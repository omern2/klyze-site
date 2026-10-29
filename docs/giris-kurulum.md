# Site girişi ve profil — kurulum ve durum

Son güncelleme: 28.10.2026

## Durum: giriş geçici olarak KAPALI (28.10.2026)

Site girişi kapatıldı, `giris.html` ve `profil.html` statik "kapalı" sayfasına
dönüştürüldü; ana sayfadaki "Giriş Yap" bağlantıları ve `js/oturum.js` kaldırıldı.
Supabase'e bağlanan hiçbir site scripti bu iki sayfada yüklenmiyor.

**Neden:** Supabase, bir sağlayıcı için **tek** Google istemcisi kabul ediyor
(`GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`). Masaüstü uygulaması Google'dan aldığı ID
token'ı `/auth/v1/token?grant_type=id_token` ile Supabase'e veriyor; Supabase
token'ın `aud` değerini kendi yapılandırdığı client_id ile karşılaştırıyor
(GoTrue `token_oidc.go`: `acceptableClientIDs` → `idToken.Audience`).

- Supabase = Masaüstü istemcisi → uygulama giriş yapar, site `redirect_uri_mismatch`.
- Supabase = Web istemcisi → site giriş yapar, uygulama
  `400 Unacceptable audience in id_token`.

Karar (28.10.2026): uygulama öncelikli. Supabase Google sağlayıcısı **masaüstü
istemcisine** geri alınacak; site girişi, iki istemciyi birlikte kabul eden bir
çözüm (köprü veya masaüstünün de Web istemcisine taşınması) seçilene kadar kapalı
kalacak. Geri açmak için: `giris.html`/`profil.html` son sürümlerini geri yükle,
ana sayfaya bağlantıları ekle, Supabase Redirect URLs'e siteyi ekle.

## Ne hazır

| Parça | Dosya | Durum |
|---|---|---|
| Supabase ayarları (tek kaynak) | `js/config.js` | ✅ |
| Ortak auth katmanı | `js/klyze-auth.js` | ✅ |
| Giriş akışı (Google, PKCE) | `js/giris.js` | ✅ |
| Giriş arayüzü (4 durum) | `giris.html` | ✅ |
| Profil arayüzü | `profil.html` | ✅ |
| Profil mantığı | `js/profil.js` | ✅ |
| Ana sayfada oturum izi | `js/oturum.js` | ✅ |
| Stiller | `css/style.css` (`v=146`) | ✅ |
| supabase-js 2.118.0 (yerel kopya) | `js/vendor/supabase-2.118.0.js` | ✅ |
| Profil satırı | `guvenlik.uyeler` (kimlik) + `site.uyeler` (profil), trigger | ✅ |
| Giriş kaydı | `guvenlik.girisler` (trigger) | ✅ |

## Veri akışı

