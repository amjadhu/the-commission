// Firebase configuration — replace these values with your Firebase project
// settings from the Firebase console (console.firebase.google.com).
// If left as placeholders the app will run in local-only (no shared DB) mode.
const FirebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
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
    const snap = await db.collection('reactions')
      .where('newsId', '==', newsId)
      .get();
    const reactions = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (!reactions[d.emoji]) reactions[d.emoji] = [];
      reactions[d.emoji].push(d.userId);
    });
    return reactions;
  }

  // Toggle a user's reaction on/off. If the same reaction exists it is deleted
  // (returns false); otherwise a new reaction doc is added (returns true).
  async function toggleReaction(newsId, emoji, userId) {
    if (!firebaseReady) return null;
    const ref = db.collection('reactions');
    const existing = await ref
      .where('newsId', '==', newsId)
      .where('emoji', '==', emoji)
      .where('userId', '==', userId)
      .get();

    if (!existing.empty) {
      // Remove existing reaction (toggle off)
      existing.forEach(doc => doc.ref.delete());
      return false; // removed
    } else {
      // Add new reaction
      await ref.add({ newsId, emoji, userId, timestamp: Date.now() });
      return true; // added
    }
  }

  // Fetch recent 'takes' (hot opinions). Returns up to 50 takes ordered by time.
  async function getTakes() {
    if (!firebaseReady) return [];
    const snap = await db.collection('takes')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Add a new take into Firestore and return the created document id.
  async function addTake(text, authorId) {
    if (!firebaseReady) return null;
    const ref = await db.collection('takes').add({
      text,
      authorId,
      timestamp: Date.now()
    });
    return ref.id;
  }

  // Votes are stored as individual documents. Read them and group by side.
  async function getVotes(takeId) {
    if (!firebaseReady) return { agree: [], disagree: [] };
    const snap = await db.collection('votes')
      .where('takeId', '==', takeId)
      .get();
    const votes = { agree: [], disagree: [] };
    snap.forEach(doc => {
      const d = doc.data();
      votes[d.vote].push(d.userId);
    });
    return votes;
  }

  // Cast a vote for a take. The implementation removes any existing vote by
  // the same user for the given take then (optionally) adds the new vote.
  // If the user clicked the same side again we interpret that as a toggle-off.
  async function castVote(takeId, vote, userId) {
    if (!firebaseReady) return;
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
    }
    await batch.commit();
  }

  return { init, isReady, getReactions, toggleReaction, getTakes, addTake, getVotes, castVote };
})();
