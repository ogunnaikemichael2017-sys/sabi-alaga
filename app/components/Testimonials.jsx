"use client";

import { useEffect, useRef } from "react";
import { DEFAULTS } from "../lib/content";




function BigWords({ text }) {
  const words = text.split(" ");
  const parts = [];
  words.forEach((w, i) => {
    parts.push(<w-d key={i}>{w}</w-d>);
    if (i < words.length - 1) parts.push(" ");
  });
  return parts;
}

export default function Testimonials({ data }) {
  const d = { ...DEFAULTS.testimonials, ...data };
  const CARDS = d.cards || [];
  const BIG = d.quote;
  const ref = useRef(null);

  useEffect(() => {
    const cf = ref.current;
    if (!cf || window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    cf.classList.add("on");
    const cs = Array.from(cf.children), n = cs.length;
    let pos = 0, last = performance.now(), paused = false, vis = true, raf;
    const clamp = (d, m) => Math.max(-m, Math.min(m, d));
    const enter = () => { paused = true; };
    const leave = () => { paused = false; };
    cf.addEventListener("mouseenter", enter);
    cf.addEventListener("mouseleave", leave);
    let io = null;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver((e) => { vis = e[0].isIntersecting; });
      io.observe(cf);
    }
    const draw = () => {
      const sp = cs[0].offsetWidth * 0.86;
      cs.forEach((c, i) => {
        let d = ((i - pos) % n + n) % n;
        if (d > n / 2) d -= n;
        const a = Math.abs(d);
        c.style.transform = "translate(-50%,-50%) translateX(" + d * sp + "px) translateZ(" + (-a * 90) + "px) rotateY(" + (-clamp(d * 25, 50)) + "deg) rotateZ(" + clamp(d, 1) * 7 + "deg) scale(" + Math.max(0.7, 1 - a * 0.1) + ")";
        c.style.opacity = Math.max(0, a > 2.4 ? 0 : 1 - Math.max(0, a - 1.6) * 1.1);
        c.style.zIndex = 100 - Math.round(a * 10);
      });
    };
    const tick = (t) => {
      const dt = Math.min(t - last, 60);
      last = t;
      if (vis && !paused) pos = (pos + dt / 3200) % n;
      if (vis) draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cf.classList.remove("on");
      cf.removeEventListener("mouseenter", enter);
      cf.removeEventListener("mouseleave", leave);
      if (io) io.disconnect();
    };
  }, []);

  return (
    <section className="say">
      <div className="wrap">
        <h2>{d.title}</h2>
        <p className="big"><BigWords text={BIG} /></p>
        <b>Event decorator, Lagos</b>
        <div className="cf" aria-label="Real messages from past clients" ref={ref}>
          {CARDS.map((c, i) => (
            <article key={i}>
              <img src={c.i} alt={c.a} loading="lazy" width="660" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