- **Kayıt:** `auth.users` AFTER INSERT → `site_private.profil_olustur()`:
  1. `site_private.uye_olustur()` → `guvenlik.uyeler` (kimlik çapası) + `site.uyeler`
     (`uye_no` 1000'den başlar),
  2. `google.sync_account()` → `google.accounts`.
  Sıra bu: google aynası üyelik satırına yabancı anahtarla bağlı.
- **Giriş kaydı:** `auth.sessions` AFTER INSERT → `site_private.giris_kaydet()` →
  üyelik yoksa kurulur, `google.accounts` eşlenir, `guvenlik.girisler` +
  `google.sign_ins` yazılır.
- **İstemci insert/delete yapmaz.** Satırlar yalnızca trigger ile oluşur.
- **Profil okuma:** `site.benim_profil()` RPC → `auth.uid()` ile kendi satırı.
  İstemci `kullanici_id` göndermez; PostgREST filtresiyle de sorgulayamaz
  (kolonda SELECT yetkisi yok).
- **Profil yazma:** `site.gorunen_ad_guncelle(p_ad)` RPC → ad sunucuda doğrulanır,
  `site.uyeler.gorunen_ad` yazılır, `guncelleme_at` trigger'ı tazeler.
  Tabloda doğrudan INSERT/UPDATE/DELETE yetkisi **yok**.
- **E-posta:** site tablolarında saklanmaz, arayüzde gösterilmez.
- **Kimlik zinciri:** `auth.users` → `guvenlik.uyeler` (FK yok; `profil_olustur`
  INSERT ve `uye_sil` DELETE trigger'ları) → `site.uyeler` (FK cascade) →
  `guvenlik.girisler` / `guvenlik.roller` / `google.accounts`.
  Site kodu `auth` şemasına hiç dokunmaz.
- **Ayna tablolar:** `auth.identities` → `guvenlik.kimlikler` (düz e-posta yok,
  `sha256` özeti), `auth.sessions` → `guvenlik.oturumlar`. Tek yönlü kopya;
  kendi giriş servisine geçilince tek kaynak olacaklar.
- **Şema sınırı (sql/008–009):** `guvenlik` = güvenlik/kimlik çekirdeği,
  `site` = sitenin kendi içeriği (ad, avatar, yorum, destek), `google` = sağlayıcı.
  İstemci `js/config.js` → `schema = "site"`; `guvenlik` ve `google` tarayıcıya kapalı.

## Yetkiler (doğrulandı)

```sql
grant usage on schema site to anon, authenticated;
grant select (uye_no, gorunen_ad, avatar_url) on site.uyeler to anon;
grant select (uye_no, gorunen_ad, avatar_url, olusturma_at, guncelleme_at)
  on site.uyeler to authenticated;
grant execute on function site.benim_profil() to authenticated;
grant execute on function site.gorunen_ad_guncelle(text) to authenticated;
-- tabloda INSERT/UPDATE/DELETE yetkisi yok; kullanici_id hiçbir role açık değil
```

| Rol | `site` | `site.uyeler` | RPC |
|---|---|---|---|
| `anon` | kullanım var | select(no, ad, avatar) | yok |
| `authenticated` | kullanım var | select(+zamanlar), yazma yok | `benim_profil`, `gorunen_ad_guncelle` |
| `service_role` | kullanım var | tüm kolonlar select | yok |

| Rol | `guvenlik` |
|---|---|
| `anon`, `authenticated` | erişim yok (USAGE bile yok) |
| `service_role` | yalnız SELECT (panel) |

> PostgREST `public, graphql_public, guvenlik, site` yayınlıyor
> (`authenticator` rolü: `pgrst.db_schemas`). `google` bilinçli olarak kapalı.
> Bu ayar Dashboard'da görünmez; Dashboard > API > Exposed schemas
> kaydedilirse şemalar listeden düşebilir. Düşerse:
> `alter role authenticator set pgrst.db_schemas = 'public, graphql_public, guvenlik, site';`
> + `notify pgrst, 'reload config';`

## Google OAuth

- Supabase'de kayıtlı istemci: `801722049589-olteiisd8uck91d0ipeuauinjh1c8c2i`
  (**Web**) — 28.10.2026'da `/auth/v1/authorize` yanıtındaki `client_id` ile doğrulandı.
  Eski dokümandaki `...fjoevivd8f0gh...` kimliği artık kullanılmıyor.
- Google'daki yetkili dönüş adresi:
  `https://wshbwkgujaspnflnwnwx.supabase.co/auth/v1/callback`
  → 28.10.2026 kontrolü: Google bu adresi kabul ediyor (302, `redirect_uri_mismatch` yok).
- Masaüstü uygulamasının istemcisi (`...4e99e9rduh8...`) değişmedi.
- `site_url`: `https://klyzegg.vercel.app/`
- Allow list: `http://127.0.0.1:8000/**`, `https://klyze.gg/**`, `https://klyzegg.vercel.app/**`
- E-posta sağlayıcısı kapalı; giriş yalnızca Google.

> OAuth onay ekranı **"Testing"** modundaysa yalnızca test kullanıcıları giriş yapar.
> 1.000 kullanıcı için **"In production"** olmalı.

## Çalıştırma

Python 3.13 kurulu (kullanıcı kapsamı, `winget`):

```
python app.py --port 8000
# http://127.0.0.1:8000/giris.html
```

Port **8000** olmalı; Supabase allow list'inde yalnızca bu port var.

## Test listesi

1. `giris.html` → "Tekrar hoş geldin" + Google butonu.
2. Google girişi → geri dönüş → "Hesabın hazır" + üye no.
3. Sayfa yenilenir → oturum korunur.
4. "Profili aç" → `profil.html` → ad, üye no, tarihler dolu.
5. Adı değiştir → "Kaydet" → "Görünen ad kaydedildi." + başlık güncellenir.
6. Adı boşalt → "Kaydet" pasif, alan `aria-invalid="true"`.
7. Ana sayfa → girişliyken menüde "Profil" (masaüstü + mobil).
8. "Çıkış yap" → `giris.html`; oturum yokken `profil.html` → `giris.html`.
9. `?error=access_denied` → hata kartı, adres çubuğu temizlenir.

Doğrulama (headless Edge, 27.10.2026): 1, 3, 4, 5, 6, 7, 8, 9 geçti.
2 gerçek Google hesabıyla kullanıcı tarafından doğrulandı (üye #1000 göründü).

> Not: 4–6 testleri tarayıcıda sahte oturum + REST yanıtı taklidi ile koşuldu;
> gerçek JWT ile okuma/yazma RLS ve grant seviyesinde doğrulandı.

## Bilinmesi gerekenler

- Tarayıcıda yalnızca `sb_publishable_...` anahtarı var. `service_role` yok.
- Oturum `localStorage["klyze-site-auth"]` içinde tutulur.
- Çıkış `scope: "local"` → yalnızca bu tarayıcıyı kapatır, masaüstü oturumunu kapatmaz.
- `oturum.js` ağ isteği yapmaz; yalnızca localStorage'daki oturuma bakar.
- Profil sayfası oturumu Supabase ile doğrular; geçersizse `giris.html`'e yönlendirir.
- Site ikonları hâlâ fare imleci (`assets/favicon*.png`); gerçek logo bekleniyor.
