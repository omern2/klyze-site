// Klyze.gg — rehber bilgi bankasi (salt okunur).
// Cozulen talepler + ekip yanitlari. Ustlenme/yazma yok.
(function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";

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
  function waitAuth(fn) {
    var n = 0;
    var iv = setInterval(function () {
      if (window.KlyzeAuth) { clearInterval(iv); fn(); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  }

  var sb = null;
  var tumu = [];
  var lastSyncKey = null;

  function erisimVar() {
    var A = window.KlyzeAuth;
    if (!A || !A.user) return false;
    return !!(A.rol || (A.isAdmin && A.isAdmin()));
  }

  function kart(t) {
    var yanitlar = (t.mesajlar || []).filter(function (m) { return m.kim === "ekip"; });
    var ilk = yanitlar.length ? yanitlar[0] : null;
    return '<article class="ticket-card open">'
      + '<div class="ticket-top">'
      + '<span class="durum durum-cozuldu">Çözüldü</span>'
      + '<span class="havuz-kim">' + esc(t.kategori) + "</span>"
      + '<time class="mono">' + esc(fmtTarih(t.updated_at || t.created_at)) + "</time>"
      + (t.puan ? '<span class="mono havuz-dosya">' + t.puan + "/5</span>" : "")
      + "</div>"
      + '<h3 class="ticket-baslik">' + esc(t.konu) + "</h3>"
      + '<p class="ticket-desc"><strong>Sorun:</strong> ' + esc(t.aciklama) + "</p>"
      + (ilk ? '<div class="ticket-reply"><strong>Çözüm — ' + esc(ilk.ad || "Ekip") + "</strong><p>" + esc(ilk.metin) + "</p></div>" : "")
      + (yanitlar.length > 1 ? '<p class="mono havuz-dosya">+' + (yanitlar.length - 1) + " yanıt daha</p>" : "")
      + "</article>";
  }

  function render() {
    var fk = ($("rehberKat") && $("rehberKat").value) || "hepsi";
    var q = (($("rehberAra") && $("rehberAra").value) || "").toLocaleLowerCase("tr");
    var box = $("rehberListe");
    var liste = tumu.filter(function (t) {
      if (fk !== "hepsi" && t.kategori !== fk) return false;
      if (q) {
        var havuz = ((t.konu || "") + " " + (t.aciklama || "") + " " + ((t.mesajlar || []).map(function (m) { return m.metin || ""; }).join(" "))).toLocaleLowerCase("tr");
        if (havuz.indexOf(q) === -1) return false;
      }
      return true;
    });
    var stats = $("rehberStats");
    if (stats) {
      var puanlar = tumu.filter(function (t) { return t.puan; });
      var ort = puanlar.length ? (puanlar.reduce(function (a, t) { return a + t.puan; }, 0) / puanlar.length).toFixed(1) : "—";
      stats.innerHTML = '<div class="stat-card"><div><strong>' + tumu.length + "</strong><span>Çözülen kayıt</span></div></div>"
        + '<div class="stat-card"><div><strong>' + ort + "</strong><span>Ortalama puan (" + puanlar.length + " oy)</span></div></div>";
    }
    if (!liste.length) { box.innerHTML = '<p class="mono rev-empty">Kayıt bulunamadı.</p>'; return; }
    box.innerHTML = liste.map(kart).join("");
  }

  function yukle() {
    sb.from("destek_talepleri").select("id,kategori,konu,aciklama,updated_at,created_at")
      .eq("durum", "cozuldu").order("updated_at", { ascending: false }).limit(100)
      .then(function (res) {
        if (!res || res.error) return;
        tumu = res.data || [];
        var ids = tumu.map(function (t) { return t.id; });
        if (!ids.length) { render(); return; }
        Promise.all([
          sb.from("destek_mesajlari").select("talep_id,kim,ad,metin").in("talep_id", ids).eq("kim", "ekip").order("created_at", { ascending: true }).limit(400),
          sb.from("destek_puan").select("talep_id,puan").in("talep_id", ids)
        ]).then(function (hepsi) {
          var map = {};
          (((hepsi[0] && hepsi[0].data)) || []).forEach(function (m) {
            (map[m.talep_id] = map[m.talep_id] || []).push(m);
          });
          var pmap = {};
          (((hepsi[1] && hepsi[1].data)) || []).forEach(function (p) { pmap[p.talep_id] = p.puan; });
          tumu.forEach(function (t) { t.mesajlar = map[t.id] || []; t.puan = pmap[t.id] || null; });
          render();
        }).catch(render);
      }).catch(function () {});
  }

  function init() {
    waitAuth(function () {
      var A = window.KlyzeAuth;
      if (!window.supabase) return;
      try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
      catch (e) { return; }
      function sync() {
        var u = A.user;
        var key = (u ? u.id : "-") + "|" + (A.rol || "-");
        if (key === lastSyncKey) return;
        lastSyncKey = key;
        $("rehberLogin").hidden = !!u;
        $("rehberApp").hidden = true;
        $("rehberDenied").hidden = true;
        if (!u) return;
        if (!erisimVar()) { $("rehberDenied").hidden = false; return; }
        $("rehberApp").hidden = false;
        yukle();
      }
      A.ready.then(sync);
      A.onChange(sync);
      ["rehberKat"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("change", render); });
      var ara = $("rehberAra");
      if (ara) ara.addEventListener("input", render);
      var y = $("rehberYenile");
      if (y) y.addEventListener("click", yukle);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
