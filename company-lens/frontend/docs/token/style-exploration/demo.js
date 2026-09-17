(() => {
  const storageKey = 'ai-berkshire-style-review-theme';
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  const label = document.querySelector('[data-theme-label]');
  const iconUse = document.querySelector('[data-theme-icon] use');
  const status = document.querySelector('[data-theme-status]');

  function syncThemeControl(shouldAnnounce) {
    const isDark = root.dataset.theme === 'dark';
    const nextLabel = isDark ? '切换为浅色' : '切换为深色';

    if (label) label.textContent = nextLabel;
    if (toggle) toggle.setAttribute('aria-label', nextLabel);
    if (iconUse) iconUse.setAttribute('href', isDark ? '#icon-sun' : '#icon-moon');
    if (shouldAnnounce && status)
      status.textContent = isDark ? '已切换为深色主题' : '已切换为浅色主题';
  }

  toggle?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // The selected theme still applies for the current session.
    }
    syncThemeControl(true);
  });

  syncThemeControl(false);
})();
