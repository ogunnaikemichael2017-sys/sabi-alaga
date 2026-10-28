export default function Shop() {
  return (
    <section className="shop" id="shop">
      <div className="wrap">
        <h2>Add the finishing touches</h2>
        <div className="grid">
          <article>
            <img src="/images/product-jewelry.jpg" alt="A pearl and crystal bridal jewelry set on a display bust" loading="lazy" />
            <div className="tx">
              <h3>Jewelry by Saysay</h3>
              <p>Pearl and crystal bridal sets from my jewelry plug, Saysay. Message me on WhatsApp to ask what is available for your date.</p>
            </div>
          </article>
          <article>
            <img src="/images/product-trunk.jpg" alt="A styled display of wrapped gift trunks, fruit crates and coolers" loading="lazy" />
            <div className="tx">
              <h3>Eru iyawo packages</h3>
              <p>Trunks, boxes and crates of gifts for your engagement, sourced, wrapped and styled for you.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
