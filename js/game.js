const Game = (() => {
  const SCHEDULE_URL =
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/sea/schedule';

  let countdownTimer = null;
  let liveInterval = null;

  async function init() {
    await refresh();
  }

  async function refresh() {
    const container = document.getElementById('seahawks-game');
    if (!container) return;

    try {
      const res = await fetch(SCHEDULE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data.events || [];
      const game = findRelevantGame(events);

      if (!game) {
        container.innerHTML = '';
        return;
      }

      clearTimers();
      renderCard(container, game);
    } catch (e) {
      console.warn('Game card error:', e);
      // Silently fail — don't break the feed if ESPN is unreachable
    }
  }

  // Find the most relevant game to display:
  // 1. Any live game first, 2. Next upcoming game, 3. Most recently completed
  function findRelevantGame(events) {
    const live = events.find(e => e.competitions?.[0]?.status?.type?.state === 'in');
    if (live) return live;

    const now = Date.now();
    const upcoming = events.find(e => {
      const state = e.competitions?.[0]?.status?.type?.state;
      return state === 'pre' && new Date(e.date).getTime() > now;
    });
    if (upcoming) return upcoming;

    const completed = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'post');
    return completed.length ? completed[completed.length - 1] : null;
  }

  function getMatchup(comp) {
    const competitors = comp.competitors || [];
    const sea = competitors.find(c => c.team.abbreviation === 'SEA') || competitors[0];
    const opp = competitors.find(c => c.team.abbreviation !== 'SEA') || competitors[1];
    return { sea, opp, isHome: sea?.homeAway === 'home' };
  }

  function logoUrl(abbr) {
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
  }

  // ESPN returns score as either a plain string "21" or an object { value: 21, displayValue: "21" }
  function getScore(competitor) {
    const s = competitor?.score;
    if (s == null) return '0';
    if (typeof s === 'string' || typeof s === 'number') return String(s);
    return s.displayValue ?? s.value ?? '0';
  }

  function renderCard(container, event) {
    const comp = event.competitions[0];
    const state = comp.status.type.state;
    const { sea, opp, isHome } = getMatchup(comp);
    const locLabel = isHome ? 'vs' : 'at';

    if (state === 'pre') {
      renderUpcoming(container, event, comp, sea, opp, locLabel);
    } else if (state === 'in') {
      renderLive(container, comp, sea, opp);
    } else {
      renderFinal(container, comp, sea, opp);
    }
  }

  function renderUpcoming(container, event, comp, sea, opp, locLabel) {
    const gameDate = new Date(event.date);
    const oppName = opp.team.shortDisplayName || opp.team.abbreviation;
    const venue = comp.venue?.fullName || '';
    const dateStr = gameDate.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
    const timeStr = gameDate.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });

    container.innerHTML = `
      <div class="game-card">
        <div class="game-card-header">
          <span class="game-card-label">Next Game</span>
          <span class="game-card-date">${dateStr} · ${timeStr}</span>
        </div>
        <div class="game-card-matchup">
          <div class="game-card-team">
            <img class="game-card-logo" src="${logoUrl('sea')}" alt="Seahawks"
              onerror="this.style.display='none'">
            <span class="game-card-name">Seahawks</span>
          </div>
          <div class="game-card-center">
            <span class="game-card-loc">${locLabel}</span>
            <div id="game-countdown" class="game-card-countdown"></div>
          </div>
          <div class="game-card-team">
            <img class="game-card-logo" src="${logoUrl(opp.team.abbreviation)}" alt="${oppName}"
              onerror="this.style.display='none'">
            <span class="game-card-name">${oppName}</span>
          </div>
        </div>
        ${venue ? `<div class="game-card-venue">${venue}</div>` : ''}
      </div>
    `;

    tickCountdown(gameDate);
    countdownTimer = setInterval(() => tickCountdown(gameDate), 1000);
  }

  function tickCountdown(target) {
    const el = document.getElementById('game-countdown');
    if (!el) { clearInterval(countdownTimer); return; }

    const diff = target - Date.now();
    if (diff <= 0) {
      el.textContent = '🏈 Kickoff!';
      clearInterval(countdownTimer);
      countdownTimer = null;
      setTimeout(refresh, 10000);
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    el.textContent = d > 0
      ? `${d}d ${h}h ${String(m).padStart(2, '0')}m`
      : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function renderLive(container, comp, sea, opp) {
    const seaScore = getScore(sea);
    const oppScore = getScore(opp);
    const clock = comp.status.displayClock || '';
    const period = comp.status.period || 1;
    const periodLabel = period > 4 ? 'OT' : `Q${period}`;
    const oppName = opp.team.shortDisplayName || opp.team.abbreviation;
    const seaLeading = parseInt(seaScore) >= parseInt(oppScore);

    container.innerHTML = `
      <div class="game-card game-card--live">
        <div class="game-card-header">
          <span class="game-card-label"><span class="live-dot"></span> LIVE</span>
          <span class="game-card-clock">${clock} · ${periodLabel}</span>
        </div>
        <div class="game-card-matchup">
          <div class="game-card-team">
            <img class="game-card-logo" src="${logoUrl('sea')}" alt="Seahawks"
              onerror="this.style.display='none'">
            <span class="game-card-name">Seahawks</span>
            <span class="game-card-score ${seaLeading ? 'leading' : ''}">${seaScore}</span>
          </div>
          <div class="game-card-center game-card-center--score">–</div>
          <div class="game-card-team">
            <img class="game-card-logo" src="${logoUrl(opp.team.abbreviation)}" alt="${oppName}"
              onerror="this.style.display='none'">
            <span class="game-card-name">${oppName}</span>
            <span class="game-card-score ${!seaLeading ? 'leading' : ''}">${oppScore}</span>
          </div>
        </div>
      </div>
    `;

    // Poll for score updates every 30 seconds
    liveInterval = setInterval(refresh, 30000);
  }

  function renderFinal(container, comp, sea, opp) {
    const seaScore = getScore(sea);
    const oppScore = getScore(opp);
    const seaWon = parseInt(seaScore) > parseInt(oppScore);
    const oppName = opp.team.shortDisplayName || opp.team.abbreviation;
    const resultClass = seaWon ? 'game-result--win' : 'game-result--loss';

    container.innerHTML = `
      <div class="game-card game-card--final">
        <div class="game-card-header">
          <span class="game-card-label">Final</span>
          <span class="game-result ${resultClass}">${seaWon ? 'W' : 'L'}</span>
        </div>
        <div class="game-card-matchup">
          <div class="game-card-team">
            <img class="game-card-logo" src="${logoUrl('sea')}" alt="Seahawks"
              onerror="this.style.display='none'">
            <span class="game-card-name">Seahawks</span>
            <span class="game-card-score ${seaWon ? 'leading' : ''}">${seaScore}</span>
          </div>
          <div class="game-card-center game-card-center--score">–</div>
          <div class="game-card-team">
            <img class="game-card-logo" src="${logoUrl(opp.team.abbreviation)}" alt="${oppName}"
              onerror="this.style.display='none'">
            <span class="game-card-name">${oppName}</span>
            <span class="game-card-score ${!seaWon ? 'leading' : ''}">${oppScore}</span>
          </div>
        </div>
      </div>
    `;
  }

  function clearTimers() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
  }

  return { init };
})();
