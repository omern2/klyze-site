/* Klyze.gg — site giris akisi (Supabase Auth, Google, PKCE).
   Bu dosya HICBIR tabloya yazmaz: profil satiri sunucudaki
   auth.users trigger'i ile olusur. */
(() => {
  "use strict";

  const A = window.KLYZE_AUTH;
  const DEMO = window.KLYZE_DEMO;
  const SEMA = (window.KLYZE_SUPABASE && window.KLYZE_SUPABASE.schema) || "site";
  const $ = (id) => document.getElementById(id);

  const el = {
    card: $("authCard"),
    kicker: $("authKicker"),
    title: $("authTitle"),
    lead: $("authLead"),
    panelLoading: $("panelLoading"),
    panelSignedOut: $("panelSignedOut"),
    panelSignedIn: $("panelSignedIn"),
    panelError: $("panelError"),
    googleBtn: $("googleBtn"),
    googleBtnLabel: $("googleBtnLabel"),
    logoutBtn: $("logoutBtn"),
    retryBtn: $("retryBtn"),
    continueBtn: $("continueBtn"),
    statusBox: $("authStatus"),
    statusText: $("authStatusText"),
    errorText: $("errorText"),
    terms: $("authTerms"),
    userName: $("userName"),
    userNo: $("userNo"),
    avatarImg: $("userAvatarImg"),
    avatarText: $("userAvatarText")
  };

  if (!A || !el.card || !el.googleBtn || !el.panelError || !el.errorText) {
    console.error("[klyze] giris.html beklenen alanlari icermiyor.");
    return;
  }

  const VIEWS = {
    loading: {
      kicker: "Klyze hesabı",
      title: "Oturum kontrol ediliyor",
      lead: "Bir saniye, hesabın doğrulanıyor.",
      status: "Güvenli bağlantı"
    },
    signedOut: {
      kicker: "Klyze hesabı",
      title: "Tekrar hoş geldin",
      lead: "Destek bileti açmak ve ekip yanıtlarını görmek için Klyze hesabına giriş yap.",
      status: "Google ile giriş · şifre saklanmaz"
    },
    signedIn: {
      kicker: "Giriş yapıldı",
      title: "Hesabın hazır",
      lead: "Biletlerine dönebilir, çıkış yapabilir veya ana sayfaya geçebilirsin.",
      status: "Oturum açık · bu tarayıcıda"
    },
    error: {
      kicker: "Giriş tamamlanamadı",
      title: "Bir sorun oldu",
      lead: "Mesajı okuyup tekrar deneyebilirsin.",
      status: ""
    }
  };

  const TIMEOUT_MS = 12000;
  let sb = null;
  let booted = false;
  let busy = false;
  let profileUser = null;
  let profile = null;
  let redirectWatch = 0;
  let donusZaman = 0;

  const donus = donusAdresi();

  /* Yalnızca site içi sayfalara dönüşe izin ver; dış adres açık yönlendirme olur. */
  function donusAdresi() {
    const ham = new URLSearchParams(location.search).get("donus");
    if (!ham) return null;
    try {
      const url = new URL(ham, location.origin);
      if (url.origin !== location.origin) return null;
      const dosya = (url.pathname.split("/").pop() || "").toLowerCase();
      if (dosya !== "bilet.html" && dosya !== "ekip.html" && dosya !== "index.html") return null;
      return dosya + url.search + url.hash;
    } catch (hata) {
      return null;
    }
  }

  function donusBasligi() {
    if (!donus) return "Biletlerime git";
    if (donus.indexOf("ekip.html") === 0) return "Destek paneline dön";
    if (donus.indexOf("bilet.html") === 0) return "Biletlerime dön";
    return "Geldiğin sayfaya dön";
  }

  function setView(name, opts) {
    const view = VIEWS[name] || VIEWS.loading;
    const focus = Boolean(opts && opts.focus);

    el.panelLoading.hidden = name !== "loading";
    el.panelSignedOut.hidden = name !== "signedOut";
    el.panelSignedIn.hidden = name !== "signedIn";
    el.panelError.hidden = name !== "error";

    el.kicker.textContent = view.kicker;
    el.title.textContent = view.title;
    el.lead.textContent = view.lead;
    el.card.setAttribute("aria-busy", name === "loading" ? "true" : "false");
    status(view.status, "");
    if (el.terms) el.terms.hidden = name === "signedIn";
    if (el.continueBtn) {
      el.continueBtn.hidden = name !== "signedIn";
      el.continueBtn.href = donus || "bilet.html";
      el.continueBtn.textContent = donusBasligi();
    }
    if (name !== "signedIn") document.title = "Giriş Yap — Klyze.gg";

    if (focus) {
      try { el.title.focus({ preventScroll: true }); } catch (e) { el.title.focus(); }
    }
  }

  function status(text, kind) {
    if (!el.statusText || !el.statusBox) return;
    el.statusText.textContent = text || "";
    el.statusBox.classList.toggle("is-active", kind === "ok");
    el.statusBox.classList.toggle("is-error", kind === "error");
  }

  function setBusy(on, label) {
    busy = on;
    el.googleBtn.disabled = on;
    el.googleBtn.setAttribute("aria-busy", on ? "true" : "false");
    el.googleBtnLabel.textContent = label || "Google ile devam et";
    if (el.logoutBtn) el.logoutBtn.disabled = on;
    if (el.retryBtn) el.retryBtn.disabled = on;
  }

  function fail(message) {
    clearTimeout(redirectWatch);
    setBusy(false);
    el.errorText.textContent = message;
    setView("error", { focus: true });
  }

  function renderUser(data) {
    el.userName.textContent = data.name;
    el.userNo.textContent = data.no ? "Üye #" + data.no : "Klyze üyesi";

    if (data.avatar) {
      el.avatarImg.hidden = false;
      el.avatarImg.src = data.avatar;
      el.avatarText.hidden = true;
      el.avatarText.textContent = "";
    } else {
      el.avatarImg.hidden = true;
      el.avatarImg.removeAttribute("src");
      el.avatarText.hidden = false;
      el.avatarText.textContent = A.initials(data.name);
    }

    document.title = data.name + " — Klyze.gg";
  }

  async function loadProfile(user) {
    const meta = (user && user.user_metadata) || {};
    const out = {
      name: A.cleanName(meta.full_name || meta.name || String(user.email || "").split("@")[0] || "Klyze kullanıcısı"),
      no: null,
      avatar: A.httpsUrl(meta.avatar_url || meta.picture)
    };

    try {
      const result = await A.withTimeout(
        sb.schema(SEMA).rpc("benim_profil"),
        TIMEOUT_MS
      );

      if (result.error) {
        console.warn("[klyze] profil okunamadi:", result.error.message);
        return out;
      }

      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (row) {
        out.name = A.cleanName(row.gorunen_ad) || out.name;
        const no = Number(row.uye_no);
        out.no = Number.isSafeInteger(no) ? no : null;
        out.avatar = A.httpsUrl(row.avatar_url) || out.avatar;
      }
    } catch (error) {
      console.warn("[klyze] profil istegi basarisiz:", error && error.message);
    }

    return out;
  }

  async function showUser(session, opts) {
    const user = session.user;

    if (profileUser === user.id && profile) {
      renderUser(profile);
      setView("signedIn", opts);
      otomatikDon();
      return;
    }

    setView("loading");
    const data = await loadProfile(user);
    profileUser = user.id;
    profile = data;
    renderUser(data);
    setView("signedIn", opts);
    otomatikDon();
  }

  function readUrlError() {
    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    const code = search.get("error") || search.get("error_code") || hash.get("error") || hash.get("error_code");
    if (!code) return null;

    const key = String(code).toLowerCase();
    if (A.MESSAGES[key]) return A.MESSAGES[key];

    const description = String(search.get("error_description") || hash.get("error_description") || "").trim();
    if (description) return "Giriş tamamlanamadı: " + description.slice(0, 200);
    return "Giriş tamamlanamadı. Tekrar dene.";
  }

  function cleanUrl() {
    const url = new URL(location.href);
    ["code", "error", "error_code", "error_description", "error_reason", "state"].forEach((anahtar) => {
      url.searchParams.delete(anahtar);
    });
    const temiz = url.pathname + (url.search || "");
    if (temiz === location.pathname + location.search && !location.hash) return;
    try { history.replaceState(null, "", temiz); } catch (e) { /* yoksay */ }
  }

  function otomatikDon() {
    if (!donus || donusZaman) return;
    status("Giriş tamamlandı, yönlendiriliyorsun…", "ok");
    donusZaman = window.setTimeout(() => {
      location.replace(donus);
    }, 700);
  }

  /* ---------- geçici demo oturum ---------- */
  function demoAktif() {
    return Boolean(DEMO && DEMO.aktif === true);
  }

  function demoNotu() {
    const not = document.querySelector("#authTerms .auth-note");
    if (not) {
      not.textContent = "Demo oturum: gerçek Google hesabına bağlanılmaz; veriler yalnızca bu tarayıcıda tutulur.";
    }
  }

  function demoBoot() {
    const acik = DEMO.oturumVar();

    if (acik) {
      setView("signedIn", { focus: true });
      renderUser(DEMO.profil);
      if (el.userNo) el.userNo.textContent = "Demo oturum · gerçek Google girişi değil";
      if (el.lead) el.lead.textContent = "Demo oturum açık. Biletler ve ekip paneli bu tarayıcıdaki demo verilerle çalışıyor.";
      status("Demo verileri · sunucuya yazılmaz", "ok");
    } else {
      setView("signedOut", { focus: true });
      if (el.lead) el.lead.textContent = "Demo oturumu yeniden açmak için devam et. Bu ekran gerçek Google girişi değildir.";
      el.googleBtnLabel.textContent = "Demo girişi yap";
      status("Demo oturum kapalı · veriler bu tarayıcıda", "");
    }

    demoNotu();
    booted = true;
    if (acik) otomatikDon();
  }

  async function boot() {
    clearTimeout(redirectWatch);
    setBusy(false);

    if (demoAktif()) {
      demoBoot();
      return;
    }

    setView("loading");

    if (!sb) {
      fail("Giriş altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.");
      return;
    }
    if (navigator.onLine === false) {
      fail("İnternet bağlantısı yok. Bağlanınca tekrar dene.");
      return;
    }

    let session = null;
    try {
      const result = await A.withTimeout(sb.auth.getSession(), TIMEOUT_MS);
      if (result.error) throw result.error;
      session = (result.data && result.data.session) || null;
    } catch (error) {
      fail(A.messageFor(error, "Oturum bilgisi okunamadı. Tekrar dene."));
      return;
    }

    const urlError = readUrlError();
    const hadCallback = new URLSearchParams(location.search).has("code");
    cleanUrl();

    if (session) {
      booted = true;
      await showUser(session, { focus: true });
      return;
    }

    if (urlError) {
      booted = true;
      fail(urlError);
      return;
    }

    if (hadCallback) {
      booted = true;
      fail("Giriş tamamlanamadı. Bağlantı başka bir tarayıcıda açılmış olabilir; bu sayfadan tekrar dene.");
      return;
    }

    booted = true;
    setView("signedOut", { focus: true });
  }

  async function signIn() {
    if (busy) return;

    if (demoAktif()) {
      setBusy(true, "Demo oturumu açılıyor…");
      DEMO.girisYap();
      await boot();
      return;
    }

    setBusy(true, "Google'a yönlendiriliyor…");
    status("Google'a bağlanılıyor…");

    const hedef = new URL(location.origin + location.pathname);
    if (donus) hedef.searchParams.set("donus", donus);

    try {
      const result = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: hedef.toString(),
          queryParams: { prompt: "select_account" }
        }
      });
      if (result.error) throw result.error;

      redirectWatch = setTimeout(() => {
        if (!busy) return;
        setBusy(false);
        status("Yönlendirme tamamlanmadı. Tekrar dene.", "error");
      }, 10000);
    } catch (error) {
      fail(A.messageFor(error, "Google girişi başlatılamadı. Tekrar dene."));
    }
  }

  async function signOut() {
    if (busy) return;
    window.clearTimeout(donusZaman);
    donusZaman = 0;

    if (demoAktif()) {
      setBusy(true, "Çıkış yapılıyor…");
      await DEMO.cikisYap();
      await boot();
      return;
    }

    setBusy(true, "Çıkış yapılıyor…");

    try {
      await sb.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("[klyze] cikis istegi basarisiz:", error && error.message);
    }

    profileUser = null;
    profile = null;
    setBusy(false);
    setView("signedOut", { focus: true });
    status("Çıkış yapıldı.", "ok");
  }

  function oturumDinleyicisi(event, session) {
    if (!booted) return;
    if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
      window.clearTimeout(donusZaman);
      donusZaman = 0;
      profileUser = null;
      profile = null;
      setView("signedOut", { focus: true });
      status("Oturum sona erdi. Tekrar giriş yap.", "error");
      return;
    }
    if (event === "SIGNED_IN" && session) {
      showUser(session, { focus: false });
    }
  }

  el.googleBtn.addEventListener("click", signIn);
  if (el.logoutBtn) el.logoutBtn.addEventListener("click", signOut);
  if (el.retryBtn) el.retryBtn.addEventListener("click", boot);

  if (!demoAktif()) {
    sb = A.createClient();
    if (!sb) {
      fail("Giriş altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.");
      return;
    }
    sb.auth.onAuthStateChange(oturumDinleyicisi);
  }

  window.addEventListener("pagehide", () => {
    clearTimeout(redirectWatch);
    clearTimeout(donusZaman);
  });
  window.addEventListener("offline", () => {
    if (!demoAktif()) status("Bağlantı kesildi.", "error");
  });
  window.addEventListener("online", () => {
    if (demoAktif()) return;
    if (el.panelSignedOut.hidden && el.panelSignedIn.hidden) {
      status("Bağlantı geri geldi. Tekrar dene.", "");
    }
  });

  boot();
})();
