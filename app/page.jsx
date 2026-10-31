import Curtain from "./components/Curtain";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Services from "./components/Services";
import Weddings from "./components/Weddings";
import About from "./components/About";
import Shop from "./components/Shop";
import Testimonials from "./components/Testimonials";
import Training from "./components/Training";
import Booking from "./components/Booking";
import Footer from "./components/Footer";
import WaFab from "./components/WaFab";
import MotionEffects from "./components/MotionEffects";
import { DEFAULT_SECTIONS } from "./lib/content";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://thesabialaga.netlify.app";

// Content comes from the Firestore "content/home" doc the admin publishes.
// At build time we fetch it through the site's own function; if that fails
// (first deploy, network hiccup) the built-in defaults render instead, so the
// page is never empty.
async function loadContent() {
  const endpoints = [BASE, "https://deploy-preview-2--thesabialaga.netlify.app"];
  for (const base of endpoints) {
    try {
      const r = await fetch(base + "/.netlify/functions/firebase-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publicContent", page: "home" }),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const sections = j && j.content && Array.isArray(j.content.sections) ? j.content.sections : null;
      if (sections && sections.length) return sections;
    } catch (e) {}
  }
  return null;
}

const pick = (sections, type) => {
  const s = sections.find((x) => x.type === type && x.vis !== false);
  return s ? s.data : undefined;
};

export default async function Page() {
  const sections = (await loadContent()) || DEFAULT_SECTIONS;
  return (
    <>
      <Curtain />
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
      <WaFab />
      <MotionEffects />
    </>
  );
}
