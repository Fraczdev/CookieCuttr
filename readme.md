# Cookiecuttr

Cookiecuttr is a Chrome (Manifest V3) extension that clears cookie banners from your view, tells you how long an article will take to read, and remembers where you left off.

## Features

**Auto‑skip cookie banners**. Cookiecuttr recognizes the consent platforms and clicks the reject button for you. For any banner that Cookiecuttr does not recognize, it looks for a fixed or sticky cookie‑ish overlay, prefers a reject button if one exists otherwise it simply removes the nag and unlocks page scroll. Then it watches for ten seconds to catch banners that load late then stops.

**Reading‑time badge**. On article pages Cookiecuttr estimates the word count and drops a badge in the corner. "6 Min read · 1,204 words”. So you know what you are getting into before you begin.

**Reading marker**. Cookiecuttr provides three slots for bookmarking your spot on a page (URL plus scroll position, plus an optional timestamp for video or media). When you come back later, it will restore your place even finding or reopening the tab if you had closed it.

**Stats Popup**. Click the toolbar icon for statistics (banners skipped, badges shown, approximate time saved) toggles for each feature and controls to reset markers.

## Installing it

**Chrome / Edge / Brave**

1. Go to `chrome://extensions`.

2. Turn on Developer mode.

3. Click "Load extension from zip file". Pick `cookiecuttr-chrome.zip`.

(Cookiecuttr is not on the Chrome Web Store yet.)

**Firefox**

Grab Cookiecuttr from addons.mozilla.org, where it is listed as Cookiecuttr.

## Notes

- Generic banner detection is heuristic and does not catch every design.

- Reading time is calculated as words divided by 200 words, per minute.

- Nothing leaves the browser. The statistics live in `chrome.storage.local` only.

## Firefox build notes

Firefoxs MV3 does not support `service_worker` backgrounds so Cookiecuttr uses a background page instead. That is really the only change:

```json

"background": { "scripts": ["background.js"] }

```

instead of Chromes `"background": { "service_worker": "background.js" }`.
