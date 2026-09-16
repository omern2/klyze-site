// Klyze.gg — verify-captcha edge fonksiyonu (Deno).
// On yuzdeki hCaptcha kutusu isaretlenmeden gonderim yapilmaz; GERCEK
// dogrulama burada olur: token hCaptcha'ya sorulur, gecerse kayit yazilir.
// KURULUM (2 dk, Supabase Dashboard):
//   1) Edge Functions > New Function > adi: verify-captcha > bu dosyayi yapistir > Deploy
//   2) Ayni fonksiyonun Secrets/Env ayarlarina ekle:
//        HCAPTCHA_SECRET = <hCaptcha gizli anahtarin>
//        HCAPTCHA_SITEKEY = 2a5ee000-3866-4322-9dee-b0f83d2aeae8
//   3) Deploy URL'ini (https://<proje>.supabase.co/functions/v1/verify-captcha)
//      bana ver, on yuzu ona baglayayim.
// NOT: gizli anahtar ASLA site dosyalarina konmaz, sadece burada env'de durur.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SECRET = Deno.env.get("HCAPTCHA_SECRET") || "";
const SITEKEY = Deno.env.get("HCAPTCHA_SITEKEY") || "";
const KORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

async function captchaGecerli(token: string): Promise<boolean> {
  if (!SECRET || !token) return false;
  const govde = new URLSearchParams({ secret: SECRET, response: token });
  if (SITEKEY) govde.set("sitekey", SITEKEY);
  const r = await fetch("https://api.hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: govde.toString(),
  });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: KORS });
  try {
    const govde = await req.json();
    const ok = await captchaGecerli(String(govde.token || ""));
    if (!ok) {
      return new Response(JSON.stringify({ error: "captcha dogrulanamadi" }), { status: 400, headers: KORS });
    }
    // Kullaniciyi JWT'den coz (anon islem yok)
    const supaAuth = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "giris gerekli" }), { status: 401, headers: KORS });
    }
    // Yazma: service_role ile (RLS bypass, dogrulama zaten yapildi)
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    if (govde.tip === "yorum") {
      const { data, error } = await supa.from("site_reviews").insert({
        name: String(user.user_metadata?.full_name || user.user_metadata?.name || "Oyuncu").slice(0, 24),
        stars: Math.min(5, Math.max(1, Number(govde.stars) || 5)),
        text: String(govde.text || "").slice(0, 400),
        avatar_url: String(user.user_metadata?.avatar_url || user.user_metadata?.picture || "").slice(0, 500) || null,
        rol: "user",
        lang: govde.lang === "en" ? "en" : "tr",
      }).select("id").single();
      if (error) throw error;
      return new Response(JSON.stringify({ id: data.id }), { headers: KORS });
    }
    // Varsayilan: destek talebi
    const { data, error } = await supa.from("destek_talepleri").insert({
      user_id: user.id,
      name: String(user.user_metadata?.full_name || user.user_metadata?.name || "Oyuncu").slice(0, 24),
      email: String(user.email || "").slice(0, 120),
      avatar_url: String(user.user_metadata?.avatar_url || user.user_metadata?.picture || "").slice(0, 500) || null,
      kategori: ["teknik", "hesap", "oneri", "diger"].includes(govde.kategori) ? govde.kategori : "diger",
      oncelik: ["dusuk", "normal", "yuksek"].includes(govde.oncelik) ? govde.oncelik : "normal",
      konu: String(govde.konu || "").slice(0, 80),
      aciklama: String(govde.aciklama || "").slice(0, 2000),
      dosyalar: Array.isArray(govde.dosyalar) ? govde.dosyalar.slice(0, 3) : [],
    }).select("id").single();
    if (error) throw error;
    return new Response(JSON.stringify({ id: data.id }), { headers: KORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: KORS });
  }
});
