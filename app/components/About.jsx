export default function About() {
  return (
    <section className="scrub">
      <div className="wrap ab">
        <div className="por">
          <img
            src="/images/sabi-portrait.jpg"
            alt="Sabi in a green lace outfit, standing beside The Sabi Alaga sign"
            width="715"
            height="867"
            loading="lazy"
          />
        </div>
        <div>
          <h2>Hello, I&rsquo;m Sabi</h2>
          <p style={{ maxWidth: "32em" }}>
            From the first knock on the gate to the last dance, I stand between two families and keep love, laughter and respect flowing. For 5 years I have hosted introductions, engagements and traditional weddings across Lagos and Ibadan: the dobale, the prayers, the eru iyawo, the geles. Every family is treated like my own, so from the moment I pick up the microphone, your people can relax and simply enjoy their day.
          </p>
          <div className="stats">
            <div><b>5 years</b>hosting</div>
            <div><b>2.8M</b>TikTok likes</div>
            <div><b>Lagos, Ibadan</b>and beyond</div>
          </div>
        </div>
      </div>
    </section>
  );
}
