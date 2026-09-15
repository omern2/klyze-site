// Klyze.gg — paylasilan oturum + ust bar profil menusu (21st/shadcn avatar-dropdown dili).
// Supabase UMD (window.supabase) gerekir. Oturum yoksa hicbir sey yapmaz.
window.KlyzeAuth = (function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  var user = null;
  var rol = null;
  var listeners = [];
  var sbClient = null;
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  // 6 rol: sahip, yonetici, yetkili, destek, rehber, stajyer (siyah-beyaz rozet)
  var ROL_ADI = {
    sahip: "Sahip", yonetici: "Yönetici", yetkili: "Yetkili",
    destek: "Destek", rehber: "Rehber", stajyer: "Stajyer", admin: "Yetkili"
  };
  window.klyzeRolAdi = function (r) { return ROL_ADI[r] || ""; };
  window.klyzeRozet = function (r) {
    if (!r || !ROL_ADI[r]) return "";
    return '<span class="rozet rozet-' + r + '">' + ROL_ADI[r] + "</span>";
  };
  // "admin" eski rol degeridir (migration 12 onu "yetkili" yapar); geriye uyumluluk icin her yerde kabul edilir.
  var HAVUZ_ROLLER = ["sahip", "yonetici", "yetkili", "destek", "stajyer", "admin"];
  var USTLEN_ROLLER = ["sahip", "yonetici", "yetkili", "destek", "admin"];

  function norm(u) {
    if (!u) return null;
    var m = u.user_metadata || {};
    return {
      id: u.id,
      email: u.email || "",
      name: m.full_name || m.name || (u.email || "").split("@")[0] || "Oyuncu",
      avatar: m.avatar_url || m.picture || "assets/logo.png"
    };
  }
  // Ayni durum icin ust uste bildirim gonderme (sayfalarin 5 kez
  // yeniden yuklenip gidip gelmesinin kok sebebi buydu).
  var lastKey = null;
  function notify() {
    var key = (user ? user.id : "-") + "|" + (rol || "-");
    if (key === lastKey) return;
    lastKey = key;
    listeners.forEach(function (fn) { try { fn(user); } catch (e) {} });
  }
  function setUser(u) {
    user = u ? norm(u) : null;
    renderTopbar();
    notify();
    if (user) yukleRol();
    else { rol = null; renderTopbar(); }
  }
  // Kendi yetki satirin + bekleyen davet varsa kabul et
  function yukleRol() {
    if (!sbClient || !user) return;
    sbClient.from("site_admins").select("rol").eq("user_id", user.id).maybeSingle()
      .then(function (res) {
        rol = (res && res.data && res.data.rol) || null;
        renderTopbar();
        notify();
        davetKabul();
      }).catch(function () {});
  }
  function davetKabul() {
    if (!sbClient || !user || !user.email) return;
    sbClient.from("site_davetler").select("email,rol,olusturan").eq("email", user.email).maybeSingle()
      .then(function (res) {
        var d = res && res.data;
        if (!d) return;
        var satir = {
          user_id: user.id,
          rol: d.rol,
          ad: String(user.name).slice(0, 24),
          avatar_url: user.avatar ? String(user.avatar).slice(0, 500) : null
        };
        sbClient.from("site_admins").upsert(satir, { onConflict: "user_id" })
          .then(function () {
            return sbClient.from("site_davetler").delete().eq("email", user.email);
          })
          .then(function () {
            return sbClient.from("role_assignment_logs").insert({
              hedef_email: user.email, hedef_uid: user.id,
              eski_rol: null, yeni_rol: d.rol, islem: "davet", yapan_admin: d.olusturan
            });
          })
          .then(function () { yukleRol(); })
          .catch(function () {});
      }).catch(function () {});
  }
  function $(id) { return document.getElementById(id); }

  // — Ust bar (21st user-profile-dropdown: avatar tetikler, baslik + ayrac + cikis) —
  // Role ozel panel linkleri: havuz rolleri -> "Destek Talepleri" + "Rehber",
  // rehber rolu -> yalniz "Rehber".
  function paneller() {
    if (HAVUZ_ROLLER.indexOf(rol) !== -1) return [
      { id: "destekNavLink", href: "admin.html", ad: "Destek Talepleri" },
      { id: "rehberNavLink", href: "rehber.html", ad: "Rehber" }
    ];
    if (rol === "rehber") return [{ id: "rehberNavLink", href: "rehber.html", ad: "Rehber" }];
    return [];
  }
  function ensureDestekLink() {
    try {
      var nav = document.querySelector(".topnav");
      if (!nav) return;
      ["destekNavLink", "rehberNavLink"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.remove();
      });
      var liste = paneller();
      if (!liste.length) return;
      var destek = null;
      nav.querySelectorAll("a").forEach(function (x) {
        if (/destek\.html$/.test(x.getAttribute("href") || "")) destek = x;
      });
      var onceki = destek && destek.nextSibling ? destek.nextSibling : null;
      liste.forEach(function (p) {
        var a = document.createElement("a");
        a.href = p.href;
        a.id = p.id;
        a.textContent = p.ad;
        if (location.pathname && location.pathname.indexOf(p.href) !== -1) a.setAttribute("aria-current", "page");
        if (onceki) nav.insertBefore(a, onceki);
        else nav.appendChild(a);
      });
    } catch (e) {}
  }
  function ensureProfilKisayol() {
    try {
      var menu = $("ppMenu");
      if (!menu) return;
      ["ppDestek", "ppRehber"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.remove();
      });
      var liste = paneller();
      if (!liste.length) return;
      var out = $("ppLogout");
      liste.forEach(function (p) {
        var a = document.createElement("a");
        a.href = p.href;
        a.id = p.id === "destekNavLink" ? "ppDestek" : "ppRehber";
        a.className = "pp-item";
        a.setAttribute("role", "menuitem");
        a.textContent = p.ad;
        if (out) menu.insertBefore(a, out);
        else menu.appendChild(a);
      });
    } catch (e) {}
  }
  function renderTopbar() {
    var loginLink = $("loginLink");
    var wrap = $("topProfile");
    if (!wrap) return;
    var logged = !!user;
    if (loginLink) loginLink.hidden = logged;
    wrap.hidden = !logged;
    if (!logged) { closeMenu(); ensureDestekLink(); return; }
    var img = $("ppImg"), mImg = $("ppMenuImg");
    if (img) { img.src = user.avatar; img.alt = user.name; }
    if (mImg) { mImg.src = user.avatar; mImg.alt = ""; }
    var nm = $("ppName"), em = $("ppEmail"), rz = $("ppRol");
    if (nm) nm.textContent = user.name;
    if (em) em.textContent = user.email;
    if (rz) rz.innerHTML = window.klyzeRozet(rol);
    ensureDestekLink();
    ensureProfilKisayol();
  }
  function closeMenu() {
    var menu = $("ppMenu"), btn = $("ppBtn");
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function wireTopbar() {
    var btn = $("ppBtn");
    if (!btn || btn.getAttribute("data-wired")) return;
    btn.setAttribute("data-wired", "1");
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var menu = $("ppMenu");
      if (!menu) return;
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (ev) {
      var menu = $("ppMenu"), wrap = $("topProfile");
      if (menu && !menu.hidden && wrap && !wrap.contains(ev.target)) closeMenu();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeMenu();
    });
    var out = $("ppLogout");
    if (out) out.addEventListener("click", function () {
      closeMenu();
      api.signOut();
    });
  }

  function init() {
    wireTopbar();
    renderTopbar();
    if (!window.supabase) { readyResolve(); return; }
    try { sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
    catch (e) { readyResolve(); return; }
    sbClient.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      setUser(s ? s.user : null);
      readyResolve();
    }).catch(function () { readyResolve(); });
    sbClient.auth.onAuthStateChange(function (ev, session) {
      if (ev === "SIGNED_IN" || ev === "TOKEN_REFRESHED" || ev === "INITIAL_SESSION") {
        setUser(session ? session.user : null);
      }
      if (ev === "SIGNED_OUT") setUser(null);
    });
  }

  var api = {
    get user() { return user; },
    get rol() { return rol; },
    isAdmin: function () { return !!rol; },
    isOwner: function () { return rol === "sahip"; },
    isYonetici: function () { return rol === "sahip" || rol === "yonetici"; },
    isRehber: function () { return rol === "rehber"; },
    havuzGorebilir: function () { return HAVUZ_ROLLER.indexOf(rol) !== -1; },
    ustlenebilir: function () { return USTLEN_ROLLER.indexOf(rol) !== -1; },
    oncelikDegistirebilir: function () { return rol === "sahip" || rol === "yonetici" || rol === "yetkili" || rol === "admin"; },
    panel: function () {
      if (HAVUZ_ROLLER.indexOf(rol) !== -1) return "havuz";
      if (rol === "rehber") return "rehber";
      return null;
    },
    ready: ready,
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    signOut: function () {
      if (sbClient) { try { sbClient.auth.signOut(); } catch (e) {} }
      setUser(null);
    },
    init: init
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  return api;
})();
