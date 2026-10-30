/* Liderlik tablosu — tek kaynak: site.liderlik_listele RPC'si.
   Veri kullanicilar.liderlik tablosunda durur; o sema API'ye kapalidir,
   tarayici yalniz bu fonksiyonu cagirabilir. */
(() => {
  "use strict";

  const SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  const LIMIT = 1000;
  const ONLINE_WINDOW_MS = 150000;
  const PAGE_SIZE = 25;
  const RANKS = [
    { group: "Radyant", min: 27, max: 27, icon: "assets/rank-radiant.png" },
    { group: "Yükselen", min: 24, max: 26, icon: "assets/rank-ascendant.png" },
    { group: "Ölümsüz", min: 21, max: 23, icon: "assets/rank-immortal.png" },
    { group: "Elmas", min: 18, max: 20, icon: "assets/rank-diamond.png" },
    { group: "Platin", min: 15, max: 17, icon: "assets/rank-plat.png" },
    { group: "Altın", min: 12, max: 14, icon: "assets/rank-gold.png" },
    { group: "Gümüş", min: 9, max: 11, icon: "assets/rank-silver.png" },
    { group: "Bronz", min: 6, max: 8, icon: "assets/rank-bronze.png" },
    { group: "Demir", min: 3, max: 5, icon: "assets/rank-iron.png" }
  ];
  const RANK_FILTERS = ["Tümü", "Demir", "Bronz", "Gümüş", "Altın", "Platin", "Elmas", "Ölümsüz", "Yükselen", "Radyant"];
  const AVATAR_COLORS = 8;

  const state = {
    rows: [],
    loading: false,
    loaded: false,
    error: false,
    rank: "all",
    q: "",
    limit: PAGE_SIZE,
    lastUpdated: 0
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    page: $("page-liderlik"),
    rows: $("lbRows"),
    table: $("lbTable"),
    loading: $("lbLoading"),
    empty: $("lbEmpty"),
    emptyTitle: $("lbEmptyTitle"),
    emptyText: $("lbEmptyText"),
    emptyReset: $("lbEmptyReset"),
    error: $("lbError"),
    errorRetry: $("lbErrorRetry"),
    more: $("lbMore"),
    moreText: $("lbMoreText"),
    count: $("lbCount"),
    updated: $("lbUpdated"),
    refresh: $("lbRefresh"),
    search: $("lbSearch"),
    clear: $("lbClear"),
    filterWrap: $("lbFilterWrap"),
    filter: $("lbFilter"),
    filterBtn: $("lbFilterBtn"),
    filterPanel: $("lbFilterPanel"),
    filterLabel: $("lbFilterLabel"),
    total: $("lbTotal"),
    online: $("lbOnline"),
    topElo: $("lbTopElo"),
    topRank: $("lbTopRank"),
    podium: $("lbPodium")
  };

  const escapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => escapeMap[char]);
  const fmt = new Intl.NumberFormat("tr-TR");
  const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
  const clock = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

  function safeImage(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function rankFor(tier) {
    for (const rank of RANKS) {
      if (tier >= rank.min && tier <= rank.max) {
        const level = tier === 27 ? "" : ` ${tier - rank.min + 1}`;
        return { group: rank.group, label: rank.group + level, icon: rank.icon };
      }
    }
    return { group: "Derecesiz", label: "Derecesiz", icon: "" };
  }

  function statusFor(row) {
    const fresh = row.seen > 0 && Date.now() - row.seen <= ONLINE_WINDOW_MS;
    const online = fresh && row.durum !== "cevrimdisi";
    if (online) {
      if (row.durum === "oyunda") {
        return { online: true, game: true, text: row.aktivite ? `Oyunda · ${row.aktivite}` : "Oyunda" };
      }
      return { online: true, game: false, text: row.aktivite || "Çevrimiçi" };
    }
    return {
      online: false,
      game: false,
      text: row.seen ? `Son görülme ${relativeTime(row.seen)}` : "Çevrimdışı"
    };
  }

  function relativeTime(timestamp) {
    const diff = Math.max(0, Date.now() - timestamp);
    if (diff < 60000) return "az önce";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    try {
      return shortDate.format(new Date(timestamp));
    } catch {
      return "";
    }
  }

  function avatarClass(name) {
    let hash = 0;
    for (const char of String(name || "")) hash = (hash * 31 + char.charCodeAt(0)) & 0x7fffffff;
    return `lb-avatar--c${hash % AVATAR_COLORS}`;
  }

  function avatarMarkup(row, status, extraClass = "") {
    const initial = String(row.name || "?").trim().charAt(0).toUpperCase() || "?";
    const image = row.card
      ? `<img class="lb-avatar-img" src="${esc(row.card)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : "";
    const presence = status.game ? "is-game" : status.online ? "is-on" : "is-off";
    return `<span class="lb-avatar ${avatarClass(row.name)} ${extraClass}"><span class="lb-avatar-fallback">${esc(initial)}</span>${image}<i class="lb-presence ${presence}" aria-hidden="true"></i></span>`;
  }

  function normalize(rawRows) {
    const byPlayer = new Map();
    for (const raw of rawRows) {
      const name = String(raw.oyuncu_adi ?? "").trim();
      if (!name) continue;
      const tag = String(raw.tag ?? "").trim();
      const tier = Number(raw.current_tier) || 0;
      const rr = Number(raw.rutbe_puani) || 0;
      const storedElo = Number(raw.elo) || 0;
      const elo = tier > 0 ? Math.max(300, tier * 100 + rr) : storedElo;
      const seen = Date.parse(raw.last_seen || "");
      const row = {
        name,
        tag,
        tier,
        elo,
        seen: Number.isNaN(seen) ? 0 : seen,
        card: safeImage(raw.card_small_url),
        durum: String(raw.durum || "").trim().toLowerCase(),
        aktivite: String(raw.aktivite || "").trim()
      };
      const key = `${name}#${tag}`.toLocaleLowerCase("tr-TR");
      const previous = byPlayer.get(key);
      if (!previous || row.elo > previous.elo || (row.elo === previous.elo && row.seen > previous.seen)) {
        byPlayer.set(key, row);
      }
    }
    return [...byPlayer.values()].sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      return a.name.localeCompare(b.name, "tr");
    });
  }

  function wireImages(root) {
    if (!root) return;
    root.querySelectorAll(".lb-avatar-img").forEach((image) => {
      if (image.complete && image.naturalWidth === 0) {
        image.remove();
        return;
      }
      image.addEventListener("error", () => image.remove(), { once: true });
    });
  }

  function setBusy(busy) {
    el.refresh?.classList.toggle("is-loading", busy);
    el.refresh?.setAttribute("aria-busy", String(busy));
    el.page?.setAttribute("aria-busy", String(busy));
  }

  function setUpdated(text, isError) {
    if (!el.updated) return;
    el.updated.textContent = text;
    el.updated.classList.toggle("is-error", Boolean(isError));
  }

  function renderStats() {
    const online = state.rows.filter((row) => statusFor(row).online).length;
    const top = state.rows[0];
    el.total.textContent = state.rows.length ? fmt.format(state.rows.length) : "—";
    el.online.textContent = state.rows.length ? fmt.format(online) : "—";
    el.topElo.textContent = top ? fmt.format(top.elo) : "—";
    el.topRank.textContent = top ? rankFor(top.tier).group : "—";
  }

  function podiumCard(row, position) {
    const status = statusFor(row);
    const rank = rankFor(row.tier);
    const rankIcon = rank.icon ? `<img src="${esc(rank.icon)}" alt="" width="20" height="20" loading="eager">` : "";
    const tag = row.tag ? `#${esc(row.tag)}` : "";
    return `<article class="lb-podium-card lb-podium-card--${position}">
      <div class="lb-podium-top">
        <span class="lb-podium-ord" aria-hidden="true">0${position}</span>
        ${avatarMarkup(row, status, "lb-avatar--lg")}
        <span class="lb-podium-id">
          <b title="${esc(row.name)}">${esc(row.name)}</b>
          <small>${tag}${tag && status.text ? " · " : ""}${esc(status.text)}</small>
        </span>
      </div>
      <div class="lb-podium-bottom">
        <span class="lb-podium-rank">${rankIcon}<span>${esc(rank.label)}</span></span>
        <span class="lb-podium-elo"><span>ELO</span><b>${fmt.format(row.elo)}</b></span>
      </div>
    </article>`;
  }

  function renderPodium() {
    if (!el.podium) return;
    if (!state.rows.length) {
      const metin = state.loaded ? "Zirve verisi henüz yok." : "Zirve verisi yükleniyor…";
      el.podium.innerHTML = `<p class="lb-podium-empty">${metin}</p>`;
      return;
    }
    el.podium.innerHTML = state.rows.slice(0, 3).map((row, index) => podiumCard(row, index + 1)).join("");
    wireImages(el.podium);
  }

  function podiumSkeleton() {
    if (!el.podium) return;
    el.podium.innerHTML = Array.from({ length: 3 }, (_, index) =>
      `<div class="lb-podium-card lb-podium-card--${index + 1} lb-podium-skel" aria-hidden="true"><span></span><span></span><span></span></div>`
    ).join("");
  }

  function rowMarkup(row) {
    const status = statusFor(row);
    const rank = rankFor(row.tier);
    const position = state.rows.indexOf(row) + 1;
    const statusClass = status.game ? "is-game" : status.online ? "is-online" : "";
    const statusDot = `<i class="lb-status-dot" aria-hidden="true"></i>`;
    const rankIcon = rank.icon ? `<img src="${esc(rank.icon)}" alt="" width="24" height="24" loading="lazy" decoding="async">` : "";
    const tag = row.tag ? ` <span class="lb-player-tag">#${esc(row.tag)}</span>` : "";
    return `<div class="lb-row" role="row">
      <div class="lb-pos" role="cell"><span class="lb-pos-num">${position}</span></div>
      <div class="lb-player" role="cell">
        ${avatarMarkup(row, status)}
        <span class="lb-player-txt">
          <span class="lb-player-name" title="${esc(row.name)}${row.tag ? `#${esc(row.tag)}` : ""}">${esc(row.name)}${tag}</span>
          <span class="lb-player-status ${statusClass}">${statusDot}${esc(status.text)}</span>
        </span>
      </div>
      <div class="lb-rank" role="cell">${rankIcon}<b>${esc(rank.label)}</b></div>
      <div class="lb-elo" role="cell">${fmt.format(row.elo)}</div>
    </div>`;
  }

  function currentFiltered() {
    const query = state.q.trim().toLocaleLowerCase("tr-TR");
    return state.rows.filter((row) => {
      if (state.rank !== "all" && rankFor(row.tier).group !== state.rank) return false;
      if (!query) return true;
      const haystack = `${row.name}#${row.tag}`.toLocaleLowerCase("tr-TR");
      return haystack.includes(query) || row.name.toLocaleLowerCase("tr-TR").includes(query);
    });
  }

  function renderRows() {
    const filtered = currentFiltered();
    const visible = filtered.slice(0, state.limit);
    const active = state.rows.filter((row) => statusFor(row).online).length;
    const filteredActive = filtered.filter((row) => statusFor(row).online).length;
    const isFiltered = Boolean(state.q.trim()) || state.rank !== "all";

    el.empty.hidden = true;
    el.error.hidden = true;
    el.table.hidden = false;
    el.loading.hidden = true;
    el.rows.innerHTML = visible.map(rowMarkup).join("");
    wireImages(el.rows);

    if (!state.rows.length) {
      el.table.hidden = true;
      el.empty.hidden = false;
      el.emptyTitle.textContent = "Sıralamada henüz oyuncu yok";
      el.emptyText.textContent = "Klyze kullanan oyuncular burada listelenir.";
      el.emptyReset.hidden = true;
      el.count.textContent = "Henüz oyuncu yok";
      el.more.hidden = true;
      return;
    }

    if (!filtered.length) {
      el.table.hidden = true;
      el.empty.hidden = false;
      el.emptyTitle.textContent = "Eşleşen oyuncu bulunamadı";
      el.emptyText.textContent = "Farklı bir Riot ID veya rank filtresi dene.";
      el.emptyReset.hidden = false;
      el.count.textContent = "0 sonuç";
      el.more.hidden = true;
      return;
    }

    el.count.textContent = isFiltered
      ? `${fmt.format(filtered.length)} sonuç · ${fmt.format(filteredActive)} aktif`
      : `${fmt.format(state.rows.length)} oyuncu · ${fmt.format(active)} aktif, ${fmt.format(state.rows.length - active)} çevrim dışı`;

    const remaining = filtered.length - visible.length;
    el.more.hidden = remaining <= 0;
    if (remaining > 0) el.moreText.textContent = `Daha fazla göster (${fmt.format(remaining)})`;
  }

  function renderAll() {
    renderStats();
    renderPodium();
    renderRows();
    if (state.error) {
      setUpdated("Yenilenemedi · son veriler", true);
    } else if (state.lastUpdated) {
      setUpdated(`Son güncelleme ${clock.format(new Date(state.lastUpdated))}`, false);
    }
  }

  function renderLoading() {
    if (state.rows.length) {
      setUpdated("Yenileniyor…", false);
      return;
    }
    setUpdated("Sıralama yükleniyor…", false);
    el.total.textContent = "—";
    el.online.textContent = "—";
    el.topElo.textContent = "—";
    el.topRank.textContent = "—";
    el.count.textContent = "Sıralama yükleniyor…";
    el.table.hidden = true;
    el.empty.hidden = true;
    el.error.hidden = true;
    el.more.hidden = true;
    el.loading.hidden = false;
    podiumSkeleton();
  }

  function renderError() {
    setUpdated("Bağlantı kurulamadı", true);
    el.total.textContent = "—";
    el.online.textContent = "—";
    el.topElo.textContent = "—";
    el.topRank.textContent = "—";
    el.count.textContent = "Veri alınamadı";
    el.table.hidden = true;
    el.empty.hidden = true;
    el.loading.hidden = true;
    el.more.hidden = true;
    el.error.hidden = false;
    if (el.podium) el.podium.innerHTML = '<p class="lb-podium-empty">Zirve verisi yüklenemedi.</p>';
  }

  async function load(force = false) {
    if (state.loading) return;
    if (!force && state.loaded && Date.now() - state.lastUpdated < 120000) return;
    state.loading = true;
    state.error = false;
    setBusy(true);
    renderLoading();
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/liderlik_listele`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Accept-Profile": "site",
          "Content-Profile": "site"
        },
        body: JSON.stringify({ p_limit: LIMIT }),
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Beklenmeyen veri");
      state.rows = normalize(data);
      state.loaded = true;
      state.lastUpdated = Date.now();
      renderAll();
    } catch (error) {
      state.error = true;
      state.loaded = true;
      if (state.rows.length) {
        renderAll();
      } else {
        renderError();
      }
    } finally {
      state.loading = false;
      setBusy(false);
    }
  }

  function syncFilterUI() {
    el.filter?.querySelectorAll(".lb-rank-option").forEach((button) => {
      button.setAttribute("aria-pressed", String((button.dataset.rank || "all") === state.rank));
    });
    if (el.filterLabel) el.filterLabel.textContent = state.rank === "all" ? "Tüm ranklar" : state.rank;
    el.filterBtn?.classList.toggle("is-active", state.rank !== "all");
  }

  function setFilterOpen(open) {
    if (!el.filterPanel || !el.filterBtn) return;
    el.filterPanel.hidden = !open;
    el.filterBtn.setAttribute("aria-expanded", String(open));
  }

  function setRank(rank) {
    state.rank = rank;
    state.limit = PAGE_SIZE;
    syncFilterUI();
    setFilterOpen(false);
    renderRows();
  }

  function clearSearch() {
    if (!el.search) return;
    el.search.value = "";
    state.q = "";
    state.limit = PAGE_SIZE;
    if (el.clear) el.clear.hidden = true;
    renderRows();
  }

  function clearFilters() {
    clearSearch();
    setRank("all");
  }

  function init() {
    if (!el.page) return;
    el.search?.addEventListener("input", () => {
      state.q = el.search.value;
      state.limit = PAGE_SIZE;
      if (el.clear) el.clear.hidden = !state.q;
      renderRows();
    });
    el.clear?.addEventListener("click", clearSearch);
    el.filterBtn?.addEventListener("click", () => {
      setFilterOpen(Boolean(el.filterPanel?.hidden));
    });
    el.filter?.addEventListener("click", (event) => {
      const button = event.target.closest(".lb-rank-option");
      if (button) setRank(button.dataset.rank || "all");
    });
    document.addEventListener("click", (event) => {
      if (!el.filterPanel || el.filterPanel.hidden) return;
      if (!el.filterWrap?.contains(event.target)) setFilterOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !el.filterPanel || el.filterPanel.hidden) return;
      setFilterOpen(false);
      el.filterBtn?.focus();
    });
    el.refresh?.addEventListener("click", () => load(true));
    el.errorRetry?.addEventListener("click", () => load(true));
    el.emptyReset?.addEventListener("click", clearFilters);
    el.more?.addEventListener("click", () => {
      state.limit += PAGE_SIZE;
      renderRows();
    });
    syncFilterUI();
  }

  init();

  window.KlyzeLiderlik = {
    load: () => load(false),
    refresh: () => load(true)
  };
})();
