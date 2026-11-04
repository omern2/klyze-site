/* Klyze.gg — destek veri katmanı.
   Bilet sayfası ve ekip paneli aynı kapıları kullanır:
   RPC → destek.* fonksiyonları, dosya → özel `destek` bucket'ı.
   Profil gibi site verisi `site` şemasında kalır.
   Bu dosya iş kuralı yazmaz; doğrulama sunucuda. */
(() => {
  "use strict";

  const A = window.KLYZE_AUTH;
  const config = window.KLYZE_SUPABASE;
  const sdk = window.supabase;
  const SEMA = (config && config.destekSemasi) || "destek";
  const SEMA_SITE = (config && config.schema) || "site";
  const BUCKET = "destek";
  const MAKS_EK = 3;
  const MAKS_EK_BOYUT = 5 * 1024 * 1024;
  const TIMEOUT_MS = 15000;
  const IMZA_SANIYE = 3600;
  const DURUMLAR = Object.freeze({ acik: "Açık", beklemede: "Beklemede", kapali: "Kapalı" });
  const IZINLI_TUR = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed"
  ]);

  const UZANTI_TUR = Object.freeze({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    log: "text/plain",
    zip: "application/zip"
  });

  let istemci = null;
  const imzaOnbellek = new Map();

  class DestekHatasi extends Error {
    constructor(mesaj, kod) {
      super(mesaj);
      this.name = "DestekHatasi";
      this.kod = kod || "";
    }
  }

  function bekle(deger, ms) {
    if (A && typeof A.withTimeout === "function") return A.withTimeout(deger, ms || TIMEOUT_MS);
    return new Promise((resolve, reject) => {
      const zaman = setTimeout(() => reject(new Error("klyze-timeout")), ms || TIMEOUT_MS);
      Promise.resolve(deger).then(
        (x) => { clearTimeout(zaman); resolve(x); },
        (hata) => { clearTimeout(zaman); reject(hata); }
      );
    });
  }

  function sunucu() {
    if (istemci) return istemci;
    if (!config || !sdk || typeof sdk.createClient !== "function") return null;

    istemci = sdk.createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "klyze-site-auth"
      }
    });
    return istemci;
  }

  function hataYap(hata, yedek) {
    if (hata instanceof DestekHatasi) return hata;

    const kod = String((hata && (hata.code || hata.error_code)) || "");
    const metin = String((hata && hata.message) || "");
    const durum = Number((hata && hata.status) || 0);

    if (metin === "klyze-timeout" || (hata && hata.name === "AuthRetryableFetchError")) {
      return new DestekHatasi("Sunucuya ulaşılamadı. İnternetini kontrol edip tekrar dene.", "ag");
    }
    if (/failed to fetch|networkerror|load failed/i.test(metin)) {
      return new DestekHatasi("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.", "ag");
    }
    if (kod === "PGRST301" || /jwt expired|invalid jwt|token has expired/i.test(metin)) {
      return new DestekHatasi("Oturumun sona erdi. Yeniden giriş yap.", "oturum");
    }
    if (kod === "42501") {
      if (/[çğıöşüÇĞİÖŞÜ]/.test(metin)) return new DestekHatasi(metin, "yetki");
      return new DestekHatasi("Bu işlem için yetkin yok.", "yetki");
    }
    if (kod === "P0002" || kod === "22023" || kod === "23505") {
      return new DestekHatasi(metin || "İşlem tamamlanamadı.", kod);
    }
    if (durum === 429) {
      return new DestekHatasi("Çok fazla istek gönderildi. Birkaç dakika sonra tekrar dene.", "limit");
    }
    if (durum === 401 || durum === 403) {
      return new DestekHatasi("Oturumun sona erdi. Yeniden giriş yap.", "oturum");
    }
    if (durum >= 500) {
      return new DestekHatasi("Sunucuda geçici bir hata oluştu. Birazdan tekrar dene.", "sunucu");
    }

    return new DestekHatasi(metin || yedek || "İşlem tamamlanamadı.", kod);
  }

  async function rpc(ad, parametreler, sema) {
    const sb = sunucu();
    if (!sb) throw new DestekHatasi("Destek altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.", "kurulum");

    let sonuc;
    try {
      sonuc = await bekle(sb.schema(sema || SEMA).rpc(ad, parametreler || {}));
    } catch (hata) {
      throw hataYap(hata, "Sunucuya ulaşılamadı.");
    }
    if (sonuc && sonuc.error) throw hataYap(sonuc.error, "İşlem tamamlanamadı.");
    return sonuc ? sonuc.data : null;
  }

  async function oturum() {
    const sb = sunucu();
    if (!sb) throw new DestekHatasi("Destek altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.", "kurulum");

    let sonuc;
    try {
      sonuc = await bekle(sb.auth.getSession());
    } catch (hata) {
      throw hataYap(hata, "Oturum bilgisi okunamadı.");
    }
    if (sonuc && sonuc.error) {
      if (/session|refresh|jwt/i.test(String(sonuc.error.message || ""))) return null;
      throw hataYap(sonuc.error, "Oturum bilgisi okunamadı.");
    }
    return (sonuc && sonuc.data && sonuc.data.session) || null;
  }

  function oturumDinle(geriCagri) {
    const sb = sunucu();
    if (!sb) return () => {};

    const sonuc = sb.auth.onAuthStateChange((olay, oturumBilgisi) => {
      try {
        geriCagri(olay, oturumBilgisi);
      } catch (hata) {
        console.warn("[klyze] oturum dinleyicisi:", hata && hata.message);
      }
    });

    return () => {
      try {
        if (sonuc && sonuc.data && sonuc.data.subscription) {
          sonuc.data.subscription.unsubscribe();
        }
      } catch (hata) {
        console.warn("[klyze] oturum dinleyicisi kapatılamadı:", hata && hata.message);
      }
    };
  }

  async function cikis() {
    const sb = sunucu();
    if (!sb) return;
    try {
      await bekle(sb.auth.signOut({ scope: "local" }));
    } catch (hata) {
      console.warn("[klyze] çıkış isteği başarısız:", hata && hata.message);
    }
    imzaOnbellek.clear();
  }

  function profil() {
    return rpc("benim_profil", null, SEMA_SITE).then((satirlar) => {
      if (Array.isArray(satirlar)) return satirlar[0] || null;
      return satirlar || null;
    });
  }

  function biletlerim() {
    return rpc("biletlerim").then((liste) => (Array.isArray(liste) ? liste : []));
  }

  function biletDetay(talepNo) {
    return rpc("bilet_detay", { p_talep_no: talepNo });
  }

  function biletOlustur(veri) {
    return rpc("bilet_olustur", {
      p_modul: veri.modul,
      p_kategori: veri.kategori,
      p_kategori_ad: veri.kategoriAd,
      p_konu: veri.konu,
      p_aciklama: veri.aciklama
    });
  }

  function mesajGonder(talepNo, metin, ekler) {
    return rpc("bilet_mesaj_gonder", {
      p_talep_no: talepNo,
      p_metin: metin,
      p_ekler: Array.isArray(ekler) ? ekler : []
    });
  }

  function durumDegistir(talepNo, durum) {
    return rpc("bilet_durum_degistir", { p_talep_no: talepNo, p_durum: durum });
  }

  async function ekipMi() {
    const cevap = await rpc("ekip_mi");
    if (Array.isArray(cevap)) return cevap[0] === true;
    return cevap === true;
  }

  function ekipBiletler(secenekler) {
    const s = secenekler || {};
    return rpc("ekip_biletler", {
      p_durum: s.durum || null,
      p_arama: s.arama || null,
      p_limit: Number.isInteger(s.limit) ? s.limit : 50,
      p_offset: Number.isInteger(s.offset) ? s.offset : 0
    }).then((liste) => (Array.isArray(liste) ? liste : []));
  }

  function ekipSayilar() {
    return rpc("ekip_sayilar").then((cevap) => cevap || {});
  }

  function uzanti(ad) {
    const metin = String(ad || "");
    const nokta = metin.lastIndexOf(".");
    if (nokta < 0 || nokta === metin.length - 1) return "";
    return metin.slice(nokta + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  }

  function mimeBelirle(dosya) {
    if (!dosya) return null;
    const tur = String(dosya.type || "").toLowerCase();
    if (tur === "image/jpg") return "image/jpeg";
    if (IZINLI_TUR.indexOf(tur) !== -1) return tur;

    if (tur && tur !== "application/octet-stream") return null;
    return UZANTI_TUR[uzanti(dosya.name)] || null;
  }

  function ekUygun(dosya) {
    if (!dosya || typeof dosya.size !== "number") return false;
    if (dosya.size < 1 || dosya.size > MAKS_EK_BOYUT) return false;
    if (!String(dosya.name || "").trim()) return false;
    return Boolean(mimeBelirle(dosya));
  }

  function guvenliAd(ad) {
    return String(ad || "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[\\/]/g, "-")
      .trim()
      .slice(0, 255) || "dosya";
  }

  function yeniKimlik() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    const bayt = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(bayt);
    } else {
      for (let i = 0; i < bayt.length; i++) bayt[i] = Math.floor(Math.random() * 256);
    }
    bayt[6] = (bayt[6] & 0x0f) | 0x40;
    bayt[8] = (bayt[8] & 0x3f) | 0x80;
    const onalti = Array.from(bayt, (b) => b.toString(16).padStart(2, "0")).join("");
    return onalti.slice(0, 8) + "-" + onalti.slice(8, 12) + "-" + onalti.slice(12, 16) + "-"
      + onalti.slice(16, 20) + "-" + onalti.slice(20);
  }

  async function dosyaYukle(dosya) {
    const sb = sunucu();
    if (!sb) throw new DestekHatasi("Destek altyapısı yüklenemedi.", "kurulum");

    const aktif = await oturum();
    if (!aktif || !aktif.user || !aktif.user.id) {
      throw new DestekHatasi("Oturumun sona erdi. Yeniden giriş yap.", "oturum");
    }

    const tur = mimeBelirle(dosya);
    if (!tur) throw new DestekHatasi("Bu dosya türü desteklenmiyor.", "dosya");
    if (!ekUygun(dosya)) {
      throw new DestekHatasi("Dosya 5 MB sınırını aşıyor veya boş.", "dosya");
    }

    const uz = uzanti(dosya.name);
    const yol = aktif.user.id + "/" + yeniKimlik() + (uz ? "." + uz : "");

    let sonuc;
    try {
      sonuc = await bekle(
        sb.storage.from(BUCKET).upload(yol, dosya, {
          contentType: tur,
          upsert: false,
          cacheControl: "3600"
        })
      );
    } catch (hata) {
      throw hataYap(hata, "Dosya yüklenemedi.");
    }
    if (sonuc && sonuc.error) throw hataYap(sonuc.error, "Dosya yüklenemedi.");

    return {
      yol,
      ad: guvenliAd(dosya.name),
      tur,
      boyut: dosya.size
    };
  }

  async function imzaliUrl(yol, indirAd) {
    const anahtar = String(yol || "") + "|" + String(indirAd || "");
    const simdi = Date.now();
    const kayit = imzaOnbellek.get(anahtar);
    if (kayit && kayit.bitis > simdi + 60000) return kayit.url;

    const sb = sunucu();
    if (!sb) throw new DestekHatasi("Destek altyapısı yüklenemedi.", "kurulum");

    let sonuc;
    try {
      sonuc = await bekle(
        sb.storage.from(BUCKET).createSignedUrl(
          yol,
          IMZA_SANIYE,
          indirAd ? { download: indirAd } : undefined
        )
      );
    } catch (hata) {
      throw hataYap(hata, "Dosya bağlantısı oluşturulamadı.");
    }
    if (sonuc && sonuc.error) throw hataYap(sonuc.error, "Dosya bağlantısı oluşturulamadı.");
    const url = sonuc && sonuc.data && sonuc.data.signedUrl;
    if (!url) throw new DestekHatasi("Dosya bağlantısı oluşturulamadı.", "dosya");

    imzaOnbellek.set(anahtar, { url, bitis: simdi + IMZA_SANIYE * 1000 });
    return url;
  }

  async function dosyaSil(yol) {
    const sb = sunucu();
    if (!sb || !yol) return;
    for (const anahtar of Array.from(imzaOnbellek.keys())) {
      if (anahtar.indexOf(String(yol) + "|") === 0) imzaOnbellek.delete(anahtar);
    }
    try {
      await bekle(sb.storage.from(BUCKET).remove([yol]));
    } catch (hata) {
      console.warn("[klyze] ek silinemedi:", hata && hata.message);
    }
  }

  window.KLYZE_DESTEK = Object.freeze({
    BUCKET,
    MAKS_EK,
    MAKS_EK_BOYUT,
    IZINLI_TUR,
    DURUMLAR,
    DestekHatasi,
    sunucu,
    oturum,
    oturumDinle,
    cikis,
    profil,
    biletlerim,
    biletDetay,
    biletOlustur,
    mesajGonder,
    durumDegistir,
    ekipMi,
    ekipBiletler,
    ekipSayilar,
    mimeBelirle,
    ekUygun,
    guvenliAd,
    dosyaYukle,
    imzaliUrl,
    dosyaSil
  });
})();
