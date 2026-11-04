/* Klyze — Bilet Gönder: form, bilet listesi ve bilet detayı.
   Veri kapısı: window.KLYZE_DESTEK (site.* RPC + özel destek bucket'ı).
   Bu dosya iş kuralı doğrulamaz; sahiplik, durum ve ek denetimi sunucuda. */
(() => {
  "use strict";

  const D = window.KLYZE_DESTEK;
  const A = window.KLYZE_AUTH;
  const MAKS_MESAJ = 1000;
  const MAKS_EK = (D && D.MAKS_EK) || 3;
  const MAKS_EK_BOYUT = (D && D.MAKS_EK_BOYUT) || 5 * 1024 * 1024;
  const VURGU_SURESI = 9000;
  const DURUMLAR = { acik: "Açık", beklemede: "Beklemede", kapali: "Kapalı" };
  const ICERIK_ADLARI = {
    valorant: "VALORANT",
    ac: "Klyze AC",
    overlay: "Overlay",
    site: "Web Sitesi",
    diger: "Diğer"
  };
  const ESKI_DEPO = "klyze-biletler-v1";
  const ESKI_DOSYA_DB = "klyze-dosyalar-v1";

  /* Ana sayfadaki "Biletlerim" bağlantısı ?gorunum=liste getirir.
     Tanınmayan değer form kabul edilir; parametresiz davranış değişmez. */
  const hedefGorunum = (() => {
    const ham = new URLSearchParams(window.location.search).get("gorunum");
    return ham === "liste" ? "liste" : "form";
  })();

  /* Kategoriler tek yerde: yeni ürün eklenirse buraya bir blok eklenir. */
  const ICERIKLER = {
    valorant: {
      kategoriler: {
        teknik: {
          ad: "Teknik Sorunlar", tur: "teknik",
          ipucu: "Hatanın ne zaman başladığını, ekranda ne gördüğünü ve varsa hata mesajını yaz.",
          ornek: "Maçlarım yüklenmiyor"
        },
        rank: {
          ad: "Rank / Maç Verisi", tur: "teknik",
          ipucu: "Riot ID'ni, beklediğin rankı ve en son ne zaman güncellendiğini yaz.",
          ornek: "Rankım güncellenmiyor"
        },
        hesap: {
          ad: "Hesap / Riot ID", tur: "hesap",
          ipucu: "Kullandığın Riot ID ve tag'i yaz; hangi ekranda takıldığını belirt.",
          ornek: "Riot ID'mi değiştiremiyorum"
        },
        oneri: {
          ad: "Öneri", tur: "oneri",
          ipucu: "Eklenmesini istediğin özelliği ve neden işine yarayacağını anlat.",
          ornek: "Maç sonu özeti istiyorum"
        }
      }
    },
    ac: {
      kategoriler: {
        tarama: {
          ad: "Tarama Sonucu", tur: "teknik",
          ipucu: "Hangi oyuncu, hangi maç ve ekranda ne gördüğünü yaz.",
          ornek: "AC etiketi yanlış görünüyor"
        },
        isaret: {
          ad: "Hatalı İşaretleme", tur: "teknik",
          ipucu: "İşaretlenen oyuncuyu ve neden hatalı olduğunu düşündüğünü anlat.",
          ornek: "Oyuncu yanlış işaretlendi"
        },
        teknik: {
          ad: "Teknik Sorunlar", tur: "teknik",
          ipucu: "Taramanın hangi aşamada takıldığını ve ekranda ne gördüğünü yaz.",
          ornek: "Tarama tamamlanmıyor"
        },
        oneri: {
          ad: "Öneri", tur: "oneri",
          ipucu: "Klyze AC için önerini ve neden işine yarayacağını anlat.",
          ornek: "AC için önerim var"
        }
      }
    },
    overlay: {
      kategoriler: {
        gorunmuyor: {
          ad: "Overlay Görünmüyor", tur: "teknik",
          ipucu: "Oyun modunu, ALT + X davranışını ve ekranda ne olduğunu yaz.",
          ornek: "Overlay oyunda açılmıyor"
        },
        performans: {
          ad: "Performans", tur: "teknik",
          ipucu: "FPS düşüşünü, sistemini ve overlay açık/kapalı farkını yaz.",
          ornek: "Overlay açınca FPS düşüyor"
        },
        ayar: {
          ad: "Ayar / Kısayol", tur: "teknik",
          ipucu: "Hangi kısayolu veya ayarı değiştirmek istediğini yaz.",
          ornek: "Kısayolu değiştirmek istiyorum"
        },
        teknik: {
          ad: "Teknik Sorunlar", tur: "teknik",
          ipucu: "Hatanın ne zaman başladığını ve ekranda ne gördüğünü yaz.",
          ornek: "Overlay'de hata var"
        }
      }
    },
    site: {
      kategoriler: {
        indirme: {
          ad: "İndirme", tur: "teknik",
          ipucu: "Tarayıcını, dosya adını ve varsa hata mesajını yaz.",
          ornek: "Kurulum dosyası inmıyor"
        },
        giris: {
          ad: "Hesap / Giriş", tur: "hesap",
          ipucu: "Hangi ekranda kaldığını ve hangi yöntemi denediğini yaz.",
          ornek: "Google girişi açılmıyor"
        },
        liderlik: {
          ad: "Liderlik", tur: "diger",
          ipucu: "Hangi tabloda ve hangi değerde sorun gördüğünü yaz.",
          ornek: "Liderlik tablosu boş"
        },
        diger: {
          ad: "Diğer", tur: "diger",
          ipucu: "Sorunu ve hangi sayfada olduğunu kısaca anlat.",
          ornek: "Sitede bir sorun var"
        }
      }
    },
    diger: {
      kategoriler: {
        soru: {
          ad: "Genel Soru", tur: "diger",
          ipucu: "Sormak istediğin konuyu ve nerede takıldığını kısaca yaz.",
          ornek: "Bir sorum var"
        },
        hata: {
          ad: "Hata Bildirimi", tur: "teknik",
          ipucu: "Hatanın nerede olduğunu, ne yaptığını ve ekranda ne gördüğünü yaz.",
          ornek: "Bir hata buldum"
        },
        oneri: {
          ad: "Öneri", tur: "oneri",
          ipucu: "Eklenmesini istediğin şeyi ve neden işine yarayacağını anlat.",
          ornek: "Bir önerim var"
        },
        geri: {
          ad: "Geri Bildirim", tur: "diger",
          ipucu: "Deneyimini ve neyin daha iyi olabileceğini yaz.",
          ornek: "Geri bildirimim var"
        }
      }
    }
  };

  const $ = (id) => document.getElementById(id);

  /* ---------- sayfa kabuğu: mobil üst bar + dil düğmesi ---------- */
  function kabukHazirla() {
    const tetik = $("mTrigger");
    const menu = $("mDrop");
    const kutu = $("mNotch");

    if (tetik && menu) {
      const kapat = () => {
        menu.hidden = true;
        tetik.setAttribute("aria-expanded", "false");
      };
      tetik.addEventListener("click", () => {
        const acilsin = menu.hidden;
        menu.hidden = !acilsin;
        tetik.setAttribute("aria-expanded", String(acilsin));
      });
      menu.querySelectorAll("[data-sayfa]").forEach((dugme) => {
        dugme.addEventListener("click", () => {
          const sayfa = dugme.dataset.sayfa;
          location.href = sayfa ? "index.html?sayfa=" + encodeURIComponent(sayfa) : "index.html";
        });
      });
      document.addEventListener("click", (olay) => {
        if (kutu && !kutu.contains(olay.target)) kapat();
      });
      document.addEventListener("keydown", (olay) => {
        if (olay.key === "Escape") kapat();
      });
    }

    const dilDugme = $("langBtn");
    const dilMenu = $("langDrop");
    if (dilDugme && dilMenu) {
      const dilKapat = () => {
        dilMenu.hidden = true;
        dilDugme.setAttribute("aria-expanded", "false");
      };
      dilDugme.addEventListener("click", () => {
        const acilsin = dilMenu.hidden;
        dilMenu.hidden = !acilsin;
        dilDugme.setAttribute("aria-expanded", String(acilsin));
      });
      dilMenu.querySelectorAll("button").forEach((dugme) => {
        dugme.addEventListener("click", () => {
          dilMenu.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", "false"));
          dugme.setAttribute("aria-selected", "true");
          dilDugme.textContent = dugme.dataset.lang;
          dilKapat();
        });
      });
      document.addEventListener("click", (olay) => {
        const kapsayici = dilDugme.closest(".lang-wrap");
        if (kapsayici && !kapsayici.contains(olay.target)) dilKapat();
      });
      document.addEventListener("keydown", (olay) => {
        if (olay.key === "Escape") dilKapat();
      });
    }
  }

  kabukHazirla();

  const form = $("ticketForm");
  if (!form) return;

  const app = $("biletUygulama");
  const yukleniyorKutu = $("biletYukleniyor");
  const durumKutu = $("biletDurum");
  const durumBaslik = $("durumBaslik");
  const durumMetin = $("durumMetin");
  const durumGiris = $("durumGiris");
  const durumTekrar = $("durumTekrar");
  const durumHata = $("durumHata");

  const frame = document.querySelector(".site-frame");
  const hero = $("hero");
  const sayfaBaslik = $("sayfaBaslik");
  const formAlt = $("formAlt");
  const listeAlt = $("listeAlt");
  const sayfaMeta = $("sayfaMeta");
  const sekmeForm = $("sekmeForm");
  const sekmeListe = $("sekmeListe");
  const sekmeDestek = $("sekmeDestek");
  const viewForm = $("viewForm");
  const viewListe = $("viewListe");
  const viewBilet = $("viewBilet");

  const card = $("card");
  const step = $("step");
  const details = $("details");
  const secim = $("secim");
  const icerikGrid = $("icerikGrid");
  const kategoriGrid = $("kategoriGrid");
  const konu = $("konu");
  const aciklama = $("aciklama");
  const icerikField = $("icerikField");
  const icerikHint = $("icerikHint");
  const kategoriField = $("kategoriField");
  const konuField = $("konuField");
  const aciklamaField = $("aciklamaField");
  const icerikErr = $("icerikErr");
  const kategoriErr = $("kategoriErr");
  const konuErr = $("konuErr");
  const aciklamaErr = $("aciklamaErr");
  const konuCount = $("konuCount");
  const aciklamaCount = $("aciklamaCount");
  const formError = $("formError");
  const gonderBtn = $("gonder");
  const gonderEtiket = $("gonderEtiket");
  const temizleBtn = $("temizle");
  const live = $("live");

  const listeUst = $("listeUst");
  const listeSayi = $("listeSayi");
  const listeList = $("listeList");
  const listeBos = $("listeBos");
  const listeHata = $("listeHata");
  const listeBilgi = $("listeBilgi");
  const listeYenile = $("listeYenile");
  const bosYeni = $("bosYeni");

  const biletGeri = $("biletGeri");
  const detayHata = $("detayHata");
  const detayKicker = $("detayKicker");
  const detayBaslik = $("detayBaslik");
  const metaUrun = $("metaUrun");
  const metaKategori = $("metaKategori");
  const metaGonderen = $("metaGonderen");
  const metaId = $("metaId");
  const metaTarih = $("metaTarih");
  const metaEtkinlik = $("metaEtkinlik");
  const metaDurum = $("metaDurum");
  const durumDegistir = $("durumDegistir");
  const akis = $("akis");
  const mesajForm = $("mesajForm");
  const mesaj = $("mesaj");
  const mesajGonder = $("mesajGonder");
  const mesajHata = $("mesajHata");
  const gonderBilgi = $("gonderBilgi");
  const mesajKapali = $("mesajKapali");
  const yenidenAc = $("yenidenAc");
  const ekleBtn = $("ekleBtn");
  const ekleGirdi = $("ekleGirdi");
  const ekOnizleme = $("ekOnizleme");
  const kopyaBtn = $("kopyaBtn");
  const kopyaOk = $("kopyaOk");
  const hesapKutu = $("biletHesap");
  const hesapAd = $("hesapAd");
  const hesapPp = $("hesapPp");
  const hesapCikis = $("hesapCikis");

  let oturumVar = false;
  let kullaniciId = "";
  let kendiAd = "";
  let kendiAvatar = "";
  let aktif = null;
  let aktifTalepNo = "";
  let liste = [];
  let listeSonYukleme = 0;
  let listeYukleniyor = false;
  let vurgulananTalep = "";
  let vurguZaman = 0;
  let detayYukleniyor = false;
  let detayToken = 0;
  let durumIslem = false;
  let biletGonderiliyor = false;
  let mesajGonderiliyor = false;
  let gonderToken = 0;
  let bekleyenEkler = [];
  let pollZaman = 0;
  let bilgiZaman = 0;
  let kopyaZaman = 0;
  let duyuruZaman = 0;
  let akisNesil = 0;
  let eskiTemizlendi = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- yardımcılar ---------- */
  function seciliRadio(ad) {
    return form.querySelector('input[name="' + ad + '"]:checked');
  }

  function icerikDeger() {
    const secili = seciliRadio("icerik");
    return secili ? secili.value : "";
  }

  function kategoriDeger() {
    const secili = seciliRadio("kategori");
    return secili ? secili.value : "";
  }

  function grupAdi(ad) {
    const secili = seciliRadio(ad);
    if (!secili) return "";
    const kutu = secili.closest(".opt");
    const etiket = kutu && kutu.querySelector(".opt-ad");
    return etiket ? etiket.textContent.trim() : "";
  }

  function icerikAdi() {
    return grupAdi("icerik");
  }

  function kategoriTanim() {
    const tanim = ICERIKLER[icerikDeger()];
    return (tanim && tanim.kategoriler[kategoriDeger()]) || null;
  }

  function urunAdi(anahtar) {
    return ICERIK_ADLARI[anahtar] || icerikAdi() || "Klyze";
  }

  function duyur(mesajMetni) {
    window.clearTimeout(duyuruZaman);
    live.textContent = "";
    duyuruZaman = window.setTimeout(() => { live.textContent = mesajMetni; }, 60);
  }

  function adimGuncelle() {
    const adim = kategoriDeger() ? 3 : icerikDeger() ? 2 : 1;
    step.textContent = adim + " / 3";
  }

  function sayacGuncelle() {
    konuCount.textContent = konu.value.length + " / 80";
    aciklamaCount.textContent = aciklama.value.length + " / 2000";
  }

  function yukariKaydir() {
    if (frame) frame.scrollTo({ top: 0, behavior: "auto" });
  }

  function durumAl(bilet) {
    return bilet && DURUMLAR[bilet.durum] ? bilet.durum : "acik";
  }

  function temizMetin(deger) {
    return String(deger == null ? "" : deger).replace(/[\u0000-\u001F\u007F]/g, "").trim();
  }

  function gonderenAdi() {
    return kendiAd || "Sen";
  }

  /* biletlerim() yalnız yanıtları sayar; açıklama da akışta ilk mesajdır. */
  function mesajSayisiYaz(adet) {
    return (Number(adet) || 0) + 1;
  }

  function bilgiParagrafi(metin) {
    const p = document.createElement("p");
    p.className = "akis-bilgi";
    p.setAttribute("role", "status");
    p.textContent = metin;
    return p;
  }

  /* ---------- görünümler ---------- */
  function sekmeAyarla(aktifSekme) {
    const formAktif = aktifSekme === "form";
    sekmeForm.classList.toggle("is-active", formAktif);
    sekmeListe.classList.toggle("is-active", !formAktif);
    if (formAktif) {
      sekmeForm.setAttribute("aria-current", "page");
      sekmeListe.removeAttribute("aria-current");
    } else {
      sekmeListe.setAttribute("aria-current", "page");
      sekmeForm.removeAttribute("aria-current");
    }
  }

  function gorunumAyarla(ad) {
    viewForm.hidden = ad !== "form";
    viewListe.hidden = ad !== "liste";
    viewBilet.hidden = ad !== "bilet";
    hero.hidden = ad === "bilet";
    sekmeAyarla(ad === "form" ? "form" : "liste");
    if (ad === "form") document.title = "Bilet Gönder — Klyze.gg";
    else if (ad === "liste") document.title = "Biletlerim — Klyze.gg";
  }

  function heroAyarla(bolum) {
    const listeMi = bolum === "liste";
    sayfaBaslik.textContent = listeMi ? "Biletlerim" : "Bilet Gönder";
    formAlt.hidden = listeMi;
    listeAlt.hidden = !listeMi;
    sayfaMeta.textContent = listeMi
      ? "Hesabına bağlı · ekip yanıtları"
      : "3 adım · yaklaşık 1 dakika";
  }

  function formGoster() {
    gorunumAyarla("form");
    heroAyarla("form");
    yukariKaydir();
    duyur("Bilet formu açıldı.");
  }

  function listeGoster() {
    gonderimiBirak();
    gorunumAyarla("liste");
    heroAyarla("liste");
    yukariKaydir();
    listeyiCiz();
    if (Date.now() - listeSonYukleme > 4000) listeyiYukle({ sessiz: liste.length > 0 });
    duyur("Biletlerin açıldı.");
  }

  /* Yeni bilet sunucudan listenin başına gelene kadar kartı yerelde gösterir. */
  function biletlerimeDon(yeni) {
    gonderimiBirak();
    vurgulananTalep = yeni.talepNo;
    liste = [yeni, ...liste.filter((b) => b.talepNo !== yeni.talepNo)];

    gorunumAyarla("liste");
    heroAyarla("liste");
    yukariKaydir();
    listeyiCiz();

    const btn = satirDugmesi(yeni.talepNo);
    if (btn) btn.focus({ preventScroll: true });
    vurguyuBaslat(yeni.talepNo);
    listeyiYukle({ sessiz: true });
  }

  function yukleniyorGoster() {
    app.hidden = true;
    durumKutu.hidden = true;
    yukleniyorKutu.hidden = false;
  }

  function uygulamaGoster() {
    yukleniyorKutu.hidden = true;
    durumKutu.hidden = true;
    app.hidden = false;
  }

  function kapiGoster(mesaj, secenekler) {
    const sec = secenekler || {};
    oturumVar = false;
    app.hidden = true;
    yukleniyorKutu.hidden = true;
    durumKutu.hidden = false;

    durumGiris.hidden = false;
    durumGiris.textContent = "Google ile giriş yap";
    durumGiris.href = "giris.html?donus=" + encodeURIComponent(
      hedefGorunum === "liste" ? "bilet.html?gorunum=liste" : "bilet.html"
    );

    if (mesaj) {
      durumBaslik.textContent = "Oturum doğrulanamadı";
      durumMetin.textContent = mesaj;
    } else if (hedefGorunum === "liste") {
      durumBaslik.textContent = "Biletlerini görmek için giriş yap";
      durumMetin.textContent = "Biletlerin hesabına bağlı; ekip yanıtlarını her cihazda görebilirsin.";
    } else {
      durumBaslik.textContent = "Bilet açmak için giriş yap";
      durumMetin.textContent = "Destek taleplerin hesabına bağlanır; ekip yanıtlarını her cihazda görebilirsin.";
    }

    durumTekrar.hidden = !sec.tekrar;
    durumHata.hidden = true;
    durumHata.textContent = "";

    if (sec.odak) {
      try { durumBaslik.focus({ preventScroll: true }); } catch (hata) { durumBaslik.focus(); }
    }
  }

  /* ---------- eski yerel kayıtları temizle ---------- */
  function eskiYerelVeriyiTemizle() {
    if (eskiTemizlendi) return;
    eskiTemizlendi = true;

    try {
      localStorage.removeItem(ESKI_DEPO);
    } catch (hata) {
      console.warn("[klyze] eski biletler silinemedi:", hata && hata.message);
    }

    if (!window.indexedDB) return;
    try {
      const istek = window.indexedDB.deleteDatabase(ESKI_DOSYA_DB);
      istek.onerror = () => console.warn("[klyze] eski dosya deposu silinemedi.");
      istek.onblocked = () => console.warn("[klyze] eski dosya deposu başka sekmede açık.");
    } catch (hata) {
      console.warn("[klyze] eski dosya deposu silinemedi:", hata && hata.message);
    }
  }

  /* ---------- oturum ---------- */
  function adFromSession(oturum) {
    const meta = (oturum && oturum.user && oturum.user.user_metadata) || {};
    const ad = temizMetin(meta.full_name || meta.name);
    if (ad) return ad.slice(0, 80);
    const eposta = String((oturum && oturum.user && oturum.user.email) || "");
    return eposta ? eposta.split("@")[0].slice(0, 80) : "Hesabım";
  }

  function avatarFromSession(oturum) {
    const meta = (oturum && oturum.user && oturum.user.user_metadata) || {};
    return avatarUrl(meta.avatar_url || meta.picture);
  }

  function avatarUrl(deger) {
    if (!A || typeof A.httpsUrl !== "function") return "";
    return A.httpsUrl(deger) || "";
  }

  function avatarPp(ad, url) {
    if (!hesapPp) return;
    const guvenli = avatarUrl(url);
    if (guvenli) {
      hesapPp.src = guvenli;
      hesapPp.alt = ad ? ad + " profil fotoğrafı" : "";
      hesapPp.hidden = false;
    } else {
      hesapPp.hidden = true;
      hesapPp.removeAttribute("src");
    }
  }

  function hesapCiz(ad, url) {
    hesapAd.textContent = ad || "Hesabım";
    avatarPp(ad, url);
    hesapKutu.hidden = false;
  }

  function hesapGizle() {
    hesapKutu.hidden = true;
    hesapAd.textContent = "—";
    avatarPp("", "");
  }

  async function profilYukle() {
    try {
      const satir = await D.profil();
      if (!oturumVar || !satir) return;
      const ad = temizMetin(satir.gorunen_ad);
      if (ad) {
        kendiAd = ad.slice(0, 80);
        hesapAd.textContent = kendiAd;
      }
      const pp = avatarUrl(satir.avatar_url);
      if (pp) {
        kendiAvatar = pp;
        avatarPp(ad || hesapAd.textContent, pp);
      }
    } catch (hata) {
      if (hata && hata.kod === "oturum") oturumBitti(hata.message);
    }
  }

  async function ekipKontrol() {
    try {
      const ekip = await D.ekipMi();
      if (!oturumVar) return;
      if (sekmeDestek) sekmeDestek.hidden = !ekip;
    } catch (hata) {
      if (hata && hata.kod === "oturum") oturumBitti(hata.message);
    }
  }

  async function girisSonrasi(oturum) {
    const uid = (oturum && oturum.user && oturum.user.id) || "";
    if (oturumVar && uid && uid === kullaniciId) {
      uygulamaGoster();
      return;
    }

    oturumVar = true;
    kullaniciId = uid;
    uygulamaGoster();
    kendiAd = adFromSession(oturum);
    kendiAvatar = avatarFromSession(oturum);
    hesapCiz(kendiAd, kendiAvatar);
    if (sekmeDestek) sekmeDestek.hidden = true;
    eskiYerelVeriyiTemizle();

    if (hedefGorunum === "liste") listeGoster();

    await Promise.allSettled([profilYukle(), ekipKontrol()]);
  }

  function oturumBitti(mesaj) {
    if (!oturumVar) {
      kapiGoster(mesaj || "Oturumun sona erdi. Yeniden giriş yap.", { odak: true });
      return;
    }

    oturumVar = false;
    kullaniciId = "";
    kendiAd = "";
    kendiAvatar = "";
    gonderimiBirak();
    bekleyenleriTemizle();
    vurguyuTemizle();
    detayToken++;
    detayYukleniyor = false;
    durumIslem = false;
    aktif = null;
    aktifTalepNo = "";
    liste = [];
    listeSonYukleme = 0;
    hesapGizle();
    listeList.replaceChildren();
    listeHata.hidden = true;
    listeBilgi.hidden = true;
    akis.replaceChildren();

    kapiGoster(mesaj || "Oturumun sona erdi. Yeniden giriş yap.", { odak: true });

    if (D && typeof D.cikis === "function") {
      D.cikis().catch(() => {});
    }
  }

  async function basla() {
    yukleniyorGoster();

    if (!D || !A) {
      kapiGoster("Destek altyapısı yüklenemedi. Sayfayı yenileyip tekrar dene.", { tekrar: true, odak: true });
      return;
    }

    try {
      const oturum = await D.oturum();
      if (!oturum) {
        kapiGoster("", { odak: true });
        return;
      }
      await girisSonrasi(oturum);
    } catch (hata) {
      kapiGoster(
        (hata && hata.message) || "Oturum bilgisi okunamadı. İnternetini kontrol edip tekrar dene.",
        { tekrar: true, odak: true }
      );
    }
  }

  /* ---------- dosya ekleri ---------- */
  const boyutBicim = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

  function boyutYaz(bayt) {
    const sayi = Number(bayt);
    if (!Number.isFinite(sayi) || sayi < 1) return "—";
    if (sayi < 1024) return sayi + " B";
    if (sayi < 1024 * 1024) return boyutBicim.format(sayi / 1024) + " KB";
    return boyutBicim.format(sayi / (1024 * 1024)) + " MB";
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
    kart.className = "ek-kart";
    kart.setAttribute("aria-label", ek.ad + " dosyasını indir");
    kart.title = ek.ad + " · " + boyutYaz(ek.boyut);

    const gorsel = document.createElement("span");
    gorsel.className = "ek-kart-gorsel";
    gorsel.append(dosyaIkonu());
    if (String(ek.tur || "").indexOf("image/") === 0) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      gorsel.append(img);
      imzaGorseli(img, ek.yol, nesil);
    }

    const govde = document.createElement("span");
    govde.className = "ek-kart-govde";
    const ad = document.createElement("span");
    ad.className = "ek-ad";
    ad.textContent = ek.ad;
    const alt = document.createElement("span");
    alt.className = "ek-boyut";
    alt.textContent = turEtiketi(ek) + " · " + boyutYaz(ek.boyut);
    govde.append(ad, alt);

    const indir = document.createElement("span");
    indir.className = "ek-indir-ikon";
    indir.append(indirIkonu());

    kart.append(gorsel, govde, indir);
    kart.addEventListener("click", () => ekIndir(ek, kart));
    return kart;
  }

  function ekleriCiz(ekler, nesil) {
    const sar = document.createElement("div");
    sar.className = "msg-ekler";
    ekler.forEach((ek) => sar.append(ekKartCiz(ek, nesil)));
    return sar;
  }

  /* ---------- bekleyen ek önizlemesi ---------- */
  function gonderDurumu() {
    const dolu = Boolean(mesaj.value.trim()) || bekleyenEkler.length > 0;
    const kapali = !aktif || durumAl(aktif) === "kapali";
    mesajGonder.disabled = mesajGonderiliyor || !dolu || kapali;
    ekleBtn.disabled = mesajGonderiliyor || kapali || bekleyenEkler.length >= MAKS_EK;
  }

  function ekOnizlemeCiz() {
    ekOnizleme.replaceChildren();
    ekOnizleme.hidden = bekleyenEkler.length === 0;

    bekleyenEkler.forEach((ek) => {
      const chip = document.createElement("div");
      chip.className = "ek-chip";

      const gorsel = document.createElement("span");
      gorsel.className = "ek-chip-gorsel";
      gorsel.append(dosyaIkonu());
      if (String(ek.tur || "").indexOf("image/") === 0) {
        const img = document.createElement("img");
        img.src = ek.url;
        img.alt = "";
        img.addEventListener("error", () => img.remove(), { once: true });
        gorsel.append(img);
      }

      const govde = document.createElement("span");
      govde.className = "ek-chip-govde";
      const ad = document.createElement("span");
      ad.className = "ek-ad";
      ad.textContent = ek.ad;
      const alt = document.createElement("span");
      alt.className = "ek-boyut";
      alt.textContent = boyutYaz(ek.boyut);
      govde.append(ad, alt);

      const kaldir = document.createElement("button");
      kaldir.type = "button";
      kaldir.className = "ek-kaldir";
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

  function bilgiYaz(metin, kalici) {
    window.clearTimeout(bilgiZaman);
    gonderBilgi.textContent = metin || "";
    gonderBilgi.hidden = !metin;
    if (metin && !kalici) {
      bilgiZaman = window.setTimeout(() => { gonderBilgi.hidden = true; }, 4000);
    }
  }

  function gonderimiBirak() {
    gonderToken++;
    mesajGonderiliyor = false;
    gonderBilgi.hidden = true;
    gonderDurumu();
  }

  /* ---------- mesaj balonları ---------- */
  function mesajOgesi(kim, ad, metin, iso, etiket, ekler, nesil, ppUrl) {
    const sag = kim === "sen";
    const makale = document.createElement("article");
    makale.className = "msg " + (sag ? "msg-sag" : "msg-sol");

    const ust = document.createElement("header");
    ust.className = "msg-ust";

    const avatar = document.createElement("span");
    avatar.className = "msg-avatar " + (sag ? "msg-avatar-sen" : "msg-avatar-klyze");
    avatar.setAttribute("aria-hidden", "true");
    const pp = avatarUrl(ppUrl);
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
        avatar.textContent = sag ? "S" : "K";
      }, { once: true });
      avatar.append(resim);
    } else {
      avatar.textContent = sag ? "S" : "K";
    }

    const kimKutu = document.createElement("div");
    kimKutu.className = "msg-kim";

    const adEl = document.createElement("span");
    adEl.className = "msg-ad";
    adEl.textContent = ad;
    if (etiket) {
      const rozet = document.createElement("span");
      rozet.className = "msg-etiket";
      rozet.textContent = etiket;
      adEl.append(" ", rozet);
    }

    const zaman = document.createElement("time");
    zaman.className = "msg-zaman";
    zaman.dateTime = iso;
    zaman.textContent = tarihYaz(uzunTarih, iso);

    kimKutu.append(adEl, zaman);
    if (sag) ust.append(kimKutu, avatar);
    else ust.append(avatar, kimKutu);

    const kutu = document.createElement("div");
    kutu.className = "msg-kutu";
    if (metin) {
      const paragraf = document.createElement("p");
      paragraf.className = "msg-metin";
      paragraf.textContent = metin;
      kutu.append(paragraf);
    }
    if (ekler && ekler.length) {
      kutu.classList.add("msg-kutu-ekli");
      kutu.append(ekleriCiz(ekler, nesil));
    }

    makale.append(ust, kutu);
    return makale;
  }

  function sistemOgesi(mesajKaydi) {
    const makale = document.createElement("article");
    makale.className = "msg msg-sistem";
    const kutu = document.createElement("div");
    kutu.className = "msg-kutu";
    const paragraf = document.createElement("p");
    paragraf.className = "msg-metin";
    paragraf.textContent = mesajKaydi.metin;
    kutu.append(paragraf);
    makale.append(kutu);
    return makale;
  }

  function akisiCiz(bilet) {
    const nesil = ++akisNesil;
    const ogeler = [
      mesajOgesi("sen", "Sen", bilet.aciklama, bilet.olusturma, "İlk mesaj", [], nesil, kendiAvatar)
    ];

    bilet.mesajlar.forEach((m) => {
      if (m.tip === "sistem") {
        ogeler.push(sistemOgesi(m));
        return;
      }

      const ekipMi = m.tip === "ekip";
      ogeler.push(mesajOgesi(
        ekipMi ? "klyze" : "sen",
        ekipMi ? (m.ad || "Klyze Destek") : "Sen",
        m.metin,
        m.tarih,
        ekipMi ? "Ekip" : null,
        m.ekler,
        nesil,
        ekipMi ? m.avatar : kendiAvatar
      ));
    });

    akis.replaceChildren(...ogeler);
  }

  function mesajBoyutla() {
    mesaj.style.height = "auto";
    mesaj.style.height = Math.max(44, Math.min(mesaj.scrollHeight, 120)) + "px";
  }

  function detayiGuncelle(bilet, secenekler) {
    const sec = secenekler || {};
    const koruTaslak = sec.koruTaslak === true;
    const durum = durumAl(bilet);
    const kapali = durum === "kapali";

    detayKicker.textContent = "BİLET · " + bilet.talepNo;
    detayBaslik.textContent = bilet.konu;
    metaUrun.textContent = urunAdi(bilet.modul);
    metaKategori.textContent = bilet.kategoriAd;
    metaGonderen.textContent = bilet.kullaniciAd || gonderenAdi();
    metaId.textContent = bilet.talepNo;
    metaTarih.textContent = tarihYaz(uzunTarih, bilet.olusturma);
    metaEtkinlik.textContent = goreliZaman(bilet.sonMesaj);

    metaDurum.textContent = DURUMLAR[durum];
    metaDurum.dataset.durum = durum;
    durumDegistir.hidden = kapali;
    durumDegistir.textContent = "Bileti kapat";
    durumDegistir.disabled = durumIslem;

    akisiCiz(bilet);
    mesajForm.hidden = kapali;
    mesajKapali.hidden = !kapali;
    mesajHata.hidden = true;

    if (!koruTaslak) {
      mesaj.value = "";
      bilgiYaz("", false);
    }

    gonderDurumu();
    mesajBoyutla();
  }

  function detayOzeti(bilet) {
    return {
      talepNo: bilet.talepNo,
      modul: bilet.modul,
      kategori: bilet.kategori,
      kategoriAd: bilet.kategoriAd,
      konu: bilet.konu,
      durum: bilet.durum,
      olusturma: bilet.olusturma,
      sonMesaj: bilet.sonMesaj,
      mesajSayisi: bilet.mesajlar.length
    };
  }

  function listeGuncelle(bilet) {
    const ozet = detayOzeti(bilet);
    const sira = liste.findIndex((b) => b.talepNo === ozet.talepNo);
    if (sira >= 0) liste[sira] = ozet;
    else liste.unshift(ozet);
    listeyiCiz();
  }

  function detayiYukle(talepNo, secenekler) {
    const sec = secenekler || {};
    const token = ++detayToken;
    detayYukleniyor = true;

    if (!sec.sessiz) {
      detayHata.hidden = true;
      detayHata.textContent = "";
    }

    return D.biletDetay(talepNo).then((ham) => {
      if (token !== detayToken || aktifTalepNo !== talepNo) return;
      const bilet = detayKaydi(ham);
      if (!bilet) throw new Error("Bilet verisi okunamadı.");
      aktif = bilet;
      detayHata.hidden = true;
      detayiGuncelle(bilet, sec);
      listeGuncelle(bilet);
      if (bilet.konu) document.title = bilet.konu + " — Klyze.gg";
    }).catch((hata) => {
      if (token !== detayToken) return;
      if (hata && hata.kod === "oturum") {
        oturumBitti(hata.message);
        return;
      }
      if (sec.sessiz) {
        console.warn("[klyze] bilet yenilenemedi:", hata && hata.message);
        return;
      }
      detayHata.textContent = (hata && hata.message) || "Bilet yüklenemedi. Sayfayı yenileyip tekrar dene.";
      detayHata.hidden = false;
      akis.replaceChildren(bilgiParagrafi("Bilet yüklenemedi."));
      duyur("Bilet yüklenemedi.");
    }).finally(() => {
      if (token === detayToken) detayYukleniyor = false;
    });
  }

  function biletGoster(talepNo, ozet) {
    if (!talepNo) return;

    gonderimiBirak();
    bekleyenleriTemizle();
    vurguyuTemizle();
    detayToken++;
    detayYukleniyor = false;
    aktif = null;
    aktifTalepNo = talepNo;

    kopyaOk.hidden = true;
    detayHata.hidden = true;
    durumDegistir.hidden = true;
    durumDegistir.disabled = false;
    detayKicker.textContent = "BİLET · " + talepNo;
    detayBaslik.textContent = (ozet && ozet.konu) || "Bilet yükleniyor…";
    metaUrun.textContent = "—";
    metaKategori.textContent = "—";
    metaGonderen.textContent = "—";
    metaId.textContent = talepNo;
    metaTarih.textContent = "—";
    metaEtkinlik.textContent = "—";
    metaDurum.textContent = "Yükleniyor";
    metaDurum.dataset.durum = "acik";
    mesajForm.hidden = false;
    mesajKapali.hidden = true;
    mesajHata.hidden = true;
    bilgiYaz("", false);
    akis.replaceChildren(bilgiParagrafi("Bilet yükleniyor…"));

    gorunumAyarla("bilet");
    yukariKaydir();
    try { detayBaslik.focus({ preventScroll: true }); } catch (hata) { detayBaslik.focus(); }
    duyur("Bilet açıldı: " + talepNo);

    detayiYukle(talepNo, { sessiz: false });
  }

  /* ---------- veri eşleme ---------- */
  function detayKaydi(ham) {
    if (!ham || typeof ham !== "object" || typeof ham.talep_no !== "string") return null;

    const mesajlar = Array.isArray(ham.mesajlar)
      ? ham.mesajlar.map(mesajKaydi).filter(Boolean)
      : [];

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
      kullaniciAd: temizMetin(ham.kullanici_ad),
      uyeNo: Number(ham.uye_no) || null,
      mesajlar
    };
  }

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
      avatar: avatarUrl(ham.yazan_avatar),
      metin,
      tarih: ham.olusturma_at,
      ekler
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
      olusturma: ham.olusturma_at,
      sonMesaj: ham.son_mesaj_at || ham.olusturma_at,
      mesajSayisi: Number(ham.mesaj_sayisi) || 0
    };
  }

  /* ---------- bilet listesi ---------- */
  function satirDugmesi(talepNo) {
    const dugmeler = listeList.querySelectorAll("button.liste-satir");
    for (const btn of dugmeler) {
      if (btn.dataset.talep === talepNo) return btn;
    }
    return null;
  }

  function vurguyuBaslat(talepNo) {
    vurgulananTalep = talepNo || "";
    window.clearTimeout(vurguZaman);
    if (!vurgulananTalep) return;
    vurguZaman = window.setTimeout(() => {
      vurgulananTalep = "";
      const btn = satirDugmesi(talepNo);
      if (btn) btn.classList.remove("is-yeni");
    }, VURGU_SURESI);
  }

  function vurguyuTemizle() {
    window.clearTimeout(vurguZaman);
    if (vurgulananTalep) {
      const btn = satirDugmesi(vurgulananTalep);
      if (btn) btn.classList.remove("is-yeni");
    }
    vurgulananTalep = "";
  }

  function listeSatiri(b) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const durumAnahtar = durumAl(b);
    const yeni = b.talepNo === vurgulananTalep;

    btn.type = "button";
    btn.className = "liste-satir" + (yeni ? " is-yeni" : "");
    btn.dataset.talep = b.talepNo;
    btn.setAttribute(
      "aria-label",
      b.talepNo + " · " + DURUMLAR[durumAnahtar] + " · " + b.konu + " · Gönderen " + gonderenAdi()
    );

    const govde = document.createElement("span");
    govde.className = "liste-govde";

    const ilk = document.createElement("span");
    ilk.className = "liste-ilk";
    const id = document.createElement("span");
    id.className = "liste-id";
    id.textContent = b.talepNo;

    const durum = document.createElement("span");
    durum.className = "durum-pill";
    durum.dataset.durum = durumAnahtar;
    durum.textContent = DURUMLAR[durumAnahtar];

    const yeniEtiket = document.createElement("span");
    yeniEtiket.className = "liste-yeni";
    yeniEtiket.setAttribute("aria-hidden", "true");
    yeniEtiket.textContent = "Yeni";

    const tarih = document.createElement("span");
    tarih.className = "liste-tarih";
    tarih.textContent = goreliZaman(b.sonMesaj);
    tarih.title = "Son etkinlik: " + tarihYaz(uzunTarih, b.sonMesaj);
    ilk.append(id, durum, yeniEtiket, tarih);

    const konuMetni = document.createElement("span");
    konuMetni.className = "liste-konu";
    konuMetni.textContent = b.konu;

    const alt = document.createElement("span");
    alt.className = "liste-alt";
    const gonderen = document.createElement("span");
    gonderen.className = "liste-gonderen";
    gonderen.textContent = "Gönderen · " + gonderenAdi();
    const meta = document.createElement("span");
    meta.className = "liste-meta";
    meta.textContent = [
      ICERIK_ADLARI[b.modul] || "Klyze",
      b.kategoriAd,
      mesajSayisiYaz(b.mesajSayisi) + " mesaj"
    ].join(" · ");
    alt.append(gonderen, meta);

    govde.append(ilk, konuMetni, alt);

    const ok = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ok.setAttribute("viewBox", "0 0 24 24");
    ok.setAttribute("aria-hidden", "true");
    ok.setAttribute("focusable", "false");
    const yol = document.createElementNS("http://www.w3.org/2000/svg", "path");
    yol.setAttribute("d", "m9 6 6 6-6 6");
    yol.setAttribute("fill", "none");
    yol.setAttribute("stroke", "currentColor");
    yol.setAttribute("stroke-width", "2");
    yol.setAttribute("stroke-linecap", "round");
    yol.setAttribute("stroke-linejoin", "round");
    ok.append(yol);

    btn.append(govde, ok);
    li.append(btn);
    return li;
  }

  function listeyiCiz() {
    const bos = liste.length === 0;
    const hataVar = !listeHata.hidden;
    const odakTalep = document.activeElement &&
      document.activeElement.classList &&
      document.activeElement.classList.contains("liste-satir")
      ? document.activeElement.dataset.talep
      : "";

    listeUst.hidden = bos;
    listeBos.hidden = !(bos && !listeYukleniyor && !hataVar);
    listeSayi.textContent = liste.length + " bilet";
    listeList.replaceChildren();
    liste.forEach((b) => listeList.append(listeSatiri(b)));

    const odak = odakTalep ? satirDugmesi(odakTalep) : null;
    if (odak) odak.focus({ preventScroll: true });
  }

  async function listeyiYukle(secenekler) {
    const sec = secenekler || {};
    if (listeYukleniyor || !oturumVar) return;
    listeYukleniyor = true;
    listeHata.hidden = true;
    listeHata.textContent = "";
    listeYenile.disabled = true;

    if (!sec.sessiz) {
      listeBilgi.textContent = "Biletler yükleniyor…";
      listeBilgi.hidden = false;
    }
    listeyiCiz();

    try {
      const gelen = await D.biletlerim();
      if (!oturumVar) return;
      liste = (Array.isArray(gelen) ? gelen : []).map(listeKaydi).filter(Boolean);
      listeSonYukleme = Date.now();
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitti(hata.message);
        return;
      }
      if (!sec.sessiz || liste.length === 0) {
        listeHata.textContent = (hata && hata.message) || "Biletler yüklenemedi. Tekrar dene.";
        listeHata.hidden = false;
      }
      duyur("Biletler yüklenemedi.");
    } finally {
      listeYukleniyor = false;
      listeYenile.disabled = false;
      listeBilgi.hidden = true;
      listeyiCiz();
    }
  }

  /* ---------- tarih ---------- */
  const uzunTarih = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
  });

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

  /* ---------- form temizleme ---------- */
  function formuTemizle() {
    form.reset();
    tumHatalariTemizle();
    kategoriGrid.replaceChildren();
    kategoriField.hidden = true;
    icerikHint.hidden = false;
    details.hidden = true;
    secim.textContent = "—";
    konu.placeholder = "Kısa bir başlık yaz";
    aciklama.placeholder = "Sorunu kısaca anlat";
    sayacGuncelle();
    adimGuncelle();
  }

  /* ---------- metin alanı hataları ---------- */
  function hataGoster(alan, girdi, kutu, mesaj) {
    alan.classList.add("is-invalid");
    girdi.setAttribute("aria-invalid", "true");
    kutu.textContent = mesaj;
    kutu.hidden = false;
  }

  function hataTemizle(alan, girdi, kutu) {
    alan.classList.remove("is-invalid");
    girdi.removeAttribute("aria-invalid");
    kutu.textContent = "";
    kutu.hidden = true;
  }

  function grupHataGoster(alan, kutu, mesaj) {
    alan.classList.add("is-invalid");
    alan.querySelectorAll('input[type="radio"]').forEach((girdi) => {
      girdi.setAttribute("aria-invalid", "true");
    });
    kutu.textContent = mesaj;
    kutu.hidden = false;
  }

  function grupHataTemizle(alan, kutu) {
    alan.classList.remove("is-invalid");
    alan.querySelectorAll('input[type="radio"]').forEach((girdi) => {
      girdi.removeAttribute("aria-invalid");
    });
    kutu.textContent = "";
    kutu.hidden = true;
  }

  function tumHatalariTemizle() {
    grupHataTemizle(icerikField, icerikErr);
    grupHataTemizle(kategoriField, kategoriErr);
    hataTemizle(konuField, konu, konuErr);
    hataTemizle(aciklamaField, aciklama, aciklamaErr);
    formError.hidden = true;
    formError.textContent = "";
  }

  function animasyonlaAc(oge) {
    if (reduceMotion.matches) return;
    oge.classList.remove("is-opening");
    void oge.offsetWidth;
    oge.classList.add("is-opening");
  }

  /* ---------- seçim akışı ---------- */
  function kategoriKutusu(anahtar, kat) {
    const etiket = document.createElement("label");
    etiket.className = "opt opt-kat";

    const girdi = document.createElement("input");
    girdi.type = "radio";
    girdi.name = "kategori";
    girdi.value = anahtar;
    girdi.setAttribute("aria-describedby", "kategoriErr");

    const govde = document.createElement("span");
    govde.className = "opt-govde";
    const ad = document.createElement("span");
    ad.className = "opt-ad";
    ad.textContent = kat.ad;
    govde.append(ad);

    const onay = document.createElement("span");
    onay.className = "opt-check";
    onay.setAttribute("aria-hidden", "true");

    etiket.append(girdi, govde, onay);
    return etiket;
  }

  function icerikDegisti() {
    grupHataTemizle(icerikField, icerikErr);
    grupHataTemizle(kategoriField, kategoriErr);
    formError.hidden = true;

    hataTemizle(konuField, konu, konuErr);
    hataTemizle(aciklamaField, aciklama, aciklamaErr);
    konu.value = "";
    aciklama.value = "";
    sayacGuncelle();

    const tanim = ICERIKLER[icerikDeger()];
    kategoriGrid.replaceChildren();
    details.hidden = true;
    secim.textContent = "—";

    if (!tanim) {
      kategoriField.hidden = true;
      icerikHint.hidden = false;
      konu.placeholder = "Kısa bir başlık yaz";
      aciklama.placeholder = "Sorunu kısaca anlat";
      adimGuncelle();
      return;
    }

    Object.entries(tanim.kategoriler).forEach(([anahtar, kat]) => {
      kategoriGrid.append(kategoriKutusu(anahtar, kat));
    });
    kategoriField.hidden = false;
    icerikHint.hidden = true;
    animasyonlaAc(kategoriField);
    adimGuncelle();
    duyur(icerikAdi() + " seçildi. Kategori kutusu açıldı.");
  }

  function kategoriDegisti() {
    grupHataTemizle(kategoriField, kategoriErr);
    const tanim = kategoriTanim();
    if (!tanim) {
      details.hidden = true;
      adimGuncelle();
      return;
    }

    const ilkAcilis = details.hidden;
    secim.textContent = icerikAdi() + " · " + tanim.ad;
    konu.placeholder = tanim.ornek;
    aciklama.placeholder = tanim.ipucu;
    details.hidden = false;

    if (ilkAcilis) {
      animasyonlaAc(details);
      duyur("Detay alanı açıldı. Konu ve açıklama yazılabilir.");
    }
    adimGuncelle();
  }

  /* ---------- doğrulama ---------- */
  function dogrula() {
    let ilkHatali = null;

    if (!icerikDeger()) {
      grupHataGoster(icerikField, icerikErr, "Bir içerik seç.");
      ilkHatali = icerikGrid.querySelector('input[type="radio"]');
    } else {
      grupHataTemizle(icerikField, icerikErr);
      if (!kategoriDeger()) {
        grupHataGoster(kategoriField, kategoriErr, "Bir kategori seç.");
        ilkHatali = kategoriGrid.querySelector('input[type="radio"]');
      } else {
        grupHataTemizle(kategoriField, kategoriErr);
      }
    }

    const konuDeger = konu.value.trim();
    konu.value = konuDeger;
    if (!konuDeger) {
      hataGoster(konuField, konu, konuErr, "Konuyu yaz.");
      ilkHatali = ilkHatali || konu;
    } else if (konuDeger.length < 3) {
      hataGoster(konuField, konu, konuErr, "Konu en az 3 karakter olmalı.");
      ilkHatali = ilkHatali || konu;
    } else if (konuDeger.length > 80) {
      hataGoster(konuField, konu, konuErr, "Konu en fazla 80 karakter olabilir.");
      ilkHatali = ilkHatali || konu;
    } else {
      hataTemizle(konuField, konu, konuErr);
    }

    const aciklamaDeger = aciklama.value.trim();
    aciklama.value = aciklamaDeger;
    if (!aciklamaDeger) {
      hataGoster(aciklamaField, aciklama, aciklamaErr, "Açıklamayı yaz.");
      ilkHatali = ilkHatali || aciklama;
    } else if (aciklamaDeger.length < 10) {
      hataGoster(aciklamaField, aciklama, aciklamaErr, "Biraz daha detay ver (en az 10 karakter).");
      ilkHatali = ilkHatali || aciklama;
    } else if (aciklamaDeger.length > 2000) {
      hataGoster(aciklamaField, aciklama, aciklamaErr, "Açıklama en fazla 2000 karakter olabilir.");
      ilkHatali = ilkHatali || aciklama;
    } else {
      hataTemizle(aciklamaField, aciklama, aciklamaErr);
    }

    sayacGuncelle();
    return ilkHatali;
  }

  /* ---------- form gönderimi ---------- */
  function formDurumu(gonderiliyorMu) {
    gonderBtn.disabled = gonderiliyorMu;
    temizleBtn.disabled = gonderiliyorMu;
    gonderEtiket.textContent = gonderiliyorMu ? "Oluşturuluyor…" : "Bilet oluştur";
    form.setAttribute("aria-busy", gonderiliyorMu ? "true" : "false");
  }

  async function biletOlustur(olay) {
    olay.preventDefault();
    if (biletGonderiliyor) return;
    formError.hidden = true;
    const ilkHatali = dogrula();
    if (ilkHatali) {
      ilkHatali.focus();
      duyur("Formda eksik alanlar var. İşaretli alanları kontrol et.");
      return;
    }

    const kat = kategoriTanim();
    if (!kat) return;

    const veri = {
      modul: icerikDeger(),
      kategori: kategoriDeger(),
      kategoriAd: kat.ad,
      konu: konu.value.trim(),
      aciklama: aciklama.value.trim()
    };

    biletGonderiliyor = true;
    formDurumu(true);

    try {
      const cevap = await D.biletOlustur(veri);
      const talepNo = cevap && cevap.talep_no;
      if (!talepNo) throw new Error("Bilet numarası alınamadı. Listeyi yenileyip kontrol et.");

      formuTemizle();
      const zaman = (cevap && cevap.olusturma_at) || new Date().toISOString();
      biletlerimeDon({
        talepNo,
        modul: veri.modul,
        kategori: veri.kategori,
        kategoriAd: veri.kategoriAd,
        konu: veri.konu,
        durum: (cevap && cevap.durum) || "acik",
        olusturma: zaman,
        sonMesaj: zaman,
        mesajSayisi: 0
      });
      duyur("Bilet oluşturuldu: " + talepNo + ". Biletlerim listesinde en üstte.");
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitti(hata.message);
        return;
      }
      formError.textContent = (hata && hata.message) || "Bilet oluşturulamadı. Tekrar dene.";
      formError.hidden = false;
      formError.focus();
      duyur("Bilet oluşturulamadı.");
    } finally {
      biletGonderiliyor = false;
      formDurumu(false);
    }
  }

  /* ---------- mesaj gönderimi ---------- */
  async function mesajGonderHandler(olay) {
    olay.preventDefault();
    if (mesajGonderiliyor || !aktif || !aktifTalepNo) return;

    mesajHata.hidden = true;
    const metin = mesaj.value.trim();
    const ekler = bekleyenEkler.slice();

    if (!metin && !ekler.length) {
      mesajHata.textContent = "Mesaj yaz veya dosya ekle.";
      mesajHata.hidden = false;
      mesaj.focus();
      return;
    }
    if (metin.length > MAKS_MESAJ) {
      mesajHata.textContent = "Mesaj en fazla " + MAKS_MESAJ + " karakter olabilir.";
      mesajHata.hidden = false;
      mesaj.focus();
      return;
    }
    if (durumAl(aktif) === "kapali") {
      mesajHata.textContent = "Bilet kapalı. Önce yeniden aç.";
      mesajHata.hidden = false;
      return;
    }

    const hedef = aktifTalepNo;
    const token = ++gonderToken;
    const yuklenen = [];
    mesajGonderiliyor = true;
    gonderDurumu();
    bilgiYaz("Gönderiliyor…", true);

    try {
      for (let i = 0; i < ekler.length; i++) {
        bilgiYaz("Dosyalar yükleniyor… " + (i + 1) + "/" + ekler.length, true);
        const meta = await D.dosyaYukle(ekler[i].dosya);
        yuklenen.push(meta);
      }

      bilgiYaz("Mesaj gönderiliyor…", true);
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
        bilgiYaz("Mesaj gönderildi.", false);
        await detayiYukle(hedef, { sessiz: true, koruTaslak: true });
        if (aktifTalepNo === hedef && !mesajForm.hidden && !mesajGonderiliyor) mesaj.focus();
      } else {
        bilgiYaz("", false);
      }

      listeyiYukle({ sessiz: true });
      duyur(cevap && cevap.ek_sayisi ? "Mesaj ve ekler gönderildi." : "Mesaj gönderildi.");
    } catch (hata) {
      await Promise.allSettled(yuklenen.map((ek) => D.dosyaSil(ek.yol)));
      if (token !== gonderToken) return;

      mesajGonderiliyor = false;
      gonderDurumu();
      bilgiYaz("", false);

      if (hata && hata.kod === "oturum") {
        oturumBitti(hata.message);
        return;
      }

      if (aktifTalepNo === hedef) {
        mesajHata.textContent = (hata && hata.message) || "Mesaj gönderilemedi. Tekrar dene.";
        mesajHata.hidden = false;
      }
      duyur("Mesaj gönderilemedi.");
    } finally {
      if (token === gonderToken) {
        mesajGonderiliyor = false;
        gonderDurumu();
      }
    }
  }

  /* ---------- durum ---------- */
  async function durumAyarla(yeni) {
    if (!aktif || !aktifTalepNo || durumIslem) return;
    const hedef = aktifTalepNo;
    durumIslem = true;
    detayHata.hidden = true;
    durumDegistir.disabled = true;

    try {
      await D.durumDegistir(hedef, yeni);
      await detayiYukle(hedef, { sessiz: true, koruTaslak: true });
      listeyiYukle({ sessiz: true });

      if (yeni === "acik") {
        duyur("Bilet yeniden açıldı.");
        if (aktifTalepNo === hedef && !mesajForm.hidden) mesaj.focus();
      } else {
        duyur("Bilet kapatıldı.");
      }
    } catch (hata) {
      if (hata && hata.kod === "oturum") {
        oturumBitti(hata.message);
        return;
      }
      detayHata.textContent = (hata && hata.message) || "Durum değiştirilemedi. Tekrar dene.";
      detayHata.hidden = false;
      duyur("Durum değiştirilemedi.");
    } finally {
      durumIslem = false;
      durumDegistir.disabled = false;
      if (aktif) durumDegistir.hidden = durumAl(aktif) === "kapali";
    }
  }

  /* ---------- kopyalama ---------- */
  async function panoyaKopyala(metin) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(metin);
        return true;
      } catch (hata) {
        console.warn("[klyze] pano yazimi basarisiz:", hata && hata.message);
      }
    }
    const alan = document.createElement("textarea");
    alan.value = metin;
    alan.setAttribute("readonly", "");
    alan.style.position = "fixed";
    alan.style.top = "-1000px";
    alan.style.opacity = "0";
    document.body.append(alan);
    alan.select();
    let oldu = false;
    try { oldu = document.execCommand("copy"); } catch (hata) { console.warn("[klyze] kopyalama basarisiz:", hata); }
    alan.remove();
    return oldu;
  }

  /* ---------- yenileme ---------- */
  function pollBaslat() {
    window.clearInterval(pollZaman);
    pollZaman = window.setInterval(() => {
      if (document.hidden || viewBilet.hidden || !aktifTalepNo || !oturumVar) return;
      if (mesajGonderiliyor || durumIslem || detayYukleniyor) return;
      if (document.activeElement === mesaj) return;
      detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
    }, 20000);
  }

  /* ---------- olaylar ---------- */
  icerikGrid.querySelectorAll('input[name="icerik"]').forEach((girdi) => {
    girdi.setAttribute("aria-describedby", "icerikErr");
  });
  icerikGrid.addEventListener("change", (olay) => {
    if (olay.target.name === "icerik") icerikDegisti();
  });
  kategoriGrid.addEventListener("change", (olay) => {
    if (olay.target.name === "kategori") kategoriDegisti();
  });

  konu.addEventListener("input", () => {
    sayacGuncelle();
    formError.hidden = true;
    if (!konuField.classList.contains("is-invalid")) return;
    const uzunluk = konu.value.trim().length;
    if (uzunluk >= 3 && uzunluk <= 80) hataTemizle(konuField, konu, konuErr);
  });

  aciklama.addEventListener("input", () => {
    sayacGuncelle();
    formError.hidden = true;
    if (!aciklamaField.classList.contains("is-invalid")) return;
    const uzunluk = aciklama.value.trim().length;
    if (uzunluk >= 10 && uzunluk <= 2000) hataTemizle(aciklamaField, aciklama, aciklamaErr);
  });

  form.addEventListener("submit", biletOlustur);

  temizleBtn.addEventListener("click", () => {
    if (biletGonderiliyor) return;
    const dolu = icerikDeger() || kategoriDeger() || konu.value.trim() || aciklama.value.trim();
    if (dolu && !window.confirm("Formdaki bilgiler silinsin mi?")) return;
    formuTemizle();
    icerikGrid.querySelector('input[type="radio"]').focus();
    duyur("Form temizlendi.");
  });

  sekmeForm.addEventListener("click", formGoster);
  sekmeListe.addEventListener("click", listeGoster);
  biletGeri.addEventListener("click", listeGoster);

  bosYeni.addEventListener("click", () => {
    formGoster();
    icerikGrid.querySelector('input[type="radio"]').focus();
  });

  listeYenile.addEventListener("click", () => listeyiYukle({ sessiz: false }));

  listeList.addEventListener("click", (olay) => {
    const btn = olay.target.closest("button.liste-satir");
    if (!btn) return;
    const talepNo = btn.dataset.talep;
    const ozet = liste.find((b) => b.talepNo === talepNo);
    biletGoster(talepNo, ozet);
  });

  kopyaBtn.addEventListener("click", async () => {
    if (!aktifTalepNo) return;
    const oldu = await panoyaKopyala(aktifTalepNo);
    duyur(oldu ? "Bilet numarası kopyalandı." : "Bilet numarası kopyalanamadı.");
    if (!oldu) return;
    kopyaOk.hidden = false;
    window.clearTimeout(kopyaZaman);
    kopyaZaman = window.setTimeout(() => { kopyaOk.hidden = true; }, 1800);
  });

  durumDegistir.addEventListener("click", () => durumAyarla("kapali"));
  yenidenAc.addEventListener("click", () => durumAyarla("acik"));

  ekleBtn.addEventListener("click", () => ekleGirdi.click());

  ekleGirdi.addEventListener("change", () => {
    const dosyalar = Array.from(ekleGirdi.files || []);
    ekleGirdi.value = "";
    if (!dosyalar.length) return;
    ekEkle(dosyalar);
  });

  mesaj.addEventListener("input", () => {
    gonderDurumu();
    mesajHata.hidden = true;
    mesajBoyutla();
  });

  /* Enter gönderir, Shift + Enter alt satıra geçer. */
  mesaj.addEventListener("keydown", (olay) => {
    if (olay.key !== "Enter" || olay.shiftKey || olay.isComposing) return;
    olay.preventDefault();
    if (mesaj.value.trim() || bekleyenEkler.length) mesajForm.requestSubmit();
  });

  mesajForm.addEventListener("submit", mesajGonderHandler);

  hesapCikis.addEventListener("click", async () => {
    if (!D || hesapCikis.disabled) return;
    hesapCikis.disabled = true;
    try {
      await D.cikis();
    } finally {
      hesapCikis.disabled = false;
      oturumBitti("Çıkış yaptın. Biletlerini görmek için yeniden giriş yap.");
    }
  });

  durumTekrar.addEventListener("click", basla);

  if (D && typeof D.oturumDinle === "function") {
    D.oturumDinle((olay, oturum) => {
      if (oturum && oturum.user) {
        if (!oturumVar || oturum.user.id !== kullaniciId) girisSonrasi(oturum);
        return;
      }
      if (olay === "SIGNED_OUT" || (olay === "TOKEN_REFRESHED" && !oturum)) {
        if (oturumVar) oturumBitti("Oturumun sona erdi. Yeniden giriş yap.");
      }
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !oturumVar) return;
    if (!viewBilet.hidden && aktifTalepNo && !mesajGonderiliyor && !durumIslem) {
      detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
    } else if (!viewListe.hidden && Date.now() - listeSonYukleme > 4000) {
      listeyiYukle({ sessiz: true });
    }
  });

  window.addEventListener("online", () => {
    if (!oturumVar) return;
    if (!viewBilet.hidden && aktifTalepNo) {
      detayiYukle(aktifTalepNo, { sessiz: true, koruTaslak: true });
    } else if (!viewListe.hidden) {
      listeyiYukle({ sessiz: true });
    }
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(pollZaman);
    window.clearTimeout(bilgiZaman);
    window.clearTimeout(kopyaZaman);
    window.clearTimeout(duyuruZaman);
    window.clearTimeout(vurguZaman);
    akisNesil++;
  });

  window.addEventListener("pageshow", (olay) => {
    if (olay.persisted) pollBaslat();
  });

  /* ---------- başlangıç ---------- */
  formError.tabIndex = -1;
  sayacGuncelle();
  adimGuncelle();
  gorunumAyarla(hedefGorunum);
  heroAyarla(hedefGorunum);
  eskiYerelVeriyiTemizle();
  document.documentElement.dataset.biletHazir = "1";
  pollBaslat();
  basla();
})();
