const History = (() => {
  const ESPN_SCHEDULE_URL =
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/sea/schedule';

  // Season records 1976–2023. Current season fetched live from ESPN.
  // playoff values: null | 'WC' | 'DIV' | 'CONF' | 'SB-L' | 'SB-W'
  const SEASONS = [
    { year: 1976, w:  2, l: 12, t: 0 },
    { year: 1977, w:  5, l:  9, t: 0 },
    { year: 1978, w:  9, l:  7, t: 0 },
    { year: 1979, w:  9, l:  7, t: 0 },
    { year: 1980, w:  4, l: 12, t: 0 },
    { year: 1981, w:  6, l: 10, t: 0 },
    { year: 1982, w:  4, l:  5, t: 0 },            // 9-game strike year
    { year: 1983, w:  9, l:  7, t: 0, playoff: 'CONF' },  // AFC Championship
    { year: 1984, w: 12, l:  4, t: 0, playoff: 'DIV'  },
    { year: 1985, w:  8, l:  8, t: 0 },
    { year: 1986, w: 10, l:  6, t: 0, playoff: 'WC'   },
    { year: 1987, w:  9, l:  6, t: 0, playoff: 'WC'   },  // 15-game strike year
    { year: 1988, w:  9, l:  7, t: 0, playoff: 'DIV'  },
    { year: 1989, w:  7, l:  9, t: 0 },
    { year: 1990, w:  9, l:  7, t: 0 },
    { year: 1991, w:  7, l:  9, t: 0 },
    { year: 1992, w:  2, l: 14, t: 0 },
    { year: 1993, w:  6, l: 10, t: 0 },
    { year: 1994, w:  6, l: 10, t: 0 },
    { year: 1995, w:  8, l:  8, t: 0 },
    { year: 1996, w:  7, l:  9, t: 0 },
    { year: 1997, w:  8, l:  8, t: 0 },
    { year: 1998, w:  8, l:  8, t: 0 },
    { year: 1999, w:  9, l:  7, t: 0, playoff: 'DIV'  },
    { year: 2000, w:  6, l: 10, t: 0 },
    { year: 2001, w:  9, l:  7, t: 0 },
    { year: 2002, w:  7, l:  9, t: 0 },              // → NFC West
    { year: 2003, w: 10, l:  6, t: 0, playoff: 'DIV'  },
    { year: 2004, w:  9, l:  7, t: 0, playoff: 'WC'   },
    { year: 2005, w: 13, l:  3, t: 0, playoff: 'SB-L' }, // Super Bowl XL
    { year: 2006, w:  9, l:  7, t: 0, playoff: 'DIV'  },
    { year: 2007, w: 10, l:  6, t: 0, playoff: 'CONF' }, // NFC Championship
    { year: 2008, w:  4, l: 12, t: 0 },
    { year: 2009, w:  5, l: 11, t: 0 },
    { year: 2010, w:  7, l:  9, t: 0, playoff: 'DIV'  }, // Beast Quake
    { year: 2011, w:  7, l:  9, t: 0 },
    { year: 2012, w: 11, l:  5, t: 0, playoff: 'DIV'  },
    { year: 2013, w: 13, l:  3, t: 0, playoff: 'SB-W' }, // SB XLVIII WIN
    { year: 2014, w: 12, l:  4, t: 0, playoff: 'SB-L' }, // SB XLIX
    { year: 2015, w: 10, l:  6, t: 0, playoff: 'DIV'  },
    { year: 2016, w: 10, l:  6, t: 0, playoff: 'WC'   },
    { year: 2017, w:  9, l:  7, t: 0 },
    { year: 2018, w: 10, l:  6, t: 0, playoff: 'DIV'  },
    { year: 2019, w: 11, l:  5, t: 0, playoff: 'DIV'  },
    { year: 2020, w: 12, l:  4, t: 0, playoff: 'WC'   },
    { year: 2021, w:  7, l: 10, t: 0 },
    { year: 2022, w:  9, l:  8, t: 0, playoff: 'WC'   },
    { year: 2023, w:  9, l:  8, t: 0 },
  ];

  // Notable annotations shown on hover / below landmark bars
  const SEASON_NOTES = {
    1983: 'AFC Champ',
    2005: 'SB XL',
    2013: '🏆 SB Win',
    2014: 'SB XLIX',
    2010: 'Beast Quake',
  };

  const PLAYOFF_HISTORY = [
    { year: 1983, result: 'AFC Championship',  note: 'Largent era peaks' },
    { year: 1984, result: 'Divisional Round',  note: '12–4 season' },
    { year: 1986, result: 'Wild Card',          note: '' },
    { year: 1987, result: 'Wild Card',          note: '15-game strike season' },
    { year: 1988, result: 'Divisional Round',  note: 'Krieg era' },
    { year: 1999, result: 'Divisional Round',  note: 'Holmgren arrives' },
    { year: 2003, result: 'Divisional Round',  note: 'First NFC West title' },
    { year: 2004, result: 'Wild Card',          note: '' },
    { year: 2005, result: 'Super Bowl XL ✗',   note: 'Lost to Pittsburgh 21–10', sb: true, won: false },
    { year: 2006, result: 'Divisional Round',  note: '' },
    { year: 2007, result: 'NFC Championship',  note: 'Frozen tundra in Green Bay' },
    { year: 2010, result: 'Divisional Round',  note: 'Beast Quake wild card win' },
    { year: 2012, result: 'Divisional Round',  note: 'LOB era begins' },
    { year: 2013, result: 'Super Bowl XLVIII 🏆', note: 'Crushed Denver 43–8', sb: true, won: true },
    { year: 2014, result: 'Super Bowl XLIX ✗', note: 'Malcolm Butler. The throw.', sb: true, won: false },
    { year: 2015, result: 'Divisional Round',  note: 'Lost to Carolina' },
    { year: 2016, result: 'Wild Card',          note: 'Lost to Atlanta' },
    { year: 2018, result: 'Divisional Round',  note: 'Beat Dallas, lost at Green Bay' },
    { year: 2019, result: 'Divisional Round',  note: 'Beat Philly, lost at Green Bay' },
    { year: 2020, result: 'Wild Card',          note: 'Lost to LA Rams' },
    { year: 2022, result: 'Wild Card',          note: 'Lost to San Francisco' },
  ];

  const LEADERS = {
    passing: [
      { name: 'Russell Wilson',   stat: '37,059 yds', sub: '292 TD · 2012–21' },
      { name: 'Matt Hasselbeck',  stat: '29,434 yds', sub: '174 TD · 2001–10' },
      { name: 'Dave Krieg',       stat: '26,132 yds', sub: '195 TD · 1980–91' },
    ],
    rushing: [
      { name: 'Shaun Alexander',  stat: '9,429 yds', sub: '100 TD · 2000–07 · NFL MVP 2005' },
      { name: 'Curt Warner',      stat: '6,705 yds', sub: '55 TD · 1983–89' },
      { name: 'Marshawn Lynch',   stat: '6,347 yds', sub: '57 TD · 2010–17' },
    ],
    receiving: [
      { name: 'Steve Largent',    stat: '8,135 yds', sub: '100 TD · 1976–89 · HOF' },
      { name: 'Brian Blades',     stat: '6,872 yds', sub: '34 TD · 1988–98' },
      { name: 'Doug Baldwin',     stat: '6,563 yds', sub: '49 TD · 2011–18' },
    ],
    defense: [
      { name: 'Jacob Green',      stat: '97.5 sacks', sub: 'DE · 1980–91' },
      { name: 'Michael Sinclair', stat: '49.5 sacks', sub: 'DE · 1991–2001 · 16 in \'98' },
      { name: 'Kenny Easley',     stat: '32 INT',     sub: 'S · 1981–87 · HOF' },
    ],
  };

  // All-time NFC West head-to-head since joining in 2002 (through 2023)
  const H2H = [
    { opp: 'LAR', oppName: 'LA Rams',        w: 27, l: 17, note: 'Since 2002' },
    { opp: 'SF',  oppName: 'San Francisco',  w: 24, l: 20, note: 'Since 2002' },
    { opp: 'ARI', oppName: 'Arizona',        w: 33, l: 11, note: 'Since 2002' },
  ];

  let currentSeason = null;
  let loaded = false;
  let activeLeaderTab = 'passing';

  function init() {
    // Intentionally deferred — load() is called on tab switch
  }

  async function load() {
    if (loaded) { render(); return; }
    loaded = true;

    try {
      const [regRes, postRes] = await Promise.all([
        fetch(`${ESPN_SCHEDULE_URL}?seasontype=2`),
        fetch(`${ESPN_SCHEDULE_URL}?seasontype=3`),
      ]);
      const regData = regRes.ok ? await regRes.json() : {};
      const postData = postRes.ok ? await postRes.json() : {};

      const completed = (regData.events || []).filter(
        e => e.competitions?.[0]?.status?.type?.state === 'post'
      );

      let w = 0, l = 0, t = 0;
      completed.forEach(e => {
        const comp = e.competitions[0];
        const sea = comp.competitors.find(c => c.team.abbreviation === 'SEA');
        const opp = comp.competitors.find(c => c.team.abbreviation !== 'SEA');
        if (!sea || !opp) return;
        const s = v => parseInt(v?.score?.displayValue ?? v?.score ?? 0);
        const ss = s(sea), os = s(opp);
        if (ss > os) w++;
        else if (ss < os) l++;
        else t++;
      });

      // Check for any postseason games
      const postGames = (postData.events || []).filter(e =>
        e.competitions?.[0]?.competitors?.some(c => c.team.abbreviation === 'SEA')
      );

      let playoff = null;
      if (postGames.length > 0) playoff = 'MADE';

      const year = regData.season?.year || new Date().getFullYear();
      currentSeason = { year, w, l, t, playoff, live: true };
    } catch (e) {
      console.warn('History: could not fetch current season', e);
    }

    render();
  }

  function allSeasons() {
    return currentSeason ? [...SEASONS, currentSeason] : [...SEASONS];
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function render() {
    const container = document.getElementById('history-content');
    if (!container) return;
    container.innerHTML =
      renderSeasonChart() +
      renderLeaders() +
      renderPlayoffHistory() +
      renderH2H();
    wireLeaderTabs();

    // Scroll the season chart to the most recent (rightmost) bars
    // Deferred so the browser has time to lay out the new content
    requestAnimationFrame(() => {
      const chartWrap = document.querySelector('.season-chart-wrap');
      if (chartWrap) chartWrap.scrollLeft = chartWrap.scrollWidth;
    });
  }

  // Card 1 — Wins by Season bar chart
  function renderSeasonChart() {
    const seasons = allSeasons();
    const MAX_WINS = 15; // normalize: 15 wins = 100% bar height

    const bars = seasons.map(s => {
      const pct = Math.round((s.w / MAX_WINS) * 100);
      const showLabel = s.year % 5 === 0 || s === seasons[seasons.length - 1];
      const note = SEASON_NOTES[s.year] || '';

      let barClass = 'season-bar';
      if (s.playoff === 'SB-W')       barClass += ' season-bar--sb-win';
      else if (s.playoff === 'SB-L')  barClass += ' season-bar--sb';
      else if (s.playoff)             barClass += ' season-bar--playoff';
      if (s.live)                     barClass += ' season-bar--live';

      const label = `${s.year}: ${s.w}–${s.l}${s.t ? `–${s.t}` : ''}${s.playoff ? ` (${s.playoff})` : ''}`;

      return `<div class="season-bar-wrap" title="${label}">
        <div class="season-bar-inner">
          ${note ? `<span class="season-bar-note">${note}</span>` : ''}
          <div class="${barClass}" style="height:${pct}%"></div>
        </div>
        <span class="season-bar-year">${showLabel ? `'${String(s.year).slice(2)}` : ''}</span>
      </div>`;
    }).join('');

    const legend = [
      ['season-bar', 'Regular season'],
      ['season-bar season-bar--playoff', 'Playoffs'],
      ['season-bar season-bar--sb', 'Super Bowl loss'],
      ['season-bar season-bar--sb-win', 'Super Bowl WIN'],
    ].map(([cls, lbl]) => `
      <div class="chart-legend-item">
        <div class="${cls}" style="height:14px;width:10px;border-radius:2px;flex-shrink:0"></div>
        <span>${lbl}</span>
      </div>`).join('');

    const last = allSeasons().slice(-1)[0];
    const sub = `1976 – ${last.year}`;

    return `<div class="history-card">
      <div class="history-card-header">
        <h3 class="history-card-title">Wins by Season</h3>
        <span class="history-card-sub">${sub}</span>
      </div>
      <div class="season-chart-wrap">
        <div class="season-chart">${bars}</div>
      </div>
      <div class="chart-legend">${legend}</div>
    </div>`;
  }

  // Card 2 — All-Time Franchise Leaders
  function renderLeaders() {
    const cats = [
      { key: 'passing',   label: 'Passing' },
      { key: 'rushing',   label: 'Rushing' },
      { key: 'receiving', label: 'Receiving' },
      { key: 'defense',   label: 'Defense' },
    ];

    const tabs = cats.map(c =>
      `<button class="leader-tab${c.key === activeLeaderTab ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`
    ).join('');

    const rows = leaderRows(activeLeaderTab);

    return `<div class="history-card">
      <div class="history-card-header">
        <h3 class="history-card-title">All-Time Franchise Leaders</h3>
      </div>
      <div class="leader-tabs">${tabs}</div>
      <div class="leader-list" id="leader-list">${rows}</div>
    </div>`;
  }

  function leaderRows(cat) {
    return (LEADERS[cat] || []).map((p, i) => `
      <div class="leader-row">
        <span class="leader-rank">${i + 1}</span>
        <div class="leader-info">
          <span class="leader-name">${p.name}</span>
          <span class="leader-sub">${p.sub}</span>
        </div>
        <span class="leader-stat">${p.stat}</span>
      </div>`).join('');
  }

  // Card 3 — Playoff History
  function renderPlayoffHistory() {
    const rows = [...PLAYOFF_HISTORY].reverse().map(p => {
      let cls = 'playoff-row';
      if (p.won)       cls += ' playoff-row--win';
      else if (p.sb)   cls += ' playoff-row--sb-loss';

      return `<div class="${cls}">
        <span class="playoff-year">${p.year}</span>
        <div class="playoff-info">
          <span class="playoff-result">${p.result}</span>
          ${p.note ? `<span class="playoff-note">${p.note}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="history-card">
      <div class="history-card-header">
        <h3 class="history-card-title">Playoff History</h3>
        <span class="history-card-sub">${PLAYOFF_HISTORY.length} appearances</span>
      </div>
      <div class="playoff-list">${rows}</div>
    </div>`;
  }

  // Card 4 — Head-to-Head vs NFC West
  function renderH2H() {
    const items = H2H.map(r => {
      const total = r.w + r.l;
      const pct = total > 0 ? Math.round((r.w / total) * 100) : 50;
      const logo = `https://a.espncdn.com/i/teamlogos/nfl/500/${r.opp.toLowerCase()}.png`;

      return `<div class="h2h-item">
        <img class="h2h-logo" src="${logo}" alt="${r.oppName}" onerror="this.style.display='none'">
        <div class="h2h-info">
          <span class="h2h-name">${r.oppName}</span>
          <span class="h2h-note">${r.note}</span>
        </div>
        <div class="h2h-record">
          <span class="h2h-wl">${r.w}–${r.l}</span>
          <div class="h2h-bar-track">
            <div class="h2h-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="history-card">
      <div class="history-card-header">
        <h3 class="history-card-title">Head-to-Head · NFC West</h3>
        <span class="history-card-sub">Since 2002</span>
      </div>
      <div class="h2h-list">${items}</div>
    </div>`;
  }

  // ── Event wiring ─────────────────────────────────────────────────────────────

  function wireLeaderTabs() {
    document.querySelectorAll('.leader-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeLeaderTab = tab.dataset.cat;
        document.querySelectorAll('.leader-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const list = document.getElementById('leader-list');
        if (list) list.innerHTML = leaderRows(activeLeaderTab);
      });
    });
  }

  return { init, load };
})();
