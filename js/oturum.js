/* Klyze.gg — ana sayfada oturum izi.
   Agir SDK yuklemeden yalnizca localStorage'daki oturumu okur.
   Suresi dolmus ve yenilenemeyecek oturumda "Giriş Yap" kalir;
   profil.html gercek dogrulamayi kendisi yapar. */
(() => {
  "use strict";

  const KEY = "klyze-site-auth";

  function hasSession() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return false; }
    if (!raw) return false;

    let data = null;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (!data || typeof data !== "object") return false;
    if (!data.access_token || !data.user) return false;

    const expiresAt = Number(data.expires_at);
    const expired = Number.isFinite(expiresAt) && expiresAt * 1000 <= Date.now();
    if (expired && !data.refresh_token) return false;
    return true;
  }

  if (!hasSession()) return;

  const links = document.querySelectorAll("a.login, a.m-login");
  for (const link of links) {
    link.textContent = "Profil";
    link.href = "profil.html";
    link.setAttribute("aria-label", "Profilini aç");
  }
})();
