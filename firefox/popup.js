const SECONDS_SAVED_PER_BANNER = 5; 

function formatTimeSaved(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function render(data) {
  document.getElementById('bannersBlocked').textContent = data.bannersBlocked || 0;
  document.getElementById('badgesShown').textContent = data.readBadgesShown || 0;
  document.getElementById('timeSaved').textContent =
    formatTimeSaved((data.bannersBlocked || 0) * SECONDS_SAVED_PER_BANNER);
  document.getElementById('cookieToggle').checked = data.cookieSkipEnabled !== false;
  document.getElementById('readTimeToggle').checked = data.readTimeEnabled !== false;
}

function loadAndRender() {
  chrome.storage.local.get(
    ['bannersBlocked', 'readBadgesShown', 'cookieSkipEnabled', 'readTimeEnabled'],
    render
  );
}

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();

  
  document.getElementById('cookieToggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({
      cookieSkipEnabled: enabled
    });
  });

  document.getElementById('readTimeToggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({
      readTimeEnabled: enabled
    });
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.storage.local.set({ bannersBlocked: 0, readBadgesShown: 0 }, loadAndRender);
  });

  chrome.storage.onChanged.addListener(() => loadAndRender());
});
