import { DEFAULTS } from "../lib/content";

export default function Training({ data }) {
  const d = { ...DEFAULTS.training, ...data };
  return (
    <section className="tk" id="training">
      <div className="wrap">
        <div className="ticket">
          <div>
            <h2>{d.title}</h2>
            <p style={{ maxWidth: "30em", color: "var(--muted)" }}>{d.text}</p>
            <a className="btn gold" href="#book" style={{ borderColor: "var(--indigo)" }}>{d.btn}</a>
          </div>
          <ul>
            {(d.items || []).map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
