function SplitLine({ text }) {
  const words = text.split(" ");
  const parts = [];
  words.forEach((word, i) => {
    parts.push(
      <w-d key={"w" + i}>
        {word.split("").map((c, j) => (
          <c-h key={j}>{c}</c-h>
        ))}
      </w-d>
    );
    if (i < words.length - 1) parts.push(" ");
  });
  return parts;
}

export default function Hero() {
  return (
    <header className="hero">
      <div className="wrap">
        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top" aria-label="The Sabi Alaga"><img src="/logo.png" alt="The Sabi Alaga" width="110" height="67" /></a>
          <a className="btn gold" href="#book">Check my date</a>
        </nav>
        <div className="hg" id="top">
          <div>
            <h1>
              <span><SplitLine text="The Sought" /></span>
              <span><SplitLine text="After Alaga" /></span>
            </h1>
            <p className="lead">Introductions, engagements and traditional weddings, hosted with dobale, joy and order. Lagos, Ibadan and wherever your event is.</p>
            <div className="cta">
              <a className="btn gold" href="#book">Check my date</a>
              <a className="btn out" href="#weddings">Watch the work</a>
            </div>
          </div>
          <div className="arches" role="img" aria-label="The Sabi Alaga hosting a ceremony">
            <i></i><i></i>
            <i>
              <video src="/clips/hero.mp4" autoPlay muted loop playsInline preload="auto"></video>
            </i>
          </div>
        </div>
      </div>
    </header>
  );
}
