"use client";

import { useEffect, useRef } from "react";

// TODO: replace with the real WhatsApp number in international format, e.g. "2348089193663"
const WHATSAPP_NUMBER = "234XXXXXXXXXX";

const MARQUEE_WORDS = ["Ẹ káàbọ̀", "Dọ̀bálẹ̀", "Ìgbéyàwó", "Ayọ̀", "Àṣẹ", "Ẹ ṣé"];

export default function Home() {
  const formRef = useRef(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onSubmit = (e) => {
      e.preventDefault();
      const v = (id) => document.getElementById(id).value || "not sure yet";
      const m =
        "Hello Sabi, I’m " + v("n") + " (" + v("p") + "). I’d like to ask about a " + v("t") +
        " on " + v("d") + " in " + v("c") + ", about " + v("g") + " guests.";
      window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(m), "_blank");
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <nav className="nav" aria-label="Main">
            <a className="logo" href="#top">The Sabi Alaga</a>
            <a className="btn gold" href="#book">Check my date</a>
          </nav>
          <div className="hg" id="top">
            <div>
              <h1>
                <span>The Sought</span>
                <span>After Alaga</span>
              </h1>
              <p className="lead">
                Introductions, engagements and traditional weddings, hosted with dobale, joy and
                order. Lagos, Ibadan and wherever your event is.
              </p>
              <div className="cta">
                <a className="btn gold" href="#book">Check my date</a>
                <a className="btn out" href="#weddings">Watch the work</a>
              </div>
            </div>
            <div className="arches" role="img" aria-label="Placeholder for her best hosting clip">
              <i />
              <i />
              <i>
                <span>
                  <span className="play" />
                  <b>Her best clip</b>
                  <em>plays here, muted, on loop</em>
                </span>
              </i>
            </div>
          </div>
        </div>
      </header>

      <main id="main">
        <div className="marq" aria-hidden="true">
          <div className="track" id="tr">
            {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
        </div>

        <section id="services">
          <div className="wrap">
            <h2>What she hosts</h2>
            <p className="sub">
              One alaga from the first knock to the last dance, so your families can simply enjoy
              the day.
            </p>
            <div>
              <div className="row">
                <h3>Alaga Iduro and Ijoko</h3>
                <p>The traditional host of your ceremony: both families, the prayers, the dobale and the praise.</p>
                <a href="#book">Ask about this</a>
              </div>
              <div className="row">
                <h3>Introductions and engagements</h3>
                <p>Parlor and family introductions run with warmth, humour and respect for both houses.</p>
                <a href="#book">Ask about this</a>
              </div>
              <div className="row">
                <h3>Eru Iyawo setup</h3>
                <p>The bride’s entourage and gift presentation, styled and presented beautifully.</p>
                <a href="#book">Ask about this</a>
              </div>
              <div className="row">
                <h3>Training and consultation</h3>
                <p>Learn the work from someone who has done it for 5 years, or get advice before your own event.</p>
                <a href="#training">See training</a>
              </div>
            </div>
          </div>
        </section>

        <section className="wed" id="weddings">
          <div className="wrap">
            <h2>Real weddings, real energy</h2>
            <p className="sub">
              Clips from events she has hosted, shown with each couple’s permission. Swipe to see
              more.
            </p>
          </div>
          <div className="rail" tabIndex={0} aria-label="Wedding clips, scroll sideways">
            <div className="clip"><div><b>Couple name</b>Traditional wedding, Lagos</div></div>
            <div className="clip"><div><b>Couple name</b>Introduction, Ibadan</div></div>
            <div className="clip"><div><b>Couple name</b>The dobale moment</div></div>
            <div className="clip"><div><b>Couple name</b>Engagement</div></div>
            <div className="clip"><div><b>Couple name</b>Eru Iyawo entrance</div></div>
            <div className="clip"><div><b>Couple name</b>Destination event</div></div>
          </div>
        </section>

        <section>
          <div className="wrap ab">
            <div className="por">
              <div>Her portrait in full gele goes here</div>
            </div>
            <div>
              <h2>Hello, I’m Sabi</h2>
              <p style={{ maxWidth: "32em" }}>
                Placeholder story: why she became an alaga, what she takes seriously (starting with
                the dobale), and how she makes both families feel looked after. Written in her own
                voice, because mothers of the bride read this part first.
              </p>
              <div className="stats">
                <div><b>5 years</b>hosting</div>
                <div><b>102K</b>TikTok followers</div>
                <div><b>2.8M</b>TikTok likes</div>
                <div><b>Lagos, Ibadan</b>and beyond</div>
              </div>
            </div>
          </div>
        </section>

        <section className="say">
          <div className="wrap">
            <h2>What people say</h2>
            <p className="big">
              “Placeholder: a couple describes how she calmed both families and kept the whole day
              on time.”
            </p>
            <b>Bride and groom, Lagos</b>
            <div className="small">
              <blockquote>
                <p>“Placeholder: a mother of the bride on how respectful and organised the introduction was.”</p>
                <b>Mother of the bride, Ibadan</b>
              </blockquote>
              <blockquote>
                <p>“Placeholder: a trainee on booking their first event after her course.”</p>
                <b>Training graduate</b>
              </blockquote>
            </div>
          </div>
        </section>

        <section className="tk" id="training">
          <div className="wrap">
            <div className="ticket">
              <div>
                <h2>Learn to be an alaga</h2>
                <p style={{ maxWidth: "30em", color: "var(--muted)" }}>
                  Training from a working alaga on the craft, the culture and the business. Format,
                  price and next start date to be confirmed.
                </p>
                <a className="btn gold" href="#book" style={{ borderColor: "var(--indigo)" }}>
                  Join the waitlist
                </a>
              </div>
              <ul>
                <li>Hosting and stage presence</li>
                <li>Traditions and protocols</li>
                <li>Styling and presentation</li>
                <li>Pricing and finding clients</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="book" id="book">
          <div className="wrap">
            <h2>Save your date</h2>
            <p className="sub">
              Tell her about your event. This opens WhatsApp with your details ready to send.
            </p>
            <form id="f" ref={formRef}>
              <label>
                Your name
                <input id="n" required autoComplete="name" />
              </label>
              <label>
                Event type
                <select id="t">
                  <option>Traditional wedding</option>
                  <option>Introduction</option>
                  <option>Engagement</option>
                  <option>Training or consultation</option>
                </select>
              </label>
              <label>
                Event date
                <input id="d" type="date" />
              </label>
              <label>
                Your WhatsApp number
                <input id="p" type="tel" inputMode="tel" placeholder="080..." />
              </label>
              <label>
                City or venue
                <input id="c" placeholder="Lagos, Ibadan or elsewhere" />
              </label>
              <label className="f">
                Estimated guests
                <input id="g" inputMode="numeric" placeholder="e.g. 300" />
              </label>
              <button className="btn gold" type="submit">Send on WhatsApp</button>
              <p className="note">
                Prototype: the WhatsApp number is a placeholder until her real number is confirmed.
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div>
            <b>The Sabi Alaga</b>
            <br />
            Yoruba traditional wedding host
            <br />
            Lagos and Ibadan
            <br />
            <a href="#book">Check your date</a> {" · "}
            <a href="#training">Training</a>
          </div>
          <div>
            Instagram and TikTok: @thesabialaga
            <br />
            <a href={"https://wa.me/" + WHATSAPP_NUMBER} aria-label="WhatsApp number placeholder">
              WhatsApp: 0808 919 3663
            </a>
          </div>
        </div>
      </footer>

      <a
        className="wa"
        href={
          "https://wa.me/" + WHATSAPP_NUMBER +
          "?text=Hello%20Sabi%2C%20I%27d%20like%20to%20ask%20about%20my%20event."
        }
        aria-label="Chat on WhatsApp"
      >
        Chat on WhatsApp
      </a>
    </>
  );
}
