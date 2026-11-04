# Site girişi — kurulum ve durum

Son güncelleme: 02.11.2026

## Durum: destek için AÇIK, Google yapılandırması bekliyor

Site girişi 28.10.2026'da kapatılmıştı; 02.11.2026'da destek biletleri
hesaba bağlanacağı için `giris.html` yeniden açıldı. Giriş yalnızca Google ile
yapılır; e-posta/şifre ve anonim giriş kapalıdır.

**Bilinen engel:** Supabase'deki Google sağlayıcısı Web istemcisini
(`801722049589-...`) kullanıyor, ancak Google Cloud'da bu istemcinin yetkili
dönüş adresine şu adres henüz ekli değil:

```
https://wshbwkgujaspnflnwnwx.supabase.co/auth/v1/callback
```

Eklenene kadar Google `redirect_uri_mismatch` döner. Bu bir kod hatası değil,
Google Cloud konsol ayarıdır. Ayrıntı: `docs/destek-kurulum.md`.

> **Masaüstü uygulaması notu:** Supabase, bir sağlayıcı için tek Google
> istemcisi kabul eder. Site Web istemcisini kullanırken masaüstü ayrı bir
> istemci kullanıyorsa uygulama `400 Unacceptable audience in id_token`
> alabilir. Bu çözülene kadar site girişi ile masaüstü girişi aynı anda
> doğrulanmış sayılmaz; köprü veya masaüstünün Web istemcisine taşınması
> gerekir. Bu depoda o köprü yok.

## Sayfalar

| Sayfa | Görev |
|---|---|
| `giris.html` + `js/giris.js` | Google girişi, `?donus=` ile geri dönüş, çıkış |
| `bilet.html` + `js/bilet.js` | Giriş kapısı, bilet formu, Biletlerim, detay, sohbet, ekler |
| `ekip.html` + `js/ekip.js` | Ekip gelen kutusu; rol kapısı, filtre, yanıt, durum |
| `js/destek-api.js` | Ortak veri katmanı: RPC + özel `destek` bucket'ı |
| `js/klyze-auth.js` | Auth istemcisi ve ortak yardımcılar |
| `js/config.js` | Supabase URL, publishable anahtar, `schema = "site"` |

`profil.html` hâlâ kapalı sayfadır; giriş akışı profile bağlı değildir.

## Giriş akışı

- `signInWithOAuth({ provider: "google", flowType: "pkce" })`.
- `redirectTo`: `giris.html`; `?donus=` varsa aynı sorguyla korunur.
- Dönüş adresi yalnızca site içi `bilet.html`, `ekip.html`, `index.html`
  sayfalarına izin verir. Dış adres açık yönlendirme sayılır ve yok sayılır.
- Oturum `localStorage["klyze-site-auth"]` içinde tutulur; oturum anahtarı
  `js/klyze-auth.js` ve `js/destek-api.js` içinde aynıdır.
- `?donus=bilet.html` ile gelindiğinde giriş tamamlanınca 700 ms sonra
  `location.replace` ile hedefe dönülür.
- Çıkış `scope: "local"`: yalnız bu tarayıcıyı kapatır.
- Hata parametreleri (`error`, `error_code`, `error_description`) adres
  çubuğundan temizlenir; kullanıcıya Türkçe mesaj gösterilir.

## Veri akışı (destek ile birlikte)

