// Klyze.gg — talep detay V3 (sade mesajlasma).
// - Timeline YOK: sadece aciklama + dosyalar + mesaj akisi.
// - Sahip + ustlenen yazar; baskasi okuyamaz/yazamaz (RLS + UI cift kilit).
// - Ustlenmeden composer kilitli. Sahip devredebilir.
// - Veriler paralel yuklenir (hizli). Hersey DB'ye kaydolur.
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
    try { return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }
  function waitAuth(fn) {
    var n = 0;
    var iv = setInterval(function () {
      if (window.KlyzeAuth) { clearInterval(iv); fn(); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  }
  function talepId() {
    try { return parseInt(new URLSearchParams(location.search).get("id"), 10) || null; }
    catch (e) { return null; }
  }
  function showErr(m) {
    var e = $("talepErr");
    if (!e) return;
    e.textContent = m || "";
    e.hidden = !m;
  }
  function rozet(rol) {
    try { return window.klyzeRozet ? window.klyzeRozet(rol) : ""; }
    catch (e) { return ""; }
  }

  var sb = null;
  var T = null;
  var ADMINMAP = {};
  var rtKanal = null;
  var rtTimer = null;

  function ben() { return (window.KlyzeAuth && window.KlyzeAuth.user) || null; }
  function sahipMiyim() { return !!(window.KlyzeAuth && window.KlyzeAuth.isOwner && window.KlyzeAuth.isOwner()); }
  function yoneticiMiyim() { var A = window.KlyzeAuth; return !!(A && A.isYonetici && A.isYonetici()); }
  function ustlenebilirMi() { var A = window.KlyzeAuth; return !!(A && A.ustlenebilir && A.ustlenebilir()); }
  function oncelikDegisebilirMi() { var A = window.KlyzeAuth; return !!(A && A.oncelikDegistirebilir && A.oncelikDegistirebilir()); }
  function notEkleyebilirMi() {
    var A = window.KlyzeAuth;
    var r = A && A.rol;
    return r === "sahip" || r === "yonetici" || r === "yetkili" || r === "destek" || r === "admin";
  }
  function yazabilirMiyim() {
    var u = ben();
    if (!u || !T) return false;
    if (yoneticiMiyim()) return true;
    return !!(T.atanan_admin && T.atanan_admin === u.id);
  }

  function render() {
    if (!T) return;
    var u = ben();
    var coz = (T.durum === "cozuldu" || T.durum === "kapali");
    var d = $("talepDurum");
    d.textContent = DURUM[T.durum] || T.durum;
    d.className = "durum durum-" + (T.durum === "kapali" ? "cozuldu" : T.durum);
    var o = $("talepOnc");
    if (T.oncelik && T.oncelik !== "normal") { o.hidden = false; o.textContent = ONC[T.oncelik] || T.oncelik; o.className = "onc onc-" + T.oncelik; }
    else o.hidden = true;
    $("talepId").textContent = "#" + T.id;
    $("talepKonu").textContent = T.konu;
    $("talepMeta").textContent = T.name + " • " + T.email + " • " + T.kategori + " • " + fmtTarih(T.created_at);
    $("talepAciklama").textContent = T.aciklama;
    $("talepDosya").innerHTML = (T.dosyalar || []).map(function (url) {
      var ad = decodeURIComponent(String(url).split("/").pop().split("?")[0] || "dosya");
      return '<a class="file-chip" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(ad.length > 28 ? ad.slice(0, 25) + "..." : ad) + "</a>";
    }).join("");
    var akis = $("talepAkis");
    akis.innerHTML = (T.mesajlar || []).map(function (m) {
      var ekip = m.kim === "ekip";
      var ad = m.ad || (ekip ? "Klyze ekibi" : T.name);
      var av = m.avatar_url ? '<img class="msg-ava" src="' + esc(m.avatar_url) + '" alt="" loading="lazy" />' : "";
      return '<div class="msg-row' + (ekip ? " msg-ekip" : "") + '"><div class="msg-head"><span class="msg-kisi">' + av + "<strong>" + esc(ad) + "</strong></span><time class='mono'>" + esc(fmtTarih(m.created_at)) + "</time></div><p>" + esc(m.metin) + "</p></div>";
    }).join("");
    if (!(T.mesajlar || []).length) {
      akis.innerHTML = '<p class="mono rev-empty">Henüz mesaj yok — ilk yanıtı sen yaz.</p>';
    }

    // Yan panel: ustlenen + rolu
    var au = T.atanan_admin ? ADMINMAP[T.atanan_admin] : null;
    var atanmisAd = au ? (au.ad || "Ekip") : "Atanmamış";
    var atanmisRol = au ? au.rol : null;
    $("yanUstlenen").innerHTML = "<strong>" + esc(atanmisAd) + "</strong>" + rozet(atanmisRol)
      + (coz ? "<span>Çözüldü — havuzdan düştü</span>" : (!T.atanan_admin ? "<span>Henüz kimse üstlenmedi</span>" : ""));
    $("yanOnc").value = T.oncelik || "normal";
    $("yanNotlar").innerHTML = ((T.notlar || []).map(function (n) {
      var a = ADMINMAP[n.admin_id];
      return '<div class="not-row"><strong>' + esc((a && a.ad) || "Ekip") + "</strong>" + rozet(a && a.rol) + " — " + esc(n.metin) + "</div>";
    }).join("")) || '<p class="mono rev-empty">Not yok.</p>';

    // Devret (yonetici+, cozunmemis talepte)
    var devretBox = $("devretBox");
    if (devretBox) {
      var gosterDevret = yoneticiMiyim() && !coz;
      devretBox.hidden = !gosterDevret;
      if (gosterDevret) {
        var sel = $("devretSec");
        var cur = sel.value;
        sel.innerHTML = Object.keys(ADMINMAP).map(function (uid) {
          var a = ADMINMAP[uid];
          if (a.rol === "rehber" || a.rol === "stajyer") return "";
          var et = (a.ad || "Ekip") + " • " + ((window.klyzeRolAdi && window.klyzeRolAdi(a.rol)) || a.rol || "");
          return '<option value="' + uid + '"' + (T.atanan_admin === uid ? " selected" : "") + ">" + esc(et) + "</option>";
        }).join("");
        if (cur && ADMINMAP[cur]) sel.value = cur;
        else if (T.atanan_admin) sel.value = T.atanan_admin;
      }
    }

    var yaz = yazabilirMiyim() && !coz;
    $("composer").hidden = !yaz;
    $("talepKilit").hidden = yaz || coz;
    var baskasi = T.atanan_admin && u && T.atanan_admin !== u.id && !yoneticiMiyim();
    $("talepKilit").querySelector("span").textContent = baskasi
      ? "Bu talebi " + atanmisAd + " üstlenmiş. Yazmak için önce devralmalısın."
      : "Yazmak için önce talebi üstlenmelisin.";
    var ustlenGoster = ustlenebilirMi() && !yaz && !coz;
    $("yanUstlen").hidden = !ustlenGoster;
    $("yanBirak").hidden = !(u && T.atanan_admin === u.id && !yoneticiMiyim() && !coz);
    $("yanCoz").disabled = !yaz;
    $("yanOnc").disabled = !(yaz && oncelikDegisebilirMi());
    var notBtn = $("yanNotEkle"), notInp = $("yanNotInput");
    if (notBtn) notBtn.hidden = !notEkleyebilirMi();
    if (notInp) notInp.disabled = !notEkleyebilirMi();
    if (!yaz && !coz) {
      var kb = $("kilitUstlen");
      if (kb) kb.hidden = !(ustlenebilirMi() && (!T.atanan_admin || baskasi));
    }
    var ds = $("talepDurumSec");
    if (ds && !coz) ds.value = T.durum === "yeni" ? "incelemede" : T.durum;
  }

  function yukle() {
    var id = talepId();
    if (!id) { denied("Geçersiz talep bağlantısı."); return; }
    sb.from("destek_talepleri").select("id,name,email,kategori,konu,aciklama,dosyalar,durum,oncelik,atanan_admin,created_at,updated_at")
      .eq("id", id).maybeSingle().then(function (res) {
        if ((res && res.error) || !(res && res.data)) { denied("Bu talebe erişimin yok veya talep bulunamadı."); return; }
        T = res.data;
        // Paralel: ekip listesi + mesajlar + ic notlar (tek tur)
        Promise.all([
          sb.from("site_admins").select("user_id,ad,avatar_url,rol"),
          sb.from("destek_mesajlari").select("kim,ad,avatar_url,metin,created_at").eq("talep_id", id).order("created_at", { ascending: true }).limit(300),
          sb.from("destek_notlar").select("admin_id,metin,created_at").eq("talep_id", id).order("created_at", { ascending: true }).limit(200)
        ]).then(function (hepsi) {
          ADMINMAP = {};
          (((hepsi[0] && hepsi[0].data)) || []).forEach(function (a) { ADMINMAP[a.user_id] = a; });
          T.mesajlar = ((hepsi[1] && hepsi[1].data)) || [];
          T.notlar = ((hepsi[2] && hepsi[2].data)) || [];
          render();
        }).catch(function () { render(); });
      }).catch(function () { denied("Bağlantı kurulamadı — tekrar dene."); });
  }
  function denied(m) {
    $("talepApp").hidden = true;
    var d = $("talepDenied");
    d.textContent = m;
    d.hidden = false;
  }
  function planli() { clearTimeout(rtTimer); rtTimer = setTimeout(yukle, 800); }
  function baglan() {
    var id = talepId();
    try {
      if (rtKanal) { try { sb.removeChannel(rtKanal); } catch (e) {} rtKanal = null; }
      rtKanal = sb.channel("talep-" + id)
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_mesajlari", filter: "talep_id=eq." + id }, planli)
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_talepleri", filter: "id=eq." + id }, planli)
        .subscribe();
    } catch (e) {}
  }

  function init() {
    waitAuth(function () {
      var A = window.KlyzeAuth;
      if (!window.supabase) { denied("Bağlantı kurulamadı."); return; }
      try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
      catch (e) { denied("Bağlantı kurulamadı."); return; }
      var lastSyncKey = null;
      function sync() {
        var u = A.user;
        var key = (u ? u.id : "-") + "|" + (A.rol || "-") + "|" + (talepId() || "-");
        if (key === lastSyncKey) return;
        lastSyncKey = key;
        $("talepLogin").hidden = !!u;
        if (!u) { $("talepApp").hidden = true; return; }
        sb.from("site_admins").select("rol").eq("user_id", u.id).maybeSingle().then(function (r) {
          var rol = r && r.data && r.data.rol;
          if (!rol) { denied("Bu sayfa yalnızca ekip içindir."); return; }
          if (rol === "rehber") { denied("Rehberler için Rehber panelini kullan."); return; }
          $("talepDenied").hidden = true;
          $("talepApp").hidden = false;
          yukle(); baglan();
        }).catch(function () { denied("Bağlantı kurulamadı — tekrar dene."); });
      }
      A.ready.then(sync);
      A.onChange(sync);

      // Mesaj gonder -> DB'ye kaydolur (mesaj + durum tek seferde)
      $("talepGonder").addEventListener("click", function () {
        if (!yazabilirMiyim()) { showErr("Önce talebi üstlenmelisin."); return; }
        var u = ben();
        var metin = ($("talepMesaj").value || "").trim().slice(0, 1000);
        var durum = $("talepDurumSec").value;
        if (!metin) return;
        var b = $("talepGonder");
        b.disabled = true;
        showErr("");
        sb.from("destek_mesajlari").insert({
          talep_id: T.id, kim: "ekip",
          ad: u ? String(u.name).slice(0, 24) : null,
          avatar_url: u && u.avatar ? String(u.avatar).slice(0, 500) : null,
          metin: metin
        }).then(function (r1) {
          if (r1 && r1.error) throw r1.error;
          if (durum === T.durum) return { error: null };
          return sb.from("destek_talepleri").update({ durum: durum }).eq("id", T.id);
        }).then(function (r2) {
          b.disabled = false;
          if (r2 && r2.error) { showErr("Kaydedilemedi: " + r2.error.message); return; }
          $("talepMesaj").value = "";
          yukle();
        }).catch(function (e) {
          b.disabled = false;
          showErr("Gönderilemedi: " + (e && e.message ? e.message : "hata"));
        });
      });
      // Enter ile gonder (Shift+Enter yeni satir)
      $("talepMesaj").addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("talepGonder").click(); }
      });

      // Ustlen -> DB'ye kaydolur, ayni sayfada kalir
      var ustlenYap = function (btn) {
        var u = ben();
        if (!u || !T) return;
        if (btn) { btn.disabled = true; btn.textContent = "Üstleniliyor..."; }
        sb.rpc("talebi_ustlen", { p_talep_id: T.id }).then(function (res) {
          if (!res.error && res.data === true) { yukle(); return; }
          if (!res.error && res.data === false) { showErr("Bu talep çoktan üstlenilmiş."); yukle(); return; }
          sb.from("destek_talepleri").update({ atanan_admin: u.id, durum: "incelemede", updated_at: new Date().toISOString() })
            .eq("id", T.id).is("atanan_admin", null).then(function () { yukle(); });
        }).catch(function () { yukle(); });
      };
      $("yanUstlen").addEventListener("click", function () { ustlenYap(this); });
      $("kilitUstlen").addEventListener("click", function () { ustlenYap(this); });

      // Birak -> DB'ye kaydolur, havuza doner
      $("yanBirak").addEventListener("click", function () {
        var b = this;
        b.disabled = true;
        sb.from("destek_talepleri").update({ atanan_admin: null, updated_at: new Date().toISOString() }).eq("id", T.id)
          .then(function (r) {
            if (r && r.error) { showErr("Kaydedilemedi: " + r.error.message); b.disabled = false; return; }
            location.href = "admin.html";
          }).catch(function () { b.disabled = false; });
      });

      // Oncelik -> aninda DB'ye kaydolur (yetkili+)
      $("yanOnc").addEventListener("change", function () {
        if (!yazabilirMiyim() || !oncelikDegisebilirMi()) { render(); return; }
        var v = this.value;
        this.disabled = true;
        var self = this;
        sb.from("destek_talepleri").update({ oncelik: v, updated_at: new Date().toISOString() }).eq("id", T.id)
          .then(function (r) {
            self.disabled = false;
            if (r && r.error) { showErr("Kaydedilemedi: " + r.error.message); render(); return; }
            T.oncelik = v;
            render();
          }).catch(function () { self.disabled = false; render(); });
      });

      // Devret (yonetici+) -> DB'ye kaydolur
      var devretBtn = $("devretBtn");
      if (devretBtn) devretBtn.addEventListener("click", function () {
        if (!yoneticiMiyim() || !T) return;
        var hedef = $("devretSec").value;
        if (!hedef || hedef === T.atanan_admin) return;
        this.disabled = true;
        var self = this;
        sb.rpc("talebi_devret", { p_talep_id: T.id, p_yeni_admin: hedef }).then(function (res) {
          if (!res.error && res.data === true) { yukle(); return; }
          if (!res.error && res.data === false) { showErr("Devredilemedi."); self.disabled = false; return; }
          sb.from("destek_talepleri").update({ atanan_admin: hedef, updated_at: new Date().toISOString() }).eq("id", T.id)
            .then(function () { yukle(); }).catch(function () { self.disabled = false; });
        }).catch(function () { self.disabled = false; });
      });

      // Cozuldu + ayril -> DB'ye kaydolur, havuza doner
      $("yanCoz").addEventListener("click", function () {
        if (!yazabilirMiyim()) { showErr("Önce talebi üstlenmelisin."); return; }
        var b = this;
        b.disabled = true;
        b.textContent = "İşaretleniyor...";
        var eski = b.textContent;
        sb.rpc("talebi_coz", { p_talep_id: T.id }).then(function (res) {
          if (!res.error && res.data === true) { location.href = "admin.html"; return; }
          if (!res.error && res.data === false) { showErr("Bu işlem için yetkin yok."); b.disabled = false; b.textContent = "Çözüldü olarak işaretle ve ayrıl"; return; }
          sb.from("destek_talepleri").update({ durum: "cozuldu", atanan_admin: null, updated_at: new Date().toISOString() }).eq("id", T.id)
            .then(function (r) {
              if (r && r.error) { showErr("Kaydedilemedi: " + r.error.message); b.disabled = false; b.textContent = "Çözüldü olarak işaretle ve ayrıl"; return; }
              location.href = "admin.html";
            }).catch(function () { b.disabled = false; b.textContent = eski; });
        }).catch(function () { b.disabled = false; b.textContent = "Çözüldü olarak işaretle ve ayrıl"; });
      });

      // Ic not -> DB'ye kaydolur
      $("yanNotEkle").addEventListener("click", function () {
        var u = ben();
        if (!u) return;
        var inp = $("yanNotInput");
        var metin = (inp.value || "").trim().slice(0, 1000);
        if (!metin) return;
        this.disabled = true;
        var self = this;
        sb.from("destek_notlar").insert({ talep_id: T.id, admin_id: u.id, metin: metin })
          .then(function (r) {
            self.disabled = false;
            if (r && r.error) { showErr("Kaydedilemedi: " + r.error.message); return; }
            inp.value = "";
            yukle();
          })
          .catch(function () { self.disabled = false; });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
