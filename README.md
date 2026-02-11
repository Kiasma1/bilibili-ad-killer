# Bilibili Ad Killer

Chrome Extension (Manifest V3) that uses DeepSeek AI to detect and skip in-video ads on Bilibili.

## How It Works

1. Intercepts Bilibili's player API response via XHR monkey-patching
2. Fetches subtitle data from the response
3. Runs a two-stage ad detection pipeline:
   - **Stage 1 — Regex pre-screen**: scans subtitles against a keyword library (builtin + user + AI-learned). On hit, extracts a ±2min context window around the match point
   - **Stage 2 — AI precise detection**: sends the context window (or full subtitles if no hit) to DeepSeek AI for accurate ad time range identification
4. Renders an ad marker on the progress bar and optionally auto-skips

When AI detects an advertiser name, it's automatically added to the keyword library for future regex hits — the system learns over time.

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                           │
│                                                                  │
│  ┌───────────────┐  tabs.onUpdated   ┌────────────────────────┐  │
│  │ background.ts │ ───────────────> │     content.ts          │  │
│  │ (Service      │  URL_CHANGED     │   (Isolated World)      │  │
│  │  Worker)      │                  │                         │  │
│  └───────────────┘                  │  - Injects inject.js    │  │
│                                     │  - Proxies storage      │  │
│  ┌───────────────┐                  │  - Relays messages      │  │
│  │  popup.tsx    │                  └──────────┬──────────────┘  │
│  │ (Extension    │                     postMessage               │
│  │  Popup UI)   │                  ┌──────────┴──────────────┐  │
│  │              │                  │     inject.ts            │  │
│  │ - Config     │                  │   (Page Context)         │  │
│  └───────────────┘                  │                         │  │
│                                     │  - XHR interception     │  │
│  ┌───────────────┐                  │  - Two-stage detection  │  │
│  │ options.tsx   │                  │  - UI rendering          │  │
│  │ (Options      │                  └─────────────────────────┘  │
│  │  Page)       │                                                │
│  │              │                                                │
│  │ - Keyword    │                                                │
│  │   library    │                                                │
│  │   CRUD       │                                                │
│  └───────────────┘                                               │
│                                                                  │
│  ┌───────────────┐                                               │
│  │chrome.storage │ <── config, ad cache, user keywords           │
│  │  .local       │                                               │
│  └───────────────┘                                               │
└──────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
                ┌────────────────────────┐
                │   External Services    │
                │   - DeepSeek AI API    │
                │   - Bilibili APIs      │
                └────────────────────────┘
```

### Module Dependency Graph

```
inject.ts  (entry point, page context)
├── config.ts              — user config management
├── constants/index.ts     — enums, timing, selectors
├── types/index.ts         — shared TypeScript types
├── toast.ts               — Toastify notification wrapper
├── util.ts                — video ID extraction
├── bilibili-ui.ts         — ad bar rendering, animations, auto-skip
│   ├── style.ts           — CSS animation definitions
│   └── services/cleanup.ts — resource tracking (observers, timers)
├── ai.ts                  — DeepSeek AI integration (OpenAI SDK)
└── services/
    ├── xhr-interceptor.ts     — monkey-patches XHR to intercept player API
    ├── subtitle.ts            — two-stage detection orchestrator
    │   └── keyword-filter.ts  — regex pre-screening (builtin + user keywords)
    └── cleanup.ts             — CleanupManager singleton

content.ts  (isolated world, no ES imports)
├── Inlined constants (MessageType, config defaults, storage keys)
└── Storage proxy for: config, ad cache, user keywords

background.ts  (service worker)
└── chrome.tabs.onUpdated listener → URL change detection

popup/App.tsx  (extension popup)
└── Config form (API key, model, switches)

options/options.tsx  (options page)
└── Keyword library management UI (CRUD, source badges)
```

### Ad Detection Flow

```
User opens Bilibili video page
         │
         ▼
