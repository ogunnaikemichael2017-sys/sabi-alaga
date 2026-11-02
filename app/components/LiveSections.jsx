"use client";

// Live content layer: the page first renders the copy baked at build time
// (fast, SEO-friendly, never empty), then checks Firestore for newer content
// and swaps it in within a second or two if it differs. Edits made in the
// admin therefore appear on the site as soon as the visitor refreshes,
// without waiting for a publish.
import { useEffect, useState } from "react";
import Hero from "./Hero";
import Marquee from "./Marquee";
import Services from "./Services";
import Weddings from "./Weddings";
import About from "./About";
import Shop from "./Shop";
import Testimonials from "./Testimonials";
import Training from "./Training";
import Booking from "./Booking";
import Footer from "./Footer";

const pick = (sections, type) => {
  const s = sections.find((x) => x.type === type && x.vis !== false);
  return s ? s.data : undefined;
};

export default function LiveSections({ initial }) {
  const [sections, setSections] = useState(initial);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/.netlify/functions/firebase-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publicContent", page: "home" }),
          cache: "no-store",
        });
        const j = await r.json();
        const live = j && j.content && Array.isArray(j.content.sections) ? j.content.sections : null;
        if (!dead && live && live.length && JSON.stringify(live) !== JSON.stringify(initial)) {
          setSections(live);
        }
      } catch (e) {
        // keep the baked content; the site must never go blank
      }
    })();
    return () => { dead = true; };
  }, [initial]);

  return (
    <>
      <Hero data={pick(sections, "hero")} />
      <Marquee data={pick(sections, "marquee")} />
      <Services data={pick(sections, "services")} />
      <Weddings data={pick(sections, "weddings")} />
      <About data={pick(sections, "about")} />
      <Shop data={pick(sections, "shop")} />
      <Testimonials data={pick(sections, "testimonials")} />
      <Training data={pick(sections, "training")} />
      <Booking data={pick(sections, "booking")} />
      <Footer data={pick(sections, "footer")} />
    </>
  );
}
