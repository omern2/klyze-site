# Plan — Rolü siteye bağlama + destek butonları

> Durum: **uygulandı** (04.11.2026). Güncel rol mimarisi ve test listesi: `docs/roller.md`.
> Not: başlığa eklenen `Biletlerim` / `Destek paneli` bağlantıları 04.11.2026'da kaldırıldı.
> Giriş noktası artık ana sayfadaki Destek bölümü → `bilet.html` sekmeleri.
> Kapsam: giriş sonrası rol kontrolü ve ana sayfa destek bölümünün butonları.
> Kapsam dışı: site geneli rol entegrasyonu, admin arayüzü, rol atama ekranı.

## Kararlar (onaylandı)

- Panel butonu `uye` için **tamamen gizli**.
- "Klyze Destek · Yakında" butonu **kalıyor** → destek bölümünde 4 buton olur.
- `sql/023-destek.sql` **canlıya alındı**.

## Bugünkü durum (kanıt)

| Ne | Durum |
|---|---|
| `giris.html` + Google girişi | Çalışıyor (canlıda test edildi) |
| `site.destek` tabloları, `bilet_*`, `ekip_mi` RPC'leri | **Canlıda yok** (`sql/023-destek.sql` uygulanmadı) |
| `guvenlik.roller` | Yalnız `uye` (226), hiç `destek` yok |
| `index.html` destek bölümü | 2 buton: "Destek oluştur" → `bilet.html`, "Klyze Destek · Yakında" (bilgi notu açar) |
| `bilet.html` | Sekmeler hazır: "Bilet Oluştur" / "Biletlerim" |
| `ekip.html` | Panel hazır; `ekipMi()` false ise "yetkin yok" kapısı gösteriyor |
| Ana sayfa | Supabase SDK'sı **yüklenmiyor**; giriş linki her zaman "Giriş" |

Yani eksik olan tek şey: ana sayfanın oturumu ve rolü bilmemesi. Bilet/panel altyapısı zaten var.

## Kademe 0 — Ön koşul (canlı DB) — TAMAM

`sql/023-destek.sql` canlıya uygulandı ve doğrulandı:

| Kontrol | Sonuç |
|---|---|
| `site.destek` / `destek_mesajlari` / `destek_ekleri` | 3 tablo, RLS açık |
| `site.ekip_mi`, `benim_biletler`, `bilet_detay` | var |
| `site.bilet_olustur`, `bilet_mesaj_gonder`, `bilet_durum_degistir` | var |
| `site.ekip_biletler`, `ekip_sayilar` | var |
| Yetki | `anon` → hepsi false, `authenticated` → hepsi true |
| Storage | `destek` bucket özel, 5 MB, 3 politika |
| `site_private.destek_kodu(1)` | `KLY-000001` |

`omeryildirim5612@gmail.com` hesabına `destek` rolü verildi (`uye` rolü de duruyor; roller eklenir, birbirini silmez).

Geri almak için:

```sql
delete from guvenlik.roller
where rol = 'destek'
  and kullanici_id = (select id from auth.users where email = 'omeryildirim5612@gmail.com');
```

## Tamamlanan ek işler (03.11.2026)

### bilet.html "Ekip paneli" sekmesi — TAMAM

- Sekme satırı: `Bilet Oluştur | Biletlerim | Ekip paneli`
- `Ekip paneli` bir `<a href="ekip.html">`; `hidden` doğar, `ekipMi()` true ise açılır.
- Ana sayfa destek bölümündeki buton (kademe 2b) hâlâ yapılmadı.

### Google profil fotoğrafları — TAMAM

| Yer | Ne |
|---|---|
| `bilet.html` hesap çubuğu | kendi PP (24 px) |
| `bilet.html` yazışma | iki tarafın PP'si (28 px) |
| `ekip.html` bilet listesi | üye PP'si (18 px) |
| `ekip.html` yazışma | iki tarafın PP'si (28 px) |

Kaynak: `site.uyeler.avatar_url` (226 üyenin 220'sinde dolu, Google).
Yeni migration: `sql/025-destek-avatar.sql` → `ekip_biletler.kullanici_avatar`, `bilet_detay.kullanici_avatar` + `mesajlar[].yazan_avatar`.
PP yüklenmezse baş harf gösterilir (`img` `error` → kaldır, harf bas).

## Kademe 1 - Rol köprüsü: `js/rol.js` (yeni) — **04.11.2026'da kaldırıldı**

> Bu bölüm tarihsel kayıttır. Başlık bağlantıları kaldırıldığı için `js/rol.js`
> dosyası da silindi; güncel davranış `docs/roller.md` içinde.

Amaç: "giriş yaptı → rolünü kontrol et" tek dosyada, tek yerde.

Akış:

```
localStorage "klyze-site-auth" var mı?
  yok  → rol = misafir. SDK hiç yüklenmez. (ana sayfa maliyeti 0)
  var  → Supabase SDK'sı tembel yüklenir
       → auth.getSession()  (gerekirse token yenilenir)
       → site.ekip_mi() RPC   ← Supabase JWT'yi doğrular, "tamam" der
       → rol = destek | uye
```

- Sonuç `document.documentElement.dataset.rol` içine yazılır: `misafir | uye | destek`.
- `window.KLYZE_ROL = { rol, ekip, oturum, hazir }` + `klyze:rol` olayı.
- **Fail-closed:** RPC hata verirse `uye` kabul edilir; panel gizli kalır. Yetki asla istemci tahminine bırakılmaz — `ekip_mi()` zaten sunucuda `guvenlik.roller` bakıyor.
- SDK neden tembel: `js/vendor/supabase-2.118.0.js` 213 KB. Ziyaretçilerin çoğu girişsiz; onlara bu dosyayı indirtmek Core Web Vitals'ı bozar.
- SDK neden elle fetch değil: token yenileme ve localStorage formatı SDK'ya ait. Elle yazmak 6 ay sonra kırılır.

`index.html`'e eklenir: `<script src="js/rol.js?v=1" defer></script>` (main.js'ten önce).

