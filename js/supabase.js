// Supabase adapter for The Commission
// Configuration is loaded from window.CONFIG (set by js/config.local.js)
let supabase = null;
let supabaseReady = false;

const SUPABASE_DB = (() => {
  // Initialize Supabase client using credentials from window.CONFIG
  function init() {
    if (!window.CONFIG) {
      console.warn('Supabase config not found. Copy config.local.example.js to config.local.js and fill in your credentials.');
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

  // Read all reactions for a news item, grouped by emoji.
  // Returns { '🔥': ['Alice','Bob'], '💀': ['Chris'] }
  async function getReactions(newsId) {
    if (!supabaseReady) return {};
    console.log(`[DB] Reading reactions for newsId: ${newsId}`);
    const { data, error } = await supabase
      .from('reactions')
      .select('emoji, user_id')
      .eq('news_id', newsId);
    if (error) { console.error('[DB] getReactions error:', error); return {}; }
    const reactions = {};
    for (const row of data) {
      if (!reactions[row.emoji]) reactions[row.emoji] = [];
      reactions[row.emoji].push(row.user_id);
    }
    console.log(`[DB] Got ${data.length} reaction rows for newsId: ${newsId}`);
    return reactions;
  }

  // Toggle a reaction on/off. Returns true if added, false if removed.
  async function toggleReaction(newsId, emoji, userId) {
    if (!supabaseReady) return null;
    console.log(`[DB] Toggling reaction: emoji=${emoji} for newsId=${newsId} by userId=${userId}`);
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('news_id', newsId)
      .eq('emoji', emoji)
      .eq('user_id', userId);

    if (existing && existing.length > 0) {
      await supabase.from('reactions').delete().eq('id', existing[0].id);
      console.log('[DB] Reaction removed');
      return false;
    } else {
      await supabase.from('reactions').insert({
        news_id: newsId, emoji, user_id: userId, timestamp: Date.now()
      });
      console.log('[DB] Reaction added');
      return true;
    }
  }

  // Fetch recent takes ordered by timestamp desc, limit 50.
  async function getTakes() {
    if (!supabaseReady) return [];
    console.log('[DB] Reading takes from database');
    const { data, error } = await supabase
      .from('takes')
      .select('id, text, author_id, timestamp')
      .order('timestamp', { ascending: false })
      .limit(50);
    if (error) { console.error('[DB] getTakes error:', error); return []; }
    console.log(`[DB] Retrieved ${data.length} takes`);
    return data.map(row => ({ id: row.id, text: row.text, authorId: row.author_id, timestamp: row.timestamp }));
  }

  // Add a new take and return its id.
  async function addTake(text, authorId) {
    if (!supabaseReady) return null;
    console.log(`[DB] Adding take from userId: ${authorId}`);
    const { data, error } = await supabase
      .from('takes')
      .insert({ text, author_id: authorId, timestamp: Date.now() })
      .select('id')
      .single();
    if (error) { console.error('[DB] addTake error:', error); return null; }
    console.log(`[DB] Take added with id: ${data.id}`);
    return data.id;
  }

  // Read votes for a take, grouped into { agree: [...], disagree: [...] }.
  async function getVotes(takeId) {
    if (!supabaseReady) return { agree: [], disagree: [] };
    console.log(`[DB] Reading votes for takeId: ${takeId}`);
    const { data, error } = await supabase
      .from('votes')
      .select('vote, user_id')
      .eq('take_id', takeId);
    if (error) { console.error('[DB] getVotes error:', error); return { agree: [], disagree: [] }; }
    const votes = { agree: [], disagree: [] };
    for (const row of data) {
      if (votes[row.vote]) votes[row.vote].push(row.user_id);
    }
    console.log(`[DB] Got ${data.length} vote rows for takeId: ${takeId}`);
    return votes;
  }

  // Cast a vote. Toggle off if same vote exists, otherwise switch.
  async function castVote(takeId, vote, userId) {
    if (!supabaseReady) return;
    console.log(`[DB] Casting vote: ${vote} on takeId=${takeId} by userId=${userId}`);
    const { data: existing } = await supabase
      .from('votes')
      .select('id, vote')
      .eq('take_id', takeId)
      .eq('user_id', userId);

    if (existing && existing.length > 0) {
      const sameVote = existing[0].vote === vote;
      // Delete existing vote(s)
      for (const row of existing) {
        await supabase.from('votes').delete().eq('id', row.id);
      }
      if (sameVote) {
        console.log('[DB] Vote toggle off');
        return;
      }
    }
    // Add the new vote
    await supabase.from('votes').insert({
      take_id: takeId, vote, user_id: userId, timestamp: Date.now()
    });
    console.log(`[DB] Vote ${vote} added`);
  }

  // Upsert a user's ranking.
  async function saveRanking(userId, ranking) {
    if (!supabaseReady) return;
    console.log(`[DB] Saving ranking for userId: ${userId}`);
    const { error } = await supabase
      .from('rankings')
      .upsert({ user_id: userId, ranking, updated_at: Date.now() }, { onConflict: 'user_id' });
    if (error) console.error('[DB] saveRanking error:', error);
    else console.log(`[DB] Ranking saved for userId: ${userId}`);
  }

  // Read a single user's ranking.
  async function getRanking(userId) {
    if (!supabaseReady) return null;
    console.log(`[DB] Reading ranking for userId: ${userId}`);
    const { data, error } = await supabase
      .from('rankings')
      .select('ranking')
      .eq('user_id', userId)
      .single();
    if (error || !data) {
      console.log(`[DB] Ranking not found for userId: ${userId}`);
      return null;
    }
    console.log(`[DB] Ranking found for userId: ${userId}`);
    return data.ranking;
  }

  // Read all rankings. Returns { userId: [ranking], ... }
  async function getAllRankings() {
    if (!supabaseReady) return {};
    console.log('[DB] Reading all rankings from database');
    const { data, error } = await supabase
      .from('rankings')
      .select('user_id, ranking');
    if (error) { console.error('[DB] getAllRankings error:', error); return {}; }
    const result = {};
    for (const row of data) {
      result[row.user_id] = row.ranking;
    }
    console.log(`[DB] Retrieved rankings for ${data.length} users`);
    return result;
  }

  // Delete a take (votes cascade-delete via FK constraint).
  async function deleteTake(takeId) {
    if (!supabaseReady) return;
    console.log(`[DB] Deleting take: ${takeId}`);
    const { error } = await supabase.from('takes').delete().eq('id', takeId);
    if (error) console.error('[DB] deleteTake error:', error);
    else console.log(`[DB] Take deleted: ${takeId}`);
  }

  return { init, isReady, getReactions, toggleReaction, getTakes, addTake, deleteTake, getVotes, castVote, saveRanking, getRanking, getAllRankings };
})();

// Alias SUPABASE_DB as DB so other modules can reference it directly
const DB = SUPABASE_DB;
