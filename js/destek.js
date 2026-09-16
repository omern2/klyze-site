// Klyze.gg — destek talepleri (giris zorunlu; dosyalar Supabase Storage).
(function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  var BUCKET = "destek-dosyalari";
  var MAX_DOSYA = 3;
  var MAX_BOYUT = 25 * 1024 * 1024;
  var DURUM = { yeni: "Yeni", beklemede: "Beklemede", incelemede: "İnceleniyor", yanitlandi: "Yanıtlandı", cozuldu: "Çözüldü", kapali: "Çözüldü" };
  var ONC = { dusuk: "Düşük", normal: "Normal", yuksek: "Yüksek", kritik: "Kritik" };
  var FILTRE = "acik";
  var PUANMAP = {};
  var rtKanal = null;
  var rtTimer = null;

  function gorulen() {
    try { return JSON.parse(localStorage.getItem("klyze-destek-seen") || "{}"); }
    catch (e) { return {}; }
  }
  function gorulduIsaretle(id) {
    try {
      var s = gorulen();
      s[id] = new Date().toISOString();
      localStorage.setItem("klyze-destek-seen", JSON.stringify(s));
    } catch (e) {}
  }
  function okunmadiVar(t) {
    try {
      var seen = gorulen()[t.id];
      var adaylar = (t.mesajlar || []).filter(function (m) { return m.kim === "ekip"; })
        .map(function (m) { return m.created_at; });
      if (t.admin_yanit && t.updated_at && t.updated_at !== t.created_at) adaylar.push(t.updated_at);
      if (!adaylar.length) return false;
      var enYeni = adaylar.sort().pop();
      return !seen || enYeni > seen;
    } catch (e) { return false; }
  }
  function norm(s) {
    return String(s || "").toLocaleLowerCase("tr")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");
  }
  function sssOner(konu, acik) {
    var veri = window.KLYZE_SSS || [];
    var kelimeler = norm(konu + " " + acik).split(/\s+/).filter(function (w) { return w.length > 2; });
    if (!kelimeler.length) return [];
    return veri.map(function (a) {
      var havuz = norm(a.baslik + " " + a.ozet + " " + a.etiket);
      var skor = 0;
      kelimeler.forEach(function (w) { if (havuz.indexOf(w) !== -1) skor++; });
      return { a: a, skor: skor };
    }).filter(function (x) { return x.skor > 0; })
      .sort(function (x, y) { return y.skor - x.skor; })
      .slice(0, 3).map(function (x) { return x.a; });
  }

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
  function showErr(msg) {
    var e = $("dErr");
    e.textContent = msg;
    e.hidden = !msg;
  }
  function waitAuth(fn) {
    var n = 0;
    var iv = setInterval(function () {
      if (window.KlyzeAuth) { clearInterval(iv); fn(); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  }

  function dosyaSatiri(url) {
    var ad = decodeURIComponent(String(url).split("/").pop().split("?")[0] || "dosya");
    var video = /\.(mp4|webm|mov)$/i.test(ad);
    return '<a class="file-chip" href="' + esc(url) + '" target="_blank" rel="noopener">' + (video ? "▶ " : "🖼 ") + esc(ad.length > 28 ? ad.slice(0, 25) + "..." : ad) + "</a>";
  }

  function kisiSatiri(m, varsayilanAd) {
    var ad = m.ad || (m.kim === "ekip" ? "Klyze ekibi" : varsayilanAd);
    var av = m.avatar_url ? '<img class="msg-ava" src="' + esc(m.avatar_url) + '" alt="" loading="lazy" />' : "";
    return '<div class="msg-row' + (m.kim === "ekip" ? " msg-ekip" : "") + '">'
      + '<div class="msg-head"><span class="msg-kisi">' + av + "<strong>" + esc(ad) + "</strong></span>"
      + '<time class="mono">' + esc(fmtTarih(m.created_at)) + "</time></div>"
      + "<p>" + esc(m.metin) + "</p></div>";
  }
  function mesajSatiri(m, sahipAdi) { return kisiSatiri(m, sahipAdi); }

  function headAvatar(t) {
    var au = (window.KlyzeAuth && window.KlyzeAuth.user) || null;
    var src = t.avatar_url || (au ? au.avatar : null);
    if (!src) return "";
    return '<img class="t-ava" src="' + esc(src) + '" alt="" loading="lazy" />';
  }

  function zamanOnce(iso) {
    try {
      var dk = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      if (dk < 1) return "az önce";
      if (dk < 60) return dk + " dk önce";
      var sa = Math.round(dk / 60);
      if (sa < 24) return sa + " sa önce";
      var gun = Math.round(sa / 24);
      if (gun < 30) return gun + " gün önce";
      return fmtTarih(iso);
    } catch (e) { return fmtTarih(iso); }
  }
  function sonMesaj(t) {
    var hepsi = (t.mesajlar || []).slice();
    if (t.admin_yanit) hepsi.push({ kim: "ekip", metin: t.admin_yanit, created_at: t.updated_at || t.created_at });
    if (!hepsi.length) return null;
    hepsi.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    return hepsi[hepsi.length - 1];
  }
  function filtreCips() {
    // Filtre artik acilir menu (select): secili degeri FILTRE ile esitle.
    var sel = $("destekFiltreSec");
    if (sel && sel.value !== FILTRE) sel.value = FILTRE;
  }
  function cozMu(t) { return t.durum === "cozuldu" || t.durum === "kapali"; }
  function uyarla(list) {
    if (FILTRE === "acik") return list.filter(function (t) { return !cozMu(t); });
    if (FILTRE === "cozuldu") return list.filter(cozMu);
    if (FILTRE === "kapali") return list.filter(cozMu);
    return list;
  }
  function csatKutusu(t) {
    if (!cozMu(t) || PUANMAP[t.id]) return "";
    return '<div class="csat-box"><strong>Destekten memnun kaldın mı?</strong>'
      + '<div class="csat-stars" data-csat>' + [1, 2, 3, 4, 5].map(function (v) {
        return '<button type="button" data-v="' + v + '" aria-label="' + v + ' yıldız">★</button>';
      }).join("") + "</div>"
      + '<div class="msg-reply"><input class="input" maxlength="500" data-csat-yorum placeholder="Kısaca yaz (isteğe bağlı)...">'
      + '<button class="btn btn-white btn-small" type="button" data-csat-gonder>Gönder</button></div></div>';
  }
  function aktifId() {
    var m = (location.hash || "").match(/^#talep-(\d+)$/);
    return m ? m[1] : null;
  }
  function render(list) {
    filtreCips();
    var box = $("ticketList");
    if (!box) return;
    var goster = uyarla(list || []);
    if (!goster.length) {
      box.innerHTML = '<div class="bos-kutu"><strong>'
        + (FILTRE === "cozuldu" ? "Çözülen talebin yok." : "Henüz talebin yok.")
        + "</strong><span>Yukarıdaki formu doldur, ortalama 24 saatte dönüş yapıyoruz.</span></div>";
      return;
    }
    box.innerHTML = goster.map(function (t) {
      var dosyalar = (t.dosyalar || []).map(dosyaSatiri).join("");
      var eski = t.admin_yanit
        ? '<div class="msg-row msg-ekip"><div class="msg-head"><strong>Klyze ekibi</strong></div><p>' + esc(t.admin_yanit) + "</p></div>"
        : "";
      var akis = (t.mesajlar || []).map(function (m) { return mesajSatiri(m, t.name); }).join("");
      var sayi = (t.mesajlar || []).length + (t.admin_yanit ? 1 : 0);
      var son = sonMesaj(t);
      var onizleme = son
        ? ((son.kim === "ekip" ? "Ekip: " : "Sen: ") + String(son.metin || ""))
        : String(t.aciklama || "");
      var oncRozet = (t.oncelik && t.oncelik !== "normal")
        ? '<span class="onc onc-' + esc(t.oncelik) + '">' + esc(ONC[t.oncelik] || t.oncelik) + "</span>" : "";
      var nokta = okunmadiVar(t) ? '<span class="unread-dot" title="Yeni yanıt"></span>' : "";
      var durumCls = t.durum === "kapali" ? "cozuldu" : t.durum;
      return '<article class="ticket-card" data-id="' + t.id + '">'
        + '<button type="button" class="ticket-head" data-ac>'
        + headAvatar(t)
        + '<span class="durum durum-' + esc(durumCls) + '">' + esc(DURUM[t.durum] || t.durum) + "</span>"
        + oncRozet
        + '<span class="ticket-head-text"><strong>' + esc(t.konu) + nokta + "</strong>"
        + "<small>" + esc(onizleme.slice(0, 80)) + (onizleme.length > 80 ? "..." : "") + "</small></span>"
        + '<span class="msg-count mono">' + sayi + " yanıt</span>"
        + '<time class="mono">' + esc(zamanOnce(t.updated_at || t.created_at)) + "</time>"
        + '<span class="chev" aria-hidden="true">▾</span>'
        + "</button>"
        + '<div class="ticket-detay">'
        + '<p class="ticket-desc">' + esc(t.aciklama) + "</p>"
        + (dosyalar ? '<div class="file-row">' + dosyalar + "</div>" : "")
        + '<div class="msg-list">' + eski + akis + "</div>"
        + '<div class="msg-reply"><textarea class="input" rows="2" maxlength="1000" data-cevap placeholder="Cevabını yaz..."></textarea>'
        + '<button class="btn btn-white btn-small" type="button" data-cevap-gonder>Gönder</button></div>'
        + csatKutusu(t)
        + "</div>"
        + "</article>";
    }).join("");
    var acikId = aktifId();
    box.querySelectorAll(".ticket-card").forEach(function (c) {
      if (acikId && c.getAttribute("data-id") === acikId) {
        c.classList.add("open");
        gorulduIsaretle(acikId);
        setTimeout(function () { c.scrollIntoView({ block: "center" }); }, 100);
      }
    });
  }

  var TALEPLER = [];

  function yukle(sb) {
    sb.from("destek_talepleri").select("id,name,avatar_url,konu,aciklama,dosyalar,durum,oncelik,admin_yanit,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(30)
      .then(function (res) {
        if (!res || res.error) return;
        TALEPLER = res.data || [];
        var ids = TALEPLER.map(function (t) { return t.id; });
        if (!ids.length) { PUANMAP = {}; render(TALEPLER); return; }
        Promise.all([
          sb.from("destek_mesajlari").select("talep_id,kim,ad,avatar_url,metin,created_at")
            .in("talep_id", ids).order("created_at", { ascending: true }).limit(300),
          sb.from("destek_puan").select("talep_id,puan").in("talep_id", ids)
        ]).then(function (hepsi) {
          var map = {};
          (((hepsi[0] && hepsi[0].data)) || []).forEach(function (m) {
            (map[m.talep_id] = map[m.talep_id] || []).push(m);
          });
          TALEPLER.forEach(function (t) { t.mesajlar = map[t.id] || []; });
          PUANMAP = {};
          (((hepsi[1] && hepsi[1].data)) || []).forEach(function (p) { PUANMAP[p.talep_id] = p.puan; });
          render(TALEPLER);
        }).catch(function () { render(TALEPLER); });
      }).catch(function () {});
  }

  function csatGonder(sb, card) {
    var u = window.KlyzeAuth && window.KlyzeAuth.user;
    if (!u) return;
    var wrap = card.querySelector("[data-csat]");
    var v = wrap ? parseInt(wrap.getAttribute("data-sec") || "0", 10) : 0;
    if (!v) return;
    var id = parseInt(card.getAttribute("data-id"), 10);
    var ta = card.querySelector("[data-csat-yorum]");
    var yorum = ((ta && ta.value) || "").trim().slice(0, 500);
    var b = card.querySelector("[data-csat-gonder]");
    b.disabled = true;
    sb.from("destek_puan").insert({ talep_id: id, puan: v, yorum: yorum === "" ? null : yorum })
      .then(function (res) {
        b.disabled = false;
        if (res && res.error) { showErr("Kaydedilemedi: " + res.error.message); return; }
        yukle(sb);
      });
  }

  function baglanRealtime(sb) {
    try {
      if (rtKanal) { try { sb.removeChannel(rtKanal); } catch (e) {} rtKanal = null; }
      rtKanal = sb.channel("destek-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_mesajlari" }, function () { planliYukle(sb); })
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_talepleri" }, function () { planliYukle(sb); })
        .on("postgres_changes", { event: "*", schema: "public", table: "destek_puan" }, function () { planliYukle(sb); })
        .subscribe();
    } catch (e) {}
  }
  function planliYukle(sb) {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(function () { yukle(sb); }, 800);
  }

  function cevapGonder(sb, card) {
    var u = window.KlyzeAuth && window.KlyzeAuth.user;
    if (!u) { showErr("Cevap için giriş yapmalısın."); return; }
    var ta = card.querySelector("[data-cevap]");
    var metin = ((ta && ta.value) || "").trim();
    if (!metin) return;
    var id = parseInt(card.getAttribute("data-id"), 10);
    var b = card.querySelector("[data-cevap-gonder]");
    b.disabled = true;
    sb.from("destek_mesajlari").insert({
        talep_id: id,
        kim: "kullanici",
        ad: String(u.name).slice(0, 24),
        avatar_url: u.avatar ? String(u.avatar).slice(0, 500) : null,
        metin: metin.slice(0, 1000)
      })
      .then(function (res) {
        b.disabled = false;
        if (res && res.error) { showErr("Gönderilemedi: " + res.error.message); return; }
        yukle(sb);
      });
  }

  function temizAd(ad) {
    return String(ad || "dosya").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  }

  function init() {
    waitAuth(function () {
      var A = window.KlyzeAuth;
      if (!window.supabase) { showErr("Bağlantı kurulamadı — biraz sonra tekrar dene."); return; }
      var sb;
      try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
      catch (e) { showErr("Bağlantı kurulamadı — biraz sonra tekrar dene."); return; }

      var lastSyncKey = null;
      function sync() {
        var u = A.user;
        var key = (u ? u.id : "-") + "|" + (A.rol || "-");
        if (key === lastSyncKey) return;
        lastSyncKey = key;
        $("destekLogin").hidden = !!u;
        $("destekApp").hidden = !u;
        if (u) { yukle(sb); baglanRealtime(sb); }
      }
      A.ready.then(sync);
      A.onChange(sync);

      var secili = [];
      var dz = $("dropzone"), di = $("dDosya");
      var thumbUrls = [];
      function thumbTemizle() {
        thumbUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
        thumbUrls = [];
      }
      function dosyaCiz() {
        var box = $("dosyaListe");
        if (!box) return;
        thumbTemizle();
        box.innerHTML = secili.map(function (f, i) {
          var ad = f.name.length > 24 ? f.name.slice(0, 21) + "..." : f.name;
          var on = "";
          if (f.type.indexOf("image/") === 0) {
            try {
              var u = URL.createObjectURL(f);
              thumbUrls.push(u);
              on = '<img class="file-thumb" src="' + u + '" alt="" />';
            } catch (e) {}
          }
          return '<span class="file-chip">' + on + esc(ad) + ' <button type="button" data-dsil="' + i + '" aria-label="Kaldır">✕</button></span>';
        }).join("");
        if (dz) dz.classList.toggle("dolu", secili.length > 0);
        adimGuncelle();
      }
      function dosyaEkle(liste) {
        var atlandi = 0;
        Array.prototype.forEach.call(liste || [], function (f) {
          var okTip = f.type.indexOf("image/") === 0 || f.type.indexOf("video/") === 0;
          if (secili.length >= MAX_DOSYA || !okTip || f.size > MAX_BOYUT) { atlandi++; return; }
          secili.push(f);
        });
        if (atlandi) showErr("Bazı dosyalar atlandı (yalnızca görsel/video, 25MB, en fazla 3).");
        else showErr("");
        dosyaCiz();
      }
      // Adim cizgisi + sayaclar (21st mikro-etkilesim)
      function adimGuncelle() {
        try {
          var konu = ($("dKonu") && $("dKonu").value.trim().length) || 0;
          var acik = ($("dAcik") && $("dAcik").value.trim().length) || 0;
          var yazOk = konu >= 3 && acik >= 10;
          var medyaOk = secili.length > 0;
          var adim = !yazOk ? 0 : (!medyaOk ? 1 : 2);
          var steps = document.querySelectorAll("#supSteps li");
          steps.forEach(function (li, i) { li.classList.toggle("done", i < adim || (i === 0 && yazOk)); });
          var bar = $("supProgress");
          if (bar) bar.style.width = (adim / 3 * 100) + "%";
          var ks = $("dKonuSay");
          if (ks) {
            ks.textContent = (($("dKonu") && $("dKonu").value.length) || 0) + "/80";
            ks.classList.toggle("dolu", konu >= 3);
          }
          var as = $("dAcikSay");
          if (as) {
            as.textContent = (($("dAcik") && $("dAcik").value.length) || 0) + "/2000";
            as.classList.toggle("dolu", acik >= 10);
          }
          ["dKonu", "dAcik"].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.classList.toggle("filled", el.value.trim().length > 0);
          });
        } catch (e) {}
      }
      if (dz && di) {
        dz.addEventListener("click", function () { di.click(); });
        dz.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); di.click(); }
        });
        ["dragenter", "dragover"].forEach(function (e) {
          dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.add("surukle"); });
        });
        ["dragleave", "drop"].forEach(function (e) {
          dz.addEventListener(e, function (ev) { ev.preventDefault(); dz.classList.remove("surukle"); });
        });
        dz.addEventListener("drop", function (ev) { dosyaEkle(ev.dataTransfer.files); });
        di.addEventListener("change", function () { dosyaEkle(di.files); di.value = ""; });
        $("dosyaListe").addEventListener("click", function (ev) {
          var b = ev.target.closest ? ev.target.closest("[data-dsil]") : null;
          if (!b) return;
          secili.splice(parseInt(b.getAttribute("data-dsil"), 10), 1);
          dosyaCiz();
        });
      }

      var filtreSec = $("destekFiltreSec");
      if (filtreSec) filtreSec.addEventListener("change", function () {
        FILTRE = filtreSec.value;
        render(TALEPLER);
      });

      var oneriTimer = null;
      function oneriGuncelle() {
        var kutu = $("sssOneri");
        if (!kutu || typeof window.KLYZE_SSS === "undefined") return;
        var top3 = sssOner($("dKonu").value, $("dAcik").value);
        if (!top3.length) { kutu.hidden = true; kutu.innerHTML = ""; return; }
        kutu.innerHTML = "<strong>Belki bunlar çözer:</strong>" + top3.map(function (a) {
          return '<a href="/sss#' + esc(a.id) + '">' + esc(a.baslik) + "</a>";
        }).join("");
        kutu.hidden = false;
      }
      ["dKonu", "dAcik"].forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener("input", function () {
          clearTimeout(oneriTimer);
          oneriTimer = setTimeout(oneriGuncelle, 400);
          adimGuncelle();
        });
      });
      adimGuncelle();

      $("ticketList").addEventListener("click", function (ev) {
        var card = ev.target.closest ? ev.target.closest(".ticket-card") : null;
        if (!card) return;
        var gonder = ev.target.closest ? ev.target.closest("[data-cevap-gonder]") : null;
        if (gonder) { cevapGonder(sb, card); return; }
        var cs = ev.target.closest ? ev.target.closest("[data-csat] button") : null;
        if (cs) {
          var wrap = cs.parentElement;
          var v = parseInt(cs.getAttribute("data-v"), 10);
          wrap.querySelectorAll("button").forEach(function (x) {
            x.classList.toggle("on", parseInt(x.getAttribute("data-v"), 10) <= v);
          });
          wrap.setAttribute("data-sec", v);
          return;
        }
        var cg = ev.target.closest ? ev.target.closest("[data-csat-gonder]") : null;
        if (cg) { csatGonder(sb, card); return; }
        var head = ev.target.closest ? ev.target.closest("[data-ac]") : null;
        if (head && !ev.target.closest("a")) {
          card.classList.toggle("open");
          if (card.classList.contains("open")) {
            gorulduIsaretle(card.getAttribute("data-id"));
            var dd = card.querySelector(".unread-dot");
            if (dd) dd.remove();
          }
        }
      });

      window.addEventListener("hashchange", function () { render(TALEPLER); });

      $("destekForm").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var u = A.user;
        if (!u) { showErr("Talep açmak için giriş yapmalısın."); return; }
        var konu = $("dKonu").value.trim();
        var acik = $("dAcik").value.trim();
        if (konu.length < 3) { showErr("Konu en az 3 karakter olmalı."); return; }
        if (acik.length < 10) { showErr("Açıklama en az 10 karakter olmalı."); return; }
        // hCaptcha: cozulmus token sart (gercek dogrulama verify-captcha edge fonksiyonunda)
        if (window.hcaptcha) {
          var capTok = "";
          try { capTok = window.hcaptcha.getResponse(); } catch (e) {}
          if (!capTok) { showErr("Göndermeden önce robot olmadığını doğrula."); return; }
          window.__hcaptcha = capTok;
        }
        var files = secili.slice(0, MAX_DOSYA);
        showErr("");
        var gonder = $("dGonder");
        var gonderHTML = gonder.innerHTML;
        gonder.disabled = true;
        gonder.innerHTML = '<span class="spin" aria-hidden="true"></span><span>Gönderiliyor...</span>';
        var buoyant = "u" + Date.now();
        var yuklemeler = files.map(function (f, i) {
          var yol = u.id + "/" + buoyant + "_" + i + "_" + temizAd(f.name);
          return sb.storage.from(BUCKET).upload(yol, f, { upsert: false })
            .then(function (res) {
              if (res.error) throw new Error(res.error.message);
              return sb.storage.from(BUCKET).getPublicUrl(yol).data.publicUrl;
            });
        });
        Promise.all(yuklemeler).then(function (urller) {
          return sb.from("destek_talepleri").insert({
            user_id: u.id,
            name: u.name,
            email: u.email,
            avatar_url: u.avatar ? String(u.avatar).slice(0, 500) : null,
            kategori: $("dKat").value,
            oncelik: ["dusuk", "normal", "yuksek"].indexOf($("dOnc").value) !== -1 ? $("dOnc").value : "normal",
            konu: konu.slice(0, 80),
            aciklama: acik.slice(0, 2000),
            dosyalar: urller
          }).select("id").single();
        }).then(function (res) {
          gonder.disabled = false;
          gonder.innerHTML = gonderHTML;
          if (res && res.error) { showErr("Kaydedilemedi: " + res.error.message); return; }
          var yeniId = res && res.data ? res.data.id : null;
          $("destekForm").reset();
          secili.length = 0;
          dosyaCiz();
          adimGuncelle();
          try {
            var steps = document.querySelectorAll("#supSteps li");
            steps.forEach(function (li) { li.classList.add("done"); });
            var bar = $("supProgress");
            if (bar) bar.style.width = "100%";
          } catch (e2) {}
          var ok = $("destekOk");
          if (ok && yeniId) {
            ok.textContent = "Talebin alındı — yanıt gelince üstteki zilden haber vereceğiz.";
            ok.hidden = false;
          }
          if (yeniId) { try { location.hash = "talep-" + yeniId; } catch (e) {} }
          try { if (window.hcaptcha) window.hcaptcha.reset(); window.__hcaptcha = null; } catch (e2) {}
          yukle(sb);
        }).catch(function (e) {
          gonder.disabled = false;
          gonder.innerHTML = gonderHTML;
          showErr("Yükleme başarısız: " + (e && e.message ? e.message : "bilinmeyen hata"));
        });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