## Kademe 2 — Ana sayfa destek bölümü

`index.html` içindeki `.ds-actions` dört butona çıkar:

| Buton | Hedef | Kim görür |
|---|---|---|
| **Bilet oluştur** (birincil) | `bilet.html` | herkes |
| **Biletlerim** | `bilet.html?gorunum=liste` | herkes (girişsizse giriş sayfası) |
| **Klyze Destek** (mevcut, "Yakında") | bilgi notu açar | herkes |
| **Destek paneli** | `ekip.html` | yalnız `data-rol="destek"` |

- Panel butonu HTML'de `hidden` doğar; `rol.js` `destek` derse açılır. JS kapalıysa görünmez (istenen davranış).
- Misafir "Bilet oluştur"/"Biletlerim"e basarsa `giris.html?donus=...` ile girişe gider; mevcut `donus` mekanizması geri getirir.
- Dört buton masaüstünde tek satır, mobilde alt alta. `.ds-actions` zaten `flex` + `wrap`; yalnız boşluk ayarı gerekir.

## Kademe 3 — `bilet.html` derin bağlantı

- `bilet.js`: `?gorunum=liste` → "Biletlerim", `?gorunum=form` → "Bilet Oluştur". Parametre yoksa bugünkü davranış korunur.
- `giris.js` `donus` adresini olduğu gibi kullanıyor; `bilet.html?gorunum=liste` çalışır, değişiklik gerekmez.

## Kademe 4 — `ekip.html` kapısı

- Davranış zaten doğru: `ekipMi()` false → kapı. Sadece metne "Ana sayfaya dön" bağlantısı eklenir.
- Güvenlik notu: butonu gizlemek yetki değildir. Panel RPC'leri (`ekip_biletler`, `ekip_sayilar`, `bilet_durum_degistir`) sunucuda `ekip_mi()` ile korunuyor; istemci kandırılsa bile veri gelmez.

## Kademe 5 — Test listesi

| Senaryo | Beklenen |
|---|---|
| Girişsiz ana sayfa | 2 buton; panel butonu yok; ağda SDK isteği yok |
| Girişsiz "Biletlerim" | `giris.html?donus=bilet.html?gorunum=liste` → giriş → biletlerim |
| `uye` girişli | "Biletlerim" açılır; `ekip.html` → yetki kapısı |
| `destek` girişli | 3 buton; panel butonu görünür; panel bilet listesini gösterir |
| Token süresi dolmuş | Sessizce yenilenir; yenilenemezse "Giriş" olarak kalır |
| RPC hatası / ağ kesik | Panel gizli, sayfa çalışmaya devam eder |

## Değişecek dosyalar

| Dosya | Ne |
|---|---|
| `klyze-site/js/rol.js` | **Yeni** — oturum + rol köprüsü |
| `klyze-site/index.html` | 4. buton (Destek paneli), `rol.js` etiketi |
| `klyze-site/js/bilet.js` | `?gorunum=` desteği |
| `klyze-site/css/style.css` | Dört butonlu dizilim (mobilde alt alta) |
| `klyze-site/ekip.html` | Kapıya "Ana sayfaya dön" |
| `klyze-site/docs/destek-kurulum.md` | Yeni akış ve test listesi |

6 dosya → onay gerekiyor. `js/destek.js`'e dokunulmuyor ("Yakında" butonu kalıyor).

## Riskler

- ~~023 canlıya alınmadan hiçbir buton çalışmaz.~~ 023 uygulandı.
- Panel butonu istemcide gizleniyor; yetki sunucuda. İstemci tarafı yalnız kozmetik.
- Ana sayfaya eklenen `rol.js` girişsiz ziyaretçiye ek istek yaptırmıyor (SDK tembel).
- `?gorunum=` eklenirken mevcut `bilet.js` davranışı bozulmamalı; parametre yoksa hiçbir şey değişmemeli.
- **Panel henüz boş:** `site.destek` içinde bilet yok. Test için önce `bilet.html`'den bir bilet açılmalı.

## Sıra

1. ~~Onay~~ / ~~023 canlıya~~ / ~~`destek` rolü~~
2. `rol.js` + index butonları
3. `bilet.js` `?gorunum=`
4. Uçtan uca test (misafir / uye / destek)
