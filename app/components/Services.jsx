const CARDS = [
  { h: "Alaga Iduro and Ijoko", p: "I stand as the traditional host of your ceremony: both families, the prayers, the dobale and the praise.", a: "Ask about this", href: "#book", photo: "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345868/sabi-alaga/images/service-1.jpg", alt: "The alaga seated between a couple in pink and purple aso oke" },
  { h: "Introductions and engagements", p: "I run your parlor and family introductions with warmth, humour and respect for both houses.", a: "Ask about this", href: "#book", photo: "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345869/sabi-alaga/images/service-2.jpg", alt: "The alaga presenting a fan to a couple in royal blue aso oke" },
  { h: "Eru Iyawo setup", p: "I style and present your bride\u2019s entourage and gifts, so the family entrance is a moment to remember.", a: "Ask about this", href: "#book", photo: "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345870/sabi-alaga/images/service-3.jpg", alt: "The alaga holding the microphone beside a bride in purple lace" },
  { h: "Traditional wedding MC", p: "I anchor your day from the first cue to the last dance: order, energy and timing that never slips.", a: "Ask about this", href: "#book", photo: "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345870/sabi-alaga/images/service-4.jpg", alt: "The alaga seated with a couple under a lighted arch backdrop" },
  { h: "Brides gifts", p: "I source, wrap and present gifts for your bride beautifully on the day of the engagement.", a: "Ask about this", href: "#book", photo: "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345866/sabi-alaga/images/brides-gifts.jpg", alt: "Sabi standing beside a styled eru iyawo gift display" },
  { h: "Training and consultation", p: "I teach the work I have done for 5 years, or advise you before your own event.", a: "See training", href: "#training", photo: "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345873/sabi-alaga/images/service-6.jpg", alt: "The alaga seated between a couple in white and gold" },
];

export default function Services() {
  return (
    <section id="services">
      <div className="wrap">
        <h2>What I do for your day</h2>
        <p className="sub">One alaga from the first knock to the last dance, so both families can simply enjoy the day.</p>
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
