/* eslint-disable func-names */
// Enzyme is deprecated and does not support React 18/19.
// Tests should be migrated to React Testing Library.

window.matchMedia =
  window.matchMedia ||
  function() {
    return {
      matches: false,
      addListener() {},
      removeListener() {},
    };
  };

window.requestAnimationFrame =
  window.requestAnimationFrame ||
  function(callback) {
    setTimeout(callback, 0);
  };
