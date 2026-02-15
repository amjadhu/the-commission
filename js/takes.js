const Takes = (() => {
  // Setup entry point for takes UI: wire the form and load existing takes.
  function init() {
    setupForm();
    loadTakes();
  }

  // Configure the take submission form: char counter, validation, and submit.
  function setupForm() {
    const form = document.getElementById('take-form');
    const input = document.getElementById('take-input');
    const counter = document.getElementById('char-count');

    // Live character counter (280 char limit displayed)
    input.addEventListener('input', () => {
      counter.textContent = 280 - input.value.length;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      const userId = Users.getCurrent();

      if (!userId) {
        // Prompt the user to pick a name before posting
        Users.init();
        return;
      }

      if (!text) return; // ignore empty submissions

      if (!DB.isReady()) {
        // Local-only fallback: save to localStorage and refresh UI
        addLocalTake(text, userId);
        input.value = '';
        counter.textContent = '280';
        loadTakes();
        return;
      }

      // Disable submit while writing to Firestore, then refresh list
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      await DB.addTake(text, userId);
      input.value = '';
      counter.textContent = '280';
      submitBtn.disabled = false;
      await loadTakes();
    });
  }

  // Load takes from Firestore if available, otherwise from localStorage.
  async function loadTakes() {
    const list = document.getElementById('takes-list');

    let takes;
    if (DB.isReady()) {
      takes = await DB.getTakes();
    } else {
      takes = getLocalTakes();
    }

    if (!takes.length) {
      list.innerHTML = '<div class="empty-state">No takes yet. Be the first to drop one.</div>';
      return;
    }

    list.innerHTML = '';
    for (const take of takes) {
      list.appendChild(await createTakeCard(take));
    }
  }

  // Build a single take card DOM node and wire vote buttons.
  async function createTakeCard(take) {
    const card = document.createElement('div');
    card.className = 'take-card';

    // Read votes for this take (agree/disagree arrays)
    let votes = { agree: [], disagree: [] };
    if (DB.isReady()) {
      votes = await DB.getVotes(take.id);
    }

    const userId = Users.getCurrent();
    const userVote = votes.agree.includes(userId) ? 'agree'
      : votes.disagree.includes(userId) ? 'disagree' : null;

    card.innerHTML = `
      <div class="take-card-header">
        <span class="take-author">${take.authorId}</span>
        <span class="take-time">${timeAgo(take.timestamp)}</span>
      </div>
      <p class="take-text">${escapeHtml(take.text)}</p>
      <div class="take-votes">
        <button class="vote-btn agree ${userVote === 'agree' ? 'active' : ''}" data-vote="agree">
          ✅ Agree <span class="vote-count">${votes.agree.length || ''}</span>
        </button>
        <button class="vote-btn disagree ${userVote === 'disagree' ? 'active' : ''}" data-vote="disagree">
          ❌ Disagree <span class="vote-count">${votes.disagree.length || ''}</span>
        </button>
      </div>
    `;

    // Voting: require a selected user and Firestore availability.
    card.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = Users.getCurrent();
        if (!userId) { Users.init(); return; }
        if (!DB.isReady()) return;
        await DB.castVote(take.id, btn.dataset.vote, userId);
        await loadTakes();
      });
    });

    return card;
  }

  // Local-only fallback helpers: store/retrieve takes in localStorage.
  function getLocalTakes() {
    try {
      return JSON.parse(localStorage.getItem('commission_takes') || '[]');
    } catch {
      return [];
    }
  }

  function addLocalTake(text, authorId) {
    const takes = getLocalTakes();
    takes.unshift({
      id: 't' + Date.now(),
      text,
      authorId,
      timestamp: Date.now()
    });
    localStorage.setItem('commission_takes', JSON.stringify(takes.slice(0, 50)));
  }

  // Small utility to show relative time for a timestamp.
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // Escape user-provided text into safe HTML for display.
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, loadTakes };
})();
