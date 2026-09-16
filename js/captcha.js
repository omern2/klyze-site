// Klyze.gg — paylasilan gorunmez dogrulama + guvenli yazma hatti.
// Kullanim: once token coz (sessiz), sonra FUNCTIE'ye gonder.
// Dogrulama + kayit SUNUCUDA (verify-captcha edge fonksiyonu) olur;
// tarayici yalnizca tasiyicidir. Direkt tablo yazimi kapali olmalidir (SQL 13).
window.KlyzeCaptcha = (function () {
  var SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
  var SUPABASE_ANON = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
  var SITEKEY = "2a5ee000-3866-4322-9dee-b0f83d2aeae8";
  // Edge fonksiyon URL'i deploy sonrasi yazilir:
  var FONKSIYON_URL = "https://wshbwkgujaspnflnwnwx.supabase.co/functions/v1/verify-captcha";

  var sb = null;
  function client() {
    if (sb) return sb;
    if (!window.supabase) return null;
    try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
    catch (e) { return null; }
    return sb;
  }

  var wid = null, bekleyen = null, kutuHazir = false;
  function kutu() {
    var d = document.getElementById("klyzeCapGizli");
    if (!d) {
      d = document.createElement("div");
      d.id = "klyzeCapGizli";
      d.setAttribute("aria-hidden", "true");
      d.style.cssText = "position:fixed;left:-9999px;top:0;width:304px;height:78px;";
      document.body.appendChild(d);
    }
    return d;
  }
  // Gorunur yedek: invisible desteklenmezse kullaniciya goster
  function kutuyuGoster() {
    var d = kutu();
    d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;"
      + "background:#0b0b0b;border:1px solid #3a3a3a;border-radius:12px;padding:14px;"
      + "box-shadow:0 24px 60px rgba(0,0,0,0.6);";
  }
  function kutuyuGizle() {
    var d = document.getElementById("klyzeCapGizli");
    if (d) d.style.cssText = "position:fixed;left:-9999px;top:0;width:304px;height:78px;";
  }

  // Gorunmez coz: basarida token, hata/zaman asiminda reject.
  function coz() {
    return new Promise(function (cozuldu, reddet) {
      if (!window.hcaptcha) { reddet(new Error("dogrulama yuklenemedi")); return; }
      if (bekleyen) { reddet(new Error("zaten cozuluyor")); return; }
      var kilit = setTimeout(function () {
        bekleyen = null;
        reddet(new Error("dogrulama zaman asimi"));
      }, 25000);
      bekleyen = { coz: cozuldu, red: reddet, kilit: kilit };
      try {
        kutu();
        if (wid === null) {
          wid = window.hcaptcha.render("klyzeCapGizli", {
            sitekey: SITEKEY,
            size: "invisible",
            callback: function (tok) { bitir(null, tok); },
            "error-callback": function () {
              // invisible desteklenmiyorsa gorunur kutuya gec
              try {
                kutuyuGoster();
                if (wid !== null) { try { window.hcaptcha.remove(wid); } catch (e) {} wid = null; }
                wid = window.hcaptcha.render("klyzeCapGizli", {
                  sitekey: SITEKEY, theme: "dark",
                  callback: function (tok2) { kutuyuGizle(); bitir(null, tok2); }
                });
              } catch (e2) { bitir(new Error("dogrulama baslatilamadi")); }
            },
            "expired-callback": function () { bitir(new Error("sure doldu, tekrar dene")); }
          });
        }
        window.hcaptcha.execute(wid);
      } catch (e) { bitir(e && e.message ? new Error(e.message) : new Error("hata")); }
    });
    function bitir(hata, tok) {
      if (!bekleyen) return;
      clearTimeout(bekleyen.kilit);
      var b = bekleyen;
      bekleyen = null;
      try { window.hcaptcha.reset(wid); } catch (e) {}
      if (hata) b.red(hata instanceof Error ? hata : new Error(String(hata)));
      else b.coz(tok);
    }
  }

  // Guvenli yazma: token + kullanici JWT ile fonksiyona gonder.
  function yaz(govde) {
    var c = client();
    if (!c) return Promise.reject(new Error("baglanti yok"));
    return c.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s) throw new Error("giris gerekli");
      return coz().then(function (tok) {
        govde.token = tok;
        return fetch(FONKSIYON_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + s.access_token,
            "apikey": SUPABASE_ANON
          },
          body: JSON.stringify(govde)
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok) throw new Error((j && j.error) || ("kaydedilemedi (" + r.status + ")"));
            return j;
          });
        });
      });
    });
  }

  return { coz: coz, yaz: yaz };
})();
