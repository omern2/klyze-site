# Supabase Güvenlik Denetimi — 26.10.2026

Proje: `wshbwkgujaspnflnwnwx` (Klyze.gg) — salt-okunur denetim.
Kapsam: `public` şeması (31 tablo, 71 policy), 12 fonksiyon, storage, grant'ler.
Satır verisi okunmadı; yalnız şema/policy/yetki metadata'sı ve anahtar adları incelendi.

## Durum: Uygulama tablolarına dokunulmayacak

Masaüstü uygulaması bu tablolardan okuyup yazıyor; şema/policy değişikliği uygulamayı kırar.
Site turunda yalnız **yeni site tabloları** açılacak. Aşağıdaki bulgular uygulama turuna ertelendi.

---

## Kritik (canlıda açık)

### C1 — `app_config` anon tarafından okunabiliyor
- Grant: `anon SELECT = true`
- Policy: `config_select_anon` → `USING (true)`
- Dolu anahtarlar (değerler yazılmadı): `henrikDevKey`, `canliGecmisKey`, `canliOyuncuKey`, `canliYedekKey`, `google_client_secret`, `google_client_id`
- Etki: publishable/anon anahtarına sahip herkes API anahtarlarını okuyabilir. Henrik kotası çalınabilir.
- Uygulama bu tablodan okuyor (`ProfileDataService.cs`, `GoogleAuthService.cs`) → düzeltmek uygulama değişikliği gerektirir.
- Doğru çözüm: anahtarları edge function env / Supabase Vault'a taşı, `app_config`'ten çıkar, sonra anahtarları **rotate et**.

