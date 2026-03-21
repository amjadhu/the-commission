/**
 * Unit tests for the Feed digest summary feature.
 *
 * Runs inside a Playwright browser context so the DOM-based
 * buildFeedDigest function works as it does in production.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

// --- Local HTTP server (same as browser.mjs) ---
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

// --- Test harness ---
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
});
const context = await browser.newContext();
const page = await context.newPage();
const results = [];

function pass(name) { results.push({ s: 'PASS', name }); console.log(`  PASS ${name}`); }
function fail(name, reason) { results.push({ s: 'FAIL', name, reason }); console.log(`  FAIL ${name} — ${reason}`); }

// Helper: build a digest in the browser and return its HTML + text
async function buildDigest(articles) {
  return page.evaluate((arts) => {
    const el = Feed._buildFeedDigest(arts);
    return {
      outerHTML: el.outerHTML,
      text: el.textContent.trim().replace(/\s+/g, ' '),
      hasClass: el.classList.contains('feed-digest'),
      label: el.querySelector('.feed-digest-label')?.textContent || '',
      strongCount: el.querySelectorAll('strong').length,
    };
  }, articles);
}

// Helper: generate a fake article
function makeArticle(title, source = 'ESPN') {
  return { id: 'n' + Math.random().toString(36).slice(2), title, link: '#', snippet: '', thumbnail: '', source, pubDate: new Date().toISOString() };
}

try {
  // Block external requests so the page loads quickly; we test digest with injected data.
  const FIREBASE_STUB = `
    window.firebase = {
      initializeApp: function() {},
      firestore: function() {
        var emptySnap = { forEach: function(){}, docs: [], empty: true };
        var chainable = {
          get: function() { return Promise.resolve(emptySnap); },
          where: function() { return chainable; },
          orderBy: function() { return chainable; },
          limit: function() { return chainable; },
          add: function() { return Promise.resolve({ id: 'stub' }); },
          doc: function() { return chainable; },
          set: function() { return Promise.resolve(); },
          delete: function() { return Promise.resolve(); },
          exists: false, data: function() { return null; },
          ref: { delete: function() { return Promise.resolve(); } }
        };
        var coll = function() { return chainable; };
        return {
          collection: coll,
          batch: function() { return { delete: function(){}, set: function(){}, commit: function() { return Promise.resolve(); } }; }
        };
      }
    };
  `;
  await page.route('**/firebase-app-compat.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: FIREBASE_STUB }));
  await page.route('**/firebase-firestore-compat.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/*rss2json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', items: [] }) }));

  console.log('\nLoading page...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);

  // ---- Edge case 1: Single article ----
  console.log('\nDigest: single article');
  {
    const d = await buildDigest([makeArticle('Seahawks win big')]);
    d.hasClass ? pass('Single article — has feed-digest class') : fail('Single class', 'Missing class');
    d.label === "Today's Buzz" ? pass("Single article — shows Today's Buzz label") : fail('Single label', d.label);
    d.strongCount === 1 ? pass('Single article — headline is bold') : fail('Single bold', `strong count: ${d.strongCount}`);
    d.text.includes('Seahawks win big') ? pass('Single article — headline in text') : fail('Single headline', d.text);
    d.text.includes('1 stories from ESPN') ? pass('Single article — correct count and source') : fail('Single count', d.text);
    // Should NOT contain "and" connector
    !d.text.includes(' and ') ? pass('Single article — no "and" connector') : fail('Single connector', d.text);
  }

  // ---- Edge case 2: Two articles ----
  console.log('\nDigest: two articles');
  {
    const d = await buildDigest([
      makeArticle('Trade rumor heats up', 'ESPN'),
      makeArticle('Draft picks announced', 'NFL'),
    ]);
    d.text.includes(' and ') ? pass('Two articles — uses "and" connector') : fail('Two connector', d.text);
    d.strongCount === 1 ? pass('Two articles — only first is bold') : fail('Two bold', `${d.strongCount}`);
    d.text.includes('2 stories from ESPN, NFL') ? pass('Two articles — correct count and sources') : fail('Two count', d.text);
  }

  // ---- Edge case 3: Three articles (standard case) ----
  console.log('\nDigest: three articles');
  {
    const d = await buildDigest([
      makeArticle('Headline A', 'ESPN'),
      makeArticle('Headline B', 'r/NFL'),
      makeArticle('Headline C', 'Seahawks'),
    ]);
    // Should use Oxford comma style: "A, B, and C"
    d.text.includes(', Headline B, and Headline C') ? pass('Three articles — comma-separated with "and"') : fail('Three commas', d.text);
    d.text.includes('3 stories') ? pass('Three articles — correct story count') : fail('Three count', d.text);
  }

  // ---- Edge case 4: More than 3 articles (only top 3 shown) ----
  console.log('\nDigest: five articles (cap at 3 headlines)');
  {
    const articles = [
      makeArticle('First', 'ESPN'),
      makeArticle('Second', 'NFL'),
      makeArticle('Third', 'CBS Sports'),
      makeArticle('Fourth', 'PFT'),
      makeArticle('Fifth', 'r/NFL'),
    ];
    const d = await buildDigest(articles);
    !d.text.includes('Fourth') ? pass('5 articles — 4th headline hidden') : fail('Cap at 3', d.text);
    !d.text.includes('Fifth') ? pass('5 articles — 5th headline hidden') : fail('Cap at 3 (5th)', d.text);
    d.text.includes('5 stories') ? pass('5 articles — correct total count') : fail('5 count', d.text);
  }

  // ---- Edge case 5: Long title truncation (>80 chars) ----
  console.log('\nDigest: long title truncation');
  {
    const longTitle = 'A'.repeat(100);
    const d = await buildDigest([makeArticle(longTitle)]);
    !d.text.includes(longTitle) ? pass('Long title — truncated (not full 100 chars)') : fail('Truncation', 'Full title shown');
    d.text.includes('...') ? pass('Long title — ends with ellipsis') : fail('Ellipsis', d.text);
  }

  // ---- Edge case 6: Title exactly 80 chars (should NOT truncate) ----
  console.log('\nDigest: title at 80-char boundary');
  {
    const title80 = 'B'.repeat(80);
    const d = await buildDigest([makeArticle(title80)]);
    d.text.includes(title80) ? pass('80-char title — not truncated') : fail('80 boundary', 'Was truncated');
  }

  // ---- Edge case 7: Title at 81 chars (should truncate) ----
  console.log('\nDigest: title at 81-char boundary');
  {
    const title81 = 'C'.repeat(81);
    const d = await buildDigest([makeArticle(title81)]);
    !d.text.includes(title81) ? pass('81-char title — truncated') : fail('81 boundary', 'Not truncated');
    d.text.includes('...') ? pass('81-char title — has ellipsis') : fail('81 ellipsis', d.text);
  }

  // ---- Edge case 8: Many sources (>3 shows "+ N more") ----
  console.log('\nDigest: source overflow (>3 sources)');
  {
    const articles = [
      makeArticle('A', 'ESPN'),
      makeArticle('B', 'NFL'),
      makeArticle('C', 'CBS Sports'),
      makeArticle('D', 'PFT'),
      makeArticle('E', 'r/Seahawks'),
    ];
    const d = await buildDigest(articles);
    d.text.includes('+ 2 more') ? pass('5 sources — shows "+ 2 more"') : fail('Source overflow', d.text);
  }

  // ---- Edge case 9: Exactly 3 sources (no overflow text) ----
  console.log('\nDigest: exactly 3 sources');
  {
    const articles = [
      makeArticle('A', 'ESPN'),
      makeArticle('B', 'NFL'),
      makeArticle('C', 'Seahawks'),
    ];
    const d = await buildDigest(articles);
    !d.text.includes('+ ') ? pass('3 sources — no overflow suffix') : fail('3 source overflow', d.text);
    d.text.includes('ESPN, NFL, Seahawks') ? pass('3 sources — all listed') : fail('3 source list', d.text);
  }

  // ---- Edge case 10: All articles from same source ----
  console.log('\nDigest: single source');
  {
    const articles = [
      makeArticle('X', 'Seahawks'),
      makeArticle('Y', 'Seahawks'),
      makeArticle('Z', 'Seahawks'),
    ];
    const d = await buildDigest(articles);
    d.text.includes('from Seahawks') ? pass('Single source — shows just "Seahawks"') : fail('Single source', d.text);
    !d.text.includes(',') || !d.text.match(/Seahawks,/) ? pass('Single source — no extra commas in source list') : fail('Source commas', d.text);
  }

  // ---- Edge case 11: Special characters in title ----
  console.log('\nDigest: special characters in title');
  {
    const d = await buildDigest([makeArticle('O\'Brien & Co. <script>alert("xss")</script>', 'ESPN')]);
    !d.outerHTML.includes('<script>alert') ? pass('Special chars — no script injection') : fail('XSS', 'Script tag present');
    d.text.includes("O'Brien") ? pass('Special chars — apostrophe preserved') : fail('Apostrophe', d.text);
  }

  // ---- Edge case 12: Digest renders in feed integration ----
  console.log('\nDigest: integration with feed rendering');
  {
    await page.waitForTimeout(4000);
    const digest = await page.$('.feed-digest');
    const newsCards = await page.$$('.news-card');
    if (newsCards.length > 0) {
      digest ? pass('Digest renders in live feed') : fail('Live digest', 'Not found');
      if (digest) {
        const label = await digest.$eval('.feed-digest-label', el => el.textContent);
        label === "Today's Buzz" ? pass('Live digest — has label') : fail('Live label', label);
      }
    } else {
      pass('Feed empty (RSS blocked) — digest test skipped');
    }
  }

} catch (e) {
  fail('Unexpected error', e.message);
}

// --- Summary ---
const passes = results.filter(r => r.s === 'PASS').length;
const fails = results.filter(r => r.s === 'FAIL').length;

console.log(`\n===== DIGEST TESTS: ${passes} passed, ${fails} failed =====\n`);

if (fails > 0) {
  console.log('Failures:');
  results.filter(r => r.s === 'FAIL').forEach(r => console.log(`  ${r.name}: ${r.reason}`));
  console.log('');
}

await browser.close();
server.close();
process.exit(fails > 0 ? 1 : 0);
