import { DEFAULTS } from "../lib/content";

export default function Services({ data }) {
  const d = { ...DEFAULTS.services, ...data };
  const CARDS = d.cards || [];
  return (
    <section id="services">
      <div className="wrap">
        <h2>{d.title}</h2>
        <p className="sub">{d.intro}</p>
        <div>
          {CARDS.map((c, i) => (
            <article className="pn" style={{ "--i": i }} key={i}>
              <div className="txt">
                <h3>{c.h}</h3>
                <p>{c.p}</p>
                <a href={c.href || "#book"}>{c.a}</a>
              </div>
              <div className="med"><img src={c.img} alt={c.alt || c.h} loading="lazy" /></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
