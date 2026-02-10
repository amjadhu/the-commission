const Users = (() => {
  const STORAGE_KEY = 'commission_user';

  // Hardcoded friend group — edit this list to add/remove people
  const GROUP = ['Amjad', 'Chris', 'Mike', 'Jay', 'Rico'];

  let current = null;

  function init() {
    current = localStorage.getItem(STORAGE_KEY);
    renderUserButton();

    if (!current) {
      openModal();
    }

    document.getElementById('user-btn').addEventListener('click', openModal);
  }

  function getCurrent() {
    return current;
  }

  function select(name) {
    current = name;
    localStorage.setItem(STORAGE_KEY, name);
    renderUserButton();
    closeModal();
  }

  function renderUserButton() {
    document.getElementById('user-name').textContent = current || 'Pick Name';
  }

  function openModal() {
    const modal = document.getElementById('user-modal');
    const list = document.getElementById('user-list');
    list.innerHTML = '';

    GROUP.forEach(name => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.addEventListener('click', () => select(name));
      list.appendChild(btn);
    });

    modal.classList.add('open');
  }

  function closeModal() {
    document.getElementById('user-modal').classList.remove('open');
  }

  return { init, getCurrent };
})();
