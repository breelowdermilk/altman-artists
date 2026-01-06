(() => {
  const path = window.location.pathname.replace(/\/+$/, "/");
  const candidates = new Set([path, path.replace(/\/index\.html$/, "/")]);

  for (const link of document.querySelectorAll("a[data-nav]")) {
    try {
      const href = new URL(link.getAttribute("href"), window.location.origin).pathname.replace(/\/+$/, "/");
      if (candidates.has(href)) link.setAttribute("aria-current", "page");
    } catch {
      // ignore
    }
  }

  const rosterControls = document.querySelector("[data-roster-controls]");
  if (rosterControls) {
    const searchInput = document.getElementById("roster-search");
    const typeSelect = document.getElementById("roster-filter");
    const countEl = document.getElementById("roster-count");
    const emptyEl = document.getElementById("roster-empty");
    const cards = Array.from(document.querySelectorAll("[data-artist-card]"));

    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();

    const apply = () => {
      const query = normalize(searchInput?.value || "");
      const type = (typeSelect?.value || "").trim();
      let shown = 0;

      for (const card of cards) {
        const hay = card.getAttribute("data-name") || "";
        const cardType = card.getAttribute("data-type") || "";
        const matchesQuery = !query || hay.includes(query);
        const matchesType = !type || cardType === type;
        const show = matchesQuery && matchesType;
        card.style.display = show ? "" : "none";
        if (show) shown += 1;
      }

      if (countEl) countEl.textContent = String(shown);
      if (emptyEl) emptyEl.style.display = shown === 0 ? "" : "none";

      try {
        const url = new URL(window.location.href);
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        if (type) url.searchParams.set("type", type);
        else url.searchParams.delete("type");
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore
      }
    };

    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("q") || "";
      const t = url.searchParams.get("type") || "";
      if (searchInput && q) searchInput.value = q;
      if (typeSelect && t) typeSelect.value = t;
    } catch {
      // ignore
    }

    searchInput?.addEventListener("input", apply);
    typeSelect?.addEventListener("change", apply);
    apply();
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]";

  if (isLocalhost) {
    try {
      const es = new EventSource("/__reload");
      es.addEventListener("reload", () => window.location.reload());
      es.addEventListener("message", () => window.location.reload());
    } catch {
      // ignore
    }
  }
})();
