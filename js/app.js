// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  Users.init();
  Feed.init();
  Takes.init();
  setupTabs();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.view;

      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`view-${target}`).classList.add('active');

      // Refresh takes when switching to that tab
      if (target === 'takes') {
        Takes.loadTakes();
      }
    });
  });
}
