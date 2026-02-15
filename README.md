# Commission

A web app for NFL fans to browse news feeds, post hot takes, and rank teams.

## Running locally

Open `index.html` in a browser — no build step required.

## Browser tests

The test suite uses [Playwright](https://playwright.dev/) to run 32 automated checks against the app (feed loading, user selection, hot takes, rankings, navigation).

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Setup (one time)

```bash
npm install
npx playwright install chromium
```

### Run tests

```bash
npm test
```

The test script spins up a local HTTP server automatically, runs all checks in a headless Chromium browser, then shuts everything down. You should see output like:

```
===== 32 passed, 0 failed, 0 console errors =====
```
