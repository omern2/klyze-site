# Roller ve destek paneli yetkisi

> Durum: kod tamam, canlı DB'ye `sql/027` + `sql/028` uygulanmayı bekliyor.
> İlgili plan: `docs/plan-destek-rol.md`

## İki rol var

| Rol | Anlamı | Nasıl verilir |
|---|---|---|
| `uye` | Her kayıtlı kullanıcı. Bilet açar, kendi biletini görür. | Kayıt olunca otomatik (`site_private.uye_rol_ata`). |
| `destek` | Üyenin üstüne eklenen ekip rolü. Panel + tüm biletler. | Yalnız SQL / service_role: `guvenlik.destek_ver(...)`. |

- Üçüncü bir `sahip/admin/moderator` rolü **yok**. `024` bunları kaldırdı.
- Roller eklenir, birbirini silmez: destek olan kişi `uye` kalır.
- Panelde rol atama ekranı **yok**. Olsaydı ya üçüncü bir "sahip" rolü ya da koda gömülü bir e-posta gerekirdi; ikisi de yetki yükseltme riski taşır.

## Tek karar zinciri

```
Google oturumu        → auth.users.id        (kim?)
guvenlik.roller       → 'uye' / 'destek'     (ne?)
destek.ekip_mi()      → boolean              (kapı)
destek.* RPC          → yetki kontrolü       (veri)
```

- İstemci rolü **localStorage veya JWT içinden okumaz**. JWT yalnız "kim" sorusunu cevaplar.
- Ana sayfa başlığında role göre bağlantı **yoktur**. Giriş noktası Destek bölümüdür: `Destek oluştur` → `bilet.html` → `Bilet Oluştur` / `Biletlerim` sekmeleri. `destek` kullanıcısı aynı sayfada `Destek paneli` sekmesini görür.
- `ekip.html` doğrudan açılsa bile veri gelmez: `ekip_biletler`, `ekip_sayilar`, diğer biletlerin `bilet_detay` / `bilet_mesaj_gonder` / `bilet_durum_degistir` çağrıları sunucuda `ekip_mi()` ile reddedilir (`42501`).
- `ekip.html` statik kabuğunda hassas veri yoktur; veri yalnız RPC'den gelir.

## Rol verme / alma

Dosya: `sql/027-rol-yonetimi.sql`

```sql
-- Vermek (idempotent)
select guvenlik.destek_ver('ornek@gmail.com');

-- Almak (son destek üyesini korur)
select guvenlik.destek_al('ornek@gmail.com');
```

- Fonksiyonlar `SECURITY DEFINER`; yalnız `service_role` çalıştırabilir. `anon` / `authenticated` çağıramaz.
- Her değişiklik `guvenlik.denetim` tablosuna yazılır (`rol.destek_ver` / `rol.destek_al`).
- E-posta `auth.users` + `guvenlik.uyeler` birleşiminden çözülür; üye olmayan hesaba rol verilmez.
- Son `destek` üyesi kaldırılamaz; panel kilitli kalmasın.

Kontrol:

```sql
select u.email, r.rol
  from guvenlik.roller r
  join auth.users u on u.id = r.kullanici_id
 where r.rol = 'destek'
 order by u.email;
```

## Durum geçmişi

Dosya: `sql/028-bilet-durum-gecmisi.sql`

Tablo: `destek.bilet_durum_gecmisi`

| Kolon | Anlam |
|---|---|
| `bilet_id` | Hangi bilet (`on delete cascade`). |
| `eski_durum` | Önceki durum; ilk kayıtta null olabilir. |
| `yeni_durum` | Yeni durum. |
| `yapan_id` | İşlemi yapan oturum (`auth.uid()`); oturumsuzsa null. |
| `yapan_tip` | `kullanici` (bilet sahibi), `ekip` (destek rolü), `sistem` (SQL/bakım). |
| `olusturma_at` | Zaman damgası. |

- Trigger: `bilet_durum_gecmisi`, `after update of durum on destek.biletler`.
- Durum gerçekten değişmediyse satır yazılmaz.
- Tablo istemciye kapalı: RLS açık, politika yok, `anon/authenticated` yetkisi yok. Şimdilik yalnız `service_role` okur.
- Mesajlar zaten `destek.mesajlar` içinde `yazan_tip`, `yazan_id`, `olusturma_at` ile tutuluyor; ayrıca geçmiş tablosu gerekmiyor.

Kontrol:

```sql
select g.*, d.talep_no
  from destek.bilet_durum_gecmisi g
  join destek.biletler d on d.id = g.bilet_id
 order by g.id desc
 limit 20;
```

## Site davranışı

| Nerede | Misafir | `uye` | `destek` |
|---|---|---|---|
| Ana sayfa başlığı | `Giriş` | `Giriş` | `Giriş` |
| Ana sayfa → Destek | `Destek oluştur` | aynı | aynı |
| `bilet.html` sekmeleri | kapı | Form + Biletlerim | Form + Biletlerim + Destek paneli |
| `bilet.html` hesap satırı | kapı | ad + Çıkış | ad + Çıkış |
| `ekip.html` | giriş kapısı | "destek rolü yok" kapısı | panel |

- Ana sayfa Supabase SDK'sını yüklemez; girişsiz ziyaretçiye ek 213 KB indirmez.
- Rol kararı yalnız `bilet.html` / `ekip.html` içinde, sunucudaki `destek.ekip_mi()` ile verilir. Panel sekmesi yalnız `destek` rolünde açılır; RPC hata verirse gizli kalır (fail-closed).
- `bilet.html?gorunum=liste` doğrudan "Biletlerim" açar. Giriş kapısındaki bağlantı bu parametreyi korur.

## Test listesi

| Senaryo | Beklenen |
|---|---|
| Girişsiz ana sayfa | Yalnız `Giriş`; başlıkta `Biletlerim` / panel yok; ağda Supabase SDK isteği yok. |
| Girişli ana sayfa | Görünüm değişmez; ana sayfa SDK yüklemez. |
| `destek` → `bilet.html` | Sekmelerde `Destek paneli` görünür; hesap satırında yalnız ad + Çıkış. |
| `uye` → `ekip.html` | "Hesabında destek rolü yok" kapısı; ağda veri yok. |
| `uye` → `ekip.html` + JS ile `ekipUygulama.hidden=false` | Kabuk görünür ama RPC'ler `42501`; bilet verisi gelmez. |
| Girişsiz → `bilet.html?gorunum=liste` | Giriş kapısı; giriş sonrası Biletlerim açılır. |
| `destek` → bilet yanıtı | Mesaj `yazan_tip='ekip'`, durum `beklemede`. |
| `destek` → bilet kapat/aç | `destek.bilet_durum_gecmisi` satırı: `yapan_tip='ekip'`. |
| `uye` → kendi biletini kapat | Geçmiş satırı: `yapan_tip='kullanici'`. |
| `destek` rolü alınmış oturum panelde | Bir sonraki RPC `42501`; istemci kapıya döner. |
