// Klyze.gg — Supabase baglantisi (publishable key; yazma RLS ile korumali).
// Baglanti kurulamazsa site eski statik haliyle calisir, hata gostermez.
(function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  var TIMEOUT_MS = 8000;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function lang() { return document.documentElement.lang === "en" ? "en" : "tr"; }
  function setBilingual(el, tr, en) {
    if (!el) return;
    el.setAttribute("data-tr", tr);
    el.setAttribute("data-en", en);
    el.textContent = lang() === "en" ? en : tr;
  }
  function client() {
    if (!window.supabase) return null;
    try { return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
    catch (e) { return null; }
  }
  function withTimeout(promise) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error("timeout")); }, TIMEOUT_MS); })
    ]);
  }
  function cmpVer(a, b) {
    var pa = String(a).split("."), pb = String(b).split(".");
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
      if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
  }
  function waitBridge(fn) {
    var n = 0;
    var iv = setInterval(function () {
      if (window.KlyzeSiteBridge) { clearInterval(iv); fn(window.KlyzeSiteBridge); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  }

  // — Surum + changelog (app_updates tablosu, herkese acik okuma) —
  function wireRelease(sb) {
    withTimeout(
      sb.from("app_updates").select("version,changelog").order("created_at", { ascending: false }).limit(1)
    ).then(function (res) {
      if (!res || res.error || !res.data || !res.data.length) return;
      var rel = res.data[0];
      if (!rel.version) return;
      setBilingual(document.querySelector(".dl-meta"),
        "v" + rel.version + " • Windows 10/11 64-bit • ~122 MB • Ücretsiz",
        "v" + rel.version + " • Windows 10/11 64-bit • ~122 MB • Free");
      setBilingual(document.querySelector(".footer .bottom"),
        "© 2026 Klyze.gg • v" + rel.version,
        "© 2026 Klyze.gg • v" + rel.version);
      try {
        var list = document.querySelector(".ver-list");
        if (!list || list.getAttribute("data-db")) return;
        var firstTag = list.querySelector(".ver-card .ver-tag");
        var m = firstTag && firstTag.textContent.match(/v([\d.]+)/);
        if (!m || cmpVer(rel.version, m[1]) <= 0) return;
        list.setAttribute("data-db", rel.version);
        firstTag.textContent = firstTag.textContent.replace("• güncel", "").replace("• current", "").trim();
        var card = document.createElement("article");
        card.className = "ver-card";
        var tag = document.createElement("p");
        tag.className = "mono ver-tag";
        tag.textContent = "v" + rel.version + (lang() === "en" ? " • current" : " • güncel");
        card.appendChild(tag);
        var ul = document.createElement("ul");
        var lines = String(rel.changelog || "").split(/\r?\n/)
          .map(function (s) { return s.replace(/^[-*•\s]+/, "").trim(); })
          .filter(Boolean).slice(0, 6);
        if (!lines.length) lines = [lang() === "en" ? "Latest stable release." : "En güncel kararlı sürüm."];
        lines.forEach(function (ln) {
          var li = document.createElement("li");
          li.textContent = ln;
          ul.appendChild(li);
        });
        card.appendChild(ul);
        list.insertBefore(card, list.firstChild);
      } catch (e) {}
    }).catch(function () {});
  }

  // — Yorumlar (site_reviews tablosu) —
  function fmtDate(iso) {
    try {
      var s = new Date(iso).toLocaleDateString(lang() === "en" ? "en-GB" : "tr-TR");
      return s && s !== "Invalid Date" ? s : (lang() === "en" ? "today" : "bugün");
    } catch (e) { return lang() === "en" ? "today" : "bugün"; }
  }
  function toEntry(r) {
    return {
      id: "db" + r.id,
      name: String(r.name || "Anonim").slice(0, 24),
      avatar: r.avatar_url || null,
      rol: r.rol || null,
      stars: Math.min(5, Math.max(1, parseInt(r.stars, 10) || 5)),
      date: fmtDate(r.created_at),
      tr: String(r.text || "").slice(0, 400),
      en: ""
    };
  }
  function toReplyEntry(r) {
    return {
      name: String(r.name || "Anonim").slice(0, 24),
      avatar: r.avatar_url || null,
      tr: String(r.text || "").slice(0, 200),
      en: ""
    };
  }
  var ROLLER = ["sahip", "yonetici", "yetkili", "destek", "rehber", "stajyer", "admin"];
  function wireReviews(sb) {
    withTimeout(
      sb.from("site_reviews").select("id,name,stars,text,avatar_url,rol,created_at")
        .eq("is_hidden", false).order("created_at", { ascending: false }).limit(20)
    ).then(function (res) {
      if (!res || res.error || !res.data) return;
      var rows = res.data;
      var entries = rows.map(toEntry);
      var finish = function (repMap) {
        var list = entries.map(function (e, i) {
          e.replies = repMap[rows[i].id] || [];
          return e;
        });
        waitBridge(function (bridge) {
          bridge.setDbReviews(list);
          // Tum yazmalar guvenli hattan (verify-captcha): gorunmez dogrulama + sunucu kaydi.
          // Promise doner: basarida DB id / true, hatada reject. Sessiz kayip yok.
          function guvenliYaz(govde) {
            if (!window.KlyzeCaptcha) return Promise.reject(new Error("dogrulama yuklenemedi"));
            return window.KlyzeCaptcha.yaz(govde);
          }
          bridge.onSubmit = function (entry) {
            return guvenliYaz({
              tip: "yorum",
              stars: entry.stars,
              text: entry.tr,
              lang: document.documentElement.lang === "en" ? "en" : "tr"
            }).then(function (res) {
              if (!res || !res.id) throw new Error("kaydedilemedi");
              return res.id;
            });
          };
          bridge.onReplySubmit = function (payload) {
            return guvenliYaz({
              tip: "yorum-yanit",
              review_id: payload.reviewId,
              text: payload.entry.tr,
              lang: document.documentElement.lang === "en" ? "en" : "tr"
            }).then(function () { return true; });
          };
          bridge.refreshReviews = function () { wireReviews(sb); };
        });
      };
      var ids = rows.map(function (r) { return r.id; });
      if (!ids.length) { finish({}); return; }
      withTimeout(
        sb.from("site_review_replies").select("review_id,name,text,avatar_url")
          .eq("is_hidden", false).in("review_id", ids).order("created_at", { ascending: true })
      ).then(function (rr) {
        var map = {};
        ((rr && rr.data) || []).forEach(function (x) {
          (map[x.review_id] = map[x.review_id] || []).push(toReplyEntry(x));
        });
        finish(map);
      }).catch(function () { finish({}); });
    }).catch(function () {});
  }

  ready(function () {
    var sb = client();
    if (!sb) return;
    wireRelease(sb);
    wireReviews(sb);
  });
})();