┌─ inject.ts ──────────────────────────────────────────────────┐
│  XHR Interceptor catches player API response                 │
│         │                                                    │
│         ▼                                                    │
│  processVideo(response, videoId)                             │
│         │                                                    │
│         ▼                                                    │
│  detectAdFromVideo()  ← services/subtitle.ts                 │
│         │                                                    │
│    ┌────┴────┐                                               │
│    │ Login?  │── NO ──> show toast, return null               │
│    └────┬────┘                                               │
│         │ YES                                                │
│    ┌────┴─────┐                                              │
│    │ Cached?  │── YES ──> return cached AdTimeRange           │
│    └────┬─────┘                                              │
│         │ NO                                                 │
│    ┌────┴──────┐                                             │
│    │ AI ready? │── NO ──> return null                         │
│    └────┬──────┘                                             │
│         │ YES                                                │
│    ┌────┴───────────┐                                        │
│    │ Has subtitles?  │── NO ──> flash warning, return null    │
│    └────┬───────────┘                                        │
│         │ YES                                                │
│         ▼                                                    │
│  ┌─ Two-Stage Detection ──────────────────────────────────┐  │
│  │                                                        │  │
│  │  Stage 1: Regex Pre-Screen                             │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Merge builtin keywords + user keywords           │  │  │
│  │  │ Build combined regex pattern                     │  │  │
│  │  │ Scan all subtitle entries                        │  │  │
│  │  └──────────┬──────────────────────┬────────────────┘  │  │
│  │             │                      │                   │  │
│  │            HIT                   NO HIT                │  │
│  │             │                      │                   │  │
│  │             ▼                      ▼                   │  │
│  │    Extract ±2min context     Use full subtitles        │  │
│  │    window around hit point   (fallback)                │  │
│  │             │                      │                   │  │
│  │             └──────────┬───────────┘                   │  │
│  │                        ▼                               │  │
│  │  Stage 2: DeepSeek AI Analysis                         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Format subtitles + video title/description       │  │  │
│  │  │ Send to DeepSeek (JSON mode)                     │  │  │
│  │  │ Parse response → {startTime, endTime, advertiser}│  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                        │                               │  │
│  │                        ▼                               │  │
│  │  Auto-Learn: advertiser found?                         │  │
│  │  ├─ YES → save keyword + Toast "已学习: XXX"           │  │
│  │  └─ NO  → continue                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│         │                                                    │
│         ▼                                                    │
│  initializeAdBar(startTime, endTime)                         │
│  ├── Create ad marker on progress bar                        │
│  ├── Setup resize handlers                                   │
│  └── Setup auto-skip (timeupdate listener)                   │
└──────────────────────────────────────────────────────────────┘
```

### Message Flow (postMessage)

```
inject.ts (page)              content.ts (isolated)         background.ts (SW)
     │                              │                             │
     │── READY ────────────────────>│                             │
     │<──────────────── CONFIG ─────│                             │
     │── REQUEST_CACHE ────────────>│                             │
     │<──────────────── SEND_CACHE ─│                             │
     │── REQUEST_KEYWORDS ─────────>│                             │
     │<──────────── SEND_KEYWORDS ──│                             │
     │                              │                             │
     │  (during detection)          │                             │
     │── SAVE_CACHE ───────────────>│  (writes to storage)        │
     │── SAVE_KEYWORD ─────────────>│  (writes to storage)        │
     │                              │                             │
     │                              │<── URL_CHANGED ─────────────│
     │<──── URL_CHANGED ───────────-│  (forwarded)                │
```

### Key Design Decisions

**Why XHR monkey-patching?**
Bilibili's player loads subtitle metadata via XHR to `api.bilibili.com/x/player/wbi/v2`. By intercepting this request, we get subtitle URLs and video metadata without additional API calls.

**Why content.ts cannot use imports?**
Chrome loads content scripts as plain scripts, not ES modules. Vite would split shared code into chunks that fail to load. Constants needed in content.ts are inlined. inject.ts CAN use imports because Vite bundles it into a single IIFE.

**Why the chunk-inlining IIFE wrapper in vite.config.ts?**
When Vite splits shared code into a chunk, the inline-chunks plugin merges it back into inject.js. The chunk code is wrapped in its own IIFE to prevent variable name collisions between minified chunk locals and inject.js locals.

**Why two-stage detection?**
Sending all subtitles to DeepSeek AI costs significant tokens per request. The regex pre-screen catches common ad keywords first and extracts only the relevant ±2min context window, reducing token consumption substantially. When no keywords match, full subtitles are sent as a fallback to ensure nothing is missed.

**Why auto-learning keywords?**
When AI identifies an advertiser name (e.g. "某品牌"), it's automatically saved to the user's keyword library. Next time a video mentions that brand, the regex pre-screen catches it immediately — faster detection and fewer tokens.

## File Structure

```
src/
├── inject.ts                  # Page-context entry point
├── content.ts                 # Chrome isolated-world script
├── background.ts              # Service worker (URL monitoring)
├── ai.ts                      # DeepSeek AI integration
├── bilibili-ui.ts             # Ad bar, animations, auto-skip
├── config.ts                  # User config defaults
├── toast.ts                   # Toast notification wrapper
├── style.ts                   # CSS animation definitions
├── util.ts                    # Video ID extraction
├── global.d.ts                # Window/Bilibili type declarations
├── constants/
│   └── index.ts               # Enums, timing, selectors
├── types/
│   └── index.ts               # Shared TypeScript types
├── services/
│   ├── subtitle.ts            # Two-stage detection orchestrator
│   ├── keyword-filter.ts      # Regex pre-screening + context window
│   ├── xhr-interceptor.ts     # XHR monkey-patch
│   └── cleanup.ts             # Resource tracking & cleanup
├── hooks/
│   ├── useI18n.ts             # i18n hook
│   └── useChromeStorageLocal.ts
├── popup/
│   ├── App.tsx                # Popup UI (config)
│   ├── App.css
│   ├── popup.html
│   └── popup.tsx              # React entry point
├── options/
│   ├── options.html
│   └── options.tsx            # Keyword library management page
└── _locales/                  # i18n message files
    ├── en/messages.json
    └── zh_CN/messages.json
```

## Usage Guide

### Install Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **"Load unpacked"** and select the `dist` folder
4. The extension will appear in your toolbar

### Configure DeepSeek API Key

1. Go to [DeepSeek Platform](https://platform.deepseek.com/)
2. Create an API key
3. Click the extension icon in Chrome toolbar
4. Paste the API key in the config tab and save

### Manage Keyword Library

1. Right-click the extension icon → **Options** (or go to `chrome://extensions` → Details → Extension options)
2. View all keywords: builtin (gray), AI-learned (blue), manually added (green)
3. Add custom keywords, delete individual entries, or clear all user keywords

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Development server
npm run dev
```
