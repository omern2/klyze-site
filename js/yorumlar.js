(() => {
  "use strict";

  const page = document.getElementById("page-yorumlar");
  const hero = document.getElementById("yrHero");
  const band = document.getElementById("yrBand");
  if (!page || !hero || !band) return;

  /* The band is a sliced cylinder: every dark tile is cut into vertical
     facets, each turned around the same axis. The tile itself travels along
     the arc, so the facets can never drift apart. */
  const SLICES = 16;
  const CAMERA = 1.6;
  const MAX_WIDTH = 55;
  const TILE_HEIGHT = 26;
  const ASPECT = 16 / 9;
  const GAP = 9;
  const AXIS = 58;
  const CURVE = 80;
  const SPEED = 4;
  const BEND = (Math.min(85, Math.max(5, CURVE)) * Math.PI) / 180;
  const SHARE = ASPECT / SLICES;
  const ACCENTS = [
    "rgba(230,57,70,.17)",
    "rgba(255,255,255,.075)",
    "rgba(112,122,255,.11)",
    "rgba(230,57,70,.10)",
    "rgba(255,255,255,.05)"
  ];

  const styleEl = document.createElement("style");
  styleEl.id = "yrOrbitKeyframes";
  document.head.appendChild(styleEl);

  let frame = 0;
  let signature = "";

  const arc = bend =>
    (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));

  const measure = (width, height) => {
    const maxWidth = width < 700 ? 66 : MAX_WIDTH;
    const tileHeight = Math.min(
      (TILE_HEIGHT / 100) * height,
      ((maxWidth / 100) * width) / ASPECT
    );
    const radius = width * arc(BEND);
    if (!(tileHeight > 0) || !(radius > 0)) return null;

    const deg = rad => (rad * 180) / Math.PI;
    const unit = deg(tileHeight / radius);
    const pitch = (ASPECT + GAP / 100) * unit;
    const limit = deg(BEND) + (ASPECT * unit) / 2;
    const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
    const evenColumns = columns % 2 ? Math.min(60, columns + 1) : columns;
    const round = value => +value.toFixed(4);
    const sweep = round((evenColumns * pitch) / 2);

    return {
      columns: evenColumns,
      sweep,
      unit: round(unit),
      limit: round(Math.min(sweep, limit)),
      maxWidth
    };
  };

  const u = value => `calc(${+value.toFixed(4)} * var(--yr-u))`;

  const keyframes = (radius, sweep, hide) => {
    const r = radius.toFixed(3);
    const s = sweep.toFixed(4);
    const from = `translateZ(${r}cqw) rotateY(-${s}deg) translateZ(-${r}cqw)`;
    const to = `translateZ(${r}cqw) rotateY(${s}deg) translateZ(-${r}cqw)`;
    const h = Math.max(0, Math.min(50, +hide.toFixed(4)));
    const start = +Math.min(100, h + 0.001).toFixed(4);
    const end = +Math.max(0, 100 - h - 0.001).toFixed(4);
    return (
      `@keyframes yrOrbit{from{transform:${from}}to{transform:${to}}` +
      `0%,${h}%,${(100 - h).toFixed(4)}%,100%{visibility:hidden}` +
      `${start}%,${end}%{visibility:visible}}`
    );
  };

  const starPath =
    '<path d="M7 0l2.1 4.3 4.8.7-3.5 3.4.8 4.8L7 10.9 2.8 13.2l.8-4.8L.1 5l4.8-.7z"/>';
  const stars = Array.from(
    { length: 5 },
    (_, index) => `<g transform="translate(${index * 20} 0)">${starPath}</g>`
  ).join("");

  const cardSvg = variant => {
    const widths = [
      [302, 246, 188],
      [260, 306, 214],
      [228, 276, 320]
    ][variant % 3];
    const lines = widths
      .map(
        (width, index) =>
          `<rect x="36" y="${154 + index * 18}" width="${width}" height="7" rx="3.5" fill="rgba(255,255,255,${index === 0 ? ".105" : ".072"})"/>`
      )
      .join("");
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">' +
      '<rect x=".75" y=".75" width="478.5" height="268.5" rx="18" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1.5"/>' +
      '<circle cx="35" cy="33" r="3.5" fill="rgba(230,57,70,.58)"/>' +
      '<text x="28" y="94" font-family="Georgia,serif" font-size="88" fill="rgba(255,255,255,.11)">“</text>' +
      `<g transform="translate(342 34)" fill="rgba(255,255,255,.27)">${stars}</g>` +
      lines +
      '<circle cx="46" cy="226" r="12" fill="rgba(255,255,255,.08)"/>' +
      '<rect x="66" y="219" width="64" height="6" rx="3" fill="rgba(255,255,255,.10)"/>' +
      '<rect x="66" y="231" width="42" height="4" rx="2" fill="rgba(255,255,255,.06)"/>' +
      "</svg>"
    );
  };

  const cardLayers = [0, 1, 2].map(
    variant =>
      `url("data:image/svg+xml,${encodeURIComponent(cardSvg(variant))}")`
  );

  const background = (accent, variant) =>
    `${cardLayers[variant % cardLayers.length]},` +
    `radial-gradient(58% 120% at 14% 0%,${accent},transparent 64%),` +
    "radial-gradient(70% 100% at 94% 112%,rgba(255,255,255,.045),transparent 58%)," +
    "linear-gradient(180deg,rgba(255,255,255,.085) 0,rgba(255,255,255,0) 16%,rgba(255,255,255,0) 82%,rgba(0,0,0,.24) 100%)," +
    "linear-gradient(145deg,#1A1A1D 0%,#111113 58%,#0B0B0C 100%)";

  const build = (layout, radius, duration) => {
    const fragment = document.createDocumentFragment();
    const tileWidth = u(ASPECT);
    const tileHeight = u(1);
    const sliceWidth = u(SHARE);

    for (let tileIndex = 0; tileIndex < layout.columns; tileIndex += 1) {
      const tile = document.createElement("div");
      tile.className = "yr-tile";
      tile.style.left = `calc(50% - ${u(ASPECT / 2)})`;
      tile.style.top = `calc(var(--yr-axis) - ${u(0.5)})`;
      tile.style.width = tileWidth;
      tile.style.height = tileHeight;
      tile.style.animation = `yrOrbit ${duration}s linear ${-tileIndex * SPEED}s infinite`;

      const accent = ACCENTS[tileIndex % ACCENTS.length];
      for (let sliceIndex = 0; sliceIndex < SLICES; sliceIndex += 1) {
        const slice = document.createElement("div");
        slice.className = "yr-slice";
        const angle = (ASPECT / 2 - (sliceIndex + 0.5) * SHARE) * layout.unit;

        slice.style.left = u((ASPECT - SHARE) / 2);
        slice.style.width =
          sliceIndex === SLICES - 1
            ? sliceWidth
            : `calc(${sliceWidth} + 1px)`;
        slice.style.height = tileHeight;
        slice.style.transform =
          `translateZ(${radius}cqw) rotateY(${angle.toFixed(4)}deg) translateZ(-${radius}cqw)`;
        slice.style.backgroundImage = background(accent, tileIndex);
        slice.style.backgroundSize = `${tileWidth} ${tileHeight}`;
        slice.style.backgroundPosition = `${u(-sliceIndex * SHARE)} 0`;

        if (sliceIndex === 0) slice.style.borderRadius = "10px 0 0 10px";
        if (sliceIndex === SLICES - 1) slice.style.borderRadius = "0 10px 10px 0";
        tile.appendChild(slice);
      }

      fragment.appendChild(tile);
    }

    band.replaceChildren(fragment);
  };

  const apply = layout => {
    const radius = 100 * arc(BEND);
    const nextSignature = [
      layout.columns,
      layout.sweep,
      layout.unit,
      layout.limit,
      layout.maxWidth,
      radius.toFixed(3)
    ].join("|");

    if (nextSignature === signature) return;
    signature = nextSignature;

    hero.style.setProperty(
      "--yr-u",
      `min(${TILE_HEIGHT}cqh,${(layout.maxWidth / ASPECT).toFixed(4)}cqw)`
    );
    hero.style.setProperty("--yr-axis", `${AXIS}%`);
    hero.style.setProperty("--yr-radius", `${radius.toFixed(3)}cqw`);
    hero.style.setProperty(
      "--yr-perspective",
      `${(radius * CAMERA).toFixed(3)}cqw`
    );

    const duration = layout.columns * SPEED;
    const hide = ((layout.sweep - layout.limit) / (2 * layout.sweep || 1)) * 100;
    styleEl.textContent = keyframes(radius, layout.sweep, hide);
    build(layout, radius, duration);
    band.classList.add("is-ready");
  };

  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      const width = hero.clientWidth;
      const height = hero.clientHeight;
      if (width < 80 || height < 200) {
        band.classList.remove("is-ready");
        signature = "";
        return;
      }
      const layout = measure(width, height);
      if (layout) apply(layout);
    });
  };

  const observer = new ResizeObserver(schedule);
  observer.observe(hero);

  const hiddenObserver = new MutationObserver(schedule);
  hiddenObserver.observe(page, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("resize", schedule, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(schedule);
  schedule();
})();

