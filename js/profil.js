/* Klyze.gg — profil sayfasi.
   Okuma/yazma: site semasindaki iki RPC — site.benim_profil() ve
   site.gorunen_ad_guncelle(). Kullanici kimligi istemciden gitmez;
   hangi satirin "benim" oldugunu sunucu auth.uid() ile cozer.
   Insert/delete yok; satir sunucudaki auth trigger'i ile olusur. */
(() => {
  "use strict";

  const A = window.KLYZE_AUTH;
  const SEMA = (window.KLYZE_SUPABASE && window.KLYZE_SUPABASE.schema) || "site";
  const $ = (id) => document.getElementById(id);

  const el = {
    card: $("profileCard"),
    loading: $("pLoading"),
    error: $("pError"),
    errorText: $("pErrorText"),
    retry: $("pRetry"),
    body: $("pBody"),
    form: $("pForm"),
    avatarImg: $("pAvatarImg"),
    avatarText: $("pAvatarText"),
    title: $("profileTitle"),
    sub: $("pSub"),
    name: $("pName"),
    hint: $("pNameHint"),
    save: $("pSave"),
    alert: $("pAlert"),
    fNo: $("fNo"),
    fMethod: $("fMethod"),
    fSince: $("fSince"),
    fUpdated: $("fUpdated"),
    logout: $("pLogout")
  };

  if (!A || !el.card || !el.body || !el.form || !el.name || !el.save) {
    console.error("[klyze] profil.html beklenen alanlari icermiyor.");
    return;
  }

  const TIMEOUT_MS = 12000;
  const PROVIDERS = { google: "Google", email: "E-posta", github: "GitHub" };

  let sb = null;
  let session = null;
  let row = null;
  let savedName = "";
  let busy = false;
  let alertTimer = 0;
  let avatarBroken = false;

  /* ---------- gorunum ---------- */

  function setView(state, opts) {
    const focus = Boolean(opts && opts.focus);

    el.loading.hidden = state !== "loading";
    el.error.hidden = state !== "error";
    el.body.hidden = state !== "ready";
    el.card.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    if (state !== "ready") document.title = "Profil — Klyze.gg";

    if (!focus) return;
    const target = state === "ready" ? el.title : state === "error" ? el.retry : null;
    if (!target) return;
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
  }

  function showError(message) {
    busy = false;
    clearTimeout(alertTimer);
    el.errorText.textContent = message;
    setView("error", { focus: true });
  }

  function clearAlert() {
    clearTimeout(alertTimer);
    el.alert.hidden = true;
    el.alert.textContent = "";
    el.alert.classList.remove("is-ok", "is-error");
    el.alert.setAttribute("role", "alert");
  }

  function showAlert(message, kind) {
    clearTimeout(alertTimer);
    el.alert.textContent = message;
    el.alert.classList.toggle("is-ok", kind === "ok");
    el.alert.classList.toggle("is-error", kind === "error");
    el.alert.setAttribute("role", kind === "ok" ? "status" : "alert");
    el.alert.hidden = false;
    if (kind === "ok") {
      alertTimer = setTimeout(clearAlert, 4000);
    }
  }

  function syncForm() {
    const name = A.cleanName(el.name.value);
    const dirty = name !== savedName;
    const valid = name.length >= 1;

    el.save.disabled = busy || !dirty || !valid;
    el.name.setAttribute("aria-invalid", valid ? "false" : "true");
    el.hint.textContent = "Sitede bu ad görünür · " + name.length + "/80";
  }

  function renderAvatar(name, url) {
    const img = el.avatarImg;
    const text = el.avatarText;

    if (url && !avatarBroken) {
      img.hidden = false;
      if (img.getAttribute("src") !== url) img.src = url;
      text.hidden = true;
      text.textContent = "";
      return;
    }

    img.hidden = true;
    img.removeAttribute("src");
    text.hidden = false;
    text.textContent = A.initials(name);
  }

  function providerOf(user) {
    const meta = (user && user.app_metadata) || {};
    const first = Array.isArray(meta.providers) ? meta.providers[0] : "";
    const key = String(meta.provider || first || "google").toLowerCase();
    return PROVIDERS[key] || "Google";
  }

  function render(data, user) {
    const raw = A.cleanName(data.gorunen_ad);
    const name = raw || "Klyze üyesi";
    const meta = (user && user.user_metadata) || {};
    const avatar = A.httpsUrl(data.avatar_url) || A.httpsUrl(meta.avatar_url || meta.picture);
    const no = Number(data.uye_no);

    el.title.textContent = name;
    el.sub.textContent = Number.isSafeInteger(no) && no > 0 ? "Üye #" + no : "Klyze üyesi";
    el.fNo.textContent = Number.isSafeInteger(no) && no > 0 ? "#" + no : "—";
    el.fMethod.textContent = providerOf(user);
    el.fSince.textContent = A.formatDate(data.olusturma_at);
    el.fUpdated.textContent = A.formatDate(data.guncelleme_at);

    if (el.name.value !== raw) el.name.value = raw;
    savedName = raw;
    syncForm();
    renderAvatar(name, avatar);

    document.title = name + " — Klyze.gg";
  }

  /* ---------- veri ---------- */

  async function fetchProfile() {
    const result = await A.withTimeout(
      sb.schema(SEMA).rpc("benim_profil"),
      TIMEOUT_MS
    );
    if (result.error) throw result.error;
    return firstRow(result.data);
  }

  /* PostgREST set döndüren fonksiyonu dizi olarak verir; tek satır bekliyoruz. */
  function firstRow(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  function goToLogin() {
    location.replace("giris.html");
  }

  /* ---------- akis ---------- */

  async function boot(opts) {
    clearAlert();
    setView("loading");
    busy = false;
    el.save.disabled = true;

    if (!sb) {
      showError("Profil altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.");
      return;
    }
    if (navigator.onLine === false) {
      showError("İnternet bağlantısı yok. Bağlanınca tekrar dene.");
      return;
    }

    let current = null;
    try {
      const result = await A.withTimeout(sb.auth.getSession(), TIMEOUT_MS);
      if (result.error) throw result.error;
      current = (result.data && result.data.session) || null;
    } catch (error) {
      showError(A.messageFor(error, "Oturum bilgisi okunamadı. Tekrar dene."));
      return;
    }

    if (!current) {
      goToLogin();
      return;
    }
    session = current;

    try {
      row = await fetchProfile();
    } catch (error) {
      showError(A.messageFor(error, "Profil yüklenemedi. Tekrar dene."));
      return;
    }

    if (!row) {
      showError("Profil kaydın bulunamadı. Çıkış yapıp yeniden giriş yapmayı dene.");
      return;
    }

    avatarBroken = false;
    render(row, current.user);
    setView("ready", opts);
  }

  async function save() {
    if (busy || !session || !row) return;

    const name = A.cleanName(el.name.value);
    if (!name) {
      showAlert("Görünen ad boş olamaz.", "error");
      el.name.focus();
      return;
    }
    if (name === savedName) {
      syncForm();
      return;
    }

    busy = true;
    el.save.disabled = true;
    clearAlert();

    try {
      const result = await A.withTimeout(
        sb.schema(SEMA).rpc("gorunen_ad_guncelle", { p_ad: name }),
        TIMEOUT_MS
      );
      if (result.error) throw result.error;

      const saved = firstRow(result.data);
      if (!saved) {
        showAlert("Profil güncellenemedi. Sayfayı yenileyip tekrar dene.", "error");
        return;
      }

      row = saved;
      render(row, session.user);
      showAlert("Görünen ad kaydedildi.", "ok");
    } catch (error) {
      showAlert("Kaydedilemedi: " + A.messageFor(error, "bilinmeyen bir hata oluştu."), "error");
    } finally {
      busy = false;
      syncForm();
    }
  }

  async function signOut() {
    if (busy) return;
    busy = true;
    el.save.disabled = true;
    if (el.logout) el.logout.disabled = true;

    try {
      await sb.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("[klyze] cikis istegi basarisiz:", error && error.message);
    }

    goToLogin();
  }

  /* ---------- baslat ---------- */

  sb = A.createClient();
  if (!sb) {
    showError("Profil altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.");
    return;
  }

  el.form.addEventListener("submit", (event) => {
    event.preventDefault();
    save();
  });
  el.name.addEventListener("input", () => {
    clearAlert();
    syncForm();
  });
  el.retry.addEventListener("click", () => boot({ focus: true }));
  if (el.logout) el.logout.addEventListener("click", signOut);

  el.avatarImg.addEventListener("error", () => {
    if (el.avatarImg.hidden) return;
    avatarBroken = true;
    el.avatarImg.hidden = true;
    el.avatarImg.removeAttribute("src");
    el.avatarText.hidden = false;
    el.avatarText.textContent = A.initials((row && row.gorunen_ad) || el.name.value);
  });

  sb.auth.onAuthStateChange((event, next) => {
    if (event === "SIGNED_OUT") {
      goToLogin();
      return;
    }
    if (next) session = next;
  });

  window.addEventListener("pagehide", () => clearTimeout(alertTimer));

  boot({ focus: true });
})();
