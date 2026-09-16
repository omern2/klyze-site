// Klyze.gg — site giris kapisi (tek robot dogrulamasi, sekme basina bir kez).
// Cozulunce bu sekmede bir daha sorulmaz. hCaptcha yuklenemezse uyari verir.
(function () {
  var ANAHTAR = "klyze-giris";
  var SITEKEY = "2a5ee000-3866-4322-9dee-b0f83d2aeae8";
  function bayrakVar() {
    try { return sessionStorage.getItem(ANAHTAR) === "1"; }
    catch (e) { return true; }
  }
  function kilitle(acik) {
    try {
      document.documentElement.style.overflow = acik ? "hidden" : "";
      document.body.style.overflow = acik ? "hidden" : "";
    } catch (e) {}
  }
  // Klavye odagini kapida tut (Tab ile arkaya gecilemesin)
  function odakKilidi(ev) {
    var o = document.getElementById("siteGiris");
    if (!o || o.hidden) return;
    if (o.contains(ev.target)) return;
    ev.stopPropagation();
    try {
      var kutu = o.querySelector(".giris-kutu");
      if (kutu) {
        if (!kutu.hasAttribute("tabindex")) kutu.setAttribute("tabindex", "-1");
        kutu.focus({ preventScroll: true });
      }
    } catch (e) {}
  }
  function bitir() {
    try { sessionStorage.setItem(ANAHTAR, "1"); } catch (e) {}
    try { document.removeEventListener("focusin", odakKilidi, true); } catch (e2) {}
    kilitle(false);
    var o = document.getElementById("siteGiris");
    if (!o) return;
    o.classList.add("giris-tamam");
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 450);
  }
  function hata(msg) {
    var e = document.getElementById("girisErr");
    if (!e) return;
    e.textContent = msg;
    e.hidden = !msg;
  }
  function baslat() {
    var overlay = document.getElementById("siteGiris");
    if (!overlay) return;
    if (bayrakVar()) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      return;
    }
    overlay.hidden = false;
    kilitle(true);
    try { document.addEventListener("focusin", odakKilidi, true); } catch (e) {}
    var deneme = 0;
    var iv = setInterval(function () {
      if (window.hcaptcha) {
        clearInterval(iv);
        try {
          window.hcaptcha.render("girisCap", {
            sitekey: SITEKEY, theme: "dark", callback: function () { bitir(); }
          });
        } catch (e) { hata("Doğrulama başlatılamadı — sayfayı yenile."); }
        return;
      }
      if (++deneme > 80) {
        clearInterval(iv);
        hata("Doğrulama yüklenemedi — reklam engelleyiciyi kapatıp sayfayı yenile.");
      }
    }, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", baslat);
  else baslat();
})();
