# Readability Refactor Design

## Goal
Improve codebase readability and maintainability without changing any functionality.

## New File Structure
```
src/
├── types/index.ts              # Shared type definitions
├── constants/index.ts          # Named constants, enums, selectors
├── services/
│   ├── xhr-interceptor.ts      # XHR interception logic
│   ├── subtitle.ts             # Subtitle fetching & ad detection
│   ├── url-monitor.ts          # SPA URL change monitoring
│   └── cleanup.ts              # Resource cleanup manager
├── ai.ts                       # AI integration (deduplicated prompts)
├── bilibili-ui.ts              # UI rendering (cleanup logic removed)
├── config.ts                   # Single source of config defaults
├── content.ts                  # Content script (uses constants)
├── inject.ts                   # Slim entry point (~50 lines)
├── toast.ts                    # Toast notifications
├── style.ts                    # Animation styles (deduplicated)
├── util.ts                     # Utility functions
├── global.d.ts                 # Enhanced type declarations
├── hooks/                      # React hooks (unchanged)
└── popup/
    ├── App.tsx                 # Import path updated
    ├── config.ts               # DELETED (merged into ../config.ts)
    └── ...
```

## Key Changes
1. Extract types/index.ts and constants/index.ts
2. Split inject.ts (271 lines) into 4 focused modules
3. Delete popup/config.ts, unify config source
4. Deduplicate AI prompt templates
5. Deduplicate animation style generation
6. Enhance global.d.ts to eliminate @ts-ignore
7. Replace all magic numbers with named constants
