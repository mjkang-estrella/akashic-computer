const CHANGE_EVENT = "model-catalog-search-change";

export function subscribeCatalogSearch(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

export function getCatalogSearch() {
  return window.location.search;
}

// The canonical, cached HTML always starts with the unfiltered catalog.
export function getServerCatalogSearch() {
  return "";
}

export function replaceCatalogSearch(query: string) {
  window.history.replaceState(null, "", query ? `/models?${query}` : "/models");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
