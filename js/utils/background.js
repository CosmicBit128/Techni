import { adjust, rgb } from "./utils/colors.js";

const rand = (a, b) => a + Math.random() * (b - a);

export function makeBlobs(liquidEl, colors) {
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BIG = REDUCE ? 3 : 6;
  const MINI = document.body.dataset.noise === "off" ? 0 : REDUCE ? 0 : 12;

  liquidEl.innerHTML = "";

  for (let i = 0; i < BIG; i++) {
    const el = document.createElement("div");
    el.className = "blob";

    const r = Math.random();
    if (r < 0.55) {
      el.classList.add("blob--bubble");
    } else if (r < 0.9) {
      el.classList.add("blob--vortex");
    }

    const c1 = colors[i % colors.length];
    const c2 = colors[(i + 1) % colors.length];

    el.style.setProperty("--c1", c1);
    el.style.setProperty("--c2", c2);
    el.style.setProperty("--sz", `${rand(60, 120)}vmin`);
    el.style.setProperty("--x", `${rand(-40, 40)}vw`);
    el.style.setProperty("--y", `${rand(-40, 40)}vh`);
    el.style.setProperty("--sc", rand(0.8, 1.15));
    el.style.setProperty("--t", `${Math.round(rand(18, 32))}s`);
    el.style.setProperty("--d", `${Math.round(rand(-32, 0))}s`);

    liquidEl.appendChild(el);
  }

  for (let i = 0; i < MINI; i++) {
    const el = document.createElement("div");
    el.className = "blob mini";

    if (Math.random() < 0.7) {
      el.classList.add("blob--bubble");
    } else {
      el.classList.add("blob--vortex");
    }

    const c = colors[Math.floor(Math.random() * colors.length)];
    el.style.setProperty("--c1", c);
    el.style.setProperty("--c2", c);
    el.style.setProperty("--sz", `${rand(10, 18)}vmin`);
    el.style.setProperty("--x", `${rand(-50, 50)}vw`);
    el.style.setProperty("--y", `${rand(-50, 50)}vh`);
    el.style.setProperty("--sc", rand(0.9, 1.6));
    el.style.setProperty("--t", `${Math.round(rand(24, 48))}s`);
    el.style.setProperty("--d", `${Math.round(rand(-48, 0))}s`);

    liquidEl.appendChild(el);
  }
}

export function applyGradientSmooth(bgA, bgB, activeRef, cols) {
  const nextBg = activeRef.current === bgA ? bgB : bgA;
  nextBg.style.backgroundImage = `linear-gradient(145deg, ${cols.join(",")})`;
  activeRef.current.classList.remove("active");
  nextBg.classList.add("active");
  activeRef.current = nextBg;
}

export function initFromCover({
  cover,
  titleScope,
  liquid,
  bgA,
  bgB,
  activeRef,
  colorThief,
}) {
  try {
    const pal = colorThief.getPalette(cover, 8);
    if (!pal) return;

    const picks = [0, 2, 4, 6].map((i) =>
      adjust(pal[i] || pal[0], { lighten: 0.18 })
    );
    const cssCols = picks.slice().reverse().map(rgb);
    titleScope?.style.setProperty(
      "--title-grad",
      `linear-gradient(90deg, ${cssCols.join(",")})`
    );

    // accent dla tytulu
    const strokeCol = rgb(adjust(picks[1], { darken: 0.5 })); // strong edge
    const glow1Col = rgb(adjust(picks[0], { lighten: 0.1 })); // inner glow
    const glow2Col = rgb(adjust(picks[3], { lighten: 0.1 })); // outer glow
    const highlightCol = rgb(adjust(picks[2], { lighten: 0.45 })); // sweep highlight

    titleScope?.style.setProperty("--title-stroke", strokeCol);
    titleScope?.style.setProperty("--title-glow-1", glow1Col);
    titleScope?.style.setProperty("--title-glow-2", glow2Col);
    titleScope?.style.setProperty("--title-highlight", highlightCol);

    const bgCols = picks
      .map((c) => adjust(c, { darken: 0.18, desat: 0.1 }))
      .map(rgb);
    applyGradientSmooth(bgA, bgB, activeRef, bgCols);
    makeBlobs(liquid, picks.map(rgb));
  } catch (e) {
    console.warn("Color extraction failed:", e);
  }
}

// DLA TESTOW #JOACHIM NAPRAW POZNIEJ
export function swapCover(coverEl, newSrc, onLoadOnce) {
  coverEl.addEventListener("load", onLoadOnce, { once: true });
  coverEl.src = "public/" + newSrc;
}
