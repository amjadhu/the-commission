// Firebase configuration — replace these values with your Firebase project
// settings from the Firebase console (console.firebase.google.com).
// If left as placeholders the app will run in local-only (no shared DB) mode.
const FirebaseConfig = {
  apiKey: 'AIzaSyB0Q6Ca0U-lOt76KVW5jGraRTymkiQHxak',
  authDomain: 'the-commission-9893b.firebaseapp.com',
  projectId: 'the-commission-9893b',
  storageBucket: 'the-commission-9893b.firebasestorage.app',
  messagingSenderId: '73393302964',
  appId: '1:73393302964:web:c702245c6ced77fc98d6e1'
};

// Runtime Firebase state. `db` holds the Firestore instance once initialized.
// `firebaseReady` is set true when init() succeeds so other modules can check.
let db = null;
let firebaseReady = false;

const DB = (() => {
  // Initialize Firebase app and Firestore. This is safe to call multiple
  // times; it does a quick placeholder-check and sets `firebaseReady`.
  function init() {
    if (FirebaseConfig.apiKey === 'YOUR_API_KEY') {
      console.warn(
        'Firebase not configured. The app will work in local-only mode.\n' +
        'To enable shared features, create a Firebase project and update js/firebase.js'
      );
      return;
    }

    try {
      // Attach Firebase SDK and grab Firestore reference
      firebase.initializeApp(FirebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
      console.log('✓ Database connected: Firebase Firestore ready');
    } catch (e) {
      console.error('Firebase init failed:', e);
    }
  }

  // Returns true when Firestore is available for reads/writes.
  function isReady() {
    return firebaseReady;
  }

  // Read all reaction documents for a given news item and group them by emoji.
  // Returns an object like { '🔥': ['Alice','Bob'], '💀': ['Chris'] }
  async function getReactions(newsId) {
    if (!firebaseReady) return {};
    console.log(`[DB] Reading reactions for newsId: ${newsId}`);
    const snap = await db.collection('reactions')
      .where('newsId', '==', newsId)
      .get();
    const reactions = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (!reactions[d.emoji]) reactions[d.emoji] = [];
      reactions[d.emoji].push(d.userId);
    });
    console.log(`[DB] Got ${snap.size} reaction documents for newsId: ${newsId}`);
    return reactions;
  }

  // Toggle a user's reaction on/off. If the same reaction exists it is deleted
  // (returns false); otherwise a new reaction doc is added (returns true).
  async function toggleReaction(newsId, emoji, userId) {
    if (!firebaseReady) return null;
    console.log(`[DB] Toggling reaction: emoji=${emoji} for newsId=${newsId} by userId=${userId}`);
    const ref = db.collection('reactions');
    const existing = await ref
      .where('newsId', '==', newsId)
      .where('emoji', '==', emoji)
      .where('userId', '==', userId)
      .get();

    if (!existing.empty) {
      // Remove existing reaction (toggle off)
      existing.forEach(doc => doc.ref.delete());
      console.log(`[DB] Reaction removed`);
      return false; // removed
    } else {
      // Add new reaction
      await ref.add({ newsId, emoji, userId, timestamp: Date.now() });
      console.log(`[DB] Reaction added`);
      return true; // added
    }
  }

  // Fetch recent 'takes' (hot opinions). Returns up to 50 takes ordered by time.
  async function getTakes() {
    if (!firebaseReady) return [];
    console.log('[DB] Reading takes from database');
    const snap = await db.collection('takes')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    console.log(`[DB] Retrieved ${snap.size} takes`);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Add a new take into Firestore and return the created document id.
  async function addTake(text, authorId) {
    if (!firebaseReady) return null;
    console.log(`[DB] Adding take from userId: ${authorId}`);
    const ref = await db.collection('takes').add({
      text,
      authorId,
      timestamp: Date.now()
    });
    console.log(`[DB] Take added with id: ${ref.id}`);
    return ref.id;
  }

  // Votes are stored as individual documents. Read them and group by side.
  async function getVotes(takeId) {
    if (!firebaseReady) return { agree: [], disagree: [] };
    console.log(`[DB] Reading votes for takeId: ${takeId}`);
    const snap = await db.collection('votes')
      .where('takeId', '==', takeId)
      .get();
    const votes = { agree: [], disagree: [] };
    snap.forEach(doc => {
      const d = doc.data();
      votes[d.vote].push(d.userId);
    });
    console.log(`[DB] Got ${snap.size} vote documents for takeId: ${takeId}`);
    return votes;
  }

  // Cast a vote for a take. The implementation removes any existing vote by
  // the same user for the given take then (optionally) adds the new vote.
  // If the user clicked the same side again we interpret that as a toggle-off.
  async function castVote(takeId, vote, userId) {
    if (!firebaseReady) return;
    console.log(`[DB] Casting vote: ${vote} on takeId=${takeId} by userId=${userId}`);
    const ref = db.collection('votes');
    // Remove any existing vote by this user on this take
    const existing = await ref
      .where('takeId', '==', takeId)
      .where('userId', '==', userId)
      .get();
    const batch = db.batch();
    existing.forEach(doc => batch.delete(doc.ref));

    // Check if clicking the same vote (toggle off)
    let toggled = false;
    existing.forEach(doc => {
      if (doc.data().vote === vote) toggled = true;
    });

    if (!toggled) {
      // Add the new vote since it wasn't a toggle-off
      batch.set(ref.doc(), { takeId, vote, userId, timestamp: Date.now() });
      console.log(`[DB] Vote ${vote} added`);
    } else {
      console.log(`[DB] Vote toggle off`);
    }
    await batch.commit();
  }

  // Save a user's ranking (array of team abbreviations) to Firestore.
  async function saveRanking(userId, ranking) {
    if (!firebaseReady) return;
    console.log(`[DB] Saving ranking for userId: ${userId}`);
    await db.collection('rankings').doc(userId).set({
      ranking,
      updatedAt: Date.now()
    });
    console.log(`[DB] Ranking saved for userId: ${userId}`);
  }

  // Read a single user's ranking from Firestore.
  async function getRanking(userId) {
    if (!firebaseReady) return null;
    console.log(`[DB] Reading ranking for userId: ${userId}`);
    const doc = await db.collection('rankings').doc(userId).get();
    console.log(`[DB] Ranking ${doc.exists ? 'found' : 'not found'} for userId: ${userId}`);
    return doc.exists ? doc.data().ranking : null;
  }

  // Read all rankings. Returns { userId: [ranking], ... }
  async function getAllRankings() {
    if (!firebaseReady) return {};
    console.log('[DB] Reading all rankings from database');
    const snap = await db.collection('rankings').get();
    const result = {};
    snap.forEach(doc => {
      result[doc.id] = doc.data().ranking;
    });
    console.log(`[DB] Retrieved rankings for ${snap.size} users`);
    return result;
  }

  // Delete a take and all its associated votes.
  async function deleteTake(takeId) {
    if (!firebaseReady) return;
    console.log(`[DB] Deleting take: ${takeId}`);
    const batch = db.batch();
    batch.delete(db.collection('takes').doc(takeId));
    const votes = await db.collection('votes').where('takeId', '==', takeId).get();
    votes.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[DB] Take deleted: ${takeId} and associated votes`);
  }

  return { init, isReady, getReactions, toggleReaction, getTakes, addTake, deleteTake, getVotes, castVote, saveRanking, getRanking, getAllRankings };
})();
