# Privacy Policy for Bilibili Ad Killer

**Last Updated:** [Please update with the current date when publishing]

## Introduction

Bilibili Ad Killer ("we," "our," or "the Extension") is a Chrome browser extension designed to automatically identify and skip advertisement segments in Bilibili videos using artificial intelligence. This Privacy Policy explains how we collect, use, store, and protect your information when you use our extension.

## Information We Collect

### 1. User Configuration Data
- **API Keys**: If you choose to use Google Gemini AI services, you may provide your own API key. This key is stored locally on your device using Chrome's local storage.
- **Extension Settings**: Your preferences including:
  - AI model selection
  - Auto-skip advertisement settings
  - Video filtering preferences (e.g., ignoring videos less than 5 minutes)
  - Browser AI model usage preferences

### 2. Video Data (Temporary Processing)
- **Video Subtitles**: The extension reads subtitle data from Bilibili video pages to identify advertisement segments. Subtitles are processed in real-time and are not permanently stored.
- **Video Metadata**: Video titles and descriptions may be temporarily accessed to assist in advertisement identification. This data is used only during active video playback and is not stored.

### 3. Cached Advertisement Time Ranges
- **Advertisement Timestamps**: The extension caches the start and end times of identified advertisement segments for videos you watch. This cache is stored locally on your device and automatically expires after 3 days to improve performance and reduce redundant AI processing.

### 4. Technical Information
- **Video IDs**: Bilibili video identifiers are used to associate cached advertisement data with specific videos. These are stored locally only.

## How We Use Your Information

### Primary Function
- **Advertisement Detection**: We use AI services (either Google Gemini API or Browser AI Model) to analyze video subtitles and identify advertisement segments.
- **Automatic Skipping**: The extension automatically skips identified advertisement segments during video playback.
- **Performance Optimization**: Cached advertisement data is used to avoid redundant AI processing for videos you've previously watched.

### Data Processing
- All data processing occurs locally on your device or is sent directly to third-party AI services (Google Gemini) that you configure.
- We do not operate any servers or collect data on our own infrastructure.
- Subtitle data and video metadata are only accessed when you are actively watching videos on Bilibili.

## Data Storage

### Local Storage
All data collected by the extension is stored locally on your device using Chrome's local storage API:
- **Location**: Your browser's local storage (Chrome extension storage)
- **Access**: Only accessible by the extension itself
- **Persistence**: Data persists until you uninstall the extension or clear your browser data

### Data Retention
- **User Settings**: Retained until you change or delete them
- **Advertisement Cache**: Automatically deleted after 3 days
- **API Keys**: Retained until you remove them from the extension settings

## Third-Party Services

### Google Gemini AI
If you choose to use Google Gemini AI services:
- **Data Transmission**: Video subtitles, titles, and descriptions are sent to Google's Gemini API for processing
- **API Key**: You must provide your own Google Gemini API key
- **Privacy**: Your use of Google Gemini services is subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- **Data Handling**: We do not control how Google processes this data. Please review Google's privacy practices before using their services

### Browser AI Model (Optional)
- If you enable the Browser AI Model feature, all processing occurs locally on your device
- No data is transmitted to external servers when using this feature

## Data Sharing and Disclosure

**We do not:**
- Sell, rent, or trade your personal information
- Share your data with third parties except as necessary for the extension's core functionality (i.e., sending data to Google Gemini API when you choose to use it)
- Collect or transmit data to our own servers
- Track your browsing behavior outside of Bilibili video pages

**We may:**
- Transmit subtitle data to Google Gemini API when you use that service (you control this through your API key configuration)
- Process data locally using Browser AI Model (no external transmission)

## Your Rights and Choices

### Control Your Data
- **API Key Management**: You can add, modify, or remove your Google Gemini API key at any time through the extension's settings
- **Settings Control**: You can modify all extension settings, including auto-skip preferences and AI model selection
- **Cache Management**: Advertisement cache is automatically cleaned after 3 days, but you can clear all extension data by uninstalling the extension

### Disable the Extension
- You can disable or uninstall the extension at any time through Chrome's extension management page
- Uninstalling the extension will remove all locally stored data

## Security

We implement the following security measures:
- **Local Storage Only**: All sensitive data (including API keys) is stored locally on your device
- **No External Servers**: We do not operate any servers that collect or store your data
- **Direct API Communication**: When using Google Gemini, data is sent directly from your browser to Google's servers (not through our infrastructure)
- **Minimal Permissions**: The extension only requests permissions necessary for its core functionality

## Permissions Explanation

The extension requires the following permissions:
- **Host Permissions** (`https://www.bilibili.com/*`, `https://api.bilibili.com/*`): Required to access Bilibili video pages and subtitle data
- **Storage Permission**: Required to save your settings and advertisement cache locally on your device

## Children's Privacy

Our extension is not intended for children under the age of 13. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by:
- Updating the "Last Updated" date at the top of this policy
- Posting the new Privacy Policy in the extension's documentation

Your continued use of the extension after any changes constitutes acceptance of the updated Privacy Policy.

## International Users

If you are using the extension from outside the jurisdiction where we operate, please note that:
- Data is stored locally on your device
- If you use Google Gemini services, data may be processed in accordance with Google's data processing locations
- You are responsible for compliance with local privacy laws

## Contact Information

If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us through:
- **GitHub Repository**: [Your repository URL]
- **Issue Tracker**: [Your issue tracker URL]

## Compliance

This Privacy Policy is designed to comply with:
- Chrome Web Store Developer Program Policies
- General data protection principles
- User privacy expectations

## Summary

**Key Points:**
- ✅ All data is stored locally on your device
- ✅ No data is sent to our servers (we don't operate any)
- ✅ API keys and settings are stored locally only
- ✅ Advertisement cache expires after 3 days
- ✅ Subtitle data is processed but not permanently stored
- ✅ You control whether to use Google Gemini API services
- ✅ You can uninstall the extension at any time to remove all data

---

*This Privacy Policy is effective as of the date listed above and applies to all users of the Bilibili Ad Killer Chrome extension.*
