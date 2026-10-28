const CARDS = [
  { h: "Alaga Iduro and Ijoko", p: "The traditional host of your ceremony: both families, the prayers, the dobale and the praise.", a: "Ask about this", href: "#book", video: "/clips/hero.mp4", icons: 1 },
  { h: "Introductions and engagements", p: "Parlor and family introductions run with warmth, humour and respect for both houses.", a: "Ask about this", href: "#book", video: "/clips/energy.mp4", icons: 2 },
  { h: "Eru Iyawo setup", p: "The bride’s entourage and gift presentation, styled and presented beautifully.", a: "Ask about this", href: "#book", video: "/clips/dobale.mp4", icons: 3 },
  { h: "Training and consultation", p: "Learn the work from someone who has done it for 5 years, or get advice before your own event.", a: "See training", href: "#training", photo: "Her training photo goes here", icons: 4 },
];

export default function Services() {
  return (
    <section id="services">
      <div className="wrap">
        <h2>What she hosts</h2>
        <p className="sub">One alaga from the first knock to the last dance, so your families can simply enjoy the day.</p>
        <div>
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <symbol id="i1" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></symbol>
            <symbol id="i2" viewBox="0 0 24 24"><circle cx="9" cy="14" r="5" /><circle cx="15" cy="14" r="5" /><path d="M8 5l2 3h4l2-3z" /></symbol>
            <symbol id="i3" viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M12 9v11M4 13h16M12 9c-3-5-7-2-4 0M12 9c3-5 7-2 4 0" /></symbol>
            <symbol id="i4" viewBox="0 0 24 24"><path d="M2 9l10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5" /></symbol>
          </svg>
          {CARDS.map((c, i) => (
            <article className="pn" style={{ "--i": i }} key={i}>
              <div className="tabs">
                {Array.from({ length: c.icons }).map((_, k) => (
                  <span className="tb" key={k}>
                    <svg><use href={"#i" + (k + 1)}></use></svg>
                  </span>
                ))}
              </div>
              <div className="txt">
                <h3>{c.h}</h3>
                <p>{c.p}</p>
                <a href={c.href}>{c.a}</a>
              </div>
              {c.video ? (
                <div className="med"><video src={c.video} autoPlay muted loop playsInline preload="metadata"></video></div>
              ) : (
                <div className="med ph">{c.photo}</div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
