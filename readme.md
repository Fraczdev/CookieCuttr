# Cookiecuttr

A browser extension that gets cookie banners out of the way, gives you a quick reading estimate, and lets you save your place in an article.
(Chrome / Manifest V3)

## The problem

A few small problems get in the way of reading online:

1. **Cookie/consent banners.** Sites interrupt the page with a consent popup. Finding the reject or necessary-only option is often harder than it should be.
2. **Committing to an article blind.** A link rarely tells you whether the article is a two-minute read or a twenty-minute read. That makes it easy to start something you cannot finish.
3. **Losing your place.** If you close an article, switch tabs, or need to stop reading, it is not always easy to find the same paragraph again later.

CookieCuttr handles these repetitive parts so you can spend less time managing pages and more time reading them.

## What this does

A lightweight extension with three content-script features and a stats popup:

### 1. Auto-skip cookie banners
- Recognizes major consent platforms (OneTrust, Cookiebot, Quantcast/Sourcepoint, Didomi, Osano, Termly, CookieYes, Complianz, WP Cookie Law Info, Borlabs...) by their known DOM structure and clicks the **reject/necessary-only** control — never "accept," so it doesn't opt you into tracking on your behalf.
- Falls back to a generic heuristic for unrecognized banners: finds fixed/sticky, cookie-related overlays, prefers a "reject/decline" button if one exists, and otherwise just removes the nag and restores page scroll (many banners lock scrolling until dismissed).
- Runs via `MutationObserver` so it catches banners that load asynchronously, then stops watching after ~10s to avoid wasting CPU on pages that don't need it.

### 2. Reading-time badge
- On article-like pages, estimates word count from the `<article>` element (or the largest content block it can find) and shows a small dismissible badge: *"6 min read · 1,204 words"* in the top-right corner.
- Lets you decide *before* you start reading whether now is the moment, instead of scrolling to gauge length.

### 3. Reading marker
- Provides three named marker slots. Place a slot, then click anywhere on the page to save its URL and scroll position.
- Each slot can store an optional timestamp, which is useful for video pages or media articles.
- Restores a saved position later, even if the original tab was closed. CookieCuttr finds the matching tab or opens the page again.

### 4. Stats + control popup
- Click the toolbar icon to see how many banners have been auto-skipped, how many reading badges have been shown, and an estimated time saved.
- Independent on/off toggles for the automation features, plus reading marker and reset controls — so the tool stays legible and controllable rather than being invisible magic.

## TODO
- Add per-site exceptions so users can keep cookie banners or hide reading features on selected domains.

## The separate improvements
1. **Removes a repetitive click** without accepting tracking cookies on your behalf.
2. **Shows the likely reading time before you start**, so you can choose an article that fits the time you have.
3. **Saves your place when you need to stop**, and brings you back to it later even if the tab is gone.
4. **Keeps the automation visible** through local stats and controls in the popup.

## Try it (Chrome / Edge / Brave)
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load extension from zip file** and select this `cookiecuttr-chrome` or `cookiecuttr-firefox` zip files in releases, depending on your browser.
OR
2. Visit the chrome extension marketplace, and search for 'Cookiecuttr', and install it.
3. Visit a few news sites — you should see cookie banners disappear on load and a read-time badge appear in the top-right of article pages
4. Click the extension icon in the toolbar to see live stats and toggle features

## Files
- `manifest.json` — extension config (Manifest V3)
- `content.js` / `content.css` — banner detection + reading-time badge, injected into every page
- `background.js` — service worker that persists stats to `chrome.storage.local`
- `popup.html` / `popup.css` / `popup.js` — toolbar popup UI

## Notes / limitations
- Heuristic-based generic banner detection can't catch every possible design; the vendor-specific rules cover the platforms most sites actually use.
- Reading-time estimate uses a standard 200 words/minute average and is deliberately simple rather than reader-specific.
- No data leaves the browser — stats are stored locally via `chrome.storage.local` only.

## Firefox build — differences from the Chrome version
Firefox's Manifest V3 doesn't support the `service_worker` background type; it uses a background page instead. The only change is in `manifest.json`:

```json
"background": { "scripts": ["background.js"] }
```
instead of Chrome's `"background": { "service_worker": "background.js" }`. `background.js`, `content.js`, and the popup files are unchanged — Firefox supports the `chrome.*` callback API natively as well as its own promise-based `browser.*` API, so no other code changes were needed.

A `browser_specific_settings.gecko.id` was added, which Firefox requires for permanent installs (it's optional for temporary loading below).

### Try it (Firefox)
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside this `cookiecuttr-firefox` folder
4. Visit a few news sites — cookie banners should disappear on load and a read-time badge should appear on article pages
5. Click the toolbar icon for live stats and feature toggles
OR
1. Go to `addons.mozilla.org`
2. Find addons -> Search for `Cookiecuttr` and install it.

Note: temporary add-ons are removed when Firefox restarts. For a permanent install during development, use `about:config` → set `xpinstall.signatures.required` to `false` on Firefox Developer Edition or Nightly, or search it on the extension marketplace for a permanent installation.