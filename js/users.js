const Users = (() => {
  // Key used for persisting the chosen user in localStorage.
  const STORAGE_KEY = 'commission_user';

  // Hardcoded friend group — edit this list to add/remove people shown in the modal.
  const GROUP = ['Amjad', 'Chris', 'Mike', 'Jay', 'Rico'];

  // `current` stores the selected user name or null when not chosen.
  let current = null;

  // Initialize users subsystem: read persisted name (if any), show UI, and
  // open modal to pick a name if none is selected yet.
  function init() {
    current = localStorage.getItem(STORAGE_KEY);
    renderUserButton();

    if (!current) {
      openModal();
    }

    document.getElementById('user-btn').addEventListener('click', openModal);
  }

  // Return the currently-selected user id/name (string) or null.
  function getCurrent() {
    return current;
  }

  // Select a user from the modal: persist selection and update UI.
  function select(name) {
    current = name;
    localStorage.setItem(STORAGE_KEY, name);
    renderUserButton();
    closeModal();
  }

  // Update the small button that shows the chosen name.
  function renderUserButton() {
    document.getElementById('user-name').textContent = current || 'Pick Name';
  }

  // Build and open the modal that allows picking from the GROUP list.
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
