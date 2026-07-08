/* ============================================================
   VRIDHO — interactions
   All motion respects prefers-reduced-motion and touch devices.
   Continuous values (cursor, magnetic) use rAF + CSS custom
   properties, never per-frame layout reads.
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer  = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  /* ---------- 1. Sticky nav background on scroll ---------- */
  const nav = document.getElementById("nav");
  const navSentinel = () => {
    if (window.scrollY > 12) nav.classList.add("is-stuck");
    else nav.classList.remove("is-stuck");
  };
  navSentinel();
  // passive listener only toggles a class; no layout work per frame
  window.addEventListener("scroll", navSentinel, { passive: true });

  /* ---------- 2. Scroll reveal (IntersectionObserver) ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-in"));
  } else {
    // stagger siblings that share a parent for a gentle cascade
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = Array.from(el.parentElement.querySelectorAll(":scope > [data-reveal]"));
        const idx = siblings.indexOf(el);
        el.style.transitionDelay = (idx > 0 ? Math.min(idx, 6) * 0.06 : 0) + "s";
        el.classList.add("is-in");
        obs.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- 3. Count-up numbers (market tape) ---------- */
  const fmt = (n, dec) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const runCount = (el) => {
    const target  = parseFloat(el.dataset.count);
    const dec      = parseInt(el.dataset.decimals || "0", 10);
    const prefix   = el.dataset.prefix || "";
    if (reduceMotion) { el.textContent = prefix + fmt(target, dec); return; }
    const dur = 1100;
    let start = null;
    const step = (t) => {
      if (start === null) start = t;
      const p = clamp((t - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(target * eased, dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => { if (e.isIntersecting) { runCount(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.5 });
    counters.forEach((el) => cio.observe(el));
  } else {
    counters.forEach(runCount);
  }

  /* ---------- 4. Spotlight-border cards (pointer position) ---------- */
  if (finePointer) {
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--px", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--py", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
  }

  /* ---------- 5. Custom cursor: spotlight + spring ring ---------- */
  if (finePointer && !reduceMotion) {
    let mx = 0, my = 0, rx = 0, ry = 0;      // real pointer / eased ring
    let started = false;

    const bodyStyle = document.body.style;
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      // spotlight + exact dot track 1:1 (cheap, transform only)
      bodyStyle.setProperty("--cx", mx + "px");
      bodyStyle.setProperty("--cy", my + "px");
      bodyStyle.setProperty("--dx", mx + "px");
      bodyStyle.setProperty("--dy", my + "px");
      if (!started) {
        started = true; rx = mx; ry = my;
        document.body.classList.add("cursor-on");   // reveal only after first move
        requestAnimationFrame(loop);
      }
    }, { passive: true });

    document.addEventListener("pointerdown", (e) => {
      document.body.classList.add("cursor-press");
      // spawn a ripple ring at the click point
      const ripple = document.createElement("div");
      ripple.className = "cursor-ripple";
      ripple.style.setProperty("--px", e.clientX + "px");
      ripple.style.setProperty("--py", e.clientY + "px");
      document.body.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
    document.addEventListener("pointerup",   () => document.body.classList.remove("cursor-press"));

    const hotSel = "a, button, [data-magnetic], input, .card, summary, label";
    document.addEventListener("pointerover", (e) => {
      if (e.target.closest(hotSel)) document.body.classList.add("cursor-hot");
    });
    document.addEventListener("pointerout", (e) => {
      if (e.target.closest(hotSel) && !e.relatedTarget?.closest?.(hotSel))
        document.body.classList.remove("cursor-hot");
    });

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      document.body.style.setProperty("--rx", rx + "px");
      document.body.style.setProperty("--ry", ry + "px");
      requestAnimationFrame(loop);
    };
  }

  /* ---------- 6. Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.28;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty("--mx", clamp(dx * strength, -14, 14) + "px");
        el.style.setProperty("--my", clamp(dy * strength, -12, 12) + "px");
      });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      });
    });
  }

  /* ---------- 7. Subtle tilt on product windows ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const max = 5;
      el.style.transformStyle = "preserve-3d";
      el.style.transition = "transform .4s var(--ease)";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1000px) rotateY(${px * max}deg) rotateX(${-py * max}deg)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- 8. Live tape shimmer: nudge last digits ---------- */
  if (!reduceMotion) {
    const prices = document.querySelectorAll(".quote__price[data-count]");
    setInterval(() => {
      prices.forEach((el) => {
        if (Math.random() > 0.35) return;
        const base = parseFloat(el.dataset.count);
        const dec  = parseInt(el.dataset.decimals || "0", 10);
        const drift = base * (Math.random() - 0.5) * 0.0006;
        const val = base + drift;
        el.textContent = (el.dataset.prefix || "") +
          val.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      });
    }, 2600);
  }
})();
