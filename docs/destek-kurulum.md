# Destek sistemi — kurulum, işleyiş ve sınırlar

Son güncelleme: 04.11.2026

> **Güncel durum (04.11.2026):** Destek tabloları ve RPC'leri `026` ile
> `site` şemasından `destek` şemasına taşındı. Rol yönetimi `027`, durum
> geçmişi `028` ile eklendi. Bu belgedeki `site.destek*` / `site.ekip_mi`
> adları tarihseldir; güncel adlar `destek.*`. Rol mimarisi için
> `docs/roller.md` dosyasına bak.

Bu belge, sitedeki destek biletlerinin gerçek backend'e bağlanması için
gereken adımları ve bilinen sınırları anlatır. **SQL dosyası bu depoda
hazırlandı ancak canlı veritabanına uygulanmadı.** Aşağıdaki adımlar
tamamlanmadan `bilet.html` ve `ekip.html` veri gösteremez.

## 1. Ön koşullar

- `site.uyeler` ve `site.benim_profil()` kurulu olmalı (`sql/008`, `sql/009`).
- `guvenlik.roller` tablosu ve roller (`uye`, `destek`) mevcut olmalı
  (`sql/011`, `sql/024`).
- Supabase'de `storage` şeması erişilebilir olmalı.

## 2. SQL'i uygula

> **Canlıda 023 ve 026 uygulandı; `023-destek.sql` dosyasını tekrar
> çalıştırma.** Yeni bir ortamda sıra: `023` → `026` → `027` → `028`.
> 026 tek seferlik taşıma olduğu için idempotent değildir.

Supabase Dashboard → SQL Editor → `sql/023-destek.sql` dosyasının tamamını
tek seferde çalıştır. Dosya `begin; … commit;` içindedir; hata olursa
hiçbir değişiklik kalmaz.

Oluşanlar:

| Nesne | Görev |
|---|---|
| `site.destek` | Bilet başlığı, durum, talep no |
| `site.destek_mesajlari` | Kullanıcı / ekip / sistem mesajları |
| `site.destek_ekleri` | Mesaja bağlı dosya meta verisi |
| `site.destek_no_seq` + `site_private.destek_kodu()` | `KLY-XXXXXX` üretimi |
| `site.benim_biletler()` | Kullanıcının bilet listesi |
| `site.bilet_detay()` | Bilet + mesajlar + ekler (JSON) |
| `site.bilet_olustur()` | Yeni bilet, doğrulama + hız sınırı |
| `site.bilet_mesaj_gonder()` | Mesaj + ek, durum geçişi |
| `site.bilet_durum_degistir()` | Aç / beklemede / kapat |
| `site.ekip_mi()` | `sahip/admin/moderator/destek` kontrolü |
| `site.ekip_biletler()` | Ekip gelen kutusu, arama + sayfalama |
| `site.ekip_sayilar()` | Durum sayaçları |
| `storage.buckets('destek')` | Özel bucket, 5 MB, MIME listesi |
| `storage.objects` politikaları | Yükle / oku / sil |

Doğrulama sorguları dosyanın sonunda yorum olarak duruyor. Özellikle şunları
kontrol et:

```sql
select site_private.destek_kodu(1);        -- KLY-000001
select site_private.destek_kodu(1073741823); -- KLY-ZZZZZZ
select site.ekip_mi();                     -- girişli ekip hesabında true
```

`site_private` şeması istemciye kapalıdır; `destek_kodu()` yalnız sunucuda
varsayılan değer üretirken çalışır.

## 3. Google girişini aç

1. Google Cloud Console → APIs & Services → Credentials → kullanılan **Web**
   istemcisi.
2. **Authorized redirect URIs** listesine ekle:
   `https://wshbwkgujaspnflnwnwx.supabase.co/auth/v1/callback`
3. Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://klyzegg.vercel.app/`
   - Redirect URLs: `http://127.0.0.1:8000/**`,
     `https://klyzegg.vercel.app/**`
4. Authentication → Providers → Google: Web istemcisinin Client ID/Secret
   değerleri girili olmalı.
5. OAuth consent screen **In production** olmalı; Testing modunda yalnız test
   kullanıcıları girer.

> Masaüstü uygulaması ayrı bir Google istemcisi kullanıyorsa Supabase'in tek
> istemci kabul etmesi nedeniyle uygulama `Unacceptable audience` alabilir.
> Bu durumda masaüstü ve site girişi aynı anda çalışmaz; köprü veya istemci
> birleştirmesi gerekir. Ayrıntı: `docs/giris-kurulum.md`.

## 4. Ekip rolü ver

Ekip paneli yalnız `destek` rolüne açılır. `uye` destek ekibi sayılmaz.
Rol ataması arayüzde yok; `027` ile gelen yardımcı SQL fonksiyonu kullanılır:

```sql
-- E-posta, auth.users + guvenlik.uyeler içinde kayıtlı olmalı.
select guvenlik.destek_ver('ornek@gmail.com');
select guvenlik.destek_al('ornek@gmail.com');  -- son destek üyesini korur
```

