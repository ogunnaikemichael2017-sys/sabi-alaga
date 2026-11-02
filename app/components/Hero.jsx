"use client";

import { useRef, useState } from "react";
import { DEFAULTS } from "../lib/content";

function SplitLine({ text }) {
  const words = text.split(" ");
  const parts = [];
  words.forEach((word, i) => {
    parts.push(
      <w-d key={"w" + i}>
        {word.split("").map((c, j) => (
          <c-h key={j}>{c}</c-h>
        ))}
      </w-d>
    );
    if (i < words.length - 1) parts.push(" ");
  });
  return parts;
}

const ICON_ON = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z";
const ICON_OFF = "M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.7-2.7-1.4-1.4L15 10.6l-2.7-2.7-1.4 1.4L13.6 12l-2.7 2.7 1.4 1.4L15 13.4l2.7 2.7 1.4-1.4L16.6 12z";

export default function Hero({ data }) {
  const d = { ...DEFAULTS.hero, ...data };
  const v = useRef(null);
  const [m, setM] = useState(true);
  const toggle = () => {
    const el = v.current;
    if (!el) return;
    el.muted = !m;
    setM(!m);
    el.play().catch(() => {});
  };
  const logoRef = useRef(null);
  const taps = useRef(0);
  const tapReset = useRef(null);
  const logoTap = () => {
    taps.current += 1;
    const img = logoRef.current;
    if (img) {
      img.classList.remove("tappulse");
      void img.offsetWidth;
      img.classList.add("tappulse");
    }
    clearTimeout(tapReset.current);
    if (taps.current >= 3) {
      taps.current = 0;
      window.location.assign("/admin");
      return;
    }
    tapReset.current = setTimeout(() => { taps.current = 0; }, 2000);
  };
  const words = String(d.headline || "").split(" ").filter(Boolean);
  const half = Math.ceil(words.length / 2);
  const line1 = words.slice(0, half).join(" ");
  const line2 = words.slice(half).join(" ");
  return (
    <header className="hero">
      <div className="wrap">
        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top" aria-label="The Sabi Alaga" onClick={(e) => { e.preventDefault(); logoTap(); }}><img ref={logoRef} src="https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345855/sabi-alaga/logo.png" alt="The Sabi Alaga" width="110" height="67" /></a>
          <a className="btn gold" href="#book">{d.btn}</a>
        </nav>
        <div className="hg" id="top">
          <div className="hgtxt">
            <h1>
              <span><SplitLine text={line1} /></span>
              <span><SplitLine text={line2} /></span>
            </h1>
            <p className="lead">{d.sub}</p>
          </div>
          <div className="arches" role="img" aria-label="The Sabi Alaga hosting a ceremony">
            <i></i><i></i>
            <i>
              <video src={d.video} autoPlay muted loop playsInline preload="auto" ref={v}></video>
            </i>
            <button type="button" className="mute" aria-label={m ? "Turn sound on" : "Turn sound off"} onClick={toggle}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={m ? ICON_OFF : ICON_ON} /></svg>
            </button>
          </div>
          <div className="cta">
            <a className="btn gold" href="#book">{d.btn}</a>
            <a className="btn out" href="#weddings">Watch the work</a>
          </div>
        </div>
      </div>
    </header>
  );
}
