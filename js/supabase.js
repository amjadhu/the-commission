// Supabase adapter for The Commission
// Configuration is loaded from window.CONFIG (set by js/config.local.js)
let supabase = null;
let supabaseReady = false;

const SUPABASE_DB = (() => {
  // Initialize Supabase client using credentials from window.CONFIG
  function init() {
    if (!window.CONFIG) {
      console.warn('Supabase config not found. Copy js/config.local.example.js to js/config.local.js and fill in your credentials.');
      return;
    }
    if (window.CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      console.warn('Supabase not configured. The app will work in local-only mode.');
      return;
    }
    try {
      // Expect a global `createClient` (if using CDN) or replace with your loader.
      if (!window.supabase || !window.supabase.createClient) {
        console.warn('Supabase client not found; include the Supabase JS SDK first.');
        return;
      }
      supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);
      supabaseReady = true;
      console.log('✓ Database connected: Supabase ready');
    } catch (e) {
      console.error('Supabase init failed:', e);
    }
  }

  function isReady() { return supabaseReady; }

  // Minimal stub implementations that mirror the DB interface used by the app.
  // Implement these using Supabase queries when ready.
  async function getReactions(newsId) {
    if (!supabaseReady) return {};
    console.log(`[DB] Reading reactions for newsId: ${newsId}`);
    // TODO: query 'reactions' table and group by emoji
    return {};
  }

  async function toggleReaction(newsId, emoji, userId) {
    if (!supabaseReady) return null;
    console.log(`[DB] Toggling reaction: emoji=${emoji} for newsId=${newsId} by userId=${userId}`);
    // TODO: implement toggle using SELECT then INSERT/DELETE
    return null;
  }

  async function getTakes() { 
    if (!supabaseReady) return []; 
    console.log('[DB] Reading takes from database');
    return []; 
  }
  async function addTake(text, authorId) { 
    if (!supabaseReady) return null; 
    console.log(`[DB] Adding take from userId: ${authorId}`);
    return null; 
  }
  async function getVotes(takeId) { 
    if (!supabaseReady) return { agree: [], disagree: [] }; 
    console.log(`[DB] Reading votes for takeId: ${takeId}`);
    return { agree: [], disagree: [] }; 
  }
  async function castVote(takeId, vote, userId) { 
    if (!supabaseReady) return; 
    console.log(`[DB] Casting vote: ${vote} on takeId=${takeId} by userId=${userId}`);
  }
  async function saveRanking(userId, ranking) { 
    if (!supabaseReady) return; 
    console.log(`[DB] Saving ranking for userId: ${userId}`);
  }
  async function getRanking(userId) { 
    if (!supabaseReady) return null; 
    console.log(`[DB] Reading ranking for userId: ${userId}`);
    return null; 
  }
  async function getAllRankings() { 
    if (!supabaseReady) return {}; 
    console.log('[DB] Reading all rankings from database');
    return {}; 
  }
  async function deleteTake(takeId) { 
    if (!supabaseReady) return; 
    console.log(`[DB] Deleting take: ${takeId}`);
  }

  return { init, isReady, getReactions, toggleReaction, getTakes, addTake, deleteTake, getVotes, castVote, saveRanking, getRanking, getAllRankings };
})();

// Alias SUPABASE_DB as DB so other modules can reference it directly
const DB = SUPABASE_DB;
