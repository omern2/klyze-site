/* Klyze kurulum: platform secimi + indirme pop-up.
   Store yok; tek gercek yontem .exe. SmartScreen bilgisi pop-up icinde.
   Pop-up native <dialog>: ekranin ortasinda acilir, odak tuzagi tarayicida. */
(() => {
  "use strict";

  const page = document.getElementById("page-kurulum");
  if (!page) return;

  const win = document.getElementById("krWin");
  const modal = document.getElementById("krModal");
  if (!win || !modal || typeof modal.showModal !== "function") return;

  const closeBtn = document.getElementById("krModalClose");
  const badge = document.getElementById("krWinBadge");
  const note = document.getElementById("krWinNote");
  const soonStatus = document.getElementById("krSoonStatus");
  const frame = document.querySelector(".site-frame");

  /* --- isletim sistemi tespiti --- */
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData && navigator.userAgentData.platform;
  const isWindows = platform === "Windows" || /Windows/i.test(ua);
  if (isWindows && badge) badge.hidden = false;
  if (!isWindows && note) {
    note.textContent = "Bu cihaz Windows değil. Klyze yalnızca Windows 10/11'de çalışır. İndirme dosyası yaklaşık 245,8 MB.";
  }

  /* --- pop-up --- */
  let lastFocus = null;

  function openModal() {
    if (modal.open) return;
    lastFocus = document.activeElement;
    modal.showModal();
    frame?.classList.add("is-locked");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (modal.open) modal.close();
  }

  modal.addEventListener("close", () => {
    frame?.classList.remove("is-locked");
    if (page.hidden) return;
    const target = lastFocus && document.contains(lastFocus) ? lastFocus : win;
    target.focus();
  });

  /* arka plana tiklayinca kapat; panel icindeki tiklamalar kapatmaz */
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    const box = modal.getBoundingClientRect();
    const outside =
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom;
    if (outside) closeModal();
  });

  win.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  /* sayfa degisirse pop-up acik kalmasin */
  new MutationObserver(() => {
    if (page.hidden) closeModal();
  }).observe(page, { attributes: true, attributeFilter: ["hidden"] });

  /* --- yakinda olan platformlar --- */
  page.querySelectorAll(".kr-plat.is-soon").forEach((btn) => {
    btn.addEventListener("click", () => {
      const os = btn.dataset.os || "Bu platform";
      soonStatus.textContent = os + " sürümü henüz yayında değil. Çıktığında bu sayfadan duyuracağız.";
    });
  });
})();
