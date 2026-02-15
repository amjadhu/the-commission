// App entry: wire up modules once the DOM is ready. This ensures elements exist
// before modules try to read or write to the DOM.
document.addEventListener('DOMContentLoaded', () => {
  DB.init();     // initialize Firebase wrapper (may be local-only)
  Users.init();  // setup user selection + stored identity
  Feed.init();   // load and render RSS feed
  Takes.init();  // setup takes UI and form handling
  setupTabs();   // tab navigation behavior
});

// Simple tab system: show/hide views and refresh certain views on switch.
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.view;

      // remove active class from all tabs/views then enable the clicked one
      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`view-${target}`).classList.add('active');

      // When switching to the takes view we reload the list to show fresh data
      if (target === 'takes') {
        Takes.loadTakes();
      }
    });
  });
}
