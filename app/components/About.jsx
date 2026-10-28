"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { v: 5, d: 0, s: "", l: "years hosting" },
  { v: 2.8, d: 1, s: "M", l: "TikTok likes" },
  { v: 102.4, d: 1, s: "K", l: "TikTok followers" },
  { v: 3668, d: 0, s: "", l: "Instagram followers", comma: true },
  { v: 26, d: 0, s: "K", l: "Facebook family" },
];

function Stat({ s }) {
  const [n, setN] = useState(0);
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) { setN(s.v); return; }
    let raf = 0, started = false;
    const run = () => {
      const t0 = performance.now(), dur = 4000;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        setN(s.v * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !started) { started = true; run(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [s.v]);
  const fmt = s.comma ? Math.round(n).toLocaleString("en-US") : n.toFixed(s.d);
  return <div ref={box}><b>{fmt}{s.s}</b>{s.l}</div>;
}

export default function About() {
  return (
    <section className="scrub">
      <div className="wrap ab">
        <div className="por">
          <img
            src="/images/sabi-portrait.jpg"
            alt="Sabi in a green lace outfit, standing beside The Sabi Alaga sign"
            width="715"
            height="867"
            loading="lazy"
          />
        </div>
        <div>
          <h2>Hello, I&rsquo;m Sabi</h2>
          <p style={{ maxWidth: "32em" }}>
            From the first knock on the gate to the last dance, I stand between two families and keep love, laughter and respect flowing. For 5 years I have hosted introductions, engagements and traditional weddings across Lagos and Ibadan: the dobale, the prayers, the eru iyawo, the geles. Every family is treated like my own, so from the moment I pick up the microphone, your people can relax and simply enjoy their day.
          </p>
          <div className="stats">
            {STATS.map((s, i) => <Stat s={s} key={i} />)}
          </div>
          <p className="hnd">@thesabialaga on TikTok, Instagram and Facebook</p>
        </div>
      </div>
    </section>
  );
}
