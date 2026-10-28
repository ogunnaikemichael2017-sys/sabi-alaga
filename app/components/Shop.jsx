export default function Shop() {
  return (
    <section className="shop" id="shop">
      <div className="wrap">
        <h2>What she sells</h2>
        <p className="sub">Beyond the microphone, Sabi curates pieces that finish your day.</p>
        <div className="grid">
          <article>
            <img src="/images/product-jewelry.jpg" alt="A pearl and crystal bridal jewelry set on a display bust" loading="lazy" />
            <div className="tx">
              <h3>Jewelry by Saysay</h3>
              <p>Pearl and crystal bridal sets from her jewelry plug. Ask what is available for your date.</p>
              <a href="https://wa.me/2348089193663" target="_blank" rel="noreferrer">Chat on WhatsApp</a>
            </div>
          </article>
          <article>
            <img src="/images/product-trunk.jpg" alt="A styled display of wrapped gift trunks, fruit crates and coolers" loading="lazy" />
            <div className="tx">
              <h3>Eru iyawo packages</h3>
              <p>Trunks, boxes and crates of gifts for the engagement, sourced, wrapped and styled for you.</p>
              <a href="https://wa.me/2348089193663" target="_blank" rel="noreferrer">Chat on WhatsApp</a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
