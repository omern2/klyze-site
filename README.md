# Klyze.gg — site

Klyze masaüstü uygulamasının tanıtım, indirme ve destek sitesi.

- **Canlı:** https://klyzegg.vercel.app
- **İndirme:** https://github.com/omern2/klyze-releases

## Sayfalar

| Dosya | Adres | Görev |
|---|---|---|
| `index.html` | `/` | Tek sayfa tanıtım: özellikler, liderlik, yenilikler, destek, kurulum |
| `bilet.html` | `/bilet` | Destek bileti oluşturma ve bilet geçmişi |
| `ekip.html` | `/ekip` | Destek ekibi paneli (yalnız `destek` rolü, sunucuda doğrulanır) |
| `giris.html` | `/giris` | Google ile giriş |
| `profil.html` | `/profil` | Geçici olarak kapalı |

## Yerel çalıştırma

```bash
python app.py --port 8000
```

Ardından http://127.0.0.1:8000

## Yapı

- `css/style.css` — ana tasarım; `css/bilet.css`, `css/ekip.css` sayfaya özel.
- `js/config.js` — yalnız `sb_publishable_...` anahtarı; gizli anahtar tarayıcıya girmez.
- `js/destek-api.js` — `destek` şemasındaki RPC'ler ve dosya yükleme.
- `sql/` (üst dizin) — veritabanı geçişleri.

## Yayına alma

```bash
vercel deploy --prod
```

`vercel.json` temiz URL, güvenlik başlıkları ve eski adreslerin yönlendirmelerini içerir.
