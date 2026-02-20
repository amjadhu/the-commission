/**
 * iOS simulation tests for The Commission - Sports
 *
 * Runs the app in a Playwright browser configured to mimic an iPhone 14
 * (viewport, touch, user agent). Covers the same core flows as browser.mjs
 * but validates iOS-specific concerns: safe area meta tag, touch navigation,
 * status bar config, and mobile layout.
 *
 * Run with: npm run test:ios
 */

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
console.log(`\nServer running on ${BASE}`);
console.log('Simulating: iPhone 14 (390x844, touch, iOS Safari UA)\n');

// --- iPhone 14 device profile ---
const iPhone14 = {
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
};

const browser = await chromium.launch();
const context = await browser.newContext(iPhone14);
const page = await context.newPage();
const results = [];
const consoleErrors = [];

page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(err.message));

function pass(name) { results.push({ s: 'PASS', name }); console.log(`  PASS  ${name}`); }
function fail(name, reason) { results.push({ s: 'FAIL', name, reason }); console.log(`  FAIL  ${name} — ${reason}`); }
function skip(name, reason) { results.push({ s: 'SKIP', name }); console.log(`  SKIP  ${name} — ${reason}`); }

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  pass('App loads on iPhone viewport');

  // ── iOS-specific: meta tags ──────────────────────────────────────────────
  console.log('\n[iOS Meta / Config]');

  const viewportMeta = await page.$eval(
    'meta[name="viewport"]', el => el.getAttribute('content')
  ).catch(() => '');
  viewportMeta.includes('viewport-fit=cover')
    ? pass('viewport-fit=cover present (edge-to-edge layout)')
    : fail('viewport-fit=cover', `Got: "${viewportMeta}"`);

  // ── iOS-specific: safe area CSS ──────────────────────────────────────────
  console.log('\n[Safe Area / Status Bar]');

  const cssText = readFileSync(join(ROOT, 'css', 'style.css'), 'utf8');

  // StatusBar plugin is configured in capacitor.config.json
  const capConfig = JSON.parse(readFileSync(join(ROOT, 'capacitor.config.json'), 'utf8'));
  const sbConfig = capConfig?.plugins?.StatusBar;
  sbConfig?.overlaysWebView === false
    ? pass('StatusBar overlaysWebView=false (WebView starts below status bar)')
    : fail('StatusBar config', `overlaysWebView=${sbConfig?.overlaysWebView}`);
  sbConfig?.backgroundColor
    ? pass(`StatusBar backgroundColor set to ${sbConfig.backgroundColor}`)
    : fail('StatusBar backgroundColor', 'Not set');
  sbConfig?.style
    ? pass(`StatusBar style set to ${sbConfig.style}`)
    : fail('StatusBar style', 'Not set');

  // ── iOS-specific: programmatic StatusBar call in JS ──────────────────────
  const appJs = readFileSync(join(ROOT, 'js', 'app.js'), 'utf8');
  appJs.includes('setOverlaysWebView')
    ? pass('Programmatic StatusBar.setOverlaysWebView call present in app.js')
    : fail('setOverlaysWebView', 'Not found in app.js');
  appJs.includes('isNativePlatform')
    ? pass('Native platform guard around StatusBar call')
    : fail('isNativePlatform guard', 'Missing');

  // ── iPhone viewport layout ───────────────────────────────────────────────
  console.log('\n[Mobile Layout]');

  const vp = page.viewportSize();
  vp.width === 390 ? pass(`Viewport width: ${vp.width}px (iPhone 14)`) : fail('Viewport', `Got ${vp.width}px`);

  const header = await page.$('.app-header');
  header ? pass('App header exists') : fail('App header', 'Not found');

  if (header) {
    const box = await header.boundingBox();
    box.y >= 0 ? pass(`Header top edge: ${box.y}px (not behind status bar)`) : fail('Header position', `y=${box.y}`);
    box.width === vp.width ? pass(`Header spans full width (${box.width}px)`) : fail('Header width', `${box.width}px`);
  }

  // Tab bar fits mobile screen
  const tabBar = await page.$('.tab-bar');
  if (tabBar) {
    const tabBox = await tabBar.boundingBox();
    tabBox.width <= vp.width
      ? pass(`Tab bar fits viewport (${tabBox.width}px)`)
      : fail('Tab bar overflow', `${tabBox.width}px > ${vp.width}px`);
  }

  // No horizontal scroll
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  !hasHScroll ? pass('No horizontal scroll overflow') : fail('Horizontal scroll', 'Page wider than viewport');

  // ── Touch: user selection ────────────────────────────────────────────────
  console.log('\n[Touch: User Selection]');

  const modalOpen = await page.isVisible('#user-modal.open');
  modalOpen ? pass('User modal visible on first launch') : fail('User modal', 'Not open');

  const userBtns = await page.$$('#user-list button');
  userBtns.length > 0 ? pass(`User list: ${userBtns.length} users`) : fail('User list', 'Empty');

  if (userBtns.length > 0) {
    await userBtns[0].tap();  // use tap() for touch
    await page.waitForTimeout(400);
    !(await page.isVisible('#user-modal.open'))
      ? pass('Modal closes on tap')
      : fail('Modal tap close', 'Still open');

    const userName = await page.textContent('#user-name');
    userName && userName !== 'Pick Name'
      ? pass(`User selected: "${userName}"`)
      : fail('User name', `Got: "${userName}"`);
  }

  // ── Touch: tab navigation ────────────────────────────────────────────────
  console.log('\n[Touch: Tab Navigation]');

  const tabs = await page.$$('.tab');
  tabs.length >= 4 ? pass(`Tab bar: ${tabs.length} tabs`) : fail('Tab count', `${tabs.length}`);

  // Tap each tab and verify view switches
  const tabViews = ['takes', 'rankings', 'history', 'feed'];
  for (const view of tabViews) {
    const tab = await page.$(`.tab[data-view="${view}"]`);
    if (tab) {
      await tab.tap();
      await page.waitForTimeout(300);
      const active = await page.isVisible(`#view-${view}.active`);
      active ? pass(`Tap "${view}" tab → view activates`) : fail(`Tab "${view}"`, 'View not active');
    }
  }

  // ── Touch: reaction buttons ───────────────────────────────────────────────
  console.log('\n[Touch: Feed & Reactions]');

  await page.tap('.tab[data-view="feed"]');
  await page.waitForTimeout(4000);

  const cards = await page.$$('.news-card');
  if (cards.length > 0) {
    pass(`Feed loaded ${cards.length} news cards`);

    const reactionBtn = await page.$('.reaction-btn');
    if (reactionBtn) {
      const box = await reactionBtn.boundingBox();
      box.height >= 30
        ? pass(`Reaction button tap target: ${Math.round(box.height)}px tall (touch-friendly)`)
        : fail('Reaction tap target', `Only ${Math.round(box.height)}px — too small for touch`);

      await reactionBtn.tap();
      await page.waitForTimeout(300);
      pass('Reaction button tap — no crash');
    }
  } else {
    skip('Feed cards', 'RSS may be blocked in test env');
  }

  // ── Touch: post a take ────────────────────────────────────────────────────
  console.log('\n[Touch: Hot Takes]');

  await page.tap('.tab[data-view="takes"]');
  await page.waitForTimeout(300);

  const takeInput = await page.$('#take-input');
  takeInput ? pass('Take input field present') : fail('Take input', 'Missing');

  if (takeInput) {
    // Verify input is focusable via tap
    await takeInput.tap();
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => document.activeElement.id === 'take-input');
    focused ? pass('Take input focuses on tap') : fail('Take input focus', 'Not focused after tap');

    await page.fill('#take-input', 'Seahawks going all the way!');
    await page.waitForTimeout(200);

    const submitBtn = await page.$('#take-form button[type="submit"]');
    if (submitBtn) {
      const btnBox = await submitBtn.boundingBox();
      btnBox.height >= 36
        ? pass(`Submit button tap target: ${Math.round(btnBox.height)}px (touch-friendly)`)
        : fail('Submit tap target', `Only ${Math.round(btnBox.height)}px`);

      await submitBtn.tap();
      await page.waitForTimeout(500);
      const takesVisible = await page.$$('.take-card');
      takesVisible.length > 0 ? pass('Take posted successfully via tap') : fail('Take post', 'No cards');
    }
  }

  // ── Capacitor config sanity checks ───────────────────────────────────────
  console.log('\n[Capacitor Config]');

  capConfig.appId === 'com.jbaker00.thecommission'
    ? pass(`App ID: ${capConfig.appId}`)
    : fail('App ID', capConfig.appId);
  capConfig.appName === 'The Commission - Sports'
    ? pass(`App name: ${capConfig.appName}`)
    : fail('App name', capConfig.appName);
  capConfig.webDir === 'www'
    ? pass('webDir: www')
    : fail('webDir', capConfig.webDir);

  // ITSAppUsesNonExemptEncryption in Info.plist
  const infoPlist = readFileSync(
    join(ROOT, 'ios/App/App/Info.plist'), 'utf8'
  );
  infoPlist.includes('ITSAppUsesNonExemptEncryption') && infoPlist.includes('<false/>')
    ? pass('ITSAppUsesNonExemptEncryption=false (TestFlight auto-approval)')
    : fail('Info.plist encryption key', 'Missing or not false');

  // StatusBar plugin in Package.swift
  const packageSwift = readFileSync(
    join(ROOT, 'ios/App/CapApp-SPM/Package.swift'), 'utf8'
  );
  packageSwift.includes('CapacitorStatusBar')
    ? pass('CapacitorStatusBar in Package.swift')
    : fail('Package.swift', 'CapacitorStatusBar missing — run npm run sync');

} catch (e) {
  fail('Unexpected error', e.message);
  console.error(e);
}

// --- Summary ---
const passes = results.filter(r => r.s === 'PASS').length;
const fails  = results.filter(r => r.s === 'FAIL').length;
const skips  = results.filter(r => r.s === 'SKIP').length;

if (consoleErrors.length > 0) {
  console.log('\nConsole errors during test:');
  consoleErrors.forEach(e => console.log(`  ${e}`));
}

if (fails > 0) {
  console.log('\nFailed tests:');
  results.filter(r => r.s === 'FAIL').forEach(r => console.log(`  ✗ ${r.name}: ${r.reason}`));
}

console.log(`\n===== ${passes} passed  ${fails} failed  ${skips} skipped  ${consoleErrors.length} console errors =====\n`);

await browser.close();
server.close();
process.exit(fails > 0 ? 1 : 0);
