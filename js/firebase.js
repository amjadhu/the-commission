// Firebase configuration
// TODO: Replace with your Firebase project config from console.firebase.google.com
const FirebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

// Firebase state — initialized lazily when config is set up
let db = null;
let firebaseReady = false;

const DB = (() => {
  function init() {
    if (FirebaseConfig.apiKey === 'YOUR_API_KEY') {
      console.warn(
        'Firebase not configured. The app will work in local-only mode.\n' +
        'To enable shared features, create a Firebase project and update js/firebase.js'
      );
      return;
    }

    try {
      firebase.initializeApp(FirebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
    } catch (e) {
      console.error('Firebase init failed:', e);
    }
  }

  function isReady() {
    return firebaseReady;
  }

  // Reactions: one per user per news item per emoji
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

  async function toggleReaction(newsId, emoji, userId) {
    if (!firebaseReady) return null;
    const ref = db.collection('reactions');
    const existing = await ref
      .where('newsId', '==', newsId)
      .where('emoji', '==', emoji)
      .where('userId', '==', userId)
      .get();

    if (!existing.empty) {
      existing.forEach(doc => doc.ref.delete());
      return false; // removed
    } else {
      await ref.add({ newsId, emoji, userId, timestamp: Date.now() });
      return true; // added
    }
  }

  // Hot takes
  async function getTakes() {
    if (!firebaseReady) return [];
    const snap = await db.collection('takes')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function addTake(text, authorId) {
    if (!firebaseReady) return null;
    const ref = await db.collection('takes').add({
      text,
      authorId,
      timestamp: Date.now()
    });
    return ref.id;
  }

  // Votes on takes
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
      batch.set(ref.doc(), { takeId, vote, userId, timestamp: Date.now() });
    }
    await batch.commit();
  }

  return { init, isReady, getReactions, toggleReaction, getTakes, addTake, getVotes, castVote };
})();
