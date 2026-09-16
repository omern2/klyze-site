// Klyze.gg — bildirim zili V2 (Discord mantigi, siyah-beyaz premium).
// - Kullanici: kendi taleplerindeki ekip yanitlari -> /destek#talep-ID
// - Ekip: atanmamis havuz + bana atanmislar -> /talep?id=ID (yeni sayfa)
// - Realtime: destek_talepleri + destek_mesajlari degisiminde sessiz guncelleme.
(function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  var rtKanal = null;
  var rtTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function waitAuth(fn) {
    var n = 0;
    var iv = setInterval(function () {
      if (window.KlyzeAuth) { clearInterval(iv); fn(); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  }
  function gorulen() {
    try { return JSON.parse(localStorage.getItem("klyze-destek-seen") || "{}"); }
    catch (e) { return {}; }
  }
  function rozet(n) {
    var b = $("bellSayi");
    if (!b) return;
    b.hidden = !(n > 0);
    b.textContent = n > 9 ? "9+" : String(n);
    var btn = $("bellBtn");
    if (btn) btn.classList.toggle("has-unread", n > 0);
  }
  function listeBos(mesaj) {
    var box = $("bellListe");
    if (box) box.innerHTML = '<p class="mono rev-empty">' + esc(mesaj) + "</p>";
  }
  function zamanKisa(iso) {
    try {
      var dk = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      if (dk < 1) return "az önce";
      if (dk < 60) return dk + " dk";
      var sa = Math.round(dk / 60);
      if (sa < 24) return sa + " sa";
      return Math.round(sa / 24) + " gün";
    } catch (e) { return ""; }
  }

  // — Kullanici: yalnizca ekip yazmissa "yeni" say —
  function kullaniciVerisi(sb, u) {
    sb.from("destek_talepleri").select("id,konu,durum,updated_at")
      .eq("user_id", u.id).neq("durum", "cozuldu").order("updated_at", { ascending: false }).limit(10)
      .then(function (res) {
        var rows = (res && res.data) || [];
        if (!rows.length) { listeBos("Yeni bildirim yok."); rozet(0); return; }
        var ids = rows.map(function (t) { return t.id; });
        sb.from("destek_mesajlari").select("talep_id,created_at")
          .in("talep_id", ids).eq("kim", "ekip").order("created_at", { ascending: false }).limit(50)
          .then(function (rr) {
            var gor = gorulen();
            var son = {};
            ((rr && rr.data) || []).forEach(function (m) {
              if (!son[m.talep_id] || m.created_at > son[m.talep_id]) son[m.talep_id] = m.created_at;
            });
            var n = 0;
            var html = rows.slice(0, 5).map(function (t) {
              var yeni = son[t.id] && (!gor[t.id] || son[t.id] > gor[t.id]);
              if (yeni) n++;
              return '<a class="bell-item" href="/destek#talep-' + t.id + '">'
                + (yeni ? '<span class="unread-dot"></span>' : '<span class="read-dot"></span>')
                + "<span><strong>" + esc(t.konu) + "</strong>"
                + "<small>" + (yeni ? "Yeni yanıt var • " : "") + esc(zamanKisa(t.updated_at)) + "</small></span></a>";
            }).join("");
            $("bellListe").innerHTML = html;
            rozet(n);
          }).catch(function () {});
      }).catch(function () {});
  }

  // — Rehber: cozulen bilgi bankasindaki yeniler. —
  function rehberVerisi(sb) {
    sb.from("destek_talepleri").select("id,konu,updated_at")
      .eq("durum", "cozuldu").order("updated_at", { ascending: false }).limit(5)
      .then(function (res) {
        var rows = (res && res.data) || [];
        if (!rows.length) { listeBos("Henüz çözülen talep yok."); rozet(0); return; }
        $("bellListe").innerHTML = '<p class="bell-baslik">BİLGİ BANKASI</p>' + rows.map(function (t) {
          return '<a class="bell-item" href="/rehber">'
            + '<span class="read-dot"></span>'
            + "<span><strong>" + esc(t.konu) + "</strong>"
            + "<small>Çözüldü • " + esc(zamanKisa(t.updated_at)) + "</small></span></a>";
        }).join("");
        rozet(0);
      }).catch(function () {});
  }

  // — Ekip: havuz (atanmamis yeni) + bana atanmislar. Baskasina atanmis gorunmez (RLS zaten gizler). —
  function adminVerisi(sb, u) {
    var q = sb.from("destek_talepleri").select("id,konu,durum,atanan_admin,created_at,updated_at")
      .neq("durum", "cozuldu").order("created_at", { ascending: false }).limit(30);
    q.then(function (res) {
      var rows = (res && res.data) || [];
      // RLS zaten baskasina atanmisi dondurmez; yine de cift koruma:
      var gorunur = rows.filter(function (t) {
        return !t.atanan_admin || (u && t.atanan_admin === u.id);
      });
      var havuz = gorunur.filter(function (t) { return !t.atanan_admin && t.durum === "yeni"; });
      var benim = gorunur.filter(function (t) { return u && t.atanan_admin === u.id && t.durum !== "cozuldu"; });
      var n = havuz.length + benim.length;
      if (!gorunur.length) { listeBos("Havuz temiz. Yeni talep yok."); rozet(0); return; }
      var html = "";
      if (havuz.length) {
        html += '<p class="bell-baslik">HAVUZ • ' + havuz.length + "</p>";
        html += havuz.slice(0, 3).map(function (t) {
          return '<a class="bell-item" href="/talep?id=' + t.id + '">'
            + '<span class="unread-dot"></span>'
            + "<span><strong>" + esc(t.konu) + "</strong>"
            + "<small>Yeni talep • " + esc(zamanKisa(t.created_at)) + " • Üstlen →</small></span></a>";
        }).join("");
      }
      if (benim.length) {
        html += '<p class="bell-baslik">BANA ATANMIŞ • ' + benim.length + "</p>";
        html += benim.slice(0, 3).map(function (t) {
          return '<a class="bell-item" href="/talep?id=' + t.id + '">'
            + '<span class="read-dot"></span>'
            + "<span><strong>" + esc(t.konu) + "</strong>"
            + "<small>Üstlendiğin talep • " + esc(zamanKisa(t.updated_at)) + "</small></span></a>";
        }).join("");
      }
      var kalan = gorunur.length - havuz.slice(0, 3).length - benim.slice(0, 3).length;
      if (kalan > 0) html += '<a class="bell-item bell-tumu" href="/admin">Tümünü havuzda gör (' + gorunur.length + ") →</a>";
      else if (!havuz.length && !benim.length) html += '<a class="bell-item bell-tumu" href="/admin">Havuzu aç →</a>';
      $("bellListe").innerHTML = html;
      rozet(n);
    }).catch(function () {});
  }

  function baglanRealtime(sb, yenile) {
    try {
      if (rtKanal) { try { sb.removeChannel(rtKanal); } catch (e) {} rtKanal = null; }
      rtKanal = sb.channel("bildirim-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_talepleri" }, function () { planli(yenile); })
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_mesajlari" }, function () { planli(yenile); })
        .subscribe();
    } catch (e) {}
  }
  function planli(fn) {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(fn, 900);
  }

  function init() {
    if (!$("topBell")) return;
    waitAuth(function () {
      var A = window.KlyzeAuth;
      if (!window.supabase) return;
      var sb;
      try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
      catch (e) { return; }
      var btn = $("bellBtn"), menu = $("bellMenu");
      if (btn && !btn.getAttribute("data-wired")) {
        btn.setAttribute("data-wired", "1");
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var acik = menu.hidden;
          menu.hidden = !acik;
          btn.setAttribute("aria-expanded", acik ? "true" : "false");
        });
        document.addEventListener("click", function (ev) {
          var w = $("topBell");
          if (menu && !menu.hidden && w && !w.contains(ev.target)) {
            menu.hidden = true;
            btn.setAttribute("aria-expanded", "false");
          }
        });
        document.addEventListener("keydown", function (ev) {
          if (ev.key === "Escape" && menu) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
        });
      }
      var lastKey = null;
      function guncelle() {
        var u = A.user;
        var key = (u ? u.id : "-") + "|" + (A.rol || "-");
        if (key === lastKey) return;
        lastKey = key;
        $("topBell").hidden = !u;
        if (!u) { rozet(0); return; }
        var panel = A.panel ? A.panel() : null;
        if (panel === "havuz") adminVerisi(sb, u);
        else if (panel === "rehber") rehberVerisi(sb);
        else kullaniciVerisi(sb, u);
      }
      A.ready.then(function () { guncelle(); baglanRealtime(sb, guncelle); });
      A.onChange(guncelle);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
