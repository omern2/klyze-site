// Klyze.gg — paylasilan acilis animasyonu (tum sayfalar).
// Her tam sayfa yuklemede kisa oynar: ilerleme + erken bitis + guvenlik.
(function () {
  function baslat() {
    var loader = document.getElementById("loader");
    if (!loader || loader.getAttribute("data-done")) return;
    loader.setAttribute("data-done", "1");
    var t0 = Date.now();
    var finished = false, prog = 0, tick = null, safety = null;
    var fill = document.getElementById("loadFill");
    function finish() {
      if (finished) return;
      finished = true;
      if (tick) clearInterval(tick);
      if (safety) clearTimeout(safety);
      var bekle = Math.max(0, 650 - (Date.now() - t0));
      setTimeout(function () {
        var el = document.getElementById("loader");
        if (!el) return;
        el.classList.add("done");
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
      }, bekle);
    }
    tick = setInterval(function () {
      prog = Math.min(100, prog + 5 + Math.floor(Math.random() * 8));
      if (fill) fill.style.width = prog + "%";
      if (prog >= 100) finish();
    }, 80);
    function earlyFinish() {
      if (fill) fill.style.width = "100%";
      setTimeout(finish, 200);
    }
    if (document.readyState === "complete") setTimeout(earlyFinish, 300);
    else window.addEventListener("load", function () { setTimeout(earlyFinish, 300); });
    safety = setTimeout(finish, 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", baslat);
  else baslat();
})();
