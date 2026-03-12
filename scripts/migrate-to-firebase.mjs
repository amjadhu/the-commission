#!/usr/bin/env node
// migrate-to-firebase.mjs
// Reads all data from Supabase REST API and writes it to Firestore REST API.
// Handles the snake_case → camelCase field rename and the take ID remap
// (votes reference take_id which changes when takes get new Firestore doc IDs).
//
// Run: node scripts/migrate-to-firebase.mjs

import { execSync } from 'child_process';

const SUPABASE_URL = 'https://qskwrxtczyqljjtkqzrk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hvPCz7-p0TNqeKZzNO98QQ_7tM4Ydk0';
const FIREBASE_PROJECT = 'the-commission-jb';
const FIRESTORE_BASE =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ---------- helpers ----------

let cachedToken = null;
function accessToken() {
  if (!cachedToken) {
    cachedToken = execSync('gcloud auth application-default print-access-token')
      .toString().trim();
  }
  return cachedToken;
}

async function fromSupabase(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=10000`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=none',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${await res.text()}`);
  return res.json();
}

// Convert a JS value to a Firestore REST field value
function fv(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number')           return { integerValue: String(val) };
  // Supabase returns bigint columns as strings; convert them to integers
  if (typeof val === 'string' && /^\d+$/.test(val) && val.length <= 15)
    return { integerValue: val };
  if (typeof val === 'string')           return { stringValue: val };
  if (Array.isArray(val))
    return { arrayValue: { values: val.map(fv) } };
  if (typeof val === 'object')
    return { mapValue: { fields: Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, fv(v)])
    )}};
  return { stringValue: String(val) };
}

function toDoc(obj) {
  return { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fv(v)])) };
}

// POST to collection (auto-generated ID) — returns the new Firestore doc ID
async function create(collection, obj) {
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toDoc(obj)),
  });
  if (!res.ok) throw new Error(`Firestore create ${collection}: ${await res.text()}`);
  const doc = await res.json();
  const parts = doc.name.split('/');
  return parts[parts.length - 1];
}

// PATCH to a specific doc ID (upsert/create with known ID)
async function upsert(collection, docId, obj) {
  const res = await fetch(`${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toDoc(obj)),
  });
  if (!res.ok) throw new Error(`Firestore upsert ${collection}/${docId}: ${await res.text()}`);
}

// ---------- migration steps ----------

async function migrateTakes() {
  const rows = await fromSupabase('takes');
  console.log(`  Found ${rows.length} takes in Supabase`);
  const idMap = {}; // supabaseUUID → firestoreDocId
  for (const row of rows) {
    const newId = await create('takes', {
      text:      row.text,
      authorId:  row.author_id,
      timestamp: row.timestamp,
    });
    idMap[row.id] = newId;
    process.stdout.write('.');
  }
  console.log(`\n  ✓ Migrated ${rows.length} takes`);
  return idMap;
}

async function migrateVotes(takeIdMap) {
  const rows = await fromSupabase('votes');
  console.log(`  Found ${rows.length} votes in Supabase`);
  let skipped = 0;
  for (const row of rows) {
    const firestoreTakeId = takeIdMap[row.take_id];
    if (!firestoreTakeId) {
      console.warn(`\n  ! Skipping vote ${row.id} — take ${row.take_id} not found`);
      skipped++;
      continue;
    }
    await create('votes', {
      takeId:    firestoreTakeId,
      vote:      row.vote,
      userId:    row.user_id,
      timestamp: row.timestamp,
    });
    process.stdout.write('.');
  }
  console.log(`\n  ✓ Migrated ${rows.length - skipped} votes${skipped ? ` (${skipped} skipped)` : ''}`);
}

async function migrateReactions() {
  const rows = await fromSupabase('reactions');
  console.log(`  Found ${rows.length} reactions in Supabase`);
  for (const row of rows) {
    await create('reactions', {
      newsId:    row.news_id,
      emoji:     row.emoji,
      userId:    row.user_id,
      timestamp: row.timestamp,
    });
    process.stdout.write('.');
  }
  console.log(`\n  ✓ Migrated ${rows.length} reactions`);
}

async function migrateRankings() {
  const rows = await fromSupabase('rankings');
  console.log(`  Found ${rows.length} rankings in Supabase`);
  for (const row of rows) {
    // Rankings use userId as the document ID so they're easy to look up
    await upsert('rankings', row.user_id, {
      ranking:   row.ranking,
      updatedAt: row.updated_at,
    });
    process.stdout.write('.');
  }
  console.log(`\n  ✓ Migrated ${rows.length} rankings`);
}

// ---------- main ----------

async function main() {
  console.log('=== Supabase → Firestore migration ===\n');

  console.log('Takes:');
  const takeIdMap = await migrateTakes();

  console.log('\nVotes:');
  await migrateVotes(takeIdMap);

  console.log('\nReactions:');
  await migrateReactions();

  console.log('\nRankings:');
  await migrateRankings();

  console.log('\n=== Migration complete ===');
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
