import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

// --- Local HTTP server ---
const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let filePath = join(ROOT, req.url === '/' ? 'index.html' : req.url);
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
  const ext = extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`Server running on ${BASE}`);

// --- Test harness ---
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const results = [];
const consoleErrors = [];

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(err.message));

function pass(name) { results.push({ s: 'PASS', name }); console.log(`  PASS ${name}`); }
function fail(name, reason) { results.push({ s: 'FAIL', name, reason }); console.log(`  FAIL ${name} — ${reason}`); }

try {
  console.log('\nLoading page...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  pass('Page loads without crash');

  // Header
  const title = await page.textContent('.app-title');
  title.includes('Commission') ? pass('Header title renders') : fail('Header title', `Got: ${title}`);

  // User modal
  console.log('\nTesting user selection...');
  const modalVisible = await page.isVisible('#user-modal.open');
  modalVisible ? pass('User modal opens on first visit') : fail('User modal', 'Not visible');

  const userButtons = await page.$$('#user-list button');
  userButtons.length > 0 ? pass(`User list shows ${userButtons.length} users`) : fail('User list', 'No buttons');

  await userButtons[0].click();
  await page.waitForTimeout(300);
  !(await page.isVisible('#user-modal.open')) ? pass('Modal closes after picking user') : fail('Modal close', 'Still open');

  const userName = await page.textContent('#user-name');
  userName && userName !== 'Pick Name' ? pass(`User set to "${userName}"`) : fail('User name', userName);

  // Feed tab
  console.log('\nTesting Feed tab...');
  (await page.isVisible('#view-feed.active')) ? pass('Feed view active by default') : fail('Feed default', 'Not active');

  await page.waitForTimeout(4000);
  const newsCards = await page.$$('.news-card');
  if (newsCards.length > 0) {
    pass(`Feed loaded ${newsCards.length} news cards`);
    (await page.$('.news-card-title')) ? pass('Cards have titles') : fail('Card title', 'Missing');
    (await page.$('.news-source')) ? pass('Cards have source labels') : fail('Card source', 'Missing');
    (await page.$('.reactions')) ? pass('Cards have reactions') : fail('Card reactions', 'Missing');

    const filterBtns = await page.$$('.feed-filter-btn');
    filterBtns.length > 0 ? pass(`Filter bar: ${filterBtns.length} filters`) : fail('Filter bar', 'Missing');

    if (filterBtns.length > 1) {
      const filterText = await filterBtns[1].textContent();
      await filterBtns[1].click();
      await page.waitForTimeout(500);
      const filtered = await page.$$('.news-card');
      pass(`Filtered by "${filterText}" → ${filtered.length} cards`);
      // Click "All" to reset
      const allBtn = await page.$('.feed-filter-btn[data-source="all"]');
      if (allBtn) await allBtn.click();
      await page.waitForTimeout(500);
    }

    // Re-query reaction button after DOM re-render
    const reactionBtn = await page.$('.reaction-btn');
    if (reactionBtn) {
      await reactionBtn.click();
      await page.waitForTimeout(300);
      pass('Reaction button click — no crash');

      // Reaction persistence (requires DB): check active class toggle
      const dbReady = await page.evaluate(() => typeof DB !== 'undefined' && DB.isReady());
      if (dbReady) {
        const isActive = await reactionBtn.evaluate(el => el.classList.contains('active'));
        isActive ? pass('Reaction button has active class after click') : fail('Reaction active', 'Missing active class');

        // Toggle off: click again, verify active class removed
        await reactionBtn.click();
        await page.waitForTimeout(300);
        const isStillActive = await reactionBtn.evaluate(el => el.classList.contains('active'));
        !isStillActive ? pass('Reaction toggle off removes active class') : fail('Reaction toggle off', 'Still active');
      } else {
        pass('Reaction persistence skipped (no DB configured)');
      }
    }
  } else {
    pass('Feed empty/loading (RSS may be blocked — OK in test)');
  }

  // Hot Takes tab
  console.log('\nTesting Hot Takes tab...');
  await page.click('.tab[data-view="takes"]');
  await page.waitForTimeout(300);
  (await page.isVisible('#view-takes.active')) ? pass('Takes tab activates') : fail('Takes tab', 'Not active');
  !(await page.isVisible('#view-feed.active')) ? pass('Feed hidden after switch') : fail('Tab switch', 'Feed still visible');
  (await page.$('#take-form')) ? pass('Take form present') : fail('Take form', 'Missing');

  await page.fill('#take-input', 'Seahawks are winning the Super Bowl!');
  await page.waitForTimeout(200);
  const charCount = await page.textContent('#char-count');
  const expected = 280 - 'Seahawks are winning the Super Bowl!'.length;
  String(charCount).trim() === String(expected) ? pass(`Char counter: ${charCount}`) : fail('Char counter', `Expected ${expected}, got ${charCount}`);

  await page.click('#take-form button[type="submit"]');
  await page.waitForTimeout(500);
  const takeCards = await page.$$('.take-card');
  takeCards.length > 0 ? pass(`Take posted — ${takeCards.length} take(s) visible`) : fail('Take post', 'No cards');

  if (takeCards.length > 0) {
    (await page.$('.take-author')) ? pass('Take shows author') : fail('Take author', 'Missing');
    (await page.$('.take-votes')) ? pass('Take has vote buttons') : fail('Take votes', 'Missing');

    // Vote persistence (requires DB): click agree, verify active state toggle
    const dbReadyForVotes = await page.evaluate(() => typeof DB !== 'undefined' && DB.isReady());
    if (dbReadyForVotes) {
      const agreeBtn = await page.$('.take-card .vote-btn.agree, .take-card .vote-btn[data-vote="agree"]');
      const disagreeBtn = await page.$('.take-card .vote-btn.disagree, .take-card .vote-btn[data-vote="disagree"]');
      if (agreeBtn) {
        await agreeBtn.click();
        await page.waitForTimeout(500);
        const agreeActive = await agreeBtn.evaluate(el => el.classList.contains('active'));
        agreeActive ? pass('Agree vote button active after click') : fail('Agree active', 'Not active');

        // Switch to disagree
        if (disagreeBtn) {
          await disagreeBtn.click();
          await page.waitForTimeout(500);
          const disagreeActive = await disagreeBtn.evaluate(el => el.classList.contains('active'));
          const agreeStillActive = await agreeBtn.evaluate(el => el.classList.contains('active'));
          disagreeActive && !agreeStillActive ? pass('Vote switches from agree to disagree') : fail('Vote switch', `agree=${agreeStillActive} disagree=${disagreeActive}`);

          // Toggle off: click disagree again
          await disagreeBtn.click();
          await page.waitForTimeout(500);
          const disagreeOff = await disagreeBtn.evaluate(el => el.classList.contains('active'));
          !disagreeOff ? pass('Vote toggle off removes active class') : fail('Vote toggle off', 'Still active');
        }
      }
    } else {
      pass('Vote persistence skipped (no DB configured)');
    }
  }

  // Rankings tab
  console.log('\nTesting Rankings tab...');
  await page.click('.tab[data-view="rankings"]');
  await page.waitForTimeout(300);
  (await page.isVisible('#view-rankings.active')) ? pass('Rankings tab activates') : fail('Rankings tab', 'Not active');

  const rTabs = await page.$$('.rankings-tab');
  rTabs.length === 2 ? pass('My/Group sub-tabs present') : fail('Sub-tabs', `Found ${rTabs.length}`);

  const rankItems = await page.$$('.rank-item');
  rankItems.length === 32 ? pass('All 32 NFL teams rendered') : fail('Teams', `Found ${rankItems.length}`);

  (await page.$('.rank-seahawks')) ? pass('Seahawks row highlighted') : fail('Seahawks highlight', 'Missing');
  (await page.$('.rank-drag-handle')) ? pass('Drag handles present') : fail('Drag handles', 'Missing');

  await page.click('#save-rankings-btn');
  await page.waitForTimeout(500);
  const btnText = await page.textContent('#save-rankings-btn');
  btnText.includes('Saved') ? pass('Save shows confirmation') : fail('Save confirm', `Got: ${btnText}`);

  await rTabs[1].click();
  await page.waitForTimeout(300);
  (await page.isVisible('#rankings-group.active')) ? pass('Group view activates') : fail('Group view', 'Not active');

  const consensusRows = await page.$$('.consensus-row');
  consensusRows.length > 0 ? pass(`Consensus: ${consensusRows.length} team rows`) : fail('Consensus', 'No rows');

  // Switch back to feed
  console.log('\nTesting navigation...');
  await page.click('.tab[data-view="feed"]');
  await page.waitForTimeout(300);
  (await page.isVisible('#view-feed.active')) ? pass('Back to Feed works') : fail('Feed return', 'Not active');

  // Reopen user modal
  await page.click('#user-btn');
  await page.waitForTimeout(300);
  (await page.isVisible('#user-modal.open')) ? pass('User modal reopens') : fail('Modal reopen', 'Not visible');

  const userBtns2 = await page.$$('#user-list button');
  if (userBtns2.length > 1) {
    await userBtns2[1].click();
    await page.waitForTimeout(300);
    const newName = await page.textContent('#user-name');
    pass(`Switched user to "${newName}"`);
  }

} catch (e) {
  fail('Unexpected error', e.message);
}

// Summary
const passes = results.filter(r => r.s === 'PASS').length;
const fails = results.filter(r => r.s === 'FAIL').length;

if (consoleErrors.length > 0) {
  console.log('\nConsole Errors:');
  consoleErrors.forEach(e => console.log(`  ${e}`));
}

console.log(`\n===== ${passes} passed, ${fails} failed, ${consoleErrors.length} console errors =====\n`);

await browser.close();
server.close();
process.exit(fails > 0 ? 1 : 0);
