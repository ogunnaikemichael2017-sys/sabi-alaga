import { DEFAULTS } from "../lib/content";

export default function Shop({ data }) {
  const d = { ...DEFAULTS.shop, ...data };
  return (
    <section className="shop" id="shop">
      <div className="wrap">
        <h2>{d.title}</h2>
        <div className="grid">
          {(d.cards || []).map((c, i) => (
            <article key={i}>
              <img src={c.img} alt={c.alt || c.h} loading="lazy" />
              <div className="tx">
                <h3>{c.h}</h3>
                <p>{c.p}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
