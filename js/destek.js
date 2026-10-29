/* Klyze destek: SSS arama/filtre + talep formu.
   Not: talep sunucuya gönderilmez; numara üretilir, metin panoya alınır
   ve Discord'da paylaşılır. Backend bağlanınca sadece submitTicket() değişir. */
(() => {
  "use strict";

  const KAT_AD = {
    teknik: "Teknik",
    kurulum: "Kurulum",
    hesap: "Hesap",
    guvenlik: "Güvenlik",
    topluluk: "Topluluk",
    destek: "Destek"
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
        "Klyze'yi kapatıp sağ tık → Yönetici olarak çalıştır ile aç.",
        "Sorun sürerse aşağıdaki formdan ekran görüntüsüyle talep oluştur."
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
        "Birkaç dakika bekleyip analiz ekranını yenile.",
        "10 dakikadan uzun sürerse hangi maçın eksik olduğunu yazarak talep oluştur."
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
        "İnternet bağlantını kontrol et.",
        "5 dakikadan uzun sürerse talep oluştur."
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
        "Alternatif: Ayarlar → Uygulamalar → Klyze → Kaldır.",
        "Kaldırma sonrası sorun yaşarsan talep oluştur."
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
        "Sitedeki “Giriş Yap” düğmesi şu an yalnızca bilgilendirme gösterir.",
        "Hesabınla ilgili bir sorun varsa talep oluştur."
      ]
    },
    {
      id: "yorum-gorunmuyor",
      kat: "topluluk",
      etiket: "yorum görünmüyor yayınlanmadı beğeni yanıt topluluk",
      baslik: "Yorumum neden görünmüyor?",
      ozet: "Yorumlar önizleme modunda çalışır; sayfa yenilenince liste başlangıca döner.",
      adimlar: [
        "Yorumlar sayfasındaki yorumlar örnek veridir.",
        "Yazdığın yorum yalnızca o anki sayfada görünür.",
        "Kalıcı yorumlar için topluluk girişi henüz açık değil."
      ]
    },
    {
      id: "talep-nasil",
      kat: "destek",
      etiket: "destek talebi açma numara takip discord form nasıl",
      baslik: "Destek talebi nasıl açılır?",
      ozet: "Formu doldur, talep numarası oluşur, metni Discord'a gönder.",
      adimlar: [
        "Aşağıdaki formda kategori, konu ve açıklamayı doldur.",
        "“Talep numarası oluştur”a bas; KLY- ile başlayan bir numara üretilir.",
        "Metni kopyalayıp Discord'daki destek kanalına yapıştır.",
        "Ekran görüntüsünü aynı mesaja eklemeyi unutma."
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

  const STORE = "klyze-destek-talepleri-v1";
  const MAX_TICKET = 10;

  const byId = (id) => document.getElementById(id);

  const list = byId("dsSssList");
  if (!list) return;

  const emptyBox = byId("dsEmpty");
  const emptyBtn = byId("dsEmptyTalep");
  const countEl = byId("dsFaqCount");
  const statusEl = byId("dsListStatus");
  const searchEl = byId("dsAra");
  const clearEl = byId("dsAraTemizle");
  const chips = Array.from(document.querySelectorAll(".ds-chip"));
  const form = byId("dsForm");
  const konuEl = byId("dsKonu");
  const aciklamaEl = byId("dsAciklama");
  const konuErr = byId("dsKonuErr");
  const aciklamaErr = byId("dsAciklamaErr");
  const katEl = byId("dsKat");
  const sayacEl = byId("dsSayac");
  const msgEl = byId("dsMsg");
  const resultEl = byId("dsResult");
  const resultIdEl = byId("dsResultId");
  const metinEl = byId("dsMetin");
  const copyMsgEl = byId("dsCopyMsg");
  const copyBtn = byId("dsKopyala");
  const mineList = byId("dsMineList");
  const mineEmpty = byId("dsMineEmpty");
  const mineStatus = byId("dsMineStatus");
  const clearAllBtn = byId("dsTemizle");
  const honeypot = byId("dsWebsite");
  const sistemEl = byId("dsSistem");

  const NS = "http://www.w3.org/2000/svg";
  const acik = new Set();
  let kat = "hepsi";
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

  function sssItem(item) {
    const article = el("article", "ds-item");
    article.id = "sss-" + item.id;
    article.setAttribute("role", "listitem");
    const open = acik.has(item.id);
    article.classList.toggle("is-open", open);

    const btn = el("button", "ds-q");
    btn.type = "button";
    btn.id = "sss-b-" + item.id;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-controls", "sss-p-" + item.id);

    btn.appendChild(el("span", "ds-tag", KAT_AD[item.kat] || item.kat));
    btn.appendChild(el("span", "ds-q-text", item.baslik));
    btn.appendChild(chevron());

    const panel = el("div", "ds-a");
    panel.id = "sss-p-" + item.id;
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
      if (willOpen) acik.add(item.id);
      else acik.delete(item.id);
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
    const hits = SSS.filter((item) => (kat === "hepsi" || item.kat === kat) && eslesme(item, kelimeler));

    list.textContent = "";
    hits.forEach((item) => list.appendChild(sssItem(item)));

    emptyBox.hidden = hits.length > 0;
    countEl.textContent = hits.length + " soru";
    clearEl.hidden = !searchEl.value;

    if (dokunuldu) {
      statusEl.textContent = hits.length
        ? hits.length + " soru bulundu."
        : "Sonuç yok. Talep oluşturabilir veya Discord'da sorabilirsin.";
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

  chips.forEach((chip) => chip.addEventListener("click", () => {
    kat = chip.dataset.kat || "hepsi";
    chips.forEach((item) => {
      const on = item === chip;
      item.classList.toggle("is-on", on);
      item.setAttribute("aria-pressed", String(on));
    });
    dokunuldu = true;
    renderSss();
  }));

  function talebeGit() {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => konuEl.focus({ preventScroll: true }), 420);
  }

  emptyBtn?.addEventListener("click", talebeGit);

  /* ---- talep formu ---- */

  function tarihMetni(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d.toISOString().slice(0, 16).replace("T", " ");
    }
  }

  function ticketNo() {
    const harf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = new Uint8Array(6);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else for (let i = 0; i < buf.length; i += 1) buf[i] = Math.floor(Math.random() * 256);
    let out = "";
    for (let i = 0; i < buf.length; i += 1) out += harf[buf[i] % harf.length];
    return "KLY-" + out;
  }

  function sistemBilgisi() {
    const parca = [];
    if (navigator.userAgent) parca.push(navigator.userAgent);
    if (window.screen) parca.push(window.screen.width + "×" + window.screen.height);
    if (window.devicePixelRatio) parca.push(window.devicePixelRatio + "x DPR");
    return parca.join(" · ");
  }

  function metinOlustur(ticket) {
    const satir = [
      "KLYZE DESTEK TALEBİ",
      "No: " + ticket.id,
      "Tarih: " + tarihMetni(ticket.ts),
      "Kategori: " + (KAT_AD[ticket.kat] || ticket.kat),
      "Konu: " + ticket.konu,
      "",
      "Açıklama:",
      ticket.aciklama
    ];
    if (ticket.sistem) {
      satir.push("", "Sistem: " + ticket.sistem);
    }
    return satir.join("\n");
  }

  function mesaj(text, tur) {
    msgEl.textContent = text;
    msgEl.classList.toggle("is-ok", tur === "ok");
    msgEl.classList.toggle("is-bad", tur === "bad");
  }

  function alanHatasi(input, hedef, text) {
    hedef.textContent = text;
    hedef.hidden = !text;
    if (text) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function talepleriOku() {
    try {
      const raw = window.localStorage.getItem(STORE);
      const data = JSON.parse(raw || "[]");
      if (!Array.isArray(data)) return [];
      return data.filter((item) => item && typeof item.id === "string" && typeof item.konu === "string").slice(0, MAX_TICKET);
    } catch {
      return [];
    }
  }

  function talepleriYaz(items) {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(items.slice(0, MAX_TICKET)));
      return true;
    } catch {
      return false;
    }
  }

  function sonucGoster(ticket) {
    resultIdEl.textContent = ticket.id;
    metinEl.value = metinOlustur(ticket);
    resultEl.hidden = false;
    copyMsgEl.textContent = "";
    copyMsgEl.classList.remove("is-ok", "is-bad");
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function kopyala(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* pano izni yok; execCommand'a dus */
    }
    try {
      metinEl.focus();
      metinEl.select();
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }

  function talebeEkle(ticket) {
    const items = talepleriOku().filter((item) => item.id !== ticket.id);
    items.unshift(ticket);
    return talepleriYaz(items);
  }

  function satirOlustur(ticket) {
    const li = el("li", "ds-mine-item");

    li.appendChild(el("span", "ds-mine-id", ticket.id));

    const body = el("div", "ds-mine-body");
    body.appendChild(el("p", "ds-mine-konu", ticket.konu));
    body.appendChild(el("p", "ds-mine-meta", (KAT_AD[ticket.kat] || ticket.kat) + " · " + tarihMetni(ticket.ts)));
    li.appendChild(body);

    const actions = el("div", "ds-mine-actions");

    const acBtn = el("button", "ds-mine-btn", "Metni aç");
    acBtn.type = "button";
    acBtn.addEventListener("click", () => sonucGoster(ticket));
    actions.appendChild(acBtn);

    const silBtn = el("button", "ds-mine-btn is-danger", "Sil");
    silBtn.type = "button";
    silBtn.addEventListener("click", () => {
      const kalan = talepleriOku().filter((item) => item.id !== ticket.id);
      talepleriYaz(kalan);
      if (!resultEl.hidden && resultIdEl.textContent === ticket.id) resultEl.hidden = true;
      renderTalepler();
      mineStatus.textContent = ticket.id + " silindi.";
    });
    actions.appendChild(silBtn);

    li.appendChild(actions);
    return li;
  }

  function renderTalepler() {
    const items = talepleriOku();
    mineList.textContent = "";
    mineStatus.textContent = "";
    items.forEach((ticket) => mineList.appendChild(satirOlustur(ticket)));
    mineEmpty.hidden = items.length > 0;
    clearAllBtn.hidden = items.length === 0;
  }

  clearAllBtn?.addEventListener("click", () => {
    if (!talepleriOku().length) return;
    if (!window.confirm("Bu tarayıcıdaki tüm talep kayıtları silinsin mi?")) return;
    talepleriYaz([]);
    resultEl.hidden = true;
    renderTalepler();
    mineStatus.textContent = "Tüm talep kayıtları silindi.";
  });

  aciklamaEl.addEventListener("input", () => {
    sayacEl.textContent = aciklamaEl.value.length + " / 1500";
  });

  copyBtn?.addEventListener("click", async () => {
    const ok = await kopyala(metinEl.value);
    copyMsgEl.textContent = ok
      ? "Metin panoya kopyalandı. Discord'daki destek kanalına yapıştır."
      : "Kopyalanamadı. Metni seçip Ctrl + C ile kopyala.";
    copyMsgEl.classList.toggle("is-ok", ok);
    copyMsgEl.classList.toggle("is-bad", !ok);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy === "1") return;

    if (honeypot && honeypot.value.trim()) {
      mesaj("Talep oluşturulamadı.", "bad");
      return;
    }

    const konu = konuEl.value.trim().replace(/\s+/g, " ");
    const aciklama = aciklamaEl.value.trim();

    alanHatasi(konuEl, konuErr, "");
    alanHatasi(aciklamaEl, aciklamaErr, "");

    let ilkHatali = null;
    if (konu.length < 3) {
      alanHatasi(konuEl, konuErr, "En az 3 karakterlik bir konu yaz.");
      ilkHatali = konuEl;
    }
    if (aciklama.length < 10) {
      alanHatasi(aciklamaEl, aciklamaErr, "En az 10 karakter yaz; ne olduğunu anlat.");
      ilkHatali = ilkHatali || aciklamaEl;
    }
    if (ilkHatali) {
      mesaj("Formda eksik alan var.", "bad");
      ilkHatali.focus();
      return;
    }

    const ticket = {
      id: ticketNo(),
      kat: katEl.value || "teknik",
      konu,
      aciklama,
      sistem: sistemEl && sistemEl.checked ? sistemBilgisi() : "",
      ts: new Date().toISOString()
    };

    form.dataset.busy = "1";
    sonucGoster(ticket);

    const kaydedildi = talebeEkle(ticket);
    renderTalepler();

    const ok = await kopyala(metinEl.value);
    mesaj(
      ok
        ? ticket.id + " hazır. Metin panoya kopyalandı; Discord'da destek kanalına yapıştır."
        : ticket.id + " hazır. Metni aşağıdan kopyalayıp Discord'a yapıştır.",
      ok ? "ok" : null
    );
    if (!kaydedildi) {
      mesaj(ticket.id + " hazır ama bu tarayıcıya kaydedilemedi (gizli mod olabilir).", "bad");
    }

    form.dataset.busy = "";
  });

  byId("krDestek")?.addEventListener("click", () => {
    document.querySelector('.ni[data-id="destek"]')?.click();
  });

  renderSss();
  renderTalepler();
})();
