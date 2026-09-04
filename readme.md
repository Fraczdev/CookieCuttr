# Cookiecuttr

A web browser extension that silently rejects cookie/consent banners and shows you how long an article will take to read before you commit to it.
(Chrome / Manifest V3)

## The problem

A few problems repeat on almost every website you visit:

1. **Cookie/consent banners.** Every single site now interrupts you with a popup asking about cookies. You click "reject" (or hunt for it under "manage preferences") dozens of times a day, on every device, forever. It's the same click, over and over, for zero personal benefit.
2. **Committing to an article blind.** You click a link with no idea if it's a 2-minute read or a 20-minute one, so you either bail partway through or avoid long pieces you'd have actually wanted to read.

Neither problem is *hard* — they're just boring. That's exactly why it's a thing worth automating: a few seconds, saved thousands of times.

## What this does

A lightweight extension with two content-script features and a stats popup:

### 1. Auto-skip cookie banners
- Recognizes major consent platforms (OneTrust, Cookiebot, Quantcast/Sourcepoint, Didomi, Osano, Termly, CookieYes, Complianz, WP Cookie Law Info, Borlabs...) by their known DOM structure and clicks the **reject/necessary-only** control — never "accept," so it doesn't opt you into tracking on your behalf.
- Falls back to a generic heuristic for unrecognized banners: finds fixed/sticky, cookie-related overlays, prefers a "reject/decline" button if one exists, and otherwise just removes the nag and restores page scroll (many banners lock scrolling until dismissed).
- Runs via `MutationObserver` so it catches banners that load asynchronously, then stops watching after ~10s to avoid wasting CPU on pages that don't need it.

### 2. Reading-time badge
- On article-like pages, estimates word count from the `<article>` element (or the largest content block it can find) and shows a small dismissible badge: *"6 min read · 1,204 words"* in the top-right corner.
- Lets you decide *before* you start reading whether now is the moment, instead of scrolling to gauge length.

### 3. Reading marker
- Provides three named marker slots. Place a slot, then click the page to save its URL and scroll position.
- Restores a saved position later from that slot when you return to the matching page.

### 4. Stats + control popup
- Click the toolbar icon to see how many banners have been auto-skipped, how many reading badges have been shown, and an estimated time saved.
- Independent on/off toggles for the automation features, plus reading marker and reset controls — so the tool stays legible and controllable rather than being invisible magic.

## TODO
- Add per-site exceptions so users can keep cookie banners or hide reading features on selected domains.

## The separate improvements
1. **Removes a repetitive click** you make on nearly every site, without trading your privacy for convenience (it rejects, doesn't accept).
2. **Gives you information you need *before* committing to a task** (reading an article), not after.
3. **Lets you set placeholders** for whenever you need to take a break.
4. **Makes the automation visible and trustworthy** via the stats popup — you can see exactly what it did and turn any part of it off.

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
3. Select the `manifest.json` file inside this `frictionless-extension-firefox` folder
4. Visit a few news sites — cookie banners should disappear on load and a read-time badge should appear on article pages
5. Click the toolbar icon for live stats and feature toggles
OR
1. Go to `addons.mozilla.org`
2. Find addons -> Search for `Cookiecuttr` and install it.

Note: temporary add-ons are removed when Firefox restarts. For a permanent install during development, use `about:config` → set `xpinstall.signatures.required` to `false` on Firefox Developer Edition or Nightly, or search it on the extension marketplace for a permanent installation.