### C2 — `google_users` içinde OAuth token'ları
- 124/124 satırda `access_token` ve `refresh_token` dolu.
- `google_users_select_own` kullanıcının kendi satırını (token'lar dahil) okumasına izin veriyor.
- Etki: XSS veya çalınmış oturum → Google hesap devralma.
- Çözüm: token kolonlarını kullanıcıya açık tablodan çıkar (server-only tablo), kolon bazlı grant kısıtla.

### C3 — `site_admins` davet ile yetki yükseltme
- `site_admins_insert_davet` yalnız davetin varlığını ve rolünün geçerli olduğunu kontrol ediyor;
  **NEW.rol ile davet rolünü karşılaştırmıyor.**
- Etki: `destek` daveti alan kişi kendini `sahip` olarak ekleyebilir.
- Ayrıca davet tek kullanımlık değil, son kullanma yok.
- Çözüm: `NEW.rol = d.rol` şartı, daveti kullanınca sil, süre ekle.

### C4 — Geniş UPDATE policy'leri
- `flow_update_auth`: `USING true WITH CHECK true` → her giriş yapmış kullanıcı her gönderiyi düzenler.
- `flow_comments_update_auth`: `USING true` → herkes her yorumu düzenler.
- `lobbies` "Users can update lobbies": `auth.role() = 'authenticated'` → herkes her lobiyi değiştirir;
  `lobbies_update_own` policy'sini etkisiz bırakıyor.
- Çözüm: geniş policy'leri sil, sahiplik kontrolüne bağla.

### C5 — Destek dosyaları bucket'ı public
- Bucket: `destek-dosyalari`, `public = true`, 25 MiB, 1 dosya.
- Policy: `destek_dosya_select_all` → `USING (bucket_id = 'destek-dosyalari')` (herkese açık listeleme/okuma).
- INSERT policy yalnız `auth.role() = 'authenticated'`; yol sahipliği kontrolü yok.
- Etki: destek ekran görüntüleri (kişisel veri içerebilir) herkese açık.
- Çözüm: bucket private, SELECT policy kaldır, signed URL, yükleme yolu `auth.uid()/...`.

---

## Orta

### M1 — anon'a açık SECURITY DEFINER fonksiyonlar
`dokun_talep_updated_at`, `is_admin`, `is_sahip`, `koru_son_sahip`, `refresh_elo`,
`rls_auto_enable`, `talebi_coz`, `talebi_devret`, `talebi_ustlen`
- Gövdeler yetki kontrolü yapıyor (talebi_* → `is_admin`/`is_sahip`, refresh_elo → `auth.uid = p_uid`).
- Yine de anon EXECUTE gereksiz; saldırı yüzeyi.
- Dikkat: `site_reviews_insert_all` policy'si `is_admin()` çağırıyor; `is_admin` anon'dan tamamen
  kaldırılırsa anonim yorum gönderimi hata verir. Policy yeniden yazılmalı.

### M2 — İstemciye güvenen ELO yazımı
- `active_users_update_own` ve `refresh_elo` kullanıcının kendi `elo/tier/rr` değerini serbestçe yazmasına izin veriyor.
- Etki: liderlik tablosu manipüle edilebilir.
- Çözüm: yazımı doğrulayan edge function'a taşı veya değerleri sunucuda hesapla.

### M3 — Lobi RPC'leri kimlik doğrulamıyor
- `join_lobby` / `leave_lobby` isim+tag ile çalışıyor; oturum sahibiyle bağ yok.
- Etki: başkası adına lobiye girme, başkasını lobiden atma, son oyuncuyu çıkarıp lobiyi silme.
- Çözüm: `auth.uid()` ile eşleşen oyuncu kaydı zorunlu.

### M4 — `sifre` tablosu (8 satır, key/value)
- API'ye kapalı (grant yok, RLS açık, policy yok) → dışarıdan okunamıyor.
- Ancak düz metin/legacy şifre saklıyor olabilir; incelenmeli ve kaldırılmalı.
- Yeni site tablolarında şifre saklanmayacak; Supabase Auth kullanılacak.

### M5 — Public SELECT ile açık veriler
- `bans`: puuid + ban sebebi herkese açık.
- `active_users`: 195 kullanıcının puuid/elo/rank bilgisi herkese açık (liderlik için kısmen gerekli).
- `hileci_kayitlari`: herkese açık (amaç buysa kabul).
- Çözüm: gerekiyorsa view ile yalnız gerekli kolonlar.

---

## Düşük

- `rls_auto_enable`, `dokun_talep_updated_at`, `sync_lobby_mevcut` trigger fonksiyonları;
  `sync_lobby_mevcut` search_path sabitlenmemiş (advisor bulgusu).
- `Klyze` tablosu boş/amaçsız, RLS policy yok; silinebilir.
- `public` şemasında anon/authenticated CREATE yok (search_path hijack riski düşük) — doğrulandı.
- `pg_default_acl`: anon/authenticated'a yeni tablolarda tam yetki veriyor (Supabase legacy varsayılanı).
  Yeni tablolarda grant'ler açıkça kısıtlanmalı.

---

## Site turunda uygulanacak kurallar

1. Her yeni tabloda `ENABLE` + `FORCE ROW LEVEL SECURITY`, varsayılan **deny**.
2. `anon`: yalnız gerekli INSERT (form) ve public içerik SELECT; UPDATE/DELETE yok.
3. `authenticated`: yalnız sahip olduğu satırda SELECT/INSERT/UPDATE.
4. Secret (API anahtarı, OAuth token, şifre) site tablolarında **tutulmaz**.
5. Şifre: Supabase Auth (bcrypt); kendi şifre tablosu yok.
6. Dosya: private bucket, `auth.uid()/uuid` yolu, signed URL, MIME/boyut limiti.
7. `SECURITY DEFINER` zorunlu değilse kullanılmaz; kullanılırsa `search_path` sabit + anon EXECUTE revoke.
8. Yazma yapan RPC'lerde kimlik `auth.uid()` ile bağlanır; istemciden gelen uid/isim yetki sayılmaz.
9. Rate limit: aynı kullanıcı/IP için `created_at` aralığı kontrolü veya edge function.
10. Admin işlemleri `site_denetim_kaydi`'na yazılır.
