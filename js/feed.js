const Feed = (() => {
  const RSS_URLS = [
    'https://www.seahawks.com/news/rss.xml',
    'https://www.espn.com/espn/rss/nfl/news'
  ];

  const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const EMOJIS = ['🔥', '💀', '🤡', '🏈'];

  async function init() {
    const feedList = document.getElementById('feed-list');
    feedList.innerHTML = '<div class="loading">Loading news...</div>';

    try {
      const articles = await fetchAllFeeds();
      renderFeed(articles);
    } catch (e) {
      console.error('Feed error:', e);
      feedList.innerHTML = '<div class="empty-state">Could not load news. Try refreshing.</div>';
    }
  }

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

    // Sort by date descending, dedupe by title
    const seen = new Set();
    return articles
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .filter(a => {
        const key = a.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }

  function renderFeed(articles) {
    const feedList = document.getElementById('feed-list');

    if (!articles.length) {
      feedList.innerHTML = '<div class="empty-state">No news right now. Check back later.</div>';
      return;
    }

    feedList.innerHTML = '';
    articles.forEach(article => {
      feedList.appendChild(createNewsCard(article));
    });
  }

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

    // Load reactions from Firebase
    loadReactions(card, article.id);

    // Wire up reaction buttons
    card.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => handleReaction(card, article.id, btn.dataset.emoji));
    });

    return card;
  }

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

  async function handleReaction(card, newsId, emoji) {
    const userId = Users.getCurrent();
    if (!userId) {
      Users.init(); // re-open modal
      return;
    }

    if (!DB.isReady()) return;
    await DB.toggleReaction(newsId, emoji, userId);
    await loadReactions(card, newsId);
  }

  // Helpers
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || '';
  }

  function extractSource(url) {
    try {
      const host = new URL(url).hostname.replace('www.', '');
      if (host.includes('seahawks')) return 'Seahawks';
      if (host.includes('espn')) return 'ESPN';
      if (host.includes('nfl')) return 'NFL';
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

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'n' + Math.abs(hash).toString(36);
  }

  return { init };
})();
