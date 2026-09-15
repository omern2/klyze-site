// Klyze.gg — destek havuzu V2 (Discord mantigi).
// Havuzda YAZISMA YOK: yetkili onizler -> "Talebi Ustlen" -> talep.html?id=... (yeni sayfa).
// Gizlilik: RLS baskasina atanmisi dondurmez; UI da cift filtre uygular.
(function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  var DURUM = { yeni: "Yeni", beklemede: "Beklemede", incelemede: "İnceleniyor", yanitlandi: "Yanıtlandı", cozuldu: "Çözüldü", kapali: "Çözüldü" };
  var ONC = { dusuk: "Düşük", normal: "Normal", yuksek: "Yüksek", kritik: "Kritik" };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtTarih(iso) {
    try {
      return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function zamanKisa(iso) {
    try {
      var dk = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      if (dk < 1) return "az önce";
      if (dk < 60) return dk + " dk önce";
      var sa = Math.round(dk / 60);
      if (sa < 24) return sa + " sa önce";
      return Math.round(sa / 24) + " gün önce";
    } catch (e) { return fmtTarih(iso); }
  }
  function waitAuth(fn) {
    var n = 0;
    var iv = setInterval(function () {
      if (window.KlyzeAuth) { clearInterval(iv); fn(); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  }

  var sb = null;
  var tumu = [];
  var ADMINMAP = {};
  var PUANORT = { n: 0, top: 0 };
  var SEKME = "havuz"; // havuz | benim | cozulen
  var rtKanal = null;
  var rtTimer = null;

  function adminMi() {
    return sb.from("site_admins").select("user_id").limit(1)
      .then(function (res) { return !res.error && res.data && res.data.length > 0; })
      .catch(function () { return false; });
  }
  function ben() { return (window.KlyzeAuth && window.KlyzeAuth.user) || null; }
  function sahipMiyim() { return !!(window.KlyzeAuth && window.KlyzeAuth.isOwner && window.KlyzeAuth.isOwner()); }
  function yoneticiMiyim() { var A = window.KlyzeAuth; return !!(A && A.isYonetici && A.isYonetici()); }
  function ustlenebilirMi() { var A = window.KlyzeAuth; return !!(A && A.ustlenebilir && A.ustlenebilir()); }

  function gorunurMu(t) {
    var u = ben();
    if (!u) return false;
    if (yoneticiMiyim()) return true;
    return !t.atanan_admin || t.atanan_admin === u.id;
  }

  function sekmeSayilar() {
    var u = ben();
    var havuz = tumu.filter(function (t) { return !t.atanan_admin && t.durum !== "cozuldu" && t.durum !== "kapali"; }).length;
    var benim = u ? tumu.filter(function (t) { return t.atanan_admin === u.id && t.durum !== "cozuldu" && t.durum !== "kapali"; }).length : 0;
    var cozulen = tumu.filter(function (t) { return t.durum === "cozuldu" || t.durum === "kapali"; }).length;
    return { havuz: havuz, benim: benim, cozulen: cozulen };
  }

  function renderSekmeler() {
    // Gorunum artik acilir menu (select): secili degeri SEKME ile esitle.
    var sel = $("havuzSekmeSec");
    if (sel && sel.value !== SEKME) sel.value = SEKME;
  }

  function havuzKarti(t) {
    var u = ben();
    var benimMi = u && t.atanan_admin === u.id;
    var oncRozet = (t.oncelik && t.oncelik !== "normal")
      ? '<span class="onc onc-' + esc(t.oncelik) + '">' + esc(ONC[t.oncelik] || t.oncelik) + "</span>" : "";
    var aciklama = String(t.aciklama || "");
    var ozet = aciklama.length > 140 ? aciklama.slice(0, 140) + "..." : aciklama;
    var dosyaSayi = (t.dosyalar || []).length;
    var aksiyon = "";
    if (t.durum === "cozuldu" || t.durum === "kapali") {
      aksiyon = '<a class="btn btn-subtle btn-small" href="talep.html?id=' + t.id + '">Görüntüle →</a>';
    } else if (!t.atanan_admin) {
      if (ustlenebilirMi()) {
        aksiyon = '<button class="btn btn-white btn-small" type="button" data-ustlen="' + t.id + '">Talebi Üstlen →</button>'
          + '<a class="havuz-onizle" href="talep.html?id=' + t.id + '">Önizle</a>';
      } else {
        aksiyon = '<a class="havuz-onizle" href="talep.html?id=' + t.id + '">Salt okunur — Önizle</a>';
      }
    } else if (benimMi) {
      aksiyon = '<a class="btn btn-white btn-small" href="talep.html?id=' + t.id + '">Devam et →</a>';
    } else {
      aksiyon = "";
    }
    return '<article class="ticket-card havuz-card" data-id="' + t.id + '">'
      + '<div class="ticket-top">'
      + '<span class="durum durum-' + esc(t.durum === "kapali" ? "cozuldu" : t.durum) + '">' + esc(DURUM[t.durum] || t.durum) + "</span>"
      + oncRozet
      + '<span class="havuz-kim">' + esc(t.name) + " • " + esc(t.kategori) + "</span>"
      + '<time class="mono">' + esc(zamanKisa(t.created_at)) + "</time>"
      + "</div>"
      + '<h3 class="ticket-baslik"><a href="talep.html?id=' + t.id + '">' + esc(t.konu) + "</a></h3>"
      + '<p class="ticket-desc">' + esc(ozet) + "</p>"
      + '<div class="havuz-alt">'
      + (dosyaSayi ? '<span class="mono havuz-dosya">' + dosyaSayi + " ek</span>" : "")
      + '<span class="havuz-kilit">Üstlenmeden yazışma kapalı</span>'
      + '<span class="havuz-aksiyon">' + aksiyon + "</span>"
      + "</div>"
      + "</article>";
  }

  function render() {
    renderSekmeler();
    renderStats();
    var q = (($("adminAra") && $("adminAra").value) || "").toLocaleLowerCase("tr");
    var fk = ($("adminKat") && $("adminKat").value) || "hepsi";
    var box = $("adminList");
    var u = ben();
    var liste = tumu.filter(gorunurMu).filter(function (t) {
      var coz = (t.durum === "cozuldu" || t.durum === "kapali");
      if (SEKME === "havuz" && (t.atanan_admin || coz)) return false;
      if (SEKME === "benim" && !(u && t.atanan_admin === u.id && !coz)) return false;
      if (SEKME === "cozulen" && !coz) return false;
      if (fk !== "hepsi" && t.kategori !== fk) return false;
      if (q) {
        var havuz = ((t.konu || "") + " " + (t.aciklama || "") + " " + (t.name || "") + " " + (t.email || "")).toLocaleLowerCase("tr");
        if (havuz.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (!liste.length) {
      var bos = SEKME === "havuz" ? "Havuz temiz. Yeni talep yok."
        : SEKME === "benim" ? "Üstlendiğin aktif talep yok. Havuzdan birini üstlen."
        : "Henüz çözülen talep yok.";
      box.innerHTML = '<div class="bos-kutu"><strong>' + esc(bos) + "</strong><span>Yeni talepler buraya anlık düşer.</span></div>";
      return;
    }
    box.innerHTML = liste.map(havuzKarti).join("");
  }

  function renderStats() {
    var box = $("adminStats");
    if (!box) return;
    var s = sekmeSayilar();
    var kart = function (deger, etiket) {
      return '<div class="stat-card"><div><strong>' + deger + "</strong><span>" + etiket + "</span></div></div>";
    };
    box.innerHTML = kart(s.havuz, "Havuzda bekleyen")
      + kart(s.benim, "Üstlendiğim")
      + kart(s.cozulen, "Çözülen")
      + kart(PUANORT.n ? (PUANORT.top / PUANORT.n).toFixed(1) : "—", "CSAT (" + PUANORT.n + " oy)");
  }

  function yukle() {
    sb.from("destek_talepleri").select("id,name,email,kategori,konu,aciklama,dosyalar,durum,oncelik,atanan_admin,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(100)
      .then(function (res) {
        if (!res || res.error) return;
        tumu = res.data || [];
        Promise.all([
          sb.from("site_admins").select("user_id,ad,avatar_url,rol"),
          sb.from("destek_puan").select("puan")
        ]).then(function (hepsi) {
          ADMINMAP = {};
          (((hepsi[0] && hepsi[0].data)) || []).forEach(function (a) { ADMINMAP[a.user_id] = a; });
          var rows = ((hepsi[1] && hepsi[1].data)) || [];
          PUANORT = { n: rows.length, top: rows.reduce(function (a, r) { return a + (r.puan || 0); }, 0) };
          render();
        }).catch(render);
      }).catch(function () {});
  }

  function planliYukle() {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(yukle, 800);
  }
  function baglanRealtime() {
    try {
      if (rtKanal) { try { sb.removeChannel(rtKanal); } catch (e) {} rtKanal = null; }
      rtKanal = sb.channel("havuz-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_talepleri" }, planliYukle)
        .subscribe();
    } catch (e) {}
  }

  function ustlen(id, btn) {
    var u = ben();
    if (!u) return;
    if (btn) { btn.disabled = true; btn.textContent = "Üstleniliyor..."; }
    var bitir = function (ok) {
      if (ok === false && btn) {
        btn.disabled = false; btn.textContent = "Talebi Üstlen →";
        var err = $("havuzErr");
        if (err) { err.textContent = "Bu talep çoktan üstlenilmiş — liste yenilendi."; err.hidden = false; }
      }
      yukle();
    };
    // Once atomik RPC dene, yoksa dogrudan sartli update
    sb.rpc("talebi_ustlen", { p_talep_id: id }).then(function (res) {
      if (!res.error && res.data === true) { location.href = "talep.html?id=" + id; return; }
      if (!res.error && res.data === false) { bitir(false); return; }
      // RPC yoksa fallback: yalnizca bosken ustlen
      sb.from("destek_talepleri").update({ atanan_admin: u.id, durum: "incelemede", updated_at: new Date().toISOString() })
        .eq("id", id).is("atanan_admin", null)
        .select("id").maybeSingle().then(function (r2) {
          if ((r2 && r2.error) || !(r2 && r2.data)) { bitir(false); return; }
          location.href = "talep.html?id=" + id;
        });
    }).catch(function () { bitir(false); });
  }

  // — Rol yonetimi (yonetici+ gorur; sahip satirlarina yalniz sahip dokunur) —
  var ROLLER = ["sahip", "yonetici", "yetkili", "destek", "rehber", "stajyer"];
  function rolGate() {
    var ozel = $("rolYonetimi");
    if (!ozel) return;
    var acik = yoneticiMiyim();
    ozel.hidden = !acik;
    if (!acik) return;
    var ds = $("davetRol");
    if (ds) {
      var so = ds.querySelector('option[value="sahip"]');
      if (so) so.hidden = !sahipMiyim();
      if (!sahipMiyim() && ds.value === "sahip") ds.value = "destek";
    }
    yukleRoller();
  }
  function logIslem(hedefEmail, hedefUid, eskiRol, yeniRol, islem) {
    var me = ben();
    sb.from("role_assignment_logs").insert({
      hedef_email: hedefEmail, hedef_uid: hedefUid || null,
      eski_rol: eskiRol || null, yeni_rol: yeniRol,
      islem: islem, yapan_admin: me ? me.id : null
    }).then(function () {});
  }
  function yukleRoller() {
    var me = ben();
    sb.from("site_admins").select("user_id,rol,ad,avatar_url,created_at").order("created_at", { ascending: true }).limit(100)
      .then(function (res) {
        var rows = (res && res.data) || [];
        var sahipler = rows.filter(function (r) { return r.rol === "sahip"; }).length;
        var benSahip = sahipMiyim();
        $("rolListe").innerHTML = rows.map(function (r) {
          var kendim = me && r.user_id === me.id;
          var sonSahip = r.rol === "sahip" && sahipler <= 1;
          var satirKilitli = r.rol === "sahip" && !benSahip;
          var sec = ROLLER.map(function (o) {
            var et = (window.klyzeRolAdi ? window.klyzeRolAdi(o) : o) || o;
            var gizleSahip = (o === "sahip" && !benSahip);
            if (gizleSahip && r.rol !== "sahip") return "";
            return '<option value="' + o + '"' + (r.rol === o ? " selected" : "") + ">" + et + "</option>";
          }).join("");
          return '<div class="rol-satir" data-uid="' + r.user_id + '" data-rol="' + esc(r.rol) + '">'
            + (r.avatar_url ? '<img class="t-ava" src="' + esc(r.avatar_url) + '" alt="" loading="lazy">' : '<span class="rev-ava">' + esc(((r.ad || "?").charAt(0)).toUpperCase()) + "</span>")
            + '<div class="rol-kim"><strong>' + esc(r.ad || "Ekip") + "</strong>"
            + '<span class="mono">' + esc(r.user_id.slice(0, 8)) + "…</span></div>"
            + window.klyzeRozet(r.rol)
            + '<select class="input" data-rol-sec' + (satirKilitli ? " disabled" : "") + ">" + sec + "</select>"
            + '<button class="btn btn-ghost btn-small" type="button" data-rol-kaldir' + ((kendim || sonSahip || satirKilitli) ? " disabled" : "") + ">Kaldır</button>"
            + "</div>";
        }).join("") || '<p class="mono rev-empty">Kayıtlı yetkili yok.</p>';
        return sb.from("role_assignment_logs").select("hedef_email,eski_rol,yeni_rol,islem,created_at").order("created_at", { ascending: false }).limit(50);
      })
      .then(function (rl) {
        var rows = (rl && rl.data) || [];
        var ISLEM = { davet: "davet etti", rol_degisikligi: "rolünü değiştirdi", kaldirma: "yetkisini aldı" };
        $("rolLog").innerHTML = rows.map(function (r) {
          return '<div class="log-satir"><span>' + esc(r.hedef_email) + "</span>"
            + "<span>" + esc(r.eski_rol || "—") + " → <strong>" + esc(r.yeni_rol || "—") + "</strong></span>"
            + "<span>" + esc(ISLEM[r.islem] || r.islem) + "</span>"
            + '<time class="mono">' + esc(fmtTarih(r.created_at)) + "</time></div>";
        }).join("") || '<p class="mono rev-empty">Henüz işlem yok.</p>';
      }).catch(function () {});
  }

  function init() {
    waitAuth(function () {
      var A = window.KlyzeAuth;
      if (!window.supabase) return;
      try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
      catch (e) { return; }
      var lastSyncKey = null;
      function sync() {
        var u = A.user;
        var key = (u ? u.id : "-") + "|" + (A.rol || "-");
        if (key === lastSyncKey) return;
        lastSyncKey = key;
        $("adminLogin").hidden = !!u;
        $("adminApp").hidden = true;
        $("adminDenied").hidden = true;
        if (!u) return;
        adminMi().then(function (ok) {
          $("adminApp").hidden = !ok;
          $("adminDenied").hidden = ok;
          if (ok) { yukle(); baglanRealtime(); rolGate(); }
        });
      }
      A.ready.then(sync);
      A.onChange(sync);

      var sekmeSec = $("havuzSekmeSec");
      if (sekmeSec) sekmeSec.addEventListener("change", function () {
        SEKME = sekmeSec.value;
        render();
      });
      var kat = $("adminKat");
      if (kat) kat.addEventListener("change", render);
      var ara = $("adminAra");
      if (ara) ara.addEventListener("input", render);
      var yenile = $("adminRefresh");
      if (yenile) yenile.addEventListener("click", yukle);

      $("adminList").addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-ustlen]") : null;
        if (!b) return;
        ev.preventDefault();
        ustlen(parseInt(b.getAttribute("data-ustlen"), 10), b);
      });

      var rolBox = $("rolYonetimi");
      if (rolBox) rolBox.addEventListener("change", function (ev) {
        var sel = ev.target.closest ? ev.target.closest("[data-rol-sec]") : null;
        if (!sel) return;
        var satir = sel.closest(".rol-satir");
        var uid = satir.getAttribute("data-uid");
        var eski = satir.getAttribute("data-rol");
        var yeni = sel.value;
        if (eski === yeni) return;
        sel.disabled = true;
        sb.from("site_admins").update({ rol: yeni }).eq("user_id", uid)
          .then(function (res) {
            if (res && res.error) { sel.disabled = false; sel.value = eski; return; }
            logIslem(uid, uid, eski, yeni, "rol_degisikligi");
            yukleRoller();
          });
      });
      if (rolBox) rolBox.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-rol-kaldir]") : null;
        if (!b || b.disabled) return;
        var satir = b.closest(".rol-satir");
        var uid = satir.getAttribute("data-uid");
        b.disabled = true;
        sb.from("site_admins").delete().eq("user_id", uid)
          .then(function (res) {
            if (res && res.error) { b.disabled = false; return; }
            logIslem(uid, uid, satir.getAttribute("data-rol"), "kaldirildi", "kaldirma");
            yukleRoller();
          });
      });
      var davetF = $("davetForm");
      if (davetF) davetF.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var me = ben();
        var ep = $("davetEmail").value.trim().toLocaleLowerCase("tr");
        var rl = $("davetRol").value;
        var er = $("davetErr");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ep)) {
          er.textContent = "Geçerli bir e-posta yaz.";
          er.hidden = false;
          return;
        }
        if (rl === "sahip" && !sahipMiyim()) {
          er.textContent = "Sahip rolünü yalnızca sahip verebilir.";
          er.hidden = false;
          return;
        }
        er.hidden = true;
        sb.from("site_davetler").upsert({ email: ep, rol: rl, olusturan: me ? me.id : null }, { onConflict: "email" })
          .then(function (res) {
            if (res && res.error) { er.textContent = "Kaydedilemedi: " + res.error.message; er.hidden = false; return; }
            logIslem(ep, null, null, rl, "davet");
            davetF.reset();
            er.textContent = "✓ Davet oluşturuldu — kişi Google ile giriş yapınca yetkisi açılır.";
            er.hidden = false;
          });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
