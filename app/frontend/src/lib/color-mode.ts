export const initColorModeScript = `
  (function () {
    try {
      var storeStr = localStorage.getItem('ui-store');
      var colorMode = 'system';
      if (storeStr) {
        var store = JSON.parse(storeStr);
        if (store && store.state && store.state.colorMode) {
          colorMode = store.state.colorMode;
        }
      }
      
      var isDark =
        colorMode === 'dark' ||
        (colorMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (_e) {}
  })();
`;

export function initColorMode() {
  const storeStr = localStorage.getItem('ui-store');
  let colorMode = 'system';
  if (storeStr) {
    try {
      const store = JSON.parse(storeStr);
      if (store?.state?.colorMode) {
        colorMode = store.state.colorMode;
      }
    } catch (_e) {}
  }

  const isDark =
    colorMode === 'dark' ||
    (colorMode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
