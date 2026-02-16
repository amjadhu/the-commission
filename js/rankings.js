const Rankings = (() => {
  const STORAGE_KEY = 'commission_rankings';

  const NFL_TEAMS = [
    { abbr: 'ARI', name: 'Cardinals', div: 'NFC West' },
    { abbr: 'ATL', name: 'Falcons', div: 'NFC South' },
    { abbr: 'BAL', name: 'Ravens', div: 'AFC North' },
    { abbr: 'BUF', name: 'Bills', div: 'AFC East' },
    { abbr: 'CAR', name: 'Panthers', div: 'NFC South' },
    { abbr: 'CHI', name: 'Bears', div: 'NFC North' },
    { abbr: 'CIN', name: 'Bengals', div: 'AFC North' },
    { abbr: 'CLE', name: 'Browns', div: 'AFC North' },
    { abbr: 'DAL', name: 'Cowboys', div: 'NFC East' },
    { abbr: 'DEN', name: 'Broncos', div: 'AFC West' },
    { abbr: 'DET', name: 'Lions', div: 'NFC North' },
    { abbr: 'GB', name: 'Packers', div: 'NFC North' },
    { abbr: 'HOU', name: 'Texans', div: 'AFC South' },
    { abbr: 'IND', name: 'Colts', div: 'AFC South' },
    { abbr: 'JAX', name: 'Jaguars', div: 'AFC South' },
    { abbr: 'KC', name: 'Chiefs', div: 'AFC West' },
    { abbr: 'LAC', name: 'Chargers', div: 'AFC West' },
    { abbr: 'LAR', name: 'Rams', div: 'NFC West' },
    { abbr: 'LV', name: 'Raiders', div: 'AFC West' },
    { abbr: 'MIA', name: 'Dolphins', div: 'AFC East' },
    { abbr: 'MIN', name: 'Vikings', div: 'NFC North' },
    { abbr: 'NE', name: 'Patriots', div: 'AFC East' },
    { abbr: 'NO', name: 'Saints', div: 'NFC South' },
    { abbr: 'NYG', name: 'Giants', div: 'NFC East' },
    { abbr: 'NYJ', name: 'Jets', div: 'AFC East' },
    { abbr: 'PHI', name: 'Eagles', div: 'NFC East' },
    { abbr: 'PIT', name: 'Steelers', div: 'AFC North' },
    { abbr: 'SEA', name: 'Seahawks', div: 'NFC West' },
    { abbr: 'SF', name: '49ers', div: 'NFC West' },
    { abbr: 'TB', name: 'Buccaneers', div: 'NFC South' },
    { abbr: 'TEN', name: 'Titans', div: 'AFC South' },
    { abbr: 'WAS', name: 'Commanders', div: 'NFC East' }
  ];

  let myRanking = null;
  let draggedItem = null;

  async function init() {
    await loadRanking();
    render();
  }

  async function loadRanking() {
    const userId = Users.getCurrent();
    if (!userId) return;

    // Try Firestore first, fall back to localStorage
    if (DB.isReady()) {
      try {
        myRanking = await DB.getRanking(userId);
        return;
      } catch (e) {
        console.warn('Firestore getRanking failed, using localStorage:', e);
      }
    }

    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      myRanking = all[userId] || null;
    } catch {
      myRanking = null;
    }
  }

  async function saveRanking(ranking) {
    const userId = Users.getCurrent();
    if (!userId) return;

    // Always save to localStorage as fallback
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[userId] = ranking;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.error('Failed to save ranking to localStorage:', e);
    }

    myRanking = ranking;

    // Also save to Firestore if available
    if (DB.isReady()) {
      try {
        await DB.saveRanking(userId, ranking);
      } catch (e) {
        console.warn('Firestore saveRanking failed:', e);
      }
    }
  }

  async function getAllRankings() {
    // Try Firestore first, fall back to localStorage
    if (DB.isReady()) {
      try {
        return await DB.getAllRankings();
      } catch (e) {
        console.warn('Firestore getAllRankings failed, using localStorage:', e);
      }
    }

    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  async function render() {
    const container = document.getElementById('rankings-content');
    const allRankings = await getAllRankings();
    const rankedUsers = Object.keys(allRankings);

    // Show sub-tabs: My Rankings | Group View
    container.innerHTML = `
      <div class="rankings-tabs">
        <button class="rankings-tab active" data-rtab="my">My Rankings</button>
        <button class="rankings-tab" data-rtab="group">Group View${rankedUsers.length > 0 ? ` (${rankedUsers.length})` : ''}</button>
      </div>
      <div id="rankings-my" class="rankings-panel active"></div>
      <div id="rankings-group" class="rankings-panel"></div>
    `;

    container.querySelectorAll('.rankings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.rankings-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.rankings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`rankings-${tab.dataset.rtab}`).classList.add('active');
      });
    });

    renderMyRankings();
    await renderGroupView();
  }

  function renderMyRankings() {
    const panel = document.getElementById('rankings-my');
    const userId = Users.getCurrent();

    if (!userId) {
      panel.innerHTML = '<div class="empty-state">Pick your name first to create rankings.</div>';
      return;
    }

    const teams = myRanking
      ? myRanking.map(abbr => NFL_TEAMS.find(t => t.abbr === abbr))
      : [...NFL_TEAMS].sort((a, b) => {
          // Default: Seahawks first, then alphabetical
          if (a.abbr === 'SEA') return -1;
          if (b.abbr === 'SEA') return 1;
          return a.name.localeCompare(b.name);
        });

    panel.innerHTML = `
      <p class="rankings-hint">Drag teams to rank them 1-32. Your #1 is the best team in the NFL.</p>
      <div class="rankings-list" id="my-rankings-list">
        ${teams.map((team, i) => `
          <div class="rank-item ${team.abbr === 'SEA' ? 'rank-seahawks' : ''}" draggable="true" data-abbr="${team.abbr}">
            <span class="rank-number">${i + 1}</span>
            <span class="rank-team-abbr">${team.abbr}</span>
            <span class="rank-team-name">${team.name}</span>
            <span class="rank-division">${team.div}</span>
            <span class="rank-drag-handle">&#x2630;</span>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary rankings-save-btn" id="save-rankings-btn">Save My Rankings</button>
    `;

    setupDragAndDrop(document.getElementById('my-rankings-list'));

    document.getElementById('save-rankings-btn').addEventListener('click', async () => {
      const items = document.querySelectorAll('#my-rankings-list .rank-item');
      const ranking = [...items].map(item => item.dataset.abbr);
      await saveRanking(ranking);
      await renderGroupView();
      showSaveConfirmation();
    });
  }

  function showSaveConfirmation() {
    const btn = document.getElementById('save-rankings-btn');
    const original = btn.textContent;
    btn.textContent = 'Saved!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1500);
  }

  function setupDragAndDrop(list) {
    const items = list.querySelectorAll('.rank-item');

    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        // Renumber
        list.querySelectorAll('.rank-item').forEach((el, i) => {
          el.querySelector('.rank-number').textContent = i + 1;
        });
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === item) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          list.insertBefore(draggedItem, item);
        } else {
          list.insertBefore(draggedItem, item.nextSibling);
        }
      });
    });

    // Touch support for mobile
    let touchItem = null;
    let touchClone = null;
    let touchStartY = 0;

    items.forEach(item => {
      item.addEventListener('touchstart', (e) => {
        touchItem = item;
        touchStartY = e.touches[0].clientY;
        item.classList.add('dragging');
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (!touchItem) return;
        e.preventDefault();

        const touchY = e.touches[0].clientY;
        const siblings = [...list.querySelectorAll('.rank-item:not(.dragging)')];

        for (const sibling of siblings) {
          const rect = sibling.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;

          if (touchY < midY) {
            list.insertBefore(touchItem, sibling);
            break;
          } else if (sibling === siblings[siblings.length - 1]) {
            list.appendChild(touchItem);
          }
        }
      }, { passive: false });

      item.addEventListener('touchend', () => {
        if (touchItem) {
          touchItem.classList.remove('dragging');
          touchItem = null;
          list.querySelectorAll('.rank-item').forEach((el, i) => {
            el.querySelector('.rank-number').textContent = i + 1;
          });
        }
      });
    });
  }

  async function renderGroupView() {
    const panel = document.getElementById('rankings-group');
    const allRankings = await getAllRankings();
    const users = Object.keys(allRankings);

    if (users.length === 0) {
      panel.innerHTML = '<div class="empty-state">No one has submitted rankings yet. Be the first!</div>';
      return;
    }

    // Calculate consensus (average rank per team)
    const teamScores = {};
    NFL_TEAMS.forEach(t => { teamScores[t.abbr] = { total: 0, count: 0, ranks: {} }; });

    users.forEach(user => {
      allRankings[user].forEach((abbr, index) => {
        teamScores[abbr].total += index + 1;
        teamScores[abbr].count += 1;
        teamScores[abbr].ranks[user] = index + 1;
      });
    });

    const consensus = NFL_TEAMS
      .map(t => ({
        ...t,
        avgRank: teamScores[t.abbr].count > 0
          ? teamScores[t.abbr].total / teamScores[t.abbr].count
          : 99,
        ranks: teamScores[t.abbr].ranks
      }))
      .sort((a, b) => a.avgRank - b.avgRank);

    panel.innerHTML = `
      <p class="rankings-hint">Consensus rankings from ${users.length} member${users.length > 1 ? 's' : ''}: ${users.join(', ')}</p>
      <div class="consensus-list">
        <div class="consensus-header">
          <span class="ch-rank">#</span>
          <span class="ch-team">Team</span>
          ${users.map(u => `<span class="ch-user">${u.slice(0, 5)}</span>`).join('')}
          <span class="ch-avg">Avg</span>
        </div>
        ${consensus.map((team, i) => {
          const maxSpread = users.length > 1
            ? Math.max(...Object.values(team.ranks)) - Math.min(...Object.values(team.ranks))
            : 0;
          return `
            <div class="consensus-row ${team.abbr === 'SEA' ? 'rank-seahawks' : ''} ${maxSpread >= 10 ? 'high-disagreement' : ''}">
              <span class="ch-rank">${i + 1}</span>
              <span class="ch-team">${team.abbr} ${team.name}</span>
              ${users.map(u => `<span class="ch-user">${team.ranks[u] || '-'}</span>`).join('')}
              <span class="ch-avg">${team.avgRank.toFixed(1)}</span>
            </div>
          `;
        }).join('')}
      </div>
      ${users.length > 1 ? `
        <div class="disagreements-card">
          <h3>Biggest Disagreements</h3>
          <div class="disagreements-list">
            ${getDisagreements(consensus, users).map(d => `
              <div class="disagreement-item">
                <span class="rank-team-abbr">${d.abbr}</span>
                <span>${d.name} — ranked as high as <strong>#${d.high}</strong> and as low as <strong>#${d.low}</strong> (${d.spread} spot spread)</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function getDisagreements(consensus, users) {
    if (users.length < 2) return [];

    return consensus
      .map(team => {
        const ranks = Object.values(team.ranks);
        const high = Math.min(...ranks);
        const low = Math.max(...ranks);
        return { abbr: team.abbr, name: team.name, high, low, spread: low - high };
      })
      .filter(d => d.spread >= 5)
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 5);
  }

  return { init, render };
})();