- **Kayıt:** `auth.users` AFTER INSERT → `site_private.profil_olustur()`:
  `guvenlik.uyeler` + `site.uyeler` (`uye_no` 1000'den başlar) ve
  `google.accounts` aynası.
- **Giriş kaydı:** `auth.sessions` AFTER INSERT → `guvenlik.girisler`.
- **İstemci tabloya yazmaz.** Profil `site.benim_profil()` ile okunur;
  destek verisi `site.benim_biletler()`, `site.bilet_detay()`,
  `site.bilet_olustur()`, `site.bilet_mesaj_gonder()`,
  `site.bilet_durum_degistir()` RPC'lerinden geçer.
- **Kimlik:** `kullanici_id` istemciye hiçbir kolonda açılmaz; sahiplik
  sunucuda `auth.uid()` ile çözülür.
- **E-posta:** site tablolarında saklanmaz, arayüzde gösterilmez.

## Yetkiler

```sql
grant usage on schema site to anon, authenticated;
grant select (uye_no, gorunen_ad, avatar_url) on site.uyeler to anon;
grant select (uye_no, gorunen_ad, avatar_url, olusturma_at, guncelleme_at)
  on site.uyeler to authenticated;
grant execute on function site.benim_profil() to authenticated;
grant execute on function site.gorunen_ad_guncelle(text) to authenticated;
-- site.destek* tablolarında istemciye INSERT/UPDATE/DELETE yok
```

| Rol | `site` | `site.uyeler` | Destek |
|---|---|---|---|
| `anon` | kullanım var | select(no, ad, avatar) | yok |
| `authenticated` | kullanım var | select(+zamanlar) | yalnız RPC |
| `service_role` | kullanım var | select | tablolarda select |

> Canlı kontrol (02.11.2026): PostgREST yalnız `public, graphql_public, site`
> şemalarını yayınlıyor. `guvenlik` ve `depolama` tarayıcıya kapalı (406).
> Bu yüzden ekip kontrolü `site.ekip_mi()` köprüsünden yapılır.
> Dashboard > API > Exposed schemas kaydedilirse liste düşebilir; düşerse:
> `alter role authenticator set pgrst.db_schemas = 'public, graphql_public, site';`
> + `notify pgrst, 'reload config';`

## Google OAuth

- Supabase'de kayıtlı istemci: `801722049589-olteiisd8uck91d0ipeuauinjh1c8c2i`
  (**Web**).
- Google Cloud'da yetkili dönüş adresi **olması gereken**:
  `https://wshbwkgujaspnflnwnwx.supabase.co/auth/v1/callback`
- `site_url`: `https://klyzegg.vercel.app/`
- Supabase Redirect URLs en az şunları içermeli:
  `http://127.0.0.1:8000/**`, `https://klyzegg.vercel.app/**`
- E-posta sağlayıcısı kapalı; giriş yalnızca Google.
- OAuth onay ekranı **Testing** modundaysa yalnız test kullanıcıları girer;
  1.000 kullanıcı için **In production** olmalı.

## Çalıştırma

```
python app.py --port 8000
# http://127.0.0.1:8000/giris.html?donus=bilet.html
```

Port **8000** olmalı; yerel allow list yalnız bu portu kapsıyor.

## Test listesi

1. `giris.html` → "Tekrar hoş geldin" + Google butonu.
2. Google girişi → `giris.html?donus=bilet.html` → otomatik `bilet.html`.
3. Oturum varken `giris.html` açılır → "Hesabın hazır".
4. `?donus=https://example.com` → yok sayılır, varsayılan `bilet.html`.
5. Çıkış → aynı sayfada "Tekrar hoş geldin"; `bilet.html` kapıya döner.
6. `?error=access_denied` → hata kartı; adres çubuğu temizlenir.
7. Sayfa yenilenir → oturum korunur.
8. Girişsiz `bilet.html` → "Bilet açmak için giriş yap" kapısı.

Gerçek Google dönüşü, Google Cloud dönüş adresi eklenmeden test edilemez.

## Bilinmesi gerekenler

- Tarayıcıda yalnız `sb_publishable_...` anahtarı var; `service_role` yok.
- `oturum.js` ağ isteği yapmaz; yalnız localStorage'daki oturuma bakar.
- `profil.html` kapalı olduğu için ana sayfada "Profil" bağlantısı yok.
- Site ikonları hâlâ fare imleci görseli (`assets/favicon*.png`); gerçek logo
  bekleniyor.
