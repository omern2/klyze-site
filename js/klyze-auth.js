/* Klyze.gg — site auth ortak katmani.
   giris.js ve profil.js ayni yardimcilari buradan alir.
   Bu dosya HICBIR tabloya yazmaz. */
(() => {
  "use strict";

  const MESSAGES = {
    access_denied: "Giriş iptal edildi. Hazır olduğunda tekrar deneyebilirsin.",
    redirect_uri_mismatch:
      "Google yönlendirme adresi tanımlı değil. Site yöneticisinin Google Cloud'da Web uygulaması istemcisi oluşturması gerekiyor.",
    invalid_request: "Giriş isteği geçersiz. Sayfayı yenileyip tekrar dene.",
    server_error: "Sunucuda geçici bir hata oluştu. Birkaç dakika sonra tekrar dene.",
    temporarily_unavailable: "Sunucu şu an meşgul. Birazdan tekrar dene.",
    otp_expired: "Giriş bağlantısının süresi dolmuş. Yeniden giriş yap.",
    flow_state_not_found: "Giriş oturumu bulunamadı. Bu sayfadan tekrar giriş yap.",
    flow_state_expired: "Giriş oturumunun süresi doldu. Bu sayfadan tekrar giriş yap.",
    bad_code_verifier: "Giriş doğrulaması eşleşmedi. Bu sayfadan tekrar giriş yap.",
    invalid_credentials: "Kimlik bilgileri doğrulanamadı. Tekrar dene.",
    session_expired: "Oturumun sona erdi. Tekrar giriş yap.",
    session_not_found: "Oturum bulunamadı. Tekrar giriş yap."
  };

  const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("klyze-timeout")), ms);
      Promise.resolve(promise).then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); }
      );
    });
  }

  function cleanName(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .slice(0, 80);
  }

  function httpsUrl(value) {
    const url = String(value == null ? "" : value).trim();
    if (url.length > 2048) return null;
    return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
  }

  function initials(value) {
    const parts = cleanName(value).split(/\s+/).filter(Boolean);
    if (!parts.length) return "K";
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toLocaleUpperCase("tr-TR") || "K";
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return DATE_FORMAT.format(date);
  }

  function messageFor(error, fallback) {
    if (!error) return fallback;
    const code = String(error.code || error.error_code || "").toLowerCase();
    if (MESSAGES[code]) return MESSAGES[code];

    const status = Number(error.status || 0);
    if (status === 429) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
    if (status >= 500) return "Sunucuya şu an ulaşılamıyor. Birazdan tekrar dene.";
    if (status === 401 || status === 403) return "Bu işlem için yetkin yok. Sayfayı yenileyip tekrar dene.";

    const name = String(error.name || "");
    const text = String(error.message || "");
    if (name === "AuthRetryableFetchError" || text === "klyze-timeout") {
      return "Sunucuya ulaşılamadı. İnternetini kontrol edip tekrar dene.";
    }
    if (/failed to fetch|networkerror/i.test(text)) {
      return "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
    }
    return fallback;
  }

  function createClient() {
    const config = window.KLYZE_SUPABASE;
    const sdk = window.supabase;
    if (!config || !sdk || typeof sdk.createClient !== "function") return null;

    return sdk.createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "klyze-site-auth"
      }
    });
  }

  window.KLYZE_AUTH = Object.freeze({
    MESSAGES,
    withTimeout,
    cleanName,
    httpsUrl,
    initials,
    formatDate,
    messageFor,
    createClient
  });
})();
