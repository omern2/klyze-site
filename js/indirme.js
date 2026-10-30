/* Klyze indirme kapisi
   ------------------------------------------------------------
   Ne yapar:
     "Windows icin indir"e basildiginda dugmenin icinde kucuk bir
     halka doner, ayni anda sunucuya tek soru gider:
     "bu surum onayli mi?" (site.indirme_kontrolu)
     Onayliysa veritabanindaki adrese gidilir, degilse indirilmez.

   Ne yapmaz:
     Dosyayi taramaz. Hash'i tarayicida hesaplamaz; dosya GitHub'dan
     indig icin sayfaya hic girmez. Bu bir "onay kaydi" kapisidir.

   Bekleme:
     Halka en az EN_AZ_MS kadar doner (flash olmasin).
     Sayfa acilirken bir kez sorulur; sonraki tiklama aninda iner.
     Onayli cevap 15 sn, digerleri 5 sn hafizada tutulur: "red"
     karari en gec 5 sn icinde yeni sekmede de gecerli olur.

   Hata durumu:
     Sunucuya ulasilamazsa statik baglantiya duser; site calismaya
     devam eder. "red" cevabi ise indirmeyi kesin durdurur.
   ------------------------------------------------------------ */
(() => {
  "use strict";

  const SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  const SECICI = 'a[href*="/releases/download/"]';
  const SURUM_KALIBI = /\/download\/v([^/]+)\//;
  const ZAMAN_ASIMI = 6000;
  const ONBELLEK_ONAYLI_MS = 15000;
  const ONBELLEK_DIGER_MS = 5000;
  const EN_AZ_MS = 900;
  const GERI_DON_MS = 800;

  const onbellek = new Map();
  const yedekler = new WeakMap();
  let calisiyor = false;
  let mesajKutu = null;
  let mesajSayac = 0;

  const bekle = (ms) => new Promise((coz) => setTimeout(coz, ms));

  function surumAl(href) {
    const m = SURUM_KALIBI.exec(href || "");
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }

  /* --- sunucuya sor --- */
  async function sor(surum) {
    const durdur = new AbortController();
    const sayac = setTimeout(() => durdur.abort(), ZAMAN_ASIMI);
    try {
      const yanit = await fetch(SUPABASE_URL + "/rest/v1/rpc/indirme_kontrolu", {
        method: "POST",
        cache: "no-store",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
          "Accept-Profile": "site",
          "Content-Profile": "site"
        },
        body: JSON.stringify(surum ? { p_surum: surum } : {}),
        signal: durdur.signal
      });
      if (!yanit.ok) throw new Error("HTTP " + yanit.status);
      const veri = await yanit.json();
      return Array.isArray(veri) && veri.length ? veri[0] : null;
    } finally {
      clearTimeout(sayac);
    }
  }

  /* Onayli cevap 15 sn, digerleri 5 sn hafizada kalir.
     Ayni anda gelen ikinci tik ayni istegi bekler. */
  function kayitSor(surum) {
    const anahtar = surum || "*";
    const kayit = onbellek.get(anahtar);
    if (kayit) {
      const omur = kayit.guvenli === true ? ONBELLEK_ONAYLI_MS : ONBELLEK_DIGER_MS;
      if (Date.now() - kayit.zaman < omur) return kayit.vaat;
    }

    const vaat = sor(surum)
      .then((satir) => {
        const mevcut = onbellek.get(anahtar);
        if (mevcut && mevcut.vaat === vaat) {
          mevcut.guvenli = satir?.guvenli === true;
          mevcut.durum = satir?.durum ?? null;
        }
        return satir;
      })
      .catch((hata) => {
        onbellek.delete(anahtar); /* hata hafizada kalmasin, sonraki tik yeniden dener */
        throw hata;
      });
    onbellek.set(anahtar, { zaman: Date.now(), vaat, guvenli: false, durum: null });
    return vaat;
  }

  /* --- dugmenin icinde donen halka --- */
  function mesgulYap(link) {
    if (yedekler.has(link)) return;
    yedekler.set(link, {
      html: link.innerHTML,
      genislik: link.style.minWidth,
      etiket: link.getAttribute("aria-label")
    });

    link.style.minWidth = link.offsetWidth + "px";
    link.classList.add("is-yukleniyor");
    link.setAttribute("aria-busy", "true");
    link.setAttribute("aria-label", "İndirme hazırlanıyor");

    const halka = document.createElement("span");
    halka.className = "dl-halka";
    halka.setAttribute("aria-hidden", "true");
    link.replaceChildren(halka);
  }

  function mesgulBitir(link) {
    const yedek = yedekler.get(link);
    if (!yedek) return;
    link.innerHTML = yedek.html;
    link.style.minWidth = yedek.genislik;
    link.classList.remove("is-yukleniyor");
    link.removeAttribute("aria-busy");
    if (yedek.etiket === null) link.removeAttribute("aria-label");
    else link.setAttribute("aria-label", yedek.etiket);
    yedekler.delete(link);
  }

  /* --- indirme durduruldu uyarisi --- */
  function mesajKapat() {
    clearTimeout(mesajSayac);
    if (mesajKutu) mesajKutu.classList.remove("is-on");
  }

  function mesajGoster(metin) {
    if (!mesajKutu) {
      mesajKutu = document.createElement("div");
      mesajKutu.className = "dl-uyari";
      mesajKutu.setAttribute("role", "alert");

      const yazi = document.createElement("p");
      yazi.className = "dl-uyari-yazi";

      const kapat = document.createElement("button");
      kapat.type = "button";
      kapat.className = "dl-uyari-kapat";
      kapat.setAttribute("aria-label", "Uyarıyı kapat");
      kapat.textContent = "×";
      kapat.addEventListener("click", mesajKapat);

      mesajKutu.append(yazi, kapat);
      document.body.appendChild(mesajKutu);
    }
    mesajKutu.querySelector(".dl-uyari-yazi").textContent = metin;
    mesajKutu.classList.add("is-on");
    clearTimeout(mesajSayac);
    mesajSayac = setTimeout(mesajKapat, 9000);
  }

  function git(link, adres) {
    /* indirme baslarken dugme normal haline donsun */
    setTimeout(() => mesgulBitir(link), GERI_DON_MS);
    location.assign(adres);
  }

  /* --- tiklamayi yakala --- */
  async function kapidanGec(link, href) {
    const surum = surumAl(href);
    const basla = Date.now();
    mesgulYap(link);

    let satir;
    try {
      satir = await kayitSor(surum);
    } catch (hata) {
      /* Sunucu yoksa indirmeyi kilitlemeyelim: site calismaya devam etsin. */
      console.warn("[klyze] indirme kontrolü yapılamadı, doğrudan indiriliyor:", hata);
      await bekle(Math.max(0, EN_AZ_MS - (Date.now() - basla)));
      git(link, href);
      return;
    }

    await bekle(Math.max(0, EN_AZ_MS - (Date.now() - basla)));

    if (!satir) {
      mesgulBitir(link);
      mesajGoster("Bu sürüm henüz doğrulanmadı. İndirme açılmadı.");
      return;
    }

    if (satir.guvenli !== true) {
      mesgulBitir(link);
      mesajGoster("Bu sürümün indirmesi durduruldu. Dosya şu anda verilmiyor.");
      return;
    }

    if (typeof satir.indirme_adresi !== "string" || !/^https:\/\//i.test(satir.indirme_adresi)) {
      mesgulBitir(link);
      mesajGoster("İndirme adresi geçersiz. Destek üzerinden bize ulaş.");
      return;
    }

    git(link, satir.indirme_adresi);
  }

  document.addEventListener("click", (olay) => {
    if (olay.defaultPrevented || olay.button !== 0) return;
    if (olay.metaKey || olay.ctrlKey || olay.shiftKey || olay.altKey) return;

    const hedef = olay.target instanceof Element ? olay.target.closest(SECICI) : null;
    if (!hedef) return;

    const href = hedef.getAttribute("href");
    if (!href) return;

    olay.preventDefault();
    if (calisiyor) return;
    calisiyor = true;

    let tam;
    try {
      tam = new URL(href, location.href).href;
    } catch {
      calisiyor = false;
      return;
    }

    kapidanGec(hedef, tam).finally(() => {
      calisiyor = false;
    });
  });

  /* --- sayfa acilirken bir kez sor: ilk tik beklemesin --- */
  const surumler = new Set();
  document.querySelectorAll(SECICI).forEach((a) => surumler.add(surumAl(a.getAttribute("href"))));
  surumler.forEach((s) => {
    kayitSor(s).catch(() => {});
  });
})();
