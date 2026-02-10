# Bilibili Ad Killer

Chrome Extension (Manifest V3) that uses Gemini AI to detect and skip in-video ads on Bilibili.

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
│                                                                 │
│  ┌──────────────┐   tabs.onUpdated    ┌──────────────────────┐  │
│  │ background.ts│ ──────────────────> │    content.ts         │  │
│  │ (Service     │   URL_CHANGED       │  (Isolated World)     │  │
│  │  Worker)     │                     │                       │  │
│  └──────────────┘                     │  - Injects inject.js  │  │
│                                       │  - Proxies storage    │  │
│  ┌──────────────┐                     │  - Relays messages    │  │
│  │  popup.tsx   │                     └───────┬───────────────┘  │
│  │ (Extension   │                        postMessage              │
│  │  Popup UI)   │                     ┌───────┴───────────────┐  │
│  │              │                     │    inject.ts           │  │
│  │ - Config     │                     │  (Page Context)        │  │
│  │ - Learned    │                     │                       │  │
│  │   Rules Mgmt │                     │  - XHR interception   │  │
│  └──────────────┘                     │  - Ad detection flow  │  │
│                                       │  - UI rendering       │  │
│  ┌──────────────┐                     └───────────────────────┘  │
│  │chrome.storage│ <── config, cache, learned rules               │
│  │   .local     │                                                │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (Gemini API / Danmaku API)
                              ▼
                 ┌──────────────────────┐
                 │  External Services   │
                 │  - Google Gemini AI  │
                 │  - Bilibili APIs     │
                 └──────────────────────┘
```

### Module Dependency Graph

```
inject.ts  (entry point, page context)
├── config.ts              — user config management
├── constants/index.ts     — enums, timing, selectors, regex patterns
├── types/index.ts         — shared TypeScript types
├── toast.ts               — Toastify notification wrapper
├── util.ts                — subtitle formatting, video ID extraction
├── bilibili-ui.ts         — ad bar rendering, animations, auto-skip
│   ├── style.ts           — CSS animation definitions
│   └── services/cleanup.ts — resource tracking (observers, timers)
├── ai.ts                  — Gemini AI / Browser AI integration
│   └── (Google GenAI SDK)
└── services/
    ├── xhr-interceptor.ts     — monkey-patches XHR to intercept player API
    ├── subtitle.ts            — core detection orchestrator (Route A / B)
    │   ├── ad-filter.ts       — local regex pre-screening + self-learning
    │   ├── subtitle-compressor.ts — subtitle merging & deduplication
    │   └── danmaku.ts         — danmaku fetch, window extraction, formatting
    └── cleanup.ts             — CleanupManager singleton

content.ts  (isolated world, no ES imports)
├── Inlined constants (MessageType, config defaults, storage keys)
└── Storage proxy for: config, ad cache, learned rules

background.ts  (service worker)
└── chrome.tabs.onUpdated listener → URL change detection

