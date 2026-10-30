/* Klyze.gg — Supabase baglanti ayarlari (tek kaynak).
   Buradaki anahtar "publishable": tarayicida gorunmesi tasarim geregi.
   service_role / sb_secret_* ASLA bu dosyaya girmez; girerse asagidaki
   kontrol hata firlatir ve sayfa giris yapmaz. */
(() => {
  "use strict";

  const url = "https://wshbwkgujaspnflnwnwx.supabase.co";
  const key = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";

  /* Site verisi `site` semasinda: görünen ad, avatar, üye no, liderlik köprüsü.
     `kullanicilar`, `depolama` ve `guvenlik` şemaları tarayıcıya kapalıdır;
     buralara yalnız `site` içindeki security definer fonksiyonlarla erişilir.
     PostgREST: pgrst.db_schemas = public, graphql_public, site */
  const schema = "site";

  if (!/^https:\/\/[a-z0-9-]{10,}\.supabase\.co$/.test(url)) {
    throw new Error("Klyze: Supabase URL gecersiz.");
  }
  if (/^sb_secret_/.test(key) || key.startsWith("eyJ")) {
    throw new Error("Klyze: bu dosyada yalnizca publishable anahtar durabilir.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) {
    throw new Error("Klyze: publishable anahtar formati gecersiz.");
  }

  window.KLYZE_SUPABASE = Object.freeze({ url, key, schema });
})();
