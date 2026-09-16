// Klyze.gg — reveal + hero tilt + stat sayaçları. Reduced-motion'a saygılı.
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll reveal
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  // Stat sayaçları
  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".", ",") + "M";
    if (n >= 1000) return Math.round(n / 1000) + "B";
    return String(n);
  }
  var counters = document.querySelectorAll("[data-count]");
  function runCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (reduceMotion) { el.textContent = fmt(target); return; }
    var t0 = null, dur = 1200;
    function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window && !reduceMotion) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  // Hero tilt
  var card = document.getElementById("tiltCard");
  var fine = window.matchMedia("(pointer: fine)").matches;
  if (card && fine && !reduceMotion) {
    var visual = card.parentElement;
    visual.addEventListener("mousemove", function (ev) {
      var r = visual.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width - 0.5;
      var y = (ev.clientY - r.top) / r.height - 0.5;
      card.style.transform = "rotateY(" + (-10 + x * 7) + "deg) rotateX(" + (3 - y * 7) + "deg)";
    });
    visual.addEventListener("mouseleave", function () { card.style.transform = ""; });
  }

  // Acilis animasyonu artik paylasilan js/loader.js icinde (tum sayfalar).

  // Özellik kartlarında imleği takip eden beyaz ışık
  document.querySelectorAll(".feat-cell").forEach(function (card) {
    card.addEventListener("pointermove", function (ev) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (ev.clientX - r.left) + "px");
      card.style.setProperty("--my", (ev.clientY - r.top) + "px");
    });
  });

  // Sayfa 1 → 2 paralaks geçişi (translate özelliği: transform ile çakışmaz)
  var p1copy = document.querySelector(".page1-copy");
  var p1vis = document.querySelector(".page1-visual");
  if ((p1copy || p1vis) && !reduceMotion) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0;
        var vh = window.innerHeight || 800;
        if (y < vh * 1.2) {
          if (p1copy) {
            p1copy.style.translate = "0 " + (y * 0.22).toFixed(1) + "px";
            p1copy.style.opacity = Math.max(0, 1 - y / (vh * 0.75)).toFixed(3);
          }
          if (p1vis) p1vis.style.translate = "0 " + (y * 0.1).toFixed(1) + "px";
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Liderlik: arama + rank filtresi
  var lbSearch = document.getElementById("lbSearch");
  var lbFilter = document.getElementById("lbFilter");
  var lbCount = document.getElementById("lbCount");
  var lbEmpty = document.getElementById("lbEmpty");
  function lbApply() {
    if (!lbSearch || !lbFilter) return;
    var q = (lbSearch.value || "").toLocaleLowerCase("tr");
    var f = lbFilter.value;
    var n = 0;
    document.querySelectorAll(".lrow").forEach(function (row) {
      var okQ = !q || (row.getAttribute("data-name") || "").indexOf(q) !== -1;
      var okF = f === "all" || row.getAttribute("data-rank") === f;
      var show = okQ && okF;
      row.style.display = show ? "" : "none";
      if (show) n++;
    });
    var en = document.documentElement.lang === "en";
    if (lbCount) lbCount.textContent = en ? n + " players" : n + " oyuncu";
    if (lbEmpty) lbEmpty.hidden = n !== 0;
  }
  if (lbSearch) lbSearch.addEventListener("input", lbApply);
  if (lbFilter) lbFilter.addEventListener("change", lbApply);

  // Aktif kullanici sayaci — 10 dk'lik dilimde sabit, 30-111 arasi rastgele (hero + liderlik)
  (function () {
    var els = [document.getElementById("lbActive"), document.getElementById("heroActive")]
      .filter(function (e) { return !!e; });
    if (!els.length) return;
    var DILIM = 10 * 60 * 1000;
    function slotSayi(slot) {
      var x = (Math.floor(slot) * 2654435761) % 4294967296;
      x = x ^ (x >>> 15);
      x = (x * 2246822519) % 4294967296;
      x = x ^ (x >>> 13);
      return 30 + (Math.abs(x) % 82);
    }
    els.forEach(function (el) {
      el.innerHTML = '<span class="live-dot" aria-hidden="true"></span><b>0</b>&nbsp;oyuncu çevrimiçi';
    });
    var nEls = els.map(function (el) { return el.querySelector("b"); });
    function fmt(n) {
      try { return n.toLocaleString("tr-TR"); } catch (e) { return String(n); }
    }
    function yaz(n) {
      nEls.forEach(function (b) { if (b) b.textContent = fmt(n); });
    }
    var gosterilen = 0, hedef = 0, anim = null;
    function animasyon(bitir) {
      if (anim) clearInterval(anim);
      if (reduceMotion) { gosterilen = bitir; yaz(bitir); return; }
      var bas = gosterilen, fark = bitir - bas, t0 = Date.now();
      anim = setInterval(function () {
        var p = Math.min((Date.now() - t0) / 900, 1);
        var e = 1 - Math.pow(1 - p, 3);
        gosterilen = Math.round(bas + fark * e);
        yaz(gosterilen);
        if (p >= 1) { clearInterval(anim); anim = null; }
      }, 40);
    }
    function kontrol() {
      var h = slotSayi(Date.now() / DILIM);
      if (h !== hedef) { hedef = h; animasyon(h); }
    }
    kontrol();
    setInterval(kontrol, 30000);
  })();

  // Yatay rank dağılım çubukları — kaydırınca uzama
  var hbars = document.getElementById("hbars");
  if (hbars) {
    hbars.querySelectorAll(".htrack i").forEach(function (el, i) {
      el.style.transitionDelay = (i * 0.07).toFixed(2) + "s";
    });
    if ("IntersectionObserver" in window && !reduceMotion) {
      var hio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { hbars.classList.add("in"); hio.disconnect(); }
        });
      }, { threshold: 0.3 });
      hio.observe(hbars);
    } else {
      hbars.classList.add("in");
    }
  }

  // Ornek/sahte yorum yok — sadece gercek yorumlar (DB + bu tarayicidakiler).
  var SAMPLE_REVIEWS = [];
  // Supabase'ten gelen yorumlar (db.js doldurur). Yoksa bos kalir, site eskisi gibi calisir.
  var DB_REVIEWS = [];
  window.KlyzeSiteBridge = {
    setDbReviews: function (arr) {
      DB_REVIEWS = Array.isArray(arr) ? arr : [];
      renderReviews();
    },
    onSubmit: null
  };
  var STAR = '<svg viewBox="0 0 24 24" fill="FILL" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.7L12 17.2 5.9 20.5l1.4-6.7L2.2 9.1l6.9-.8z"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" fill="FIL" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  var MSG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>';
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function revStore() {
    // v2: DB tek gercek kaynaktir. v1'de kalan eski yerel test verileri okunmaz (hayalet yorumlar).
    try { return JSON.parse(localStorage.getItem("klyze-rev-v2")) || { added: [], liked: {}, replies: {} }; }
    catch (e) { return { added: [], liked: {}, replies: {} }; }
  }
  function revSave(s) { try { localStorage.setItem("klyze-rev-v2", JSON.stringify(s)); } catch (e) {} }
  function revLang() {
    try { return localStorage.getItem("klyze-lang") === "en" ? "en" : "tr"; }
    catch (e) { return "tr"; }
  }
  function starRow(n) {
    var h = "";
    for (var i = 1; i <= 5; i++) h += STAR.replace("FILL", i <= n ? "currentColor" : "none").replace("<svg ", i <= n ? "<svg " : '<svg stroke="currentColor" stroke-width="1.5" ');
    return h;
  }
  var revGrid = document.getElementById("revGrid");
  function allReviews() {
    var s = revStore();
    var seenDb = {};
    DB_REVIEWS.forEach(function (r) { seenDb[r.name + "|" + r.stars + "|" + r.tr] = 1; });
    var list = SAMPLE_REVIEWS.map(function (r) { return { base: r, extra: null }; });
    s.added.forEach(function (r) {
      if (seenDb[r.name + "|" + r.stars + "|" + r.tr]) return; // DB'de varsa cift gosterme
      list.unshift({ base: null, extra: r });
    });
    DB_REVIEWS.forEach(function (r) { list.unshift({ base: null, extra: r }); });
    return { list: list, store: s };
  }
  function revAvatar(r) {
    var au = (window.KlyzeAuth && window.KlyzeAuth.user) || null;
    var src = r.avatar || (au && au.name === r.name ? au.avatar : null);
    if (src) return '<span class="rev-ava rev-ava-img"><img src="' + esc(src) + '" alt="" loading="lazy" /></span>';
    return '<span class="rev-ava">' + esc((r.name || "?").charAt(0).toUpperCase()) + '</span>';
  }
  function renderReviews() {
    if (!revGrid) return;
    var L = revLang();
    var d = allReviews();
    var html = "";
    d.list.forEach(function (item) {
      var r = item.base || item.extra;
      var id = item.base ? item.base.id : item.extra.id;
      var liked = !!d.store.liked[id];
      var count = (item.base ? item.base.likes : 0) + (liked ? 1 : 0);
      var dbYanits = (item.extra && item.extra.replies) || [];
      var dbKeys = {};
      dbYanits.forEach(function (rp) { dbKeys[rp.name + "|" + rp.tr] = 1; });
      var yerelYanits = (d.store.replies[id] || []).filter(function (rp) { return !dbKeys[rp.name + "|" + rp.tr]; });
      var replies = (item.base ? item.base.replies : []).concat(yerelYanits).concat(dbYanits);
      var txt = (L === "en" && r.en) ? r.en : r.tr;
      html += '<article class="review-card" data-id="' + id + '">';
      html += '<div class="rev-top">' + revAvatar(r);
      html += '<span class="rev-who"><strong>' + esc(r.name) + (window.klyzeRozet ? window.klyzeRozet(r.rol) : "") + '</strong><time>' + esc(r.date) + '</time></span>';
      html += '<span class="rev-stars">' + starRow(r.stars) + '</span></div>';
      html += '<p class="rev-text">' + esc(txt) + '</p>';
      html += '<div class="rev-actions"><button type="button" class="rev-btn like' + (liked ? " liked" : "") + '">' + HEART.replace("FIL", liked ? "currentColor" : "none") + '<b>' + count + '</b></button>';
      html += '<button type="button" class="rev-btn reply">' + MSG + (L === "en" ? "Reply" : "Yanıtla") + '</button></div>';
      html += '<ul class="rev-replies">';
      replies.forEach(function (rp) {
        var rt = L === "en" ? rp.en : rp.tr;
        var ra = rp.avatar ? '<img class="rev-rep-ava" src="' + esc(rp.avatar) + '" alt="" loading="lazy" />' : "";
        html += "<li>" + ra + "<span><strong>" + esc(rp.name) + "</strong> — " + esc(rt || rp.tr) + "</span></li>";
      });
      html += "</ul>";
      html += '<div class="rev-reply-form"><input class="input rtext" maxlength="200" placeholder="' + (L === "en" ? "Your reply..." : "Yanıtın...") + '" /><button type="button" class="btn btn-white rsend">' + (L === "en" ? "Send" : "Gönder") + "</button></div>";
      html += "</article>";
    });
    revGrid.innerHTML = html;
    if (!d.list.length) {
      var L0 = revLang();
      revGrid.innerHTML = '<p class="mono rev-empty">' + (L0 === "en" ? "No reviews yet — be the first to write one." : "Henüz yorum yok — ilk yorumu sen yaz.") + "</p>";
    }
    renderScore(d.list);
  }
  function renderScore(list) {
    var num = document.getElementById("scoreNum");
    var stars = document.getElementById("scoreStars");
    var cnt = document.getElementById("scoreCount");
    if (!num) return;
    var L = revLang();
    var sum = 0;
    list.forEach(function (item) { sum += (item.base || item.extra).stars; });
    var avg = list.length ? sum / list.length : 0;
    num.setAttribute("data-avg", avg.toFixed(2));
    if (stars) stars.innerHTML = starRow(Math.round(avg));
    if (cnt) cnt.textContent = list.length + (L === "en" ? " reviews" : " değerlendirme");
    var panel = document.getElementById("scorePanel");
    if (panel && !panel.getAttribute("data-done")) {
      panel.setAttribute("data-done", "1");
      if (reduceMotion) {
        num.textContent = avg.toFixed(1).replace(".", ",");
      } else {
        var t0 = null;
        var step = function (t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / 1000, 1);
          num.textContent = (avg * p).toFixed(1).replace(".", ",");
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    } else {
      num.textContent = avg.toFixed(1).replace(".", ",");
    }
  }
  if (revGrid) {
    renderReviews();
    revGrid.addEventListener("click", function (ev) {
      var likeBtn = ev.target.closest ? ev.target.closest(".like") : null;
      var replyBtn = ev.target.closest ? ev.target.closest(".reply") : null;
      var sendBtn = ev.target.closest ? ev.target.closest(".rsend") : null;
      var card = ev.target.closest ? ev.target.closest(".review-card") : null;
      if (!card) return;
      var id = card.getAttribute("data-id");
      var s = revStore();
      if (likeBtn) {
        if (s.liked[id]) delete s.liked[id]; else s.liked[id] = 1;
        revSave(s); renderReviews(); return;
      }
      if (replyBtn) {
        var f = card.querySelector(".rev-reply-form");
        if (f) f.classList.toggle("open");
        return;
      }
      if (sendBtn) {
        var auRp = (window.KlyzeAuth && window.KlyzeAuth.user) || null;
        if (!auRp) {
          var f0 = card.querySelector(".rev-reply-form");
          if (f0 && !f0.querySelector(".rev-err")) {
            var ee = document.createElement("span");
            ee.className = "rev-err";
            var en0 = document.documentElement.lang === "en";
            ee.appendChild(document.createTextNode(en0 ? "Please " : "Yanıt için "));
            var aa = document.createElement("a");
            aa.href = "/login";
            aa.textContent = en0 ? "log in" : "giriş yap";
            ee.appendChild(aa);
            f0.appendChild(ee);
          }
          return;
        }
        var tx = card.querySelector(".rtext").value.trim();
        if (!tx) return;
        var rpEntry = { name: auRp.name, avatar: auRp.avatar, tr: tx.slice(0, 200), en: "" };
        var bridge = window.KlyzeSiteBridge;
        var hataGoster = function (msg) {
          var f1 = card.querySelector(".rev-reply-form");
          if (f1 && !f1.querySelector(".rev-err")) {
            var ee = document.createElement("span");
            ee.className = "rev-err";
            ee.textContent = "Kaydedilemedi: " + msg;
            f1.appendChild(ee);
          }
        };
        var yereldenSil = function () {
          try {
            var sx = revStore();
            sx.replies[id] = (sx.replies[id] || []).filter(function (x) {
              return !(x.name === rpEntry.name && x.tr === rpEntry.tr);
            });
            revSave(sx);
          } catch (e) {}
        };
        var tazele = function () {
          if (bridge && bridge.refreshReviews) { try { bridge.refreshReviews(); return; } catch (e) {} }
          renderReviews();
        };
        var mDb = /^db(\d+)$/.exec(id);
        if (mDb && bridge && bridge.onReplySubmit) {
          // DB yorumu: once yerelde goster, DB onaylayinca yereli sil + listeyi tazele
          if (!s.replies[id]) s.replies[id] = [];
          s.replies[id].push(rpEntry);
          revSave(s); renderReviews();
          card.querySelector(".rtext").value = "";
          try {
            bridge.onReplySubmit({ reviewId: parseInt(mDb[1], 10), entry: rpEntry })
              .then(function () { yereldenSil(); tazele(); })
              .catch(function (e) { hataGoster(e && e.message ? e.message : "hata"); });
          } catch (e) {}
          return;
        }
        if (bridge && bridge.onSubmit && bridge.onReplySubmit) {
          // Henuz DB'de olmayan yoruma yanit: once yorumu, sonra yaniti DB'ye yaz
          var yerel = null;
          s.added.forEach(function (x) { if (x.id === id) yerel = x; });
          if (!yerel) { renderReviews(); return; }
          if (!s.replies[id]) s.replies[id] = [];
          s.replies[id].push(rpEntry);
          revSave(s); renderReviews();
          card.querySelector(".rtext").value = "";
          var p;
          try { p = bridge.onSubmit(yerel); } catch (e) { hataGoster("hata"); return; }
          if (!p || !p.then) return;
          p.then(function (dbId) {
            return bridge.onReplySubmit({ reviewId: dbId, entry: rpEntry });
          }).then(function () {
            try {
              var s3 = revStore();
              s3.added = s3.added.filter(function (x) { return x.id !== id; });
              revSave(s3);
            } catch (e) {}
            yereldenSil(); tazele();
          }).catch(function (e) { hataGoster(e && e.message ? e.message : "hata"); });
          return;
        }
        if (!s.replies[id]) s.replies[id] = [];
        s.replies[id].push(rpEntry);
        revSave(s); renderReviews();
      }
    });
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () { renderReviews(); });
    });
  }
  var revForm = document.getElementById("revForm");
  var starPick = document.getElementById("starPick");
  var pickVal = 5;
  function paintPick(n) {
    if (!starPick) return;
    starPick.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("on", parseInt(b.getAttribute("data-v"), 10) <= n);
    });
  }
  if (starPick) {
    paintPick(5);
    starPick.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        pickVal = parseInt(b.getAttribute("data-v"), 10);
        paintPick(pickVal);
      });
    });
  }
  if (revForm) {
    revForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var au = (window.KlyzeAuth && window.KlyzeAuth.user) || null;
      if (!au) {
        var ae = document.getElementById("revAuthErr");
        if (ae) {
          ae.innerHTML = "";
          var en = document.documentElement.lang === "en";
          ae.appendChild(document.createTextNode(en ? "Please " : "Yorum yazmak için "));
          var a = document.createElement("a");
          a.href = "/login";
          a.textContent = en ? "log in to review" : "giriş yapmalısın";
          a.style.color = "#fff";
          ae.appendChild(a);
          ae.hidden = false;
        }
        var yb = document.getElementById("yorumlar");
        if (yb) yb.scrollIntoView();
        return;
      }
      var nm = au.name;
      var tx = document.getElementById("revText").value.trim();
      if (!tx) return;
      // hCaptcha: cozulmus token sart (gercek dogrulama verify-captcha edge fonksiyonunda)
      if (window.hcaptcha) {
        var ctok = "";
        try { ctok = window.hcaptcha.getResponse(); } catch (e) {}
        if (!ctok) {
          var ce0 = document.getElementById("revAuthErr");
          if (ce0) { ce0.textContent = "Göndermeden önce robot olmadığını doğrula."; ce0.hidden = false; }
          return;
        }
        window.__hcaptcha = ctok;
      }
      var s = revStore();
      var entry = {
        id: "u" + Date.now(), name: String(nm).slice(0, 24), avatar: au.avatar, stars: pickVal,
        rol: (window.KlyzeAuth && window.KlyzeAuth.rol) || "user",
        date: revLang() === "en" ? "today" : "bugün", tr: tx.slice(0, 400), en: ""
      };
      var bridge2 = window.KlyzeSiteBridge;
      var bitir = function () {
        try { if (window.hcaptcha) window.hcaptcha.reset(); window.__hcaptcha = null; } catch (e) {}
        document.getElementById("revText").value = "";
        renderReviews();
        document.getElementById("yorumlar").scrollIntoView();
      };
      if (bridge2 && bridge2.onSubmit) {
        // Once yerelde goster, DB onaylayinca DB kaydina gec
        s.added.unshift(entry);
        revSave(s); bitir();
        var btn = revForm.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        try {
          bridge2.onSubmit(entry).then(function (dbId) {
            if (btn) btn.disabled = false;
            try {
              var sx = revStore();
              sx.added = sx.added.filter(function (x) { return x.id !== entry.id; });
              revSave(sx);
            } catch (e) {}
            if (bridge2.refreshReviews) { try { bridge2.refreshReviews(); } catch (e2) {} }
            else renderReviews();
          }).catch(function (e) {
            if (btn) btn.disabled = false;
            var ae2 = document.getElementById("revAuthErr");
            if (ae2) {
              ae2.textContent = "Kaydedilemedi: " + (e && e.message ? e.message : "hata") + " — yorumun bu cihazda duruyor.";
              ae2.hidden = false;
            }
          });
        } catch (e) {}
        return;
      }
      s.added.unshift(entry);
      revSave(s); bitir();
    });
  }
  // Girisli kullanicida isim kutusunu gizle (Google ismi kullanilir)
  function revAuthSync() {
    var au = (window.KlyzeAuth && window.KlyzeAuth.user) || null;
    if (revForm) revForm.classList.toggle("logged", !!au);
    var ae = document.getElementById("revAuthErr");
    if (ae && au) ae.hidden = true;
  }
  if (window.KlyzeAuth) {
    if (window.KlyzeAuth.ready) window.KlyzeAuth.ready.then(revAuthSync);
    window.KlyzeAuth.onChange(revAuthSync);
  }
  var ROT = {
    tr: ["Analiz", "Grup", "Canlı Maç", "Sıralama", "Analiz"],
    en: ["Analysis", "Group", "Live Match", "Ranking", "Analysis"]
  };
  var langBtns = document.querySelectorAll(".lang-switch button");
  function setLang(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-tr]").forEach(function (el) {
      el.textContent = lang === "en" ? el.getAttribute("data-en") : el.getAttribute("data-tr");
    });
    document.querySelectorAll("[data-tr-ph]").forEach(function (el) {
      el.setAttribute("placeholder", lang === "en" ? el.getAttribute("data-en-ph") : el.getAttribute("data-tr-ph"));
    });
    if (typeof lbApply === "function") lbApply();
    var track = document.querySelector(".rot-track");
    if (track) {
      var words = ROT[lang] || ROT.tr;
      track.querySelectorAll("span").forEach(function (s, i) { s.textContent = words[i % words.length]; });
    }
    langBtns.forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-lang") === lang); });
    try { localStorage.setItem("klyze-lang", lang); } catch (e) {}
  }
  langBtns.forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
  });
  try {
    var saved = localStorage.getItem("klyze-lang");
    if (saved === "en") setLang("en");
  } catch (e) {}

  // 3D eğilme + imlece yakınlaşma (uygulama görseli)
  var stage = document.querySelector(".page-1");
  var appImg = document.getElementById("appTilt");
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  if (stage && appImg && finePointer && !reduceMotion) {
    stage.addEventListener("mousemove", function (ev) {
      var r = appImg.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width - 0.5;
      var py = (ev.clientY - r.top) / r.height - 0.5;
      px = Math.max(-0.5, Math.min(0.5, px));
      py = Math.max(-0.5, Math.min(0.5, py));
      appImg.style.transformOrigin = ((px + 0.5) * 100).toFixed(1) + "% " + ((py + 0.5) * 100).toFixed(1) + "%";
      appImg.style.transform = "rotateY(" + (px * 10).toFixed(2) + "deg) rotateX(" + (-py * 8).toFixed(2) + "deg) scale(1.3)";
    });
    stage.addEventListener("mouseleave", function () {
      appImg.style.transform = "";
    });
  }

  // Dönen kelime artık saf CSS ile (rotCycle) — JS gerekmez.

  // İndirme butonları — ilerleme animasyonu, sonra gerçek indirme başlar
  document.querySelectorAll(".dl-btn").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      var href = btn.getAttribute("href") || "";
      if (btn.classList.contains("busy")) { ev.preventDefault(); return; }
      if (href.charAt(0) === "#") {
        // Sayfa içi hedef: animasyon + kaydır (yedek davranış)
        ev.preventDefault();
        btn.classList.add("busy");
        var labelH = btn.querySelector(".dl-label");
        var fillH = btn.querySelector(".dl-fill");
        var enH = document.documentElement.lang === "en";
        var labelH0 = labelH ? labelH.textContent : "";
        var pH = 0;
        var ivH = setInterval(function () {
          pH = Math.min(100, pH + 3 + Math.floor(Math.random() * 8));
          if (fillH) fillH.style.width = pH + "%";
          if (labelH) labelH.textContent = "%" + pH;
          if (pH >= 100) {
            clearInterval(ivH);
            if (labelH) labelH.textContent = enH ? "✓ Ready" : "✓ Hazır";
            setTimeout(function () {
              if (fillH) fillH.style.width = "0";
              if (labelH) labelH.textContent = labelH0;
              btn.classList.remove("busy");
              var target = document.querySelector(href);
              if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
            }, 600);
          }
        }, 120);
        return;
      }
      // Gerçek dosya: animasyon oynar, bitince indirme başlar
      ev.preventDefault();
      btn.classList.add("busy");
      var label = btn.querySelector(".dl-label");
      var fill = btn.querySelector(".dl-fill");
      var en = document.documentElement.lang === "en";
      var label0 = label ? label.textContent : "";
      var p = 0;
      var iv = setInterval(function () {
        p = Math.min(100, p + 3 + Math.floor(Math.random() * 8));
        if (fill) fill.style.width = p + "%";
        if (label) label.textContent = "%" + p;
        if (p >= 100) {
          clearInterval(iv);
          if (label) label.textContent = en ? "✓ Downloading" : "✓ İndiriliyor";
          var a = document.createElement("a");
          a.href = href;
          a.download = href.split("/").pop();
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () {
            if (fill) fill.style.width = "0";
            if (label) label.textContent = label0;
            btn.classList.remove("busy");
          }, 3000);
        }
      }, 120);
    });
  });

  // Eski demo not bloğu kaldırıldı — indirme hedefi index.html'deki #nasil.
})();
