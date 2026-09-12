// Single source of the debug flag for every script in the extension.
// `scripts/version-deploy.cjs` rewrites the `true` below on a release build,
// so keep this declaration in a shape that a plain string replace can match.
(function () {
  const DEBUG_MODE = false;

  window.debugLog = DEBUG_MODE ? console.log.bind(console, '[HN Copy Links]') : () => {};
  window.errorLog = DEBUG_MODE ? console.error.bind(console, '[HN Copy Links]') : () => {};
})();
