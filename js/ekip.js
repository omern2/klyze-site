/* Klyze — ekip destek paneli.
   Yalnız site.ekip_mi() true dönen hesaplar veri görür; kontrol hem
   burada hem sunucuda. Yazma aynı RPC'lerden geçer (site.bilet_*). */
(() => {
  "use strict";

  const D = window.KLYZE_DESTEK;
  const A = window.KLYZE_AUTH;
  const DURUMLAR = { acik: "Açık", beklemede: "Beklemede", kapali: "Kapalı" };
  const ICERIK_ADLARI = {
    valorant: "VALORANT",
    ac: "Klyze AC",
    overlay: "Overlay",
    site: "Web Sitesi",
    diger: "Diğer"
  };
  const LIMIT = 30;
  const MAKS_EK = (D && D.MAKS_EK) || 3;
  const MAKS_EK_BOYUT = (D && D.MAKS_EK_BOYUT) || 5 * 1024 * 1024;
  const MAKS_MESAJ = 4000;

  const $ = (id) => document.getElementById(id);

  function kabukHazirla() {
    const tetik = $("mTrigger");
    const menu = $("mDrop");
    if (!tetik || !menu) return;
    const kapat = () => {
      menu.hidden = true;
      tetik.setAttribute("aria-expanded", "false");
    };
    tetik.addEventListener("click", () => {
      const acilsin = menu.hidden;
      menu.hidden = !acilsin;
      tetik.setAttribute("aria-expanded", String(acilsin));
    });
    document.addEventListener("keydown", (olay) => {
      if (olay.key === "Escape") kapat();
    });
  }

  kabukHazirla();

  const app = $("ekipUygulama");
  if (!app) return;

  const ic = $("ekipIc");
  const yukleniyorKutu = $("ekipYukleniyor");
  const kapiKutu = $("ekipDurumKutu");
  const kapiBaslik = $("ekipDurumBaslik");
  const kapiMetin = $("ekipDurumMetin");
  const kapiGiris = $("ekipDurumGiris");
  const kapiTekrar = $("ekipDurumTekrar");

  const hesapAd = $("ekipHesap");
  const cikisBtn = $("ekipCikis");

  const listePanel = $("ekipListePanel");
  const detayPanel = $("ekipDetayPanel");
  const detayBos = $("ekipDetayBos");
  const filtreler = $("ekipFiltreler");
  const arama = $("ekipArama");
  const liste = $("ekipListe");
  const listeBos = $("ekipListeBos");
  const listeHata = $("ekipListeHata");
  const listeBilgi = $("ekipListeBilgi");
  const yenileBtn = $("ekipYenile");
  const dahaBtn = $("ekipDaha");

  const sayiTumu = $("ekipSayiTumu");
  const sayiAcik = $("ekipSayiAcik");
  const sayiBeklemede = $("ekipSayiBeklemede");
  const sayiKapali = $("ekipSayiKapali");

  const geriBtn = $("ekipGeri");
  const kicker = $("ekipKicker");
  const konu = $("ekipKonu");
  const uye = $("ekipUye");
  const biletNo = $("ekipBiletNo");
  const gonderen = $("ekipGonderen");
  const urun = $("ekipUrun");
  const kategori = $("ekipKategori");
  const olusturma = $("ekipOlusturma");
  const etkinlik = $("ekipEtkinlik");
  const durumSecim = $("ekipDurum");
  const durumKaydet = $("ekipDurumKaydet");
  const detayHata = $("ekipDetayHata");
  const kendiNotu = $("ekipKendiNotu");
  const akis = $("ekipAkis");
  const mesajForm = $("ekipMesajForm");
  const mesaj = $("ekipMesaj");
  const gonderBtn = $("ekipGonder");
  const mesajHata = $("ekipMesajHata");
  const bilgi = $("ekipBilgi");
  const kapaliNot = $("ekipKapaliNot");
  const ekBtn = $("ekipEkBtn");
  const ekGirdi = $("ekipEkGirdi");
  const ekOnizleme = $("ekipEkOnizleme");
  const live = $("ekipLive");

  let oturumVar = false;
  let ekipVar = false;
  let kullaniciId = "";
  let durum = "";
  let aramaMetni = "";
  let listeKayitlari = [];
  let listeYukleniyor = false;
  let listeBekliyor = false;
  let bekleyenSecenekler = null;
  let aramaZaman = 0;
  let aktif = null;
  let aktifTalepNo = "";
  let detayYukleniyor = false;
  let detayToken = 0;
  let durumIslem = false;
  let mesajGonderiliyor = false;
  let gonderToken = 0;
  let bekleyenEkler = [];
  let akisNesil = 0;
  let pollZaman = 0;
  let bilgiZaman = 0;
  let duyuruZaman = 0;

  const boyutBicim = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
  const uzunTarih = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
  });

  /* ---------- ortak ---------- */
  function temizMetin(deger) {
    return String(deger == null ? "" : deger).replace(/[\u0000-\u001F\u007F]/g, "").trim();
  }

  /* ekip_biletler() yalnız yanıtları sayar; açıklama da akışta ilk mesajdır. */
  function mesajSayisiYaz(adet) {
    return (Number(adet) || 0) + 1;
  }

  function duyur(metin) {
    window.clearTimeout(duyuruZaman);
    live.textContent = "";
    duyuruZaman = window.setTimeout(() => { live.textContent = metin; }, 60);
  }

  function tarihYaz(bicim, iso) {
    const t = new Date(iso);
    return Number.isNaN(t.getTime()) ? "—" : bicim.format(t);
  }

  function goreliZaman(iso) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const fark = Math.max(0, Date.now() - t);
    const dk = Math.floor(fark / 60000);
    if (dk < 1) return "az önce";
    if (dk < 60) return dk + " dakika önce";
    const saat = Math.floor(dk / 60);
    if (saat < 24) return saat + " saat önce";
    const gun = Math.floor(saat / 24);
    if (gun < 30) return gun + " gün önce";
    const ay = Math.floor(gun / 30);
    if (ay < 12) return ay + " ay önce";
    return Math.floor(ay / 12) + " yıl önce";
  }

  function boyutYaz(bayt) {
    const sayi = Number(bayt);
    if (!Number.isFinite(sayi) || sayi < 1) return "—";
    if (sayi < 1024) return sayi + " B";
    if (sayi < 1024 * 1024) return boyutBicim.format(sayi / 1024) + " KB";
    return boyutBicim.format(sayi / (1024 * 1024)) + " MB";
  }

  function durumAl(bilet) {
    return bilet && DURUMLAR[bilet.durum] ? bilet.durum : "acik";
  }

  function adFromSession(oturum) {
    const meta = (oturum && oturum.user && oturum.user.user_metadata) || {};
    const ad = temizMetin(meta.full_name || meta.name);
    if (ad) return ad.slice(0, 80);
    const eposta = String((oturum && oturum.user && oturum.user.email) || "");
    return eposta ? eposta.split("@")[0].slice(0, 80) : "Destek ekibi";
  }

  function hesapCiz(ad) {
    hesapAd.textContent = (ad || "Destek ekibi") + " · ekip";
  }

  function bilgiYaz(metin) {
    window.clearTimeout(bilgiZaman);
    bilgi.textContent = metin || "";
    bilgi.hidden = !metin;
    if (metin) {
      bilgiZaman = window.setTimeout(() => { bilgi.hidden = true; }, 4000);
    }
  }

  /* ---------- kapı / yükleme ---------- */
  function yukleniyorGoster() {
    app.hidden = true;
    kapiKutu.hidden = true;
    yukleniyorKutu.hidden = false;
  }

  function uygulamaGoster() {
    yukleniyorKutu.hidden = true;
    kapiKutu.hidden = true;
    app.hidden = false;
  }

  function kapiGoster(baslik, metin, secenekler) {
    const sec = secenekler || {};
    app.hidden = true;
    yukleniyorKutu.hidden = true;
    kapiKutu.hidden = false;
    kapiBaslik.textContent = baslik || "Ekip girişi gerekiyor";
    kapiMetin.textContent = metin || "";
    kapiGiris.hidden = oturumVar || sec.giris === false;
    kapiTekrar.hidden = !sec.tekrar;
    if (sec.odak) {
      try { kapiBaslik.focus({ preventScroll: true }); } catch (hata) { kapiBaslik.focus(); }
    }
  }

  /* ---------- dosya yardımcıları ---------- */
  function dosyaIkonu() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const govde = document.createElementNS("http://www.w3.org/2000/svg", "path");
    govde.setAttribute("d", "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z");
    govde.setAttribute("fill", "none");
    govde.setAttribute("stroke", "currentColor");
    govde.setAttribute("stroke-width", "1.7");
    govde.setAttribute("stroke-linejoin", "round");
    const kat = document.createElementNS("http://www.w3.org/2000/svg", "path");
    kat.setAttribute("d", "M14 3v5h5");
    kat.setAttribute("fill", "none");
    kat.setAttribute("stroke", "currentColor");
    kat.setAttribute("stroke-width", "1.7");
    kat.setAttribute("stroke-linejoin", "round");
    svg.append(govde, kat);
    return svg;
  }

  function indirIkonu() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const ok = document.createElementNS("http://www.w3.org/2000/svg", "path");
    ok.setAttribute("d", "M12 4v11M7.5 11.5 12 16l4.5-4.5");
    ok.setAttribute("fill", "none");
    ok.setAttribute("stroke", "currentColor");
    ok.setAttribute("stroke-width", "1.8");
    ok.setAttribute("stroke-linecap", "round");
    ok.setAttribute("stroke-linejoin", "round");
    const taban = document.createElementNS("http://www.w3.org/2000/svg", "path");
    taban.setAttribute("d", "M5 19h14");
    taban.setAttribute("fill", "none");
    taban.setAttribute("stroke", "currentColor");
    taban.setAttribute("stroke-width", "1.8");
    taban.setAttribute("stroke-linecap", "round");
    svg.append(ok, taban);
    return svg;
  }

  function turEtiketi(ek) {
    const tur = String((ek && ek.tur) || "");
    if (tur.indexOf("image/") === 0) return "Resim";
    if (tur === "application/pdf") return "PDF";
    if (tur === "text/plain") return "Metin";
    if (tur.indexOf("zip") !== -1) return "ZIP";
    const parca = String((ek && ek.ad) || "").split(".");
    return parca.length > 1 ? parca.pop().slice(0, 4).toUpperCase() : "Dosya";
  }

  function imzaGorseli(img, yol, nesil) {
    if (!D || typeof D.imzaliUrl !== "function") return;
    D.imzaliUrl(yol).then((url) => {
      if (nesil !== akisNesil || !img.isConnected) return;
      img.src = url;
    }).catch(() => {
      if (img.isConnected) img.remove();
    });
  }

  async function ekIndir(ek, kart) {
    if (ek._indiriliyor) return;
    ek._indiriliyor = true;
    if (kart) kart.setAttribute("aria-busy", "true");
    try {
      const url = await D.imzaliUrl(ek.yol, ek.ad);
      const bag = document.createElement("a");
      bag.href = url;
      bag.download = ek.ad;
      bag.rel = "noopener";
      document.body.append(bag);
      bag.click();
      bag.remove();
      duyur("Dosya indiriliyor.");
    } catch (hata) {
      duyur((hata && hata.message) || "Dosya indirilemedi.");
    } finally {
      ek._indiriliyor = false;
      if (kart) kart.removeAttribute("aria-busy");
    }
  }

  function ekKartCiz(ek, nesil) {
    const kart = document.createElement("button");
    kart.type = "button";
    kart.className = "ekip-ek-kart";
    kart.setAttribute("aria-label", ek.ad + " dosyasını indir");
    kart.title = ek.ad + " · " + boyutYaz(ek.boyut);

    const gorsel = document.createElement("span");
    gorsel.className = "ekip-ek-gorsel";
    gorsel.append(dosyaIkonu());
    if (String(ek.tur || "").indexOf("image/") === 0) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      gorsel.append(img);
      imzaGorseli(img, ek.yol, nesil);
    }

    const govde = document.createElement("span");
    govde.className = "ekip-ek-govde";
    const ad = document.createElement("span");
    ad.className = "ekip-ek-ad";
    ad.textContent = ek.ad;
    const alt = document.createElement("span");
    alt.className = "ekip-ek-alt";
    alt.textContent = turEtiketi(ek) + " · " + boyutYaz(ek.boyut);
    govde.append(ad, alt);

    const indir = document.createElement("span");
    indir.className = "ekip-ek-indir";
    indir.append(indirIkonu());

    kart.append(gorsel, govde, indir);
    kart.addEventListener("click", () => ekIndir(ek, kart));
    return kart;
  }

  function ekleriCiz(ekler, nesil) {
    const sar = document.createElement("div");
    sar.className = "ekip-msg-ekler";
    ekler.forEach((ek) => sar.append(ekKartCiz(ek, nesil)));
    return sar;
  }

  /* ---------- mesaj balonları ---------- */
  function mesajOgesi(tip, ad, metin, iso, ekler, nesil, ppUrl, etiket) {
    const ekipMi = tip === "ekip";
    const makale = document.createElement("article");
    makale.className = "ekip-msg " + (ekipMi ? "ekip-msg-sag" : "ekip-msg-sol");

    const ust = document.createElement("header");
    ust.className = "ekip-msg-ust";

    const avatar = document.createElement("span");
    avatar.className = "ekip-msg-avatar " + (ekipMi ? "is-ekip" : "is-uye");
    avatar.setAttribute("aria-hidden", "true");
    const harf = ekipMi
      ? (A && typeof A.initials === "function" ? A.initials(ad) : "K")
      : (A && typeof A.initials === "function" ? A.initials(ad) : "Ü");
    const pp = A && typeof A.httpsUrl === "function" ? A.httpsUrl(ppUrl) : "";
    if (pp) {
      const resim = document.createElement("img");
      resim.src = pp;
      resim.alt = "";
      resim.width = 28;
      resim.height = 28;
      resim.loading = "lazy";
      resim.decoding = "async";
      resim.addEventListener("error", () => {
        resim.remove();
        avatar.textContent = harf;
      }, { once: true });
      avatar.append(resim);
    } else {
      avatar.textContent = harf;
    }

    const kimKutu = document.createElement("div");
    kimKutu.className = "ekip-msg-kim";
    const adEl = document.createElement("span");
    adEl.className = "ekip-msg-ad";
    adEl.textContent = ad;
    if (etiket || ekipMi) {
      const rozet = document.createElement("span");
      rozet.className = "ekip-msg-rozet";
      rozet.textContent = etiket || "Ekip";
      adEl.append(" ", rozet);
    }
    const zaman = document.createElement("time");
    zaman.className = "ekip-msg-zaman";
    zaman.dateTime = iso;
    zaman.textContent = tarihYaz(uzunTarih, iso);
    kimKutu.append(adEl, zaman);

    if (ekipMi) ust.append(kimKutu, avatar);
    else ust.append(avatar, kimKutu);

    const kutu = document.createElement("div");
    kutu.className = "ekip-msg-kutu";
    if (metin) {
      const paragraf = document.createElement("p");
      paragraf.className = "ekip-msg-metin";
      paragraf.textContent = metin;
      kutu.append(paragraf);
    }
    if (ekler && ekler.length) {
      kutu.classList.add("has-ek");
      kutu.append(ekleriCiz(ekler, nesil));
    }

    makale.append(ust, kutu);
    return makale;
  }

  function sistemOgesi(mesajKaydi) {
    const makale = document.createElement("article");
    makale.className = "ekip-msg ekip-msg-sistem";
    const kutu = document.createElement("div");
    kutu.className = "ekip-msg-kutu";
    const paragraf = document.createElement("p");
    paragraf.className = "ekip-msg-metin";
    paragraf.textContent = mesajKaydi.metin;
    kutu.append(paragraf);
    makale.append(kutu);
    return makale;
  }

  function akisiCiz(bilet) {
    const nesil = ++akisNesil;
    const ogeler = [
      mesajOgesi("kullanici", bilet.kullaniciAd || "Üye", bilet.aciklama, bilet.olusturma, [], nesil, bilet.kullaniciAvatar, "İlk mesaj")
    ];

    bilet.mesajlar.forEach((m) => {
      if (m.tip === "sistem") {
        ogeler.push(sistemOgesi(m));
        return;
      }
      const ekipMi = m.tip === "ekip";
      ogeler.push(mesajOgesi(
        ekipMi ? "ekip" : "kullanici",
        m.ad || (ekipMi ? "Klyze Destek" : (bilet.kullaniciAd || "Üye")),
        m.metin,
        m.tarih,
        m.ekler,
        nesil,
        m.avatar || (ekipMi ? "" : bilet.kullaniciAvatar)
      ));
    });

    akis.replaceChildren(...ogeler);
  }

  /* ---------- bekleyen ekler ---------- */
  function gonderDurumu() {
    const kapali = !aktif || durumAl(aktif) === "kapali";
    const dolu = Boolean(mesaj.value.trim()) || bekleyenEkler.length > 0;
    gonderBtn.disabled = mesajGonderiliyor || kapali || !dolu;
    ekBtn.disabled = mesajGonderiliyor || kapali || bekleyenEkler.length >= MAKS_EK;
  }

  function ekOnizlemeCiz() {
    ekOnizleme.replaceChildren();
    ekOnizleme.hidden = bekleyenEkler.length === 0;

    bekleyenEkler.forEach((ek) => {
      const chip = document.createElement("div");
      chip.className = "ekip-chip";

      const gorsel = document.createElement("span");
      gorsel.className = "ekip-chip-gorsel";
      gorsel.append(dosyaIkonu());
      if (String(ek.tur || "").indexOf("image/") === 0) {
        const img = document.createElement("img");
        img.src = ek.url;
        img.alt = "";
        img.addEventListener("error", () => img.remove(), { once: true });
        gorsel.append(img);
      }

      const govde = document.createElement("span");
      govde.className = "ekip-chip-govde";
      const ad = document.createElement("span");
      ad.className = "ekip-chip-ad";
      ad.textContent = ek.ad;
      const alt = document.createElement("span");
      alt.className = "ekip-chip-alt";
      alt.textContent = boyutYaz(ek.boyut);
      govde.append(ad, alt);

      const kaldir = document.createElement("button");
      kaldir.type = "button";
      kaldir.className = "ekip-chip-kaldir";
      kaldir.setAttribute("aria-label", ek.ad + " dosyasını kaldır");
      kaldir.title = "Kaldır";
      kaldir.textContent = "×";
      kaldir.addEventListener("click", () => ekKaldir(ek.id));

      chip.append(gorsel, govde, kaldir);
      ekOnizleme.append(chip);
    });

    gonderDurumu();
  }

  function ekKaldir(id) {
    const sira = bekleyenEkler.findIndex((ek) => ek.id === id);
    if (sira < 0) return;
    URL.revokeObjectURL(bekleyenEkler[sira].url);
    bekleyenEkler.splice(sira, 1);
    mesajHata.hidden = true;
    ekOnizlemeCiz();
  }

  function ekEkle(dosyalar) {
    const hatalar = [];

    dosyalar.forEach((dosya) => {
      if (bekleyenEkler.length >= MAKS_EK) {
        hatalar.push("En fazla " + MAKS_EK + " dosya ekleyebilirsin.");
        return;
      }
      const tur = D && typeof D.mimeBelirle === "function" ? D.mimeBelirle(dosya) : null;
      if (!tur || (D && typeof D.ekUygun === "function" && !D.ekUygun(dosya))) {
        hatalar.push(dosya.name + " desteklenmiyor. Resim, PDF, metin veya ZIP ekleyebilirsin.");
        return;
      }
      if (dosya.size > MAKS_EK_BOYUT) {
        hatalar.push(dosya.name + " 5 MB sınırını aşıyor.");
        return;
      }
      bekleyenEkler.push({
        id: "EK-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        ad: (D && typeof D.guvenliAd === "function" ? D.guvenliAd(dosya.name) : dosya.name).slice(0, 255),
        tur,
        boyut: dosya.size,
        dosya,
        url: URL.createObjectURL(dosya)
      });
    });

    ekOnizlemeCiz();
    if (hatalar.length) {
      mesajHata.textContent = hatalar[0];
      mesajHata.hidden = false;
    } else {
      mesajHata.hidden = true;
    }
  }

  function bekleyenleriTemizle() {
    bekleyenEkler.forEach((ek) => URL.revokeObjectURL(ek.url));
    bekleyenEkler = [];
    ekOnizleme.replaceChildren();
    ekOnizleme.hidden = true;
    gonderDurumu();
  }

  function gonderimiBirak() {
    gonderToken++;
    mesajGonderiliyor = false;
    bilgi.hidden = true;
    gonderDurumu();
  }

  function mesajBoyutla() {
    mesaj.style.height = "auto";
    mesaj.style.height = Math.max(52, Math.min(mesaj.scrollHeight, 160)) + "px";
  }

  /* ---------- veri eşleme ---------- */
  function mesajKaydi(ham) {
    if (!ham || typeof ham !== "object") return null;
    const metin = String(ham.metin == null ? "" : ham.metin).trim();
    const ekler = Array.isArray(ham.ekler)
      ? ham.ekler.filter((ek) => ek && typeof ek.yol === "string" && ek.yol && typeof ek.ad === "string" && ek.ad)
        .map((ek) => ({
          id: String(ek.id || ek.yol),
          yol: ek.yol,
          ad: ek.ad,
          tur: String(ek.tur || ""),
          boyut: Number(ek.boyut) || 0
        }))
      : [];
    if (!metin && !ekler.length) return null;

    const tip = ham.yazan_tip === "ekip" || ham.yazan_tip === "sistem" ? ham.yazan_tip : "kullanici";
    return {
      id: String(ham.id || ""),
      tip,
      ad: temizMetin(ham.yazan_ad),
      avatar: A && typeof A.httpsUrl === "function" ? (A.httpsUrl(ham.yazan_avatar) || "") : "",
      metin,
      tarih: ham.olusturma_at,
      ekler
    };
  }

  function detayKaydi(ham) {
    if (!ham || typeof ham !== "object" || typeof ham.talep_no !== "string") return null;
    return {
      talepNo: ham.talep_no,
      modul: temizMetin(ham.modul),
      kategori: temizMetin(ham.kategori),
      kategoriAd: temizMetin(ham.kategori_ad) || "Destek",
      konu: temizMetin(ham.konu) || "Bilet",
      aciklama: String(ham.aciklama || "").trim(),
      durum: DURUMLAR[ham.durum] ? ham.durum : "acik",
      olusturma: ham.olusturma_at,
      guncelleme: ham.guncelleme_at,
      sonMesaj: ham.son_mesaj_at || ham.olusturma_at,
      benim: ham.benim === true,
      ekip: ham.ekip === true,
      kullaniciAd: temizMetin(ham.kullanici_ad) || "Üye",
      kullaniciAvatar: A && typeof A.httpsUrl === "function" ? (A.httpsUrl(ham.kullanici_avatar) || "") : "",
      uyeNo: Number(ham.uye_no) || null,
      mesajlar: Array.isArray(ham.mesajlar) ? ham.mesajlar.map(mesajKaydi).filter(Boolean) : []
    };
  }

  function listeKaydi(ham) {
    if (!ham || typeof ham.talep_no !== "string") return null;
    return {
      talepNo: ham.talep_no,
      modul: temizMetin(ham.modul),
      kategori: temizMetin(ham.kategori),
      kategoriAd: temizMetin(ham.kategori_ad) || "Destek",
      konu: temizMetin(ham.konu) || "Bilet",
      durum: DURUMLAR[ham.durum] ? ham.durum : "acik",
      kullaniciAd: temizMetin(ham.kullanici_ad) || "Üye",
      kullaniciAvatar: A && typeof A.httpsUrl === "function" ? (A.httpsUrl(ham.kullanici_avatar) || "") : "",
      uyeNo: Number(ham.uye_no) || null,
      olusturma: ham.olusturma_at,
      sonMesaj: ham.son_mesaj_at || ham.olusturma_at,
      mesajSayisi: Number(ham.mesaj_sayisi) || 0,
      sonMesajMetni: String(ham.son_mesaj || "").trim()
    };
  }

  /* ---------- liste ---------- */
  function filtreleriCiz() {
    filtreler.querySelectorAll("button[data-durum]").forEach((btn) => {
      const secili = btn.dataset.durum === durum;
      btn.classList.toggle("is-active", secili);
      btn.setAttribute("aria-pressed", secili ? "true" : "false");
    });
  }

  function listeSatiri(b) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const durumAnahtar = durumAl(b);
    btn.type = "button";
    btn.className = "ekip-satir";
    btn.dataset.talep = b.talepNo;
    btn.setAttribute(
      "aria-label",
      b.talepNo + " · " + DURUMLAR[durumAnahtar] + " · " + b.kullaniciAd + " · " + b.konu
    );

    const ilk = document.createElement("span");
    ilk.className = "ekip-satir-ilk";
    const no = document.createElement("span");
    no.className = "ekip-satir-no";
    no.textContent = b.talepNo;
    const rozet = document.createElement("span");
    rozet.className = "ekip-rozet";
    rozet.dataset.durum = durumAnahtar;
    rozet.textContent = DURUMLAR[durumAnahtar];
    const zaman = document.createElement("span");
    zaman.className = "ekip-satir-zaman";
    zaman.textContent = goreliZaman(b.sonMesaj);
    ilk.append(no, rozet, zaman);

    const baslik = document.createElement("span");
    baslik.className = "ekip-satir-konu";
    baslik.textContent = b.konu;

    const alt = document.createElement("span");
    alt.className = "ekip-satir-alt";
    const kim = document.createElement("span");
    kim.className = "ekip-satir-kim";

    const pp = document.createElement("span");
    pp.className = "ekip-satir-pp";
    pp.setAttribute("aria-hidden", "true");
    const harf = A && typeof A.initials === "function" ? A.initials(b.kullaniciAd) : "Ü";
    if (b.kullaniciAvatar) {
      const resim = document.createElement("img");
      resim.src = b.kullaniciAvatar;
      resim.alt = "";
      resim.width = 18;
      resim.height = 18;
      resim.loading = "lazy";
      resim.decoding = "async";
      resim.addEventListener("error", () => {
        resim.remove();
        pp.textContent = harf;
      }, { once: true });
      pp.append(resim);
    } else {
      pp.textContent = harf;
    }

    const uyeAd = document.createElement("span");
    uyeAd.className = "ekip-satir-uye";
    uyeAd.textContent = b.kullaniciAd + (b.uyeNo ? " · #" + b.uyeNo : "");
    kim.append(pp, uyeAd);
    alt.append(kim);

    const onizleme = document.createElement("span");
    onizleme.className = "ekip-satir-onizleme";
    onizleme.textContent = b.sonMesajMetni || b.kategoriAd;

    const altBilgi = document.createElement("span");
    altBilgi.className = "ekip-satir-bilgi";
    altBilgi.textContent = [
      ICERIK_ADLARI[b.modul] || "Klyze",
      b.kategoriAd,
      mesajSayisiYaz(b.mesajSayisi) + " mesaj"
    ].join(" · ");

    btn.append(ilk, baslik, alt, onizleme, altBilgi);
    li.append(btn);
    return li;
  }

  function listeyiCiz() {
    const bos = listeKayitlari.length === 0;
    const hataVar = !listeHata.hidden;
    liste.replaceChildren();
    listeKayitlari.forEach((b) => liste.append(listeSatiri(b)));
    listeBos.hidden = !(bos && !listeYukleniyor && !hataVar);
    if (aktifTalepNo) {
      liste.querySelectorAll(".ekip-satir").forEach((btn) => {
        const secili = btn.dataset.talep === aktifTalepNo;
        btn.classList.toggle("is-active", secili);
        if (secili) btn.setAttribute("aria-current", "true");
        else btn.removeAttribute("aria-current");
      });
    }
  }

  function seciliyiIsaretle() {
    liste.querySelectorAll(".ekip-satir").forEach((btn) => {
      const secili = btn.dataset.talep === aktifTalepNo;
      btn.classList.toggle("is-active", secili);
      if (secili) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }

  async function listeyiYukle(secenekler) {
    const sec = secenekler || {};
    if (!ekipVar) return;
    if (listeYukleniyor) {
      /* Aynı anda tek istek: son istenen seçenek kazanır, bitince tekrar çalışır. */
      listeBekliyor = true;
      bekleyenSecenekler = sec;
      return;
    }

    const dahaFazla = sec.dahaFazla === true;
    const istenenOffset = dahaFazla ? listeKayitlari.length : 0;
    listeYukleniyor = true;
    listeHata.hidden = true;
    listeHata.textContent = "";
    yenileBtn.disabled = true;
    dahaBtn.disabled = true;
    if (!sec.sessiz) {
      listeBilgi.textContent = "Biletler yükleniyor…";
      listeBilgi.hidden = false;
      if (!dahaFazla) listeKayitlari = [];
    }
    listeyiCiz();

    try {
      const gelen = await D.ekipBiletler({
        durum: durum || null,
        arama: aramaMetni || null,
        limit: LIMIT,
        offset: istenenOffset
      });
      if (!ekipVar) return;

      const kayitlar = (Array.isArray(gelen) ? gelen : []).map(listeKaydi).filter(Boolean);
      if (dahaFazla) {
        const mevcut = new Set(listeKayitlari.map((b) => b.talepNo));
        kayitlar.forEach((b) => { if (!mevcut.has(b.talepNo)) listeKayitlari.push(b); });
      } else {
        listeKayitlari = kayitlar;
      }
      dahaBtn.hidden = kayitlar.length < LIMIT;
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitir(hata.message);
        return;
      }
      if (hata && hata.kod === "yetki") {
        ekipYetkisiBitti(hata.message);
        return;
      }
      listeHata.textContent = (hata && hata.message) || "Biletler yüklenemedi. Tekrar dene.";
      listeHata.hidden = false;
      duyur("Bilet listesi yüklenemedi.");
    } finally {
      listeYukleniyor = false;
      yenileBtn.disabled = false;
      dahaBtn.disabled = false;
      listeBilgi.hidden = true;
      listeyiCiz();

      if (listeBekliyor) {
        const sonraki = bekleyenSecenekler || { sessiz: true };
        listeBekliyor = false;
        bekleyenSecenekler = null;
        listeyiYukle(sonraki);
      }
    }
  }

  async function sayilariYukle() {
    if (!ekipVar) return;
    try {
      const sayilar = await D.ekipSayilar() || {};
      sayiTumu.textContent = String(Number(sayilar.toplam) || 0);
      sayiAcik.textContent = String(Number(sayilar.acik) || 0);
      sayiBeklemede.textContent = String(Number(sayilar.beklemede) || 0);
      sayiKapali.textContent = String(Number(sayilar.kapali) || 0);
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitir(hata.message);
        return;
      }
      if (hata && hata.kod === "yetki") {
        ekipYetkisiBitti(hata.message);
        return;
      }
      console.warn("[klyze] ekip sayıları okunamadı:", hata && hata.message);
    }
  }

  /* ---------- detay ---------- */
  function detayiGuncelle(bilet, secenekler) {
    const sec = secenekler || {};
    const kapali = durumAl(bilet) === "kapali";

    kicker.textContent = "BİLET · " + bilet.talepNo;
    konu.textContent = bilet.konu;
    uye.textContent = [
      bilet.kullaniciAd || "Üye",
      bilet.uyeNo ? "Üye #" + bilet.uyeNo : "",
      tarihYaz(uzunTarih, bilet.olusturma)
    ].filter(Boolean).join(" · ");

    biletNo.textContent = bilet.talepNo;
    gonderen.textContent = bilet.kullaniciAd || "Üye";
    urun.textContent = ICERIK_ADLARI[bilet.modul] || "Klyze";
    kategori.textContent = bilet.kategoriAd;
    olusturma.textContent = tarihYaz(uzunTarih, bilet.olusturma);
    etkinlik.textContent = goreliZaman(bilet.sonMesaj);
    durumSecim.value = durumAl(bilet);
    durumSecim.disabled = durumIslem;
    kendiNotu.hidden = !bilet.benim;
    detayHata.hidden = true;

    akisiCiz(bilet);
    mesajForm.hidden = false;
    mesaj.disabled = kapali;
    kapaliNot.hidden = !kapali;
    ekipDurumKaydet();

    if (!sec.koruTaslak) {
      mesaj.value = "";
      mesajBoyutla();
      if (!sec.sessiz) {
        mesajHata.hidden = true;
        bilgi.hidden = true;
      }
    }

    gonderDurumu();
    document.title = "Destek · " + bilet.talepNo + " — Klyze.gg";
  }

  function ekipDurumKaydet() {
    durumKaydet.disabled = durumIslem || !aktif || durumSecim.value === durumAl(aktif);
  }

  function detayiYukle(talepNo, secenekler) {
    const sec = secenekler || {};
    const token = ++detayToken;
    detayYukleniyor = true;

    if (!sec.sessiz) {
      detayHata.hidden = true;
      ekipDurumKaydet();
    }

    return D.biletDetay(talepNo).then((ham) => {
      if (token !== detayToken || aktifTalepNo !== talepNo) return;
      const bilet = detayKaydi(ham);
      if (!bilet) throw new Error("Bilet verisi okunamadı.");
      aktif = bilet;
      detayiGuncelle(bilet, sec);
      seciliyiIsaretle();
    }).catch((hata) => {
      if (token !== detayToken) return;
      if (hata && hata.kod === "oturum") {
        oturumBitir(hata.message);
        return;
      }
      if (hata && hata.kod === "yetki") {
        ekipYetkisiBitti(hata.message);
        return;
      }
      if (sec.sessiz) {
        console.warn("[klyze] bilet detayı yenilenemedi:", hata && hata.message);
        return;
      }
      detayHata.textContent = (hata && hata.message) || "Bilet yüklenemedi. Tekrar dene.";
      detayHata.hidden = false;
      akis.replaceChildren();
      duyur("Bilet yüklenemedi.");
    }).finally(() => {
      if (token === detayToken) detayYukleniyor = false;
    });
  }

  function biletSec(talepNo, ozet) {
    if (!talepNo) return;
    gonderimiBirak();
    bekleyenleriTemizle();
    detayToken++;
    detayYukleniyor = false;
    aktif = null;
    aktifTalepNo = talepNo;

    ic.classList.add("is-detay");
    detayPanel.hidden = false;
    detayBos.hidden = true;
    kicker.textContent = "BİLET · " + talepNo;
    konu.textContent = (ozet && ozet.konu) || "Bilet yükleniyor…";
    uye.textContent = ozet ? [ozet.kullaniciAd, ozet.uyeNo ? "Üye #" + ozet.uyeNo : ""].filter(Boolean).join(" · ") : "—";
    biletNo.textContent = talepNo;
    gonderen.textContent = ozet ? ozet.kullaniciAd || "Üye" : "—";
    urun.textContent = "—";
    kategori.textContent = "—";
    olusturma.textContent = "—";
    etkinlik.textContent = "—";
    durumSecim.value = "acik";
    durumSecim.disabled = true;
    durumKaydet.disabled = true;
    detayHata.hidden = true;
    kendiNotu.hidden = true;
    mesaj.disabled = true;
    kapaliNot.hidden = true;
    akis.replaceChildren();
    seciliyiIsaretle();

    const yukleniyor = document.createElement("p");
    yukleniyor.className = "ekip-bilgi";
    yukleniyor.setAttribute("role", "status");
    yukleniyor.textContent = "Bilet yükleniyor…";
    akis.append(yukleniyor);

    try { konu.focus({ preventScroll: true }); } catch (hata) { konu.focus(); }
    duyur("Bilet açıldı: " + talepNo);
    detayiYukle(talepNo, { sessiz: false });
  }

  function detayiKapat() {
    gonderimiBirak();
    bekleyenleriTemizle();
    detayToken++;
    detayYukleniyor = false;
    aktif = null;
    aktifTalepNo = "";
    akisNesil++;
    ic.classList.remove("is-detay");
    detayPanel.hidden = true;
    detayBos.hidden = false;
    document.title = "Destek ekibi — Klyze.gg";
    seciliyiIsaretle();
    bilgi.hidden = true;
  }

  /* ---------- gönderme ---------- */
  async function mesajGonderHandler(olay) {
    olay.preventDefault();
    if (mesajGonderiliyor || !aktif || !aktifTalepNo) return;

    mesajHata.hidden = true;
    const metin = mesaj.value.trim();
    const ekler = bekleyenEkler.slice();

    if (!metin && !ekler.length) {
      mesajHata.textContent = "Yanıt yaz veya dosya ekle.";
      mesajHata.hidden = false;
      mesaj.focus();
      return;
    }
    if (metin.length > MAKS_MESAJ) {
      mesajHata.textContent = "Yanıt en fazla " + MAKS_MESAJ + " karakter olabilir.";
      mesajHata.hidden = false;
      mesaj.focus();
      return;
    }
    if (durumAl(aktif) === "kapali") {
      mesajHata.textContent = "Bilet kapalı. Önce durumu Açık yapıp kaydet.";
      mesajHata.hidden = false;
      return;
    }

    const hedef = aktifTalepNo;
    const token = ++gonderToken;
    const yuklenen = [];
    mesajGonderiliyor = true;
    gonderDurumu();
    bilgiYaz("Gönderiliyor…");

    try {
      for (let i = 0; i < ekler.length; i++) {
        bilgiYaz("Dosyalar yükleniyor… " + (i + 1) + "/" + ekler.length);
        yuklenen.push(await D.dosyaYukle(ekler[i].dosya));
      }

      bilgiYaz("Yanıt gönderiliyor…");
      const cevap = await D.mesajGonder(hedef, metin, yuklenen);
      yuklenen.length = 0;

      if (token !== gonderToken) return;

      const ayniBilet = aktifTalepNo === hedef;
      mesajGonderiliyor = false;
      gonderDurumu();

      if (ayniBilet) {
        bekleyenleriTemizle();
        mesaj.value = "";
        mesajBoyutla();
        mesajHata.hidden = true;
        bilgiYaz("Yanıt gönderildi.");
        await detayiYukle(hedef, { sessiz: true, koruTaslak: true });
        if (aktifTalepNo === hedef && !mesaj.disabled) mesaj.focus();
      }

      sayilariYukle();
      listeyiYukle({ sessiz: true });
      duyur(cevap && cevap.ek_sayisi ? "Yanıt ve ekler gönderildi." : "Yanıt gönderildi.");
    } catch (hata) {
      await Promise.allSettled(yuklenen.map((ek) => D.dosyaSil(ek.yol)));
      if (token !== gonderToken) return;

      mesajGonderiliyor = false;
      gonderDurumu();
      bilgi.hidden = true;

      if (hata && hata.kod === "oturum") {
        oturumBitir(hata.message);
        return;
      }
      if (hata && hata.kod === "yetki") {
        ekipYetkisiBitti(hata.message);
        return;
      }
      if (aktifTalepNo === hedef) {
        mesajHata.textContent = (hata && hata.message) || "Yanıt gönderilemedi. Tekrar dene.";
        mesajHata.hidden = false;
      }
      duyur("Yanıt gönderilemedi.");
    } finally {
      if (token === gonderToken) {
        mesajGonderiliyor = false;
        gonderDurumu();
      }
    }
  }

  async function durumKaydetHandler() {
    if (!aktif || !aktifTalepNo || durumIslem) return;
    const yeni = durumSecim.value;
    if (yeni === durumAl(aktif)) return;

    const hedef = aktifTalepNo;
    durumIslem = true;
    detayHata.hidden = true;
    durumSecim.disabled = true;
    durumKaydet.disabled = true;

    try {
      await D.durumDegistir(hedef, yeni);
      await detayiYukle(hedef, { sessiz: true, koruTaslak: true });
      sayilariYukle();
      listeyiYukle({ sessiz: true });
      duyur("Durum " + DURUMLAR[yeni] + " olarak güncellendi.");
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitir(hata.message);
        return;
      }
      if (hata && hata.kod === "yetki") {
        ekipYetkisiBitti(hata.message);
        return;
      }
      detayHata.textContent = (hata && hata.message) || "Durum değiştirilemedi. Tekrar dene.";
      detayHata.hidden = false;
      duyur("Durum değiştirilemedi.");
    } finally {
      durumIslem = false;
      durumSecim.disabled = false;
      if (aktif) durumSecim.value = durumAl(aktif);
      ekipDurumKaydet();
    }
  }

  /* ---------- oturum ---------- */
  async function profilYukle() {
    try {
      const satir = await D.profil();
      if (!ekipVar || !satir) return;
      const ad = temizMetin(satir.gorunen_ad);
      if (ad) hesapCiz(ad);
    } catch (hata) {
      if (hata && hata.kod === "oturum") oturumBitir(hata.message);
    }
  }

  async function girisSonrasi(oturum) {
    const uid = (oturum && oturum.user && oturum.user.id) || "";
    if (oturumVar && uid && uid === kullaniciId && ekipVar) {
      uygulamaGoster();
      return;
    }

    oturumVar = true;
    kullaniciId = uid;
    hesapCiz(adFromSession(oturum));

    let yetki = false;
    try {
      yetki = await D.ekipMi();
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitir(hata.message);
        return;
      }
      kapiGoster(
        "Ekip yetkisi doğrulanamadı",
        (hata && hata.message) || "Sunucuya ulaşılamadı. SQL kurulumu uygulanmış mı kontrol et.",
        { tekrar: true, odak: true }
      );
      return;
    }

    if (!yetki) {
      ekipVar = false;
      kapiGoster(
        "Bu sayfa yalnız destek ekibi için",
        "Hesabında destek rolü yok. Erişim gerekiyorsa site yöneticisine başvur.",
        { odak: true }
      );
      return;
    }

    ekipVar = true;
    uygulamaGoster();
    hesapCiz(adFromSession(oturum));
    profilYukle();
    sayilariYukle();
    listeyiYukle({ sessiz: false });
  }

  function temizleDurum() {
    window.clearInterval(pollZaman);
    gonderimiBirak();
    bekleyenleriTemizle();
    detayToken++;
    listeYukleniyor = false;
    listeBekliyor = false;
    bekleyenSecenekler = null;
    detayYukleniyor = false;
    durumIslem = false;
    aktif = null;
    aktifTalepNo = "";
    listeKayitlari = [];
    liste.replaceChildren();
    listeHata.hidden = true;
    listeBilgi.hidden = true;
    listeBos.hidden = true;
    dahaBtn.hidden = true;
    akis.replaceChildren();
    akisNesil++;
    detayPanel.hidden = true;
    detayBos.hidden = false;
    ic.classList.remove("is-detay");
    hesapAd.textContent = "—";
    document.title = "Destek ekibi — Klyze.gg";
  }

  function ekipYetkisiBitti(mesaj) {
    if (!ekipVar) return;
    ekipVar = false;
    temizleDurum();
    kapiGoster(
      "Ekip yetkisi sona erdi",
      mesaj || "Hesabının destek ekibi rolü kaldırılmış olabilir. Site yöneticisine başvur.",
      { odak: true }
    );
  }

  function oturumBitir(mesaj) {
    oturumVar = false;
    ekipVar = false;
    kullaniciId = "";
    temizleDurum();
    kapiGoster(
      "Oturum gerekli",
      mesaj || "Devam etmek için Klyze hesabınla giriş yap.",
      { giris: true, odak: true }
    );
    if (D && typeof D.cikis === "function") D.cikis().catch(() => {});
  }

  async function basla() {
    yukleniyorGoster();

    if (!D || !A) {
      kapiGoster(
        "Panel yüklenemedi",
        "Destek veri katmanı yüklenemedi. Sayfayı yenileyip tekrar dene.",
        { tekrar: true, odak: true }
      );
      return;
    }

    try {
      const oturum = await D.oturum();
      if (!oturum) {
        oturumVar = false;
        ekipVar = false;
        kapiGoster(
          "Ekip girişi gerekiyor",
          "Bu sayfa yalnız destek ekibi içindir. Devam etmek için Klyze hesabınla giriş yap.",
          { odak: true }
        );
        return;
      }
      await girisSonrasi(oturum);
    } catch (hata) {
      kapiGoster(
        "Bağlantı kurulamadı",
        (hata && hata.message) || "İnternetini kontrol edip tekrar dene.",
        { tekrar: true, odak: true }
      );
    }
  }

  /* ---------- olaylar ---------- */
  filtreler.addEventListener("click", (olay) => {
    const btn = olay.target.closest("button[data-durum]");
    if (!btn) return;
    const yeni = btn.dataset.durum || "";
    if (yeni === durum) return;
    durum = yeni;
    filtreleriCiz();
    listeyiYukle({ sessiz: false });
  });

  arama.addEventListener("input", () => {
    window.clearTimeout(aramaZaman);
    aramaZaman = window.setTimeout(() => {
      aramaMetni = arama.value.trim();
      listeyiYukle({ sessiz: false });
    }, 320);
  });

  arama.addEventListener("keydown", (olay) => {
    if (olay.key === "Escape") {
      arama.value = "";
      aramaMetni = "";
      window.clearTimeout(aramaZaman);
      listeyiYukle({ sessiz: false });
      return;
    }
    if (olay.key === "Enter") {
      olay.preventDefault();
      window.clearTimeout(aramaZaman);
      aramaMetni = arama.value.trim();
      listeyiYukle({ sessiz: false });
    }
  });

  yenileBtn.addEventListener("click", () => {
    sayilariYukle();
    listeyiYukle({ sessiz: listeKayitlari.length > 0 });
    if (aktifTalepNo && !detayYukleniyor) {
      detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
    }
    duyur("Liste yenilendi.");
  });

  dahaBtn.addEventListener("click", () => listeyiYukle({ dahaFazla: true, sessiz: true }));

  liste.addEventListener("click", (olay) => {
    const btn = olay.target.closest("button.ekip-satir");
    if (!btn) return;
    const ozet = listeKayitlari.find((b) => b.talepNo === btn.dataset.talep);
    biletSec(btn.dataset.talep, ozet);
  });

  geriBtn.addEventListener("click", detayiKapat);
  durumSecim.addEventListener("change", ekipDurumKaydet);
  durumKaydet.addEventListener("click", durumKaydetHandler);

  mesaj.addEventListener("input", () => {
    gonderDurumu();
    mesajHata.hidden = true;
    mesajBoyutla();
  });

  mesaj.addEventListener("keydown", (olay) => {
    if (olay.key !== "Enter" || olay.shiftKey || olay.isComposing) return;
    olay.preventDefault();
    if (mesaj.value.trim() || bekleyenEkler.length) mesajForm.requestSubmit();
  });

  mesajForm.addEventListener("submit", mesajGonderHandler);

  ekBtn.addEventListener("click", () => ekGirdi.click());
  ekGirdi.addEventListener("change", () => {
    const dosyalar = Array.from(ekGirdi.files || []);
    ekGirdi.value = "";
    if (!dosyalar.length) return;
    ekEkle(dosyalar);
  });

  cikisBtn.addEventListener("click", () => {
    if (cikisBtn.disabled) return;
    cikisBtn.disabled = true;
    oturumBitir("Çıkış yaptın. Ekip paneline dönmek için yeniden giriş yap.");
    cikisBtn.disabled = false;
  });

  kapiTekrar.addEventListener("click", basla);

  if (D && typeof D.oturumDinle === "function") {
    D.oturumDinle((olay, oturum) => {
      if (oturum && oturum.user) {
        if (!oturumVar || oturum.user.id !== kullaniciId) girisSonrasi(oturum);
        return;
      }
      if (olay === "SIGNED_OUT" || (olay === "TOKEN_REFRESHED" && !oturum)) {
        if (oturumVar) oturumBitir("Oturumun sona erdi. Yeniden giriş yap.");
      }
    });
  }

  function pollBaslat() {
    window.clearInterval(pollZaman);
    pollZaman = window.setInterval(() => {
      if (document.hidden || !ekipVar || !aktifTalepNo || !oturumVar) return;
      if (mesajGonderiliyor || durumIslem || detayYukleniyor) return;
      if (document.activeElement === mesaj) return;
      detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
    }, 25000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !ekipVar) return;
    if (aktifTalepNo && !mesajGonderiliyor && !durumIslem) {
      detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
    }
    if (!listeYukleniyor) listeyiYukle({ sessiz: true });
  });

  window.addEventListener("online", () => {
    if (!ekipVar) return;
    sayilariYukle();
    listeyiYukle({ sessiz: true });
    if (aktifTalepNo) detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(pollZaman);
    window.clearTimeout(bilgiZaman);
    window.clearTimeout(duyuruZaman);
    window.clearTimeout(aramaZaman);
    akisNesil++;
  });

  window.addEventListener("pageshow", (olay) => {
    if (olay.persisted) pollBaslat();
  });

  /* ---------- başlangıç ---------- */
  filtreleriCiz();
  mesajBoyutla();
  pollBaslat();
  basla();
})();
