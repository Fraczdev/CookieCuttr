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
  const markers = Array.isArray(data.readingMarkers) ? data.readingMarkers : [];
  document.querySelectorAll('.marker-slot').forEach((slot) => {
    const marker = markers[Number(slot.dataset.slot)];
    slot.querySelector('.marker-name').value = marker?.name || 'untitled';
    slot.querySelector('.marker-site').textContent = marker?.url
      ? `(${new URL(marker.url).hostname})`
      : 'Empty';
    const timestampToggle = slot.querySelector('.marker-timestamp-toggle');
    const timestampInput = slot.querySelector('.marker-timestamp');
    timestampToggle.checked = Boolean(marker?.timestampEnabled);
    timestampInput.value = marker?.timestamp || '';
    timestampInput.hidden = !timestampToggle.checked;
    slot.querySelector('.marker-return').hidden = !marker?.url;
  });
}

function loadAndRender() {
  chrome.storage.local.get(
    ['bannersBlocked', 'readBadgesShown', 'cookieSkipEnabled', 'readTimeEnabled', 'readingMarkers'],
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

  document.querySelectorAll('.marker-place').forEach((button) => button.addEventListener('click', () => {
    const slot = button.closest('.marker-slot');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      const timestampToggle = slot.querySelector('.marker-timestamp-toggle');
      const timestampInput = slot.querySelector('.marker-timestamp');
      chrome.tabs.sendMessage(tab.id, {
        type: 'ARM_READING_MARKER',
        slot: Number(slot.dataset.slot),
        timestampEnabled: timestampToggle.checked,
        timestamp: timestampInput.value.trim()
      }, () => {
        button.textContent = chrome.runtime.lastError ? 'Unavailable' : 'Click page';
        setTimeout(() => { button.textContent = 'Place'; }, 1800);
      });
    });
  }));

  document.querySelectorAll('.marker-timestamp-toggle').forEach((toggle) => toggle.addEventListener('change', () => {
    const slot = toggle.closest('.marker-slot');
    const timestampInput = slot.querySelector('.marker-timestamp');
    timestampInput.hidden = !toggle.checked;
    if (toggle.checked) timestampInput.focus();
  }));

  document.querySelectorAll('.marker-timestamp').forEach((input) => input.addEventListener('change', () => {
    const slot = input.closest('.marker-slot');
    chrome.storage.local.get(['readingMarkers'], ({ readingMarkers = [] }) => {
      const markers = [...readingMarkers];
      const marker = markers[Number(slot.dataset.slot)] || { name: 'untitled' };
      marker.timestamp = input.value.trim();
      marker.timestampEnabled = slot.querySelector('.marker-timestamp-toggle').checked;
      markers[Number(slot.dataset.slot)] = marker;
      chrome.storage.local.set({ readingMarkers: markers.slice(0, 3) });
    });
  }));

  function returnToMarker(marker) {
    chrome.runtime.sendMessage({ type: 'RETURN_TO_READING_MARKER', marker });
  }

  document.querySelectorAll('.marker-return').forEach((button) => button.addEventListener('click', () => {
    const slot = button.closest('.marker-slot');
    chrome.storage.local.get(['readingMarkers'], ({ readingMarkers = [] }) => {
      const marker = readingMarkers[Number(slot.dataset.slot)];
      if (marker?.url) returnToMarker(marker);
    });
  }));

  document.querySelectorAll('.marker-name').forEach((input) => input.addEventListener('change', () => {
    const slot = input.closest('.marker-slot');
    chrome.storage.local.get(['readingMarkers'], ({ readingMarkers = [] }) => {
      const markers = [...readingMarkers];
      const marker = markers[Number(slot.dataset.slot)] || {};
      marker.name = input.value.trim() || 'untitled';
      markers[Number(slot.dataset.slot)] = marker;
      chrome.storage.local.set({ readingMarkers: markers.slice(0, 3) });
    });
  }));

  document.getElementById('forceBadgeBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { type: 'FORCE_READ_BADGE' }, () => {
        const button = document.getElementById('forceBadgeBtn');
        if (chrome.runtime.lastError) {
          button.textContent = 'Unavailable on this page';
        } else {
          button.textContent = 'Badge shown';
        }
        setTimeout(() => { button.textContent = 'Show reading badge'; }, 1600);
      });
    });
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.storage.local.set({ bannersBlocked: 0, readBadgesShown: 0 }, loadAndRender);
  });

  chrome.storage.onChanged.addListener(() => loadAndRender());
});
