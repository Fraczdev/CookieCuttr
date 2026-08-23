# CookieCuttr

Cookie Auto-Skip & Read Time


## The problem

Two tiny frictions repeat on almost every website you visit:

Cookie/consent banners. Every single site now interrupts you with a popup asking about cookies. You click "reject" (or hunt for it under "manage preferences") dozens of times a day, on every device, forever. It's the same click, over and over, for zero personal benefit.
Committing to an article blind. You click a link with no idea if it's a 2-minute read or a 20-minute one, so you either bail partway through or avoid long pieces you'd have actually wanted to read.

Neither problem is hard — they're just relentless. That's exactly the kind of thing worth automating: a few seconds, saved thousands of times.

## What this does

A lightweight extension with two content-script features and a stats popup: 

1. Auto-skip cookie banners
Recognizes ~10 major consent platforms (OneTrust, Cookiebot, Quantcast/Sourcepoint, Didomi, Osano, Termly, CookieYes, Complianz, WP Cookie Law Info, Borlabs) by their known DOM structure and clicks the reject/necessary-only control — never "accept," so it doesn't opt you into tracking on your behalf.
Falls back to a generic heuristic for unrecognized banners: finds fixed/sticky, cookie-related overlays, prefers a "reject/decline" button if one exists, and otherwise just removes the nag and restores page scroll (many banners lock scrolling until dismissed).
Runs via MutationObserver so it catches banners that load asynchronously, then stops watching after ~10s to avoid wasting CPU on pages that don't need it.
2. Reading-time badge
On article-like pages, estimates word count from the <article> element (or the largest content block it can find) and shows a small dismissible badge: "6 min read · 1,204 words" in the top-right corner.
Lets you decide before you start reading whether now is the moment, instead of scrolling to gauge length.
3. Stats + control popup
Click the toolbar icon to see how many banners have been auto-skipped, how many reading badges have been shown, and an estimated time saved.
Independent on/off toggles for each feature, plus a reset button — so the tool stays legible and controllable rather than being invisible magic.
Why 3 separate QoL improvements
Removes a repetitive click you make on nearly every site, without trading your privacy for convenience (it rejects, doesn't accept).
Gives you information you need before committing to a task (reading an article), not after.
Makes the automation visible and trustworthy via the stats popup — you can see exactly what it did and turn any part of it off.
Install & try it (Chrome / Edge / Brave)
Go to chrome://extensions
Turn on Developer mode (top-right toggle)
Click Load unpacked and select this frictionless-extension folder
Visit a few news sites — you should see cookie banners disappear on load and a read-time badge appear in the top-right of article pages
Click the extension icon in the toolbar to see live stats and toggle features
Files
manifest.json — extension config (Manifest V3)
content.js / content.css — banner detection + reading-time badge, injected into every page
background.js — service worker that persists stats to chrome.storage.local
popup.html / popup.css / popup.js — toolbar popup UI
Notes / limitations
Heuristic-based generic banner detection can't catch every possible design; the vendor-specific rules cover the platforms most sites actually use.
Reading-time estimate uses a standard 200 words/minute average and is deliberately simple rather than reader-specific.
No data leaves the browser — stats are stored locally via chrome.storage.local only.