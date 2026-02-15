# The Commission — Copilot Instructions

A vanilla JavaScript web app for Seahawks fans to share news reactions and hot takes. Uses Firebase for real-time data sync, falls back to localStorage when Firebase is unconfigured.

## Architecture

**Module pattern with revealing module pattern**
- Each JS file exports one module via IIFE (Immediately Invoked Function Expression)
- Modules expose only necessary functions through `return { ... }`
- Private state lives in closure scope (e.g., `current` in Users, `db` in DB)

**Initialization flow**
1. `app.js` coordinates: calls `init()` on each module in dependency order
2. `DB.init()` first — may enable Firebase or stay local-only
3. `Users.init()` — loads persisted identity or prompts for selection
4. `Feed.init()` and `Takes.init()` — load content, set up UI

**Data persistence strategy**
- Firebase path: `DB.isReady()` → Firestore collections (`reactions`, `takes`, `votes`)
- Local-only path: localStorage keys (`commission_user`, `commission_takes`)
- All Firebase methods check `firebaseReady` flag and gracefully degrade

**Feed architecture**
- Fetches multiple RSS sources in parallel via `Promise.allSettled`
- Uses rss2json.com public API to convert RSS to JSON (CORS-friendly)
- Deduplicates by normalized title, sorts by date, limits to 20 items
- Each article gets stable ID via `hashString()` for reactions

**Reactions & votes**
- Stored as individual documents in Firestore (not embedded arrays)
- Toggle behavior: clicking same reaction/vote removes it
- UI marks active state when current user has reacted/voted
- Methods return grouped data: `{ emoji: [userId, ...] }` or `{ agree: [], disagree: [] }`

## Key Conventions

**Module communication**
- Modules access each other via global objects: `DB`, `Users`, `Feed`, `Takes`
- No imports/exports — relies on script load order in `index.html`
- Script order matters: `firebase.js` → `users.js` → `feed.js` → `takes.js` → `app.js`

**User identity**
- Hardcoded friend group in `users.js` → `GROUP` array
- Selected name persists in localStorage, used as `userId` throughout
- User selection modal blocks posting/reacting until name chosen

**Firebase config**
- `FirebaseConfig` object at top of `firebase.js` contains placeholder strings
- App detects placeholders (`apiKey === 'YOUR_API_KEY'`) and runs local-only
- Firebase SDK loaded from CDN (check `index.html` if updating versions)

**Styling & DOM**
- CSS uses BEM-like naming: `.news-card`, `.news-card-title`, `.take-form-footer`
- Tab switching via `.active` class toggling on `.tab` and `.view` elements
- Modal overlay uses `.modal.open` class pattern
- Loading/empty states handled via inline messages in card lists

**ID generation**
- News articles: `hashString(link || title)` → `'n' + base36`
- Takes (local): `'t' + Date.now()`
- Takes (Firebase): auto-generated document ID from Firestore

**Timestamps**
- Store as `Date.now()` (milliseconds since epoch)
- Display via `timeAgo()` helper: "5m ago", "2h ago", "3d ago"

## Firebase Collections Schema

If Firebase is configured, these collections are used:

**reactions**
```
{ newsId: string, emoji: string, userId: string, timestamp: number }
```

**takes**
```
{ text: string, authorId: string, timestamp: number }
```

**votes**
```
{ takeId: string, vote: 'agree'|'disagree', userId: string, timestamp: number }
```

## Deployment

Deploys to GitHub Pages on push to `main` branch.
- Static site (no build step) — all files served as-is
- Workflow: `.github/workflows/deploy.yml`
- No Node.js, package.json, or build commands

## Adding Features

**New RSS source**: Add URL to `RSS_URLS` array in `feed.js`

**New reaction emoji**: Add to `EMOJIS` array in `feed.js`

**New user**: Add name to `GROUP` array in `users.js`

**Firebase integration**: Replace placeholders in `FirebaseConfig` with project values from Firebase Console, then include Firebase SDK scripts in `index.html` (currently expects CDN links)
