/* Klyze destek: SSS arama/filtre + konu sayfaları. */
(() => {
  "use strict";

  const KAT_AD = {
    teknik: "Teknik",
    kurulum: "Kurulum",
    hesap: "Hesap",
    guvenlik: "Güvenlik"
  };

  const SSS = [
    {
      id: "overlay-gorunmuyor",
      kat: "teknik",
      etiket: "overlay görünmüyor açılmıyor alt x kısayol oyun içi panel gelmiyor",
      baslik: "Overlay oyunda görünmüyor",
      ozet: "Overlay ALT + X ile açılır. Kısayol çalışmıyorsa oyun modunu ve yönetici iznini kontrol et.",
      adimlar: [
        "Oyun içinde ALT + X tuşlarına bas. Overlay bu kısayolla açılıp kapanır.",
        "Valorant'ı tam ekran yerine Tam Ekran Pencereli (borderless) modda çalıştır.",
        "Klyze'yi kapatıp sağ tık → Yönetici olarak çalıştır ile aç."
      ]
    },
    {
      id: "oyun-kasma",
      kat: "teknik",
      etiket: "kasma donma takılma fps performans yavaş overlay oyun",
      baslik: "Oyun kasıyor veya donuyor",
      ozet: "Önce overlay'i kapatıp farkı gör; sürücüyü ve arka plan uygulamalarını kontrol et.",
      adimlar: [
        "Oyun içinde ALT + X ile overlay'i kapat; kasma devam ediyor mu bak.",
        "Ekran kartı sürücünü güncelle ve oyunu tam ekran pencereli modda dene.",
        "Arka planda çalışan ağır uygulamaları kapat."
      ]
    },
    {
      id: "smartscreen-uyarisi",
      kat: "kurulum",
      etiket: "kurulum smartscreen bilinmeyen yayımcı windows korudu çalıştır uyarı",
      baslik: "Windows “bilinmeyen yayımcı” uyarısı veriyor",
      ozet: "Kurulum dosyası imzasız göründüğünde SmartScreen devreye girer; kurulum devam edebilir.",
      adimlar: [
        "Uyarı ekranında “Ek bilgi” bağlantısına tıkla.",
        "“Yine de çalıştır” seçeneğini seç.",
        "Kurulum normal şekilde devam eder.",
        "Dosyayı yalnızca Klyze sitesindeki indirme düğmesinden indir."
      ]
    },
    {
      id: "maclar-guncellenmiyor",
      kat: "teknik",
      etiket: "maç rank güncellenmiyor görünmüyor analiz veri riot eksik maç geçmişi",
      baslik: "Maçlarım / rankım güncellenmiyor",
      ozet: "Riot verisi birkaç dakikaya kadar gecikebilir.",
      adimlar: [
        "Riot ID ve tag bilginin doğru yazıldığından emin ol.",
        "Birkaç dakika bekleyip analiz ekranını yenile."
      ]
    },
    {
      id: "canli-mac-yavas",
      kat: "teknik",
      etiket: "canlı maç yavaş gecikme geç geliyor takip asistan",
      baslik: "Canlı maç takibi gecikmeli",
      ozet: "Maç başlangıcında 1-2 dakikalık gecikme normaldir.",
      adimlar: [
        "Maçın ilk dakikalarında verinin oturmasını bekle.",
        "İnternet bağlantını kontrol et."
      ]
    },
    {
      id: "klyze-ac-nedir",
      kat: "guvenlik",
      etiket: "klyze ac anticheat hileci smurf tarama nedir güvenlik",
      baslik: "Klyze AC nedir?",
      ozet: "Kadrodaki oyuncuları tarar; hileciyi ve smurf'ü işaretler.",
      adimlar: [
        "Canlı overlay'deki AC etiketleri son 7 günün taramasından gelir.",
        "Klyze AC oyun dosyalarına yazmaz ve oyuna enjekte etmez.",
        "Yalnızca maç verisini okur; oyunun kendi dosyalarını değiştirmez."
      ]
    },
    {
      id: "oyunu-etkiler-mi",
      kat: "guvenlik",
      etiket: "ban riski oyunu etkiler mi dosya bütünlüğü enjekte vanguard güvenli",
      baslik: "Klyze oyunu etkiler mi?",
      ozet: "Klyze oyun dosyalarına yazmaz, oyuna enjekte etmez; yalnızca maç verisini okur.",
      adimlar: [
        "Overlay tıklamaları oyuna geçer; oyunu engellemez.",
        "Oyun dosyalarını değiştirmediği için dosya bütünlüğü kontrolünü etkilemez.",
        "Overlay'i kapatmak için oyun içinde ALT + X'e bas."
      ]
    },
    {
      id: "kaldirma",
      kat: "kurulum",
      etiket: "kaldırma silme uninstall nasıl silinir program ekle",
      baslik: "Klyze nasıl kaldırılır?",
      ozet: "Başlat menüsünden veya Windows Ayarlar üzerinden kaldırabilirsin.",
      adimlar: [
        "Başlat menüsünde Klyze'yi bulup “Kaldır”a tıkla.",
        "Alternatif: Ayarlar → Uygulamalar → Klyze → Kaldır."
      ]
    },
    {
      id: "hesap-giris",
      kat: "hesap",
      etiket: "hesap giriş giriş yapamıyorum google şifre oturum login",
      baslik: "Hesabıma nasıl giriş yaparım?",
      ozet: "Uygulama Riot ID ile çalışır; site üzerinden Google girişi henüz aktif değil.",
      adimlar: [
        "Uygulamayı aç, Riot ID ve tag bilgini gir. Şifre gerekmez.",
        "Sitedeki “Giriş Yap” düğmesi şu an yalnızca bilgilendirme gösterir."
      ]
    },
    {
      id: "sistem-gereksinimleri",
      kat: "kurulum",
      etiket: "sistem gereksinimleri windows 10 11 64 bit boyut ücret destekli",
      baslik: "Hangi sistemlerde çalışıyor?",
      ozet: "Windows 10 ve 11'in 64-bit sürümlerinde çalışır.",
      adimlar: [
        "İşletim sistemi: Windows 10 veya Windows 11 (64-bit).",
        "İndirme boyutu yaklaşık 121,6 MB.",
        "Uygulama ücretsiz; kart bilgisi istemez."
      ]
    }
  ];

  const KONULAR = {
    overlay: {
      ad: "Overlay",
      aciklama: "Oyun içi panel, kısayollar ve tam ekran ayarları.",
      sorular: ["overlay-gorunmuyor", "oyunu-etkiler-mi", "klyze-ac-nedir"]
    },
    kasma: {
      ad: "Kasma / donma",
      aciklama: "FPS düşüşü, donma ve performans kontrolü.",
      sorular: ["oyun-kasma", "canli-mac-yavas", "sistem-gereksinimleri"]
    },
    rank: {
      ad: "Rank / maç",
      aciklama: "Riot ID, rank ve maç verisinin güncellenmesi.",
      sorular: ["maclar-guncellenmiyor", "canli-mac-yavas"]
    },
    kurulum: {
      ad: "Kurulum",
      aciklama: "İndirme, SmartScreen uyarısı ve kaldırma.",
      sorular: ["smartscreen-uyarisi", "kaldirma", "sistem-gereksinimleri"]
    },
    ac: {
      ad: "Klyze AC",
      aciklama: "Tarama, güvenlik ve oyun dosyaları.",
      sorular: ["klyze-ac-nedir", "oyunu-etkiler-mi"]
    },
    hesap: {
      ad: "Hesap",
      aciklama: "Riot ID ile giriş ve oturum.",
      sorular: ["hesap-giris"]
    }
  };

  const byId = (id) => document.getElementById(id);

  const list = byId("dsSssList");
  if (!list) return;

  const emptyBox = byId("dsEmpty");
  const countEl = byId("dsFaqCount");
  const statusEl = byId("dsListStatus");
  const searchEl = byId("dsAra");
  const clearEl = byId("dsAraTemizle");

  const NS = "http://www.w3.org/2000/svg";
  const acik = new Set();
  const detayAcik = new Set();
  let dokunuldu = false;

  const norm = (value) => String(value == null ? "" : value)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const chevron = () => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "ds-chev");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "m6 9 6 6 6-6");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  };

  function sssItem(item, onek = "sss", acikSet = acik) {
    const article = el("article", "ds-item");
    article.id = onek + "-" + item.id;
    article.setAttribute("role", "listitem");
    const open = acikSet.has(item.id);
    article.classList.toggle("is-open", open);

    const btn = el("button", "ds-q");
    btn.type = "button";
    btn.id = onek + "-b-" + item.id;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-controls", onek + "-p-" + item.id);

    btn.appendChild(el("span", "ds-tag", KAT_AD[item.kat] || item.kat));
    btn.appendChild(el("span", "ds-q-text", item.baslik));
    btn.appendChild(chevron());

    const panel = el("div", "ds-a");
    panel.id = onek + "-p-" + item.id;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", btn.id);
    panel.appendChild(el("p", "ds-a-ozet", item.ozet));

    const steps = el("ol", "ds-steps");
    item.adimlar.forEach((adim) => steps.appendChild(el("li", null, adim)));
    panel.appendChild(steps);

    btn.addEventListener("click", () => {
      const willOpen = !article.classList.contains("is-open");
      article.classList.toggle("is-open", willOpen);
      btn.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) acikSet.add(item.id);
      else acikSet.delete(item.id);
    });

    article.appendChild(btn);
    article.appendChild(panel);
    return article;
  }

  function eslesme(item, kelimeler) {
    if (!kelimeler.length) return true;
    const hay = norm([item.baslik, item.ozet, item.etiket, item.adimlar.join(" ")].join(" "));
    return kelimeler.every((kelime) => hay.includes(kelime));
  }

  function renderSss() {
    const kelimeler = norm(searchEl.value).split(" ").filter(Boolean);
    const hits = SSS.filter((item) => eslesme(item, kelimeler));

    list.textContent = "";
    hits.forEach((item) => list.appendChild(sssItem(item)));

    emptyBox.hidden = hits.length > 0;
    countEl.textContent = hits.length + " soru";
    clearEl.hidden = !searchEl.value;

    if (dokunuldu) {
      statusEl.textContent = hits.length
        ? hits.length + " soru bulundu."
        : "Sonuç yok. Daha kısa bir kelime dene.";
    }
  }

  searchEl.addEventListener("input", () => {
    dokunuldu = true;
    renderSss();
  });

  clearEl.addEventListener("click", () => {
    searchEl.value = "";
    dokunuldu = true;
    renderSss();
    searchEl.focus();
  });

  /* ---- konu sayfasi ---- */
  const frameEl = document.querySelector(".site-frame");
  const pageEl = byId("page-destek");
  const heroEl = document.querySelector(".ds-hero");
  const bodyEl = document.querySelector(".ds-body");
  const detailEl = byId("dsDetail");
  const detailList = byId("dsDetailList");
  const detailTitle = byId("dsDetailTitle");
  const detailLead = byId("dsDetailLead");
  const detailIco = byId("dsDetailIco");
  let geriScroll = 0;
  let sonKart = null;

  function konuAc(key, kart) {
    const konu = KONULAR[key];
    if (!konu) return;

    geriScroll = frameEl ? frameEl.scrollTop : 0;
    sonKart = kart;

    detailTitle.textContent = konu.ad;
    detailLead.textContent = konu.aciklama;

    detailIco.textContent = "";
    const kaynakIkon = kart.querySelector(".ds-topic-ico");
    const svg = kaynakIkon ? kaynakIkon.querySelector("svg") : null;
    if (svg) detailIco.appendChild(svg.cloneNode(true));
    if (kaynakIkon) detailIco.style.color = getComputedStyle(kaynakIkon).color;

    detailList.textContent = "";
    detayAcik.clear();
    konu.sorular.forEach((id, index) => {
      const item = SSS.find((kayit) => kayit.id === id);
      if (!item) return;
      if (index === 0) detayAcik.add(item.id);
      detailList.appendChild(sssItem(item, "dd", detayAcik));
    });

    heroEl.hidden = true;
    bodyEl.hidden = true;
    detailEl.hidden = false;
    pageEl.setAttribute("aria-labelledby", "dsDetailTitle");
    if (frameEl) frameEl.scrollTo({ top: 0, behavior: "auto" });
    detailTitle.focus({ preventScroll: true });
  }

  function konuKapat(geriYukle = true) {
    detailEl.hidden = true;
    heroEl.hidden = false;
    bodyEl.hidden = false;
    pageEl.setAttribute("aria-labelledby", "dsTitle");
    if (!geriYukle) return;
    if (frameEl) frameEl.scrollTo({ top: geriScroll, behavior: "auto" });
    sonKart?.focus({ preventScroll: true });
  }

  const topics = Array.from(document.querySelectorAll(".ds-topic"));
  topics.forEach((kart) => kart.addEventListener("click", () => konuAc(kart.dataset.konu, kart)));

  byId("dsBack")?.addEventListener("click", () => konuKapat());

  document.querySelectorAll('[data-id="destek"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!detailEl.hidden) konuKapat(false);
    });
  });

  const appBtn = byId("dsAppBtn");
  const appNote = byId("dsAppNote");
  appBtn?.addEventListener("click", () => {
    const willOpen = appNote.hidden;
    appNote.hidden = !willOpen;
    appBtn.setAttribute("aria-expanded", String(willOpen));
  });

  byId("krDestek")?.addEventListener("click", () => {
    document.querySelector('.ni[data-id="destek"]')?.click();
  });

  renderSss();
})();
