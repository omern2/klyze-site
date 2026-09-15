// Klyze.gg — SSS arama + kategori filtresi (veri sss.html icinde).
(function () {
  var KAT = { teknik: "Teknik", kurulum: "Kurulum", hesap: "Hesap", destek: "Destek", topluluk: "Topluluk", guvenlik: "Güvenlik" };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return String(s || "").toLocaleLowerCase("tr")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");
  }
  var aktifKat = "hepsi";
  function render() {
    var q = norm(document.getElementById("sssAra").value).trim();
    var box = document.getElementById("sssListe");
    var veri = window.KLYZE_SSS || [];
    var goster = veri.filter(function (a) {
      if (aktifKat !== "hepsi" && a.kat !== aktifKat) return false;
      if (!q) return true;
      var havuz = norm(a.baslik + " " + a.ozet + " " + a.etiket + " " + (a.adimlar || []).join(" "));
      return q.split(/\s+/).every(function (k) { return havuz.indexOf(k) !== -1; });
    });
    // Ankraj destegi: sss.html#id ile gelindiyse one cikar
    var ankraj = (location.hash || "").replace("#", "");
    goster.sort(function (x, y) {
      if (x.id === ankraj) return -1;
      if (y.id === ankraj) return 1;
      return 0;
    });
    if (!goster.length) {
      box.innerHTML = '<p class="mono rev-empty">Sonuç yok — <a href="destek.html" style="color:#fff">destek talebi aç</a>.</p>';
      return;
    }
    box.innerHTML = goster.map(function (a) {
      return '<article class="ticket-card" id="' + esc(a.id) + '">'
        + '<div class="ticket-top"><span class="durum durum-incelemede">' + esc(KAT[a.kat] || a.kat) + "</span></div>"
        + "<h3>" + esc(a.baslik) + "</h3>"
        + '<p class="ticket-desc">' + esc(a.ozet) + "</p>"
        + '<ol class="sss-adim">' + (a.adimlar || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>"
        + "</article>";
    }).join("");
  }
  function kats() {
    var box = document.getElementById("sssKat");
    var veri = window.KLYZE_SSS || [];
    var sirali = ["hepsi"].concat(Object.keys(KAT).filter(function (k) {
      return veri.some(function (a) { return a.kat === k; });
    }));
    box.innerHTML = sirali.map(function (k) {
      return '<button type="button" class="chip' + (k === aktifKat ? " on" : "") + '" data-kat="' + k + '">'
        + (k === "hepsi" ? "Tümü" : KAT[k]) + "</button>";
    }).join("");
  }
  function init() {
    if (!window.KLYZE_SSS) return;
    kats();
    render();
    document.getElementById("sssAra").addEventListener("input", render);
    document.getElementById("sssKat").addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-kat]") : null;
      if (!b) return;
      aktifKat = b.getAttribute("data-kat");
      kats();
      render();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
