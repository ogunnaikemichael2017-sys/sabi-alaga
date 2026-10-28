"use client";

import { useRef, useState } from "react";

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

export default function Hero() {
  const v = useRef(null);
  const [m, setM] = useState(true);
  const toggle = () => {
    const el = v.current;
    if (!el) return;
    el.muted = m;
    setM(!m);
    el.play().catch(() => {});
  };
  return (
    <header className="hero">
      <div className="wrap">
        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top" aria-label="The Sabi Alaga"><img src="/logo.png" alt="The Sabi Alaga" width="110" height="67" /></a>
          <a className="btn gold" href="#book">Check my date</a>
        </nav>
        <div className="hg" id="top">
          <div>
            <h1>
              <span><SplitLine text="The Sought" /></span>
              <span><SplitLine text="After Alaga" /></span>
            </h1>
            <p className="lead">I host your introduction, engagement or traditional wedding with dobale, joy and order. Lagos, Ibadan, or wherever your day is.</p>
            <div className="cta">
              <a className="btn gold" href="#book">Check my date</a>
              <a className="btn out" href="#weddings">Watch the work</a>
            </div>
          </div>
          <div className="arches" role="img" aria-label="The Sabi Alaga hosting a ceremony">
            <i></i><i></i>
            <i>
              <video src="/clips/hero.mp4" autoPlay muted loop playsInline preload="auto" ref={v}></video>
            </i>
            <button type="button" className="mute" aria-label={m ? "Turn sound on" : "Turn sound off"} onClick={toggle}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={m ? ICON_OFF : ICON_ON} /></svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