/* Yorum listesi ve form — demo veri, sayfa yenilenince sifirlanir. */
(() => {
  "use strict";

  const page = document.getElementById("page-yorumlar");
  if (!page) return;

  const grid = document.getElementById("yrGrid");
  const more = document.getElementById("yrMore");
  const end = document.getElementById("yrEnd");
  const listCount = document.getElementById("yrListCount");
  const scoreEl = page.querySelector(".yr-score strong");
  const countText = document.getElementById("yrCountText");
  const starsBox = document.getElementById("yrStars");
  if (!grid || !more || !end || !listCount || !scoreEl || !countText || !starsBox) return;

  const PAGE_SIZE = 6;
  const MAX_NAME = 24;
  const MAX_TEXT = 400;
  const SVG_NS = "http://www.w3.org/2000/svg";

  /* 12 yorum, 6 x 5 + 6 x 4 = ortalama 4,5. Tarihler sabit ki liste
     gun gectikce "dun" gibi yanlis ifadeler gostermesin. */
  const reviews = [
    { name: "ege", stars: 5, date: "2026-10-21", text: "Arayüz gerçekten temiz. Maçtan sonra ayrı program açmadan rank değişimimi görmek büyük rahatlık." },
    { name: "Selin", stars: 5, date: "2026-10-19", text: "Overlay oyunu hiç bozmuyor; FPS düşüşü fark etmedim. Kurulum da iki dakika sürdü." },
    { name: "mert.exe", stars: 5, date: "2026-10-18", text: "Maç analizi beklediğimden detaylı. Hangi raundda neyi kaçırdığımı görmek işe yarıyor." },
    { name: "Deniz", stars: 4, date: "2026-10-16", text: "Rank takibi güzel, fakat ilk açılışta biraz bekletiyor. Sonrasında akıcı." },
    { name: "ada", stars: 5, date: "2026-10-14", text: "AC raporuna maçtan önce bakmak alışkanlık oldu. Haftalık özet kısmı özellikle işime yarıyor." },
    { name: "Kaan", stars: 5, date: "2026-10-12", text: "Sade ve hızlı. Gereksiz sekme kalabalığı yok, aradığımı hemen buluyorum." },
    { name: "zeynep", stars: 4, date: "2026-10-10", text: "Günlük seri motive ediyor. Kaç gün üst üste oynadığımı görmek hoşuma gitti." },
    { name: "Arda", stars: 4, date: "2026-10-08", text: "Arkadaşlarımla rankları karşılaştırmak için açıyoruz. Liderlik tablosu eğlenceli." },
    { name: "elif", stars: 4, date: "2026-10-05", text: "Analiz ekranı ilk bakışta yoğun gelebilir ama alışınca çok pratik." },
    { name: "Burak", stars: 5, date: "2026-10-02", text: "Uygulama hafif; arka planda çalışırken belli bile olmuyor." },
    { name: "Ceren", stars: 4, date: "2026-09-28", text: "Riot ID bağlama sorunsuzdu. Maç geçmişi birkaç saniyede geldi." },
    { name: "Yiğit", stars: 4, date: "2026-09-24", text: "Beklentimin üzerinde. Özellikle maç sonrası özet ekranını çok sevdim." }
  ];

  const dateFmt = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });

  const dateLabel = review =>
    review.fresh ? "Az önce" : dateFmt.format(new Date(review.date));

  const initial = name => {
    const first = Array.from(name.trim())[0] || "?";
    return first.toLocaleUpperCase("tr-TR");
  };

  const starIcon = (symbol, empty) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (empty) svg.classList.add("is-empty");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", symbol);
    svg.appendChild(use);
    return svg;
  };

  const buildStars = (rating, className) => {
    const box = document.createElement("span");
    box.className = className;
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", `5 üzerinden ${rating} yıldız`);
    for (let index = 1; index <= 5; index += 1) {
      box.appendChild(starIcon("#yrStar", index > rating));
    }
    return box;
  };

  const buildCard = (review, index) => {
    const card = document.createElement("article");
    card.className = "yr-card";
    if (review.fresh) card.classList.add("is-new");
    card.style.setProperty("--i", String(index % PAGE_SIZE));

    const head = document.createElement("div");
    head.className = "yr-card-head";

    const avatar = document.createElement("span");
    avatar.className = "yr-avatar";
    avatar.textContent = initial(review.name);
    avatar.setAttribute("aria-hidden", "true");

    const identity = document.createElement("div");
    identity.className = "yr-card-id";
    const name = document.createElement("p");
    name.className = "yr-card-name";
    name.textContent = review.name;
    const date = document.createElement("span");
    date.className = "yr-card-date";
    date.textContent = dateLabel(review);
    identity.append(name, date);

    const text = document.createElement("p");
    text.className = "yr-card-text";
    text.textContent = review.text;

    head.append(avatar, identity, buildStars(review.stars, "yr-card-stars"));
    card.append(head, text);
    return card;
  };

  let visible = Math.min(PAGE_SIZE, reviews.length);

  const syncMore = () => {
    const remaining = reviews.length - visible;
    more.hidden = remaining <= 0;
    end.hidden = remaining > 0 || reviews.length <= PAGE_SIZE;
  };

  const renderList = () => {
    const fragment = document.createDocumentFragment();
    reviews.slice(0, visible).forEach((review, index) => {
      fragment.appendChild(buildCard(review, index));
    });
    grid.replaceChildren(fragment);
    syncMore();
  };

  const renderHero = () => {
    if (!reviews.length) return;
    const average = reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length;
    const shown = average.toLocaleString("tr-TR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    const rounded = Math.round(average * 2) / 2;
    const full = Math.floor(rounded);
    const half = rounded - full >= 0.5;

    starsBox.replaceChildren();
    for (let index = 1; index <= 5; index += 1) {
      if (half && index === full + 1) {
        starsBox.appendChild(starIcon("#yrStarHalf", false));
      } else {
        starsBox.appendChild(starIcon("#yrStar", index > full + (half ? 1 : 0)));
      }
    }

    scoreEl.textContent = shown;
    countText.textContent = `${reviews.length} değerlendirme`;
    starsBox.setAttribute("aria-label", `Örnek ortalama: 5 üzerinden ${shown}`);
  };

  const updateListCount = () => {
    listCount.textContent = `${reviews.length} yorum`;
  };

  more.addEventListener("click", () => {
    const from = visible;
    visible = Math.min(reviews.length, visible + PAGE_SIZE);
    const fragment = document.createDocumentFragment();
    for (let index = from; index < visible; index += 1) {
      fragment.appendChild(buildCard(reviews[index], index - from));
    }
    grid.appendChild(fragment);
    syncMore();
    if (visible >= reviews.length) {
      try {
        end.focus({ preventScroll: true });
      } catch {
        end.focus();
      }
    }
  });

  /* Form */
  const form = document.getElementById("yrForm");
  const nameInput = document.getElementById("yrName");
  const textInput = document.getElementById("yrText");
  const counter = document.getElementById("yrCounter");
  const message = document.getElementById("yrFormMsg");
  const honeypot = document.getElementById("yrWebsite");
  const submit = form?.querySelector(".yr-submit");
  const starPick = document.getElementById("yrStarPick");
  if (!form || !nameInput || !textInput || !counter || !message || !honeypot || !submit || !starPick) return;

  const starInputs = Array.from(form.querySelectorAll('input[name="yrStars"]'));
  const starLabels = Array.from(starPick.querySelectorAll(".yr-star-btn"));

  const selectedStars = () => {
    const checked = form.querySelector('input[name="yrStars"]:checked');
    return checked ? Number(checked.value) : 0;
  };

  const paintStars = value => {
    starLabels.forEach((label, index) => {
      label.classList.toggle("is-on", index < value);
    });
  };

  const clearError = id => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = "";
    node.hidden = true;
  };

  const setError = (id, text, input) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = text;
      node.hidden = false;
    }
    if (input) input.setAttribute("aria-invalid", "true");
  };

  const clearErrors = () => {
    clearError("yrStarsErr");
    clearError("yrNameErr");
    clearError("yrTextErr");
    nameInput.removeAttribute("aria-invalid");
    textInput.removeAttribute("aria-invalid");
  };

  const updateCounter = () => {
    counter.textContent = `${textInput.value.length} / ${MAX_TEXT}`;
  };

  const validate = () => {
    clearErrors();
    let firstInvalid = null;
    const name = nameInput.value.trim().replace(/\s+/g, " ");
    const text = textInput.value.trim();
    const stars = selectedStars();

    if (!name) {
      setError("yrNameErr", "Adını yaz.", nameInput);
      firstInvalid = firstInvalid || nameInput;
    } else if (Array.from(name).length > MAX_NAME) {
      setError("yrNameErr", `Adın en fazla ${MAX_NAME} karakter olabilir.`, nameInput);
      firstInvalid = firstInvalid || nameInput;
    }

    if (!stars || stars < 1 || stars > 5) {
      setError("yrStarsErr", "Bir puan seç.");
      firstInvalid = firstInvalid || starInputs[0];
    }

    if (!text) {
      setError("yrTextErr", "Yorumunu yaz.", textInput);
      firstInvalid = firstInvalid || textInput;
    } else if (Array.from(text).length < 3) {
      setError("yrTextErr", "En az 3 karakter yaz.", textInput);
      firstInvalid = firstInvalid || textInput;
    } else if (Array.from(text).length > MAX_TEXT) {
      setError("yrTextErr", `Yorumun en fazla ${MAX_TEXT} karakter olabilir.`, textInput);
      firstInvalid = firstInvalid || textInput;
    }

    return firstInvalid ? { ok: false, firstInvalid } : { ok: true, name, text, stars };
  };

  let busy = false;
  let releaseTimer = 0;

  const releaseSubmit = () => {
    busy = false;
    submit.disabled = false;
    window.clearTimeout(releaseTimer);
  };

  starInputs.forEach(input => {
    input.addEventListener("change", () => {
      paintStars(Number(input.value));
      clearError("yrStarsErr");
    });
  });

  starLabels.forEach((label, index) => {
    label.addEventListener("mouseenter", () => paintStars(index + 1));
  });
  starPick.addEventListener("mouseleave", () => paintStars(selectedStars()));

  nameInput.addEventListener("input", () => {
    clearError("yrNameErr");
    nameInput.removeAttribute("aria-invalid");
  });

  textInput.addEventListener("input", () => {
    updateCounter();
    clearError("yrTextErr");
    textInput.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;

    message.textContent = "";
    message.className = "yr-form-msg";

    if (honeypot.value.trim()) {
      form.reset();
      paintStars(selectedStars() || 5);
      updateCounter();
      return;
    }

    const result = validate();
    if (!result.ok) {
      result.firstInvalid.focus();
      return;
    }

    busy = true;
    submit.disabled = true;

    const review = {
      name: result.name,
      stars: result.stars,
      text: result.text,
      date: new Date().toISOString(),
      fresh: true
    };

    reviews.unshift(review);
    visible = Math.min(reviews.length, Math.max(visible + 1, PAGE_SIZE));
    grid.prepend(buildCard(review, 0));
    updateListCount();
    syncMore();
    renderHero();

    form.reset();
    paintStars(selectedStars() || 5);
    updateCounter();
    message.textContent = `Teşekkürler ${result.name}, yorumun listede en üstte.`;
    message.className = "yr-form-msg is-ok";
    nameInput.focus();

    releaseTimer = window.setTimeout(releaseSubmit, 700);
  });

  paintStars(selectedStars() || 5);
  updateCounter();
  updateListCount();
  renderList();
  renderHero();
})();