popup/App.tsx  (extension popup)
├── Config form (API key, model, switches)
└── Learned rules management UI
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
│    ┌────┴──────────┐                                         │
│    │ Has subtitles? │                                        │
│    └──┬─────────┬──┘                                         │
│       │         │                                            │
│      YES        NO                                           │
│       │         │                                            │
│       ▼         ▼                                            │
│   Route A    Route B                                         │
│                                                              │
│   ┌─ Route A: Subtitle ──────┐  ┌─ Route B: Danmaku ──────┐ │
│   │ 1. Fetch subtitle JSON   │  │ 1. Get cid               │ │
│   │ 2. Regex pre-screen      │  │ 2. Fetch danmaku XML     │ │
│   │    ├─ Group into segments │  │ 3. Regex pre-screen      │ │
│   │    │  (gap ≤5s = same ad) │  │    ├─ NO HIT → no ads    │ │
│   │    ├─ Any seg ≥30s?       │  │    └─ HIT → continue     │ │
│   │    │  YES → return range  │  │ 4. Extract time window   │ │
│   │    │  NO  → continue      │  │ 5. Send to Gemini AI     │ │
│   │    └─ No hits → continue  │  │ 6. Save advertiser rule  │ │
│   │ 3. Compress subtitles    │  └──────────────────────────┘ │
│   │ 4. Send to Gemini AI     │                               │
│   │ 5. Save advertiser rule  │                               │
│   └──────────────────────────┘                               │
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
     │── REQUEST_LEARNED_RULES ────>│                             │
     │<──── SEND_LEARNED_RULES ─────│                             │
     │                              │                             │
     │  (during detection)          │                             │
     │── SAVE_CACHE ───────────────>│  (writes to storage)        │
     │── SAVE_LEARNED_RULE ────────>│  (writes to storage)        │
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
When Vite splits shared code (config, constants, types) into a chunk (index.js), the inline-chunks plugin merges it back into inject.js. The chunk code is wrapped in its own IIFE to prevent variable name collisions with the Google GenAI SDK (both use minified single-letter variable names like `_`, `r`, `s`).

**Why two detection routes?**
Many Bilibili videos lack subtitles (especially older or user-uploaded content). Route B uses danmaku (viewer comments) as a fallback signal — viewers often comment "ad", "skip", etc. during sponsored segments.

**Why local regex pre-screening?**
Sending all subtitles/danmaku to Gemini AI costs ~2000 tokens per request. Built-in regex patterns catch common ad keywords (广告, 恰饭, 感谢赞助, etc.). Hits are grouped into contiguous segments (gap ≤5s = same ad). Segments ≥30s are returned directly (zero tokens). Shorter hits are forwarded to AI since they may be false positives (normal content mentioning ad-related words). Self-learning rules accumulate advertiser names from AI responses, growing the regex pool over time.

**Why subtitle compression?**
Raw subtitles can be 200+ entries. The compressor merges them into 30-second windows, filters filler words, and deduplicates — reducing token consumption by ~60%.

## File Structure

```
src/
├── inject.ts                  # Page-context entry point
├── content.ts                 # Chrome isolated-world script
├── background.ts              # Service worker (URL monitoring)
├── ai.ts                      # Gemini AI integration
├── bilibili-ui.ts             # Ad bar, animations, auto-skip
├── config.ts                  # User config defaults
├── toast.ts                   # Toast notification wrapper
├── style.ts                   # CSS animation definitions
├── util.ts                    # Subtitle formatting, video ID
├── global.d.ts                # Window/Bilibili type declarations
├── constants/
│   └── index.ts               # Enums, timing, selectors, patterns
├── types/
│   └── index.ts               # Shared TypeScript types
├── services/
│   ├── subtitle.ts            # Detection orchestrator (Route A/B)
│   ├── ad-filter.ts           # Regex pre-screening + self-learning
│   ├── subtitle-compressor.ts # Subtitle merging & dedup
│   ├── danmaku.ts             # Danmaku fetch & parse
│   ├── xhr-interceptor.ts     # XHR monkey-patch
│   └── cleanup.ts             # Resource tracking & cleanup
├── hooks/
│   ├── useI18n.ts             # i18n hook
│   └── useChromeStorageLocal.ts
├── popup/
│   ├── App.tsx                # Popup UI (config + learned rules)
│   ├── App.css
│   └── popup.tsx              # React entry point
└── _locales/                  # i18n message files
```

## Usage Guide

### Install Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **"Load unpacked"** and select `dist` folder
4. The extension will appear in your toolbar

### Apply Google Gemini API Key

- Go to [Google AI Studio](https://aistudio.google.com/)
- Click the "Get API Key" button at the left bottom corner of the left sidebar menu
- Click the "Create API Key" button at the top right corner of the page
- Following the instructions to create a new API key
- Copy the API key and paste it in the extension popup page

## Development Guide

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run development server

```bash
npm run dev
```

### Run tests

```bash
npm run test:ai
npm run test:dom
```
