const CARDS = [
  { h: "Alaga Iduro and Ijoko", p: "The traditional host of your ceremony: both families, the prayers, the dobale and the praise.", a: "Ask about this", href: "#book", photo: "/images/service-1.jpg", alt: "The alaga seated between a couple in pink and purple aso oke", icons: 1 },
  { h: "Introductions and engagements", p: "Parlor and family introductions run with warmth, humour and respect for both houses.", a: "Ask about this", href: "#book", photo: "/images/service-2.jpg", alt: "The alaga presenting a fan to a couple in royal blue aso oke", icons: 2 },
  { h: "Eru Iyawo setup", p: "The bride\u2019s entourage and gift presentation, styled and presented beautifully.", a: "Ask about this", href: "#book", photo: "/images/service-3.jpg", alt: "The alaga holding the microphone beside a bride in purple lace", icons: 3 },
  { h: "Traditional wedding MC", p: "Your day anchored from the first cue to the last dance: order, energy and timing that never slips.", a: "Ask about this", href: "#book", photo: "/images/service-4.jpg", alt: "The alaga seated with a couple under a lighted arch backdrop", icons: 4 },
  { h: "Gele tying and styling", p: "Gele tied beautifully for the bride and her entourage, the finishing touch for your pictures.", a: "Ask about this", href: "#book", photo: "/images/service-5.jpg", alt: "The alaga playfully posing beside a couple in purple and blue", icons: 2 },
  { h: "Training and consultation", p: "Learn the work from someone who has done it for 5 years, or get advice before your own event.", a: "See training", href: "#training", photo: "/images/service-6.jpg", alt: "The alaga seated between a couple in white and gold", icons: 4 },
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
              <div className="med"><img src={c.photo} alt={c.alt} loading="lazy" /></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
