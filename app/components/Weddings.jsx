"use client";

import { useRef, useState } from "react";

const CLIPS = [
  { v: "https://res.cloudinary.com/di4dlnd5x/video/upload/v1793345881/sabi-alaga/videos/beg.mp4", t: "The beg for the bride", s: "Groom\u2019s side, pleading their case" },
  { v: "https://res.cloudinary.com/di4dlnd5x/video/upload/v1793345883/sabi-alaga/videos/dobale.mp4", t: "The dobale moment", s: "Groom\u2019s men, flat on the floor" },
  { v: "https://res.cloudinary.com/di4dlnd5x/video/upload/v1793345884/sabi-alaga/videos/energy.mp4", t: "Matching your energy", s: "Dancing with the guests" },
  { v: "https://res.cloudinary.com/di4dlnd5x/video/upload/v1793345889/sabi-alaga/videos/v3.mp4", t: "The groom\u2019s men", s: "Steeze and composure" },
  { v: "https://res.cloudinary.com/di4dlnd5x/video/upload/v1793345892/sabi-alaga/videos/v4.mp4", t: "Song and praise", s: "The women lead the entrance" },
  { v: "https://res.cloudinary.com/di4dlnd5x/video/upload/v1793345894/sabi-alaga/videos/v5.mp4", t: "Aso ebi on the floor", s: "The dance floor does not rest" },
];

const ICON_ON = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z";
const ICON_OFF = "M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.7-2.7-1.4-1.4L15 10.6l-2.7-2.7-1.4 1.4L13.6 12l-2.7 2.7 1.4 1.4L15 13.4l2.7 2.7 1.4-1.4L16.6 12z";

export default function Weddings() {
  const refs = useRef([]);
  const [muted, setMuted] = useState(CLIPS.map(() => true));

  const toggle = (i) => {
    const next = !muted[i];
    setMuted(muted.map((m, n) => (n === i ? next : true)));
    refs.current.forEach((v, n) => {
      if (!v) return;
      v.muted = n === i ? next : true;
    });
  };

  return (
    <section className="wed pin" id="weddings">
      <div className="wedin">
        <div className="wrap">
          <h2>Real weddings, real energy</h2>
          <p className="sub">Clips from events I have hosted, shown with each couple&rsquo;s permission. Tap the speaker at the bottom of a clip to hear the sound.</p>
        </div>
        <div className="rail" tabIndex={0} aria-label="Wedding clips, scroll sideways">
          {CLIPS.map((c, i) => (
            <div className="clip v" key={i}>
              <video src={c.v} autoPlay muted loop playsInline preload="metadata" ref={(el) => { refs.current[i] = el; }}></video>
              <button type="button" className="mute" aria-label={muted[i] ? "Turn sound on" : "Turn sound off"} onClick={() => toggle(i)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={muted[i] ? ICON_OFF : ICON_ON} /></svg>
              </button>
              <div><b>{c.t}</b>{c.s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
