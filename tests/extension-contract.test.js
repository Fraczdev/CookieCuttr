const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

for (const browser of ['chrome', 'firefox']) {
  test(`${browser} content script has badge deduplication`, () => {
    const source = read(`${browser}/content.js`);
    assert.match(source, /let badgeShownForUrl = null;/);
    assert.match(source, /badgeShownForUrl === location\.href/);
    assert.match(source, /badgeShownForUrl = location\.href;/);
    assert.match(source, /badgeShownForUrl = null;/);
  });

  test(`${browser} popup exposes all feature settings`, () => {
    const html = read(`${browser}/popup.html`);
    const popup = read(`${browser}/popup.js`);
    const content = read(`${browser}/content.js`);
    const background = read(`${browser}/background.js`);
    const manifest = JSON.parse(read(`${browser}/manifest.json`));
    for (const id of ['cookieToggle', 'readTimeToggle']) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.equal((html.match(/class="marker-slot"/g) || []).length, 3);
    assert.equal((html.match(/class="marker-name"/g) || []).length, 3);
    assert.equal((html.match(/class="marker-timestamp-toggle"/g) || []).length, 3);
    assert.equal((html.match(/class="marker-timestamp"/g) || []).length, 3);
    assert.match(popup, /readingMarkers/);
    assert.match(popup, /ARM_READING_MARKER/);
    assert.match(popup, /RETURN_TO_READING_MARKER/);
    assert.match(popup, /chrome\.tabs\.query\(\{\}/);
    assert.match(popup, /chrome\.tabs\.create\(\{ url: marker\.url \}/);
    assert.match(popup, /changeInfo\.status !== 'complete'/);
    assert.ok(manifest.permissions.includes('tabs'));
    assert.match(html, /id="forceBadgeBtn"/);
    assert.match(popup, /FORCE_READ_BADGE/);
    assert.match(content, /injectReadTimeBadge\(true\)/);
    assert.match(content, /SAVE_READING_MARKER/);
    assert.match(content, /RETURN_TO_READING_MARKER/);
    assert.match(content, /message\.slot/);
    assert.match(content, /timestampEnabled/);
    assert.match(background, /readingMarkers/);
    assert.match(background, /slice\(0, 3\)/);
    assert.match(background, /'untitled'/);
  });
}

test('both browsers include the BBC consent path', () => {
  for (const browser of ['chrome', 'firefox']) {
    const source = read(`${browser}/content.js`);
    assert.match(source, /#bbccookies/);
    assert.match(source, /\[id\*="cookie" i\]/);
    assert.match(source, /el\.getAttribute\('title'\)/);
    assert.match(source, /el\.getAttribute\('name'\)/);
    assert.match(source, /i do not agree/);
    assert.match(source, /title="I do not agree" i/);
  }
});
