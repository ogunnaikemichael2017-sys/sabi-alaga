import { DEFAULTS } from "../lib/content";

export default function Marquee({ data }) {
  const d = { ...DEFAULTS.marquee, ...data };
  const WORDS = String(d.words || "").split(",").map((w) => w.trim()).filter(Boolean);
  return (
    <div className="marq" aria-hidden="true">
      <div className="track" id="tr">
        {[0, 1, 2, 3].map((set) =>
          WORDS.map((w, i) => (
            <span key={set + "-" + i}>{w}</span>
          ))
        )}
      </div>
    </div>
  );
}
