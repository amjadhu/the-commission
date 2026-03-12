# Commission

A web app for NFL fans to browse news feeds, post hot takes, and rank teams.

## Running locally

Open `index.html` in a browser — no build step required.

Or serve it with any static server:

```bash
npx serve .
```

## Database — Firebase Firestore

This app uses **Firebase Firestore** as the shared database for rankings, takes, and reactions. The live database is hosted in jbaker00's Firebase project (`the-commission-jb`).

- **Firebase console:** https://console.firebase.google.com/project/the-commission-jb/firestore
- **Project ID:** `the-commission-jb`
- **Admins:** jbaker00 (owner), amjad.dajma@gmail.com (Firebase admin)

The Firebase credentials are embedded directly in `js/firebase.js` — no separate config file needed. The app works out of the box without any setup.

**Note:** Without a network connection the app falls back to localStorage (local-only mode) automatically.

### Firebase project setup (if starting fresh)

If you ever need to recreate the Firebase project from scratch:

1. **Install Firebase CLI:** `npm install -g firebase-tools`

2. **Login:** `firebase login`

3. **Create project:**
   ```bash
   firebase projects:create <project-id> --display-name "The Commission"
   ```

4. **Create Firestore database:**
   ```bash
   firebase firestore:databases:create "(default)" --location nam5 --project <project-id>
   ```

5. **Deploy security rules:**
   ```bash
   firebase deploy --only firestore --project <project-id>
   ```

6. **Create a web app and get config:**
   ```bash
   firebase apps:create WEB "The Commission" --project <project-id>
   firebase apps:sdkconfig WEB <app-id>
   ```

7. **Update `js/firebase.js`** with the new project credentials.

8. **Migrate data from Supabase** (if needed):
   ```bash
   node scripts/migrate-to-firebase.mjs
   ```

### Firestore security rules

Rules are in `firestore.rules` and deployed via the Firebase CLI. The app uses open read/write rules (appropriate for a private friend-group app with no authentication):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Collections

| Collection  | Description                              |
|-------------|------------------------------------------|
| `takes`     | Hot takes — text, authorId, timestamp    |
| `votes`     | Agree/disagree votes on takes            |
| `reactions` | Emoji reactions on news articles         |
| `rankings`  | Per-user NFL team rankings (doc ID = userId) |

## RSS News Feeds

News is pulled from four sources via the [rss2json.com](https://rss2json.com) proxy:

| Source            | Feed URL                                          |
|-------------------|---------------------------------------------------|
| Seahawks Official | `https://www.seahawks.com/rss/news`               |
| ESPN NFL          | `https://www.espn.com/espn/rss/nfl/news`          |
| r/nfl             | `https://www.reddit.com/r/nfl/.rss`               |
| Pro Football Talk | `https://profootballtalk.nbcsports.com/feed/`     |

To add or swap feeds, edit the `RSS_URLS` array at the top of `js/feed.js`. Test any new URL first — rss2json.com blocks many domains and returns a silent 500 if it can't fetch a feed.

## Browser tests

The test suite uses [Playwright](https://playwright.dev/) to run 37 automated checks against the app (feed loading, user selection, reactions, hot takes, votes, rankings, navigation).

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

The test script spins up a local HTTP server automatically, runs all checks in a headless Chromium browser, then shuts everything down. You should see:

```
===== 37 passed, 0 failed, 0 console errors =====
```

## iOS app

The app is wrapped with [Capacitor](https://capacitorjs.com/) for iOS deployment.

```bash
npm run build    # copy web assets to www/
npm run sync     # build + sync to iOS project
```

Then open `ios/App/App.xcworkspace` in Xcode to build and run on device or simulator.

## Project structure

```
index.html              # Single-page app entry point
js/
  firebase.js           # Firebase Firestore adapter (active DB)
  config.local.js       # Placeholder (Firebase config lives in firebase.js)
  app.js                # App initialization
  users.js              # User selection (localStorage)
  feed.js               # RSS feed + reactions
  takes.js              # Hot takes + voting
  rankings.js           # Team rankings
  game.js               # Current game info (ESPN API)
  history.js            # Historical stats
css/
  style.css             # App styles
firebase.json           # Firebase CLI config
firestore.rules         # Firestore security rules
firestore.indexes.json  # Firestore index definitions
.firebaserc             # Links repo to the-commission-jb project
scripts/
  migrate-to-firebase.mjs  # One-time Supabase → Firestore migration script
tests/
  browser.mjs           # Playwright browser tests
  ios.mjs               # iOS-specific tests
ios/                    # Capacitor iOS project
supabase/               # Legacy — Supabase schema (no longer used)
```
