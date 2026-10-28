const CARDS = [
  { h: "Alaga Iduro and Ijoko", p: "The traditional host of your ceremony: both families, the prayers, the dobale and the praise.", a: "Ask about this", href: "#book", photo: "/images/service-1.jpg", alt: "The alaga seated between a couple in pink and purple aso oke" },
  { h: "Introductions and engagements", p: "Parlor and family introductions run with warmth, humour and respect for both houses.", a: "Ask about this", href: "#book", photo: "/images/service-2.jpg", alt: "The alaga presenting a fan to a couple in royal blue aso oke" },
  { h: "Eru Iyawo setup", p: "The bride\u2019s entourage and gift presentation, styled and presented beautifully.", a: "Ask about this", href: "#book", photo: "/images/service-3.jpg", alt: "The alaga holding the microphone beside a bride in purple lace" },
  { h: "Traditional wedding MC", p: "Your day anchored from the first cue to the last dance: order, energy and timing that never slips.", a: "Ask about this", href: "#book", photo: "/images/service-4.jpg", alt: "The alaga seated with a couple under a lighted arch backdrop" },
  { h: "Gele tying and styling", p: "Gele tied beautifully for the bride and her entourage, the finishing touch for your pictures.", a: "Ask about this", href: "#book", photo: "/images/service-5.jpg", alt: "The alaga playfully posing beside a couple in purple and blue" },
  { h: "Training and consultation", p: "Learn the work from someone who has done it for 5 years, or get advice before your own event.", a: "See training", href: "#training", photo: "/images/service-6.jpg", alt: "The alaga seated between a couple in white and gold" },
];

export default function Services() {
  return (
    <section id="services">
      <div className="wrap">
        <h2>What she hosts</h2>
        <p className="sub">One alaga from the first knock to the last dance, so your families can simply enjoy the day.</p>
        <div>
          {CARDS.map((c, i) => (
            <article className="pn" style={{ "--i": i }} key={i}>
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
