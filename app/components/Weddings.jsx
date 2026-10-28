const CLIPS = [
  { v: "/clips/beg.mp4", t: "The beg for the bride", s: "Groom’s side, in aso-oke" },
  { v: "/clips/dobale.mp4", t: "The dobale moment", s: "Families honoured, all together" },
  { v: "/clips/energy.mp4", t: "Matching your energy", s: "Dancing with the guests" },
  { t: "Couple name", s: "Engagement" },
  { t: "Couple name", s: "Eru Iyawo entrance" },
  { t: "Couple name", s: "Destination event" },
];

export default function Weddings() {
  return (
    <section className="wed pin" id="weddings">
      <div className="wedin">
        <div className="wrap">
          <h2>Real weddings, real energy</h2>
          <p className="sub">Clips from events she has hosted, shown with each couple’s permission. Swipe to see more.</p>
        </div>
        <div className="rail" tabIndex={0} aria-label="Wedding clips, scroll sideways">
          {CLIPS.map((c, i) =>
            c.v ? (
              <div className="clip v" key={i}>
                <video src={c.v} autoPlay muted loop playsInline preload="metadata"></video>
                <div><b>{c.t}</b>{c.s}</div>
              </div>
            ) : (
              <div className="clip" key={i}><div><b>{c.t}</b>{c.s}</div></div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
