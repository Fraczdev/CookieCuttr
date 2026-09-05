
const DEFAULTS = {
  cookieSkipEnabled: true,
  readTimeEnabled: false,
  bannersBlocked: 0,
  readBadgesShown: 0,
  readingMarkers: [],
  installedAt: Date.now()
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULTS), (existing) => {
    const toSet = {};
    for (const key of Object.keys(DEFAULTS)) {
      if (existing[key] === undefined) toSet[key] = DEFAULTS[key];
    }
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'RETURN_TO_READING_MARKER' && msg.marker?.url) {
    returnToReadingMarker(msg.marker);
  }

  if (msg.type === 'SAVE_READING_MARKER' && msg.marker?.url) {
    chrome.storage.local.get(['readingMarkers'], ({ readingMarkers = [] }) => {
      const markers = Array.isArray(readingMarkers) ? [...readingMarkers] : [];
      const slot = Math.min(2, Math.max(0, Number(msg.marker.slot) || 0));
      const previous = markers[slot] || {};
      markers[slot] = {
        name: typeof previous.name === 'string' && previous.name.trim() ? previous.name.trim() : 'untitled',
        url: String(msg.marker.url),
        x: Math.max(0, Number(msg.marker.x) || 0),
        y: Math.max(0, Number(msg.marker.y) || 0),
        timestampEnabled: Boolean(msg.marker.timestampEnabled),
        timestamp: typeof msg.marker.timestamp === 'string' ? msg.marker.timestamp.slice(0, 12) : '',
        savedAt: Date.now()
      };
      chrome.storage.local.set({ readingMarkers: markers.slice(0, 3) });
    });
  }

  if (msg.type === 'BANNER_BLOCKED') incrementStat('bannersBlocked');
  if (msg.type === 'READ_BADGE_SHOWN') incrementStat('readBadgesShown');

  return true;
});

function sendMarkerToTab(tabId, marker, attempts = 0) {
  chrome.tabs.sendMessage(tabId, { type: 'RETURN_TO_READING_MARKER', marker }, () => {
    if (chrome.runtime.lastError && attempts < 10) {
      setTimeout(() => sendMarkerToTab(tabId, marker, attempts + 1), 250);
    }
  });
}

function returnToReadingMarker(marker) {
  chrome.tabs.query({}, (tabs) => {
    const existingTab = tabs.find((tab) => tab.url === marker.url && tab.id);
    if (existingTab) {
      chrome.tabs.update(existingTab.id, { active: true }, () => sendMarkerToTab(existingTab.id, marker));
      return;
    }

    const onUpdated = (tabId, changeInfo) => {
      if (tabId !== pendingTabId || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      sendMarkerToTab(tabId, marker);
    };
    let pendingTabId = null;
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.create({ url: marker.url }, (newTab) => {
      pendingTabId = newTab?.id || null;
      if (!pendingTabId) chrome.tabs.onUpdated.removeListener(onUpdated);
    });
  });
}

const pendingStats = new Map();
let statsFlushTimer = null;

function incrementStat(key) {
  pendingStats.set(key, (pendingStats.get(key) || 0) + 1);
  if (statsFlushTimer) return;
  statsFlushTimer = setTimeout(flushStats, 100);
}

function flushStats() {
  statsFlushTimer = null;
  const increments = new Map(pendingStats);
  pendingStats.clear();
  const keys = [...increments.keys()];
  chrome.storage.local.get(keys, (res) => {
    const next = {};
    for (const key of keys) next[key] = (Number(res[key]) || 0) + increments.get(key);
    chrome.storage.local.set(next);
  });
  if (pendingStats.size) statsFlushTimer = setTimeout(flushStats, 100);
}