Bu fonksiyonlar yalnız `service_role` tarafından çalıştırılabilir; her
değişiklik `guvenlik.denetim` tablosuna yazılır. Rolü alınan kullanıcı bir
sonraki istekte yetkisiz sayılır: `destek.ekip_mi()` her istekte
`guvenlik.roller` tablosunu okur, oturum önbelleğine güvenmez.

## 5. Durum modeli

| Durum | Anlamı | Kim değiştirir |
|---|---|---|
| `acik` | Yeni bilet veya kullanıcı yanıtı | Kullanıcı, ekip |
| `beklemede` | Ekip yanıtladı, kullanıcıdan yanıt bekleniyor | Ekip |
| `kapali` | Bilet kapandı | Kullanıcı, ekip |

- Kullanıcı mesajı bileti `acik` yapar.
- Ekip mesajı bileti `beklemede` yapar.
- Kullanıcı kapalı bileti yeniden açabilir.
- Kapalı bilete mesaj gönderilemez; önce açılmalı.
- Kullanıcı `beklemede` seçemez (sunucu `42501` döner).

## 6. Ekler

- Bir mesaja en fazla **3** dosya; dosya başına **5 MB**.
- İzinli türler: JPEG, PNG, WebP, PDF, düz metin (`.txt`, `.log`), ZIP.
- Bucket **private**; okuma için 1 saatlik imzalı URL üretilir.
- Yol biçimi `auth.uid()/uuid.ext`; kullanıcı yalnız kendi klasörüne yükler.
- Mesaj RPC'si dosyanın gerçekten yüklendiğini, boyutunu ve MIME türünü
  `storage.objects` üzerinden doğrular. İstemcinin bildirdiği boyuta güvenmez.
- Yükleme başarılı olup mesaj RPC'si başarısız olursa istemci dosyayı silmeye
  çalışır. Sekme kapanırsa yetim dosya kalabilir; temizlik işi henüz yok.

## 7. Hız sınırları

- Kullanıcı başına 24 saatte **10 bilet**.
- Aynı anda en fazla **5** açık/bekleyen bilet.
- Hesap başına 5 dakikada en fazla **40 mesaj** (ekip ve kullanıcı dahil).
- Aynı mesaja en fazla 3 ek.

## 8. Test listesi (canlı SQL sonrası)

Girişsiz:

1. `bilet.html` → "Bilet açmak için giriş yap"; form görünmez.
2. `ekip.html` → "Ekip girişi gerekiyor".

Kullanıcı:

3. Google ile giriş → `bilet.html` → form açılır, hesap adı görünür.
4. Bilet oluştur → `KLY-XXXXXX` detay açılır; listede görünür.
5. Sayfayı yenile → bilet ve mesajlar korunur.
6. Mesaj yaz → gönder → balon eklenir; durum `Açık`.
7. Resim/PDF ekle → önizleme → gönder → ek kartı görünür, indirilir.
8. Mesajı yalnız ekle gönder → metinsiz balon + ek.
9. Bileti kapat → yazı kutusu kapanır; "Yeniden aç" çalışır.
10. Başka hesapla giriş → aynı bilet no'yu açamaz.

Ekip:

11. Ekip rolü olmayan hesap → "Bu sayfa yalnız destek ekibi için".
12. Ekip hesabı → gelen kutusu, sayaçlar, arama, filtre.
13. Bilet aç → yanıtla → durum `Beklemede`; kullanıcıya yansır.
14. Durumu `Kapalı` yap → kullanıcı yanıt gönderemez.
15. Ekip ekranı 390 px genişlikte → liste → detay → geri akışı.

Yetki:

16. `anon` anahtarıyla `site.destek` tablosunu okumayı dene → izin yok.
17. Başka kullanıcının bilet no'suyla `bilet_detay` → "Bilet bulunamadı".
18. `site.ekip_biletler()` ekip olmayan hesapla → `42501`.

## 9. Geri alma

`sql/023-geri-alma.sql`: RPC'leri, tabloları, sırayı ve storage
politikalarını kaldırır. Bucket yalnız boşsa silinir. **Biletler ve mesajlar
silinir; önce yedek al.** Dosyalar bucket'ta kalırsa komut yalnız uyarı verir.

## 10. Bilinen eksikler / riskler

- SQL canlıda çalıştırılmadı; şema, RLS ve RPC'ler gerçek veritabanında
  doğrulanmadı.
- Google dönüş adresi eklenmeden giriş çalışmaz.
- Gerçek zamanlı değil: kullanıcı 20 sn, ekip 25 sn'de bir yoklar.
- E-posta/bildirim yok; kullanıcı yanıtı görmek için sayfayı açmalı.
- Ekip ataması, iç not, etiket ve okunmadı sayaçı yok.
- Uzun biletlerde mesaj sayısı sınırsız; `bilet_detay` tüm mesajları döndürür.
- Yetim dosya temizliği yok.
- `site.destek` üzerinde `service_role` select var; panel/otomasyon ileride
  kullanabilir. Bu rol tarayıcıya verilmemeli.
