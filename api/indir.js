/* Klyze.gg — /indir  →  son sürümü indirir.
 *
 * Ne yapar:
 *   1. Veritabanına sorar: "yayındaki son sürüm ne?"
 *   2. Hash'i (sha256) geçerli değilse İNDİRMEZ. 503 döner.
 *   3. Geçerliyse tarayıcıyı dosyanın kendisine yönlendirir (302).
 *
 * Neden yönlendirme, neden dosyayı buradan servis etmiyoruz:
 *   Vercel Hobby tek dosya yükleme sınırı 100 MB, dosya 246 MB.
 *   Yönlendirme ile tarayıcı dosyayı GitHub'dan çeker; kullanıcı
 *   GitHub sayfası GÖRMEZ, indirme anında başlar. Trafik 0 TL.
 *
 * Sır yok: burada yalnız "publishable" anahtar var (tarayıcıda da görünür).
 */

const SUPABASE_URL = "https://wshbwkgujaspnflnwnwx.supabase.co";
const PUBLISHABLE = "sb_publishable_1_eY31wnWDkYY6DQ6masNw_IQZpm5Gi";
const HASH_KURALI = /^[0-9a-f]{64}$/;

async function sonSurum() {
  const yanit = await fetch(`${SUPABASE_URL}/rest/v1/rpc/son_surum`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE,
      Authorization: `Bearer ${PUBLISHABLE}`,
      "Content-Type": "application/json",
      "Accept-Profile": "site",
      "Content-Profile": "site"
    },
    body: "{}"
  });

  if (!yanit.ok) {
    throw new Error(`veritabani ${yanit.status}`);
  }

  const govde = await yanit.json();
  const satir = Array.isArray(govde) ? govde[0] : govde;
  if (!satir) {
    throw new Error("yayinda surum yok");
  }
  return satir;
}

module.exports = async function handler(istek, yanit) {
  yanit.setHeader("Cache-Control", "no-store, max-age=0");
  yanit.setHeader("X-Robots-Tag", "noindex");

  if (istek.method !== "GET" && istek.method !== "HEAD") {
    yanit.setHeader("Allow", "GET, HEAD");
    yanit.status(405).json({ hata: "Yalnizca GET." });
    return;
  }

  let surum;
  try {
    surum = await sonSurum();
  } catch (hata) {
    yanit.status(503).json({ hata: "Indirme su an kullanilamiyor. Birazdan tekrar dene." });
    return;
  }

  // Mühür: hash yoksa veya bozuksa indirme yok.
  if (!surum.sha256 || !HASH_KURALI.test(surum.sha256)) {
    yanit.status(503).json({ hata: "Dogrulanmamis surum indirilemez." });
    return;
  }

  if (!surum.indirme_adresi || !/^https:\/\//.test(surum.indirme_adresi)) {
    yanit.status(503).json({ hata: "Indirme adresi tanimli degil." });
    return;
  }

  yanit.setHeader("X-Klyze-Surum", String(surum.surum));
  yanit.setHeader("X-Klyze-Sha256", String(surum.sha256));
  yanit.statusCode = 302;
  yanit.setHeader("Location", surum.indirme_adresi);
  yanit.end();
};
