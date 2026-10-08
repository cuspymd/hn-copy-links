// Pure logic: which of the supported sites a page belongs to. Each site core
// (hn-core.js, lobsters-core.js) publishes a `site` description - how to find
// a row, where its buttons go, how to read it and how to store its mark - and
// content.js works only through the one picked here.
(function () {
  function siteCores() {
    return [window.HnCore?.site, window.LobstersCore?.site].filter(Boolean);
  }

  function siteForHostname(hostname, sites = siteCores()) {
    return sites.find((site) => site.hostname === hostname) || null;
  }

  window.SiteCore = {
    siteCores,
    siteForHostname,
  };
})();
