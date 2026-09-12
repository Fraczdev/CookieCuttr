# Cookiecuttr

A Chrome (Manifest V3) extension that clears cookie banners out of your way, tells you how long an article will take to read, and remembers where you left off.

## What it does

**Auto-skip cookie banners** — Recognizes the major consent platforms (OneTrust, Cookiebot, Quantcast/Sourcepoint, Didomi, Osano, Termly, CookieYes, Complianz, WP Cookie Law Info, Borlabs) and clicks reject/necessary-only for you — never "accept," so it's not opting you into tracking. For anything it doesn't recognize, it falls back: look for a fixed/sticky cookie-ish overlay, prefer a reject button if one exists, otherwise just remove the nag and unlock page scroll. It watches for about 10 seconds to catch banners that load late, then stops so it's not idling on pages that don't need it.

**Reading-time badge** — On article pages, it estimates word count and drops a small badge in the corner — "6 min read · 1,204 words" — so you know what you're getting into before you start.

**Reading marker** — Three slots for bookmarking your spot on a page (URL + scroll position, plus an optional timestamp for video or media). Come back later and it'll restore your place, even finding or reopening the tab if you'd closed it.

**Stats Popup** — Click the toolbar icon for quick stats (banners skipped, badges shown, rough time saved), toggles for each feature, and marker/reset controls.
## Installing it

**Chrome / Edge / Brave**
1. Go to `chrome://extensions`
2. Turn on Developer mode
3. Click "Load extension from zip file" and pick `cookiecuttr-chrome.zip`

(Not on the Chrome Web Store yet.)

**Firefox**

Grab it from addons.mozilla.org, where it's listed as Cookiecuttr.

## Files
- `manifest.json` — extension config (MV3)
- `content.js` / `content.css` — banner detection + reading badge, injected on every page
- `background.js` — service worker, persists stats to `chrome.storage.local`
- `popup.html` / `popup.css` / `popup.js` — the toolbar popup

## Notes
- Generic banner detection is heuristic and doesn't catch every design; The vendor-specific rules cover the platforms most sites actually use.
- Reading time is just words ÷ 200 wpm. Kept it simple on purpose.
- Nothing leaves the browser. Stats live in `chrome.storage.local` only.

## Firefox build notes

Firefox's MV3 doesn't support `service_worker` backgrounds, so it uses a background page instead. That's really the only manifest change:

```json
"background": { "scripts": ["background.js"] }
```
instead of Chrome's `"background": { "service_worker": "background.js" }`.

`background.js`, `content.js`, and the popup files are all shared as-is. The manifest also gets a `browser_specific_settings.gecko.id`, which Firefox requires for a permanent install (optional if you're just loading it temporarily for testing).