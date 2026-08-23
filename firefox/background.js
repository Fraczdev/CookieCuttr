
const DEFAULTS = {
  cookieSkipEnabled: true,
  readTimeEnabled: false,
  bannersBlocked: 0,
  readBadgesShown: 0,
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

  if (msg.type === 'BANNER_BLOCKED') {
    chrome.storage.local.get(['bannersBlocked'], (res) => {
      chrome.storage.local.set({ bannersBlocked: (res.bannersBlocked || 0) + 1 });
    });
  }

  if (msg.type === 'READ_BADGE_SHOWN') {
    chrome.storage.local.get(['readBadgesShown'], (res) => {
      chrome.storage.local.set({ readBadgesShown: (res.readBadgesShown || 0) + 1 });
    });
  }

  return true;
});
