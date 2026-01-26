## Description

Bilibili Ad Killer is a Chrome extension that automatically detects and skips advertisement segments in Bilibili videos using AI-powered subtitle analysis. The extension monitors video subtitles in real-time, uses Google Gemini AI to identify ad content by analyzing subtitle text, and provides an automatic skip button to jump over advertisement segments, allowing users to enjoy uninterrupted video viewing.

Key features:
- **AI-Powered Detection**: Uses Google Gemini AI to intelligently identify advertisement content by analyzing video subtitles, titles, and descriptions
- **Automatic Skip**: Displays a skip button when ads are detected, allowing users to quickly jump over advertisement segments
- **Smart Caching**: Remembers ad time ranges for previously analyzed videos to avoid redundant AI processing
- **Configurable**: Users can configure their Google Gemini API key, choose AI models, enable/disable auto-skip, and set preferences for video duration filtering

This extension enhances the Bilibili viewing experience by eliminating the need to manually skip through advertisement segments, saving time and providing a smoother video watching experience.

## Single purpose

The extension has a single, narrow purpose: to automatically detect and skip advertisement segments in Bilibili videos by analyzing video subtitles using AI technology. The extension only operates on Bilibili video pages and does not modify or interact with any other websites or content.

## Permission justification

**Host Permissions:**
- `https://www.bilibili.com/*`: Required to access Bilibili video pages where the extension monitors subtitles and injects the skip functionality
- `https://api.bilibili.com/*`: Required to intercept API requests from Bilibili's player API (`api.bilibili.com/x/player/wbi/v2`) to access video subtitle data, which is essential for AI-based ad detection

**Storage Permission:**
- `storage`: Required to save user configuration settings including Google Gemini API key, AI model preferences, auto-skip settings, and cached ad time ranges for videos. This data is stored locally and never transmitted to third-party servers.

**Web Accessible Resources:**
- `inject.js`, `lib/toastify.min.js`, `lib/toastify.min.css`: Required to inject the ad detection and skip functionality into Bilibili video pages. These resources are only accessible on `https://www.bilibili.com/*` domains and are necessary for the extension's core functionality.

All permissions are directly necessary for the extension's single purpose of detecting and skipping ads in Bilibili videos. No unnecessary permissions are requested.