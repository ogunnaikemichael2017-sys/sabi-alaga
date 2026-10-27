const WORDS = ["Ẹ káàbọ̀", "Dọ̀bálẹ̀", "Ìgbéyàwó", "Ayọ̀", "Àṣẹ", "Ẹ ṣé"];

export default function Marquee() {
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
