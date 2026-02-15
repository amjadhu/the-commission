const Feed = (() => {
  // List of RSS feeds to aggregate. Add/remove sources here.
  const RSS_URLS = [
    'https://www.seahawks.com/news/rss.xml',
    'https://www.espn.com/espn/rss/nfl/news',
    'https://www.reddit.com/r/Seahawks/.rss',
    'https://www.reddit.com/r/nfl/.rss',
    'https://profootballtalk.nbcsports.com/feed/',
    'https://www.cbssports.com/rss/headlines/nfl/',
    'https://www.nfl.com/rss/rsslanding?searchString=home'
  ];

  // Public RSS -> JSON proxy used to fetch feeds in-browser.
  const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';
  // Short list of emojis shown as reaction buttons on each news card.
  const EMOJIS = ['🔥', '💀', '🤡', '🏈'];

  let allArticles = [];
  let activeFilter = 'all';

  // Entry point: populate the feed list and handle errors.
  async function init() {
    const feedList = document.getElementById('feed-list');
    feedList.innerHTML = '<div class="loading">Loading news...</div>';

    try {
      allArticles = await fetchAllFeeds();
      renderFeed(allArticles);
    } catch (e) {
      console.error('Feed error:', e);
      feedList.innerHTML = '<div class="empty-state">Could not load news. Try refreshing.</div>';
    }
  }

  function filterBySource(source) {
    activeFilter = source;
    const filtered = source === 'all'
      ? allArticles
      : allArticles.filter(a => a.source === source);
    renderFeed(filtered);

    document.querySelectorAll('.feed-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.source === source);
    });
  }

  // Fetch all configured RSS feeds in parallel, normalize items and dedupe.
  async function fetchAllFeeds() {
    const results = await Promise.allSettled(
      RSS_URLS.map(url =>
        fetch(RSS2JSON_BASE + encodeURIComponent(url))
          .then(r => r.json())
          .then(data => {
            if (data.status !== 'ok') return [];
            return (data.items || []).map(item => ({
              id: hashString(item.link || item.title),
              title: item.title,
              link: item.link,
              snippet: stripHtml(item.description || ''),
              thumbnail: item.thumbnail || item.enclosure?.link || '',
              source: extractSource(data.feed?.url || item.link || ''),
              pubDate: item.pubDate
            }));
          })
      )
    );

    const articles = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Sort by date (newest first), dedupe by normalized title, and cap results.
    const seen = new Set();
    return articles
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .filter(a => {
        const key = a.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 30);
  }

  // Render an array of article objects into the feed list container.
  function renderFeed(articles) {
    const feedList = document.getElementById('feed-list');

    if (!articles.length) {
      feedList.innerHTML = '<div class="empty-state">No news right now. Check back later.</div>';
      return;
    }

    // Build source filter bar from available sources
    const sources = [...new Set(allArticles.map(a => a.source))];
    const filterBar = document.createElement('div');
    filterBar.className = 'feed-filters';
    filterBar.innerHTML = `
      <button class="feed-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-source="all">All</button>
      ${sources.map(s => `<button class="feed-filter-btn ${activeFilter === s ? 'active' : ''}" data-source="${s}">${s}</button>`).join('')}
    `;
    filterBar.querySelectorAll('.feed-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => filterBySource(btn.dataset.source));
    });

    feedList.innerHTML = '';
    feedList.appendChild(filterBar);
    articles.forEach(article => {
      feedList.appendChild(createNewsCard(article));
    });
  }

  // Create a DOM node for a single news card, including reaction buttons.
  function createNewsCard(article) {
    const card = document.createElement('article');
    card.className = 'news-card';

    const thumbnailHtml = article.thumbnail
      ? `<img class="news-card-thumbnail" src="${article.thumbnail}" alt="" loading="lazy">`
      : '';

    card.innerHTML = `
      ${thumbnailHtml}
      <div class="news-card-body">
        <div class="news-card-meta">
          <span class="news-source">${article.source}</span>
          <span class="news-time">${timeAgo(article.pubDate)}</span>
        </div>
        <h3 class="news-card-title">
          <a href="${article.link}" target="_blank" rel="noopener">${article.title}</a>
        </h3>
        <p class="news-card-snippet">${article.snippet}</p>
      </div>
      <div class="reactions" data-news-id="${article.id}">
        ${EMOJIS.map(e => `
          <button class="reaction-btn" data-emoji="${e}">
            <span>${e}</span>
            <span class="reaction-count">0</span>
          </button>
        `).join('')}
      </div>
    `;

    // Load persisted reactions from Firebase (if available) and hook buttons
    loadReactions(card, article.id);

    card.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => handleReaction(card, article.id, btn.dataset.emoji));
    });

    return card;
  }

  // Read reaction counts for a news item and mark which one the current user chose.
  async function loadReactions(card, newsId) {
    if (!DB.isReady()) return;
    const reactions = await DB.getReactions(newsId);
    const userId = Users.getCurrent();

    card.querySelectorAll('.reaction-btn').forEach(btn => {
      const emoji = btn.dataset.emoji;
      const users = reactions[emoji] || [];
      btn.querySelector('.reaction-count').textContent = users.length || '';
      btn.classList.toggle('active', users.includes(userId));
    });
  }

  // When a reaction is clicked: ensure a user is selected, then toggle reaction
  // in Firestore and refresh the UI for that card.
  async function handleReaction(card, newsId, emoji) {
    const userId = Users.getCurrent();
    if (!userId) {
      Users.init(); // prompt for name
      return;
    }

    if (!DB.isReady()) return;
    await DB.toggleReaction(newsId, emoji, userId);
    await loadReactions(card, newsId);
  }

  // -- Helper utilities used by the feed module --
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || '';
  }

  // Simple source extraction from a URL to show a friendly label.
  function extractSource(url) {
    try {
      const host = new URL(url).hostname.replace('www.', '');
      if (host.includes('seahawks')) return 'Seahawks';
      if (host.includes('espn')) return 'ESPN';
      if (host.includes('reddit') && url.includes('Seahawks')) return 'r/Seahawks';
      if (host.includes('reddit')) return 'r/NFL';
      if (host.includes('nbcsports') || host.includes('profootballtalk')) return 'PFT';
      if (host.includes('cbssports')) return 'CBS Sports';
      if (host.includes('nfl.com')) return 'NFL';
      return host.split('.')[0];
    } catch {
      return 'NFL';
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // Lightweight string hash to create a stable id for articles.
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'n' + Math.abs(hash).toString(36);
  }

  return { init, filterBySource };
})();
