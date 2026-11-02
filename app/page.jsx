import Curtain from "./components/Curtain";
import LiveSections from "./components/LiveSections";
import WaFab from "./components/WaFab";
import MotionEffects from "./components/MotionEffects";
import { DEFAULT_SECTIONS } from "./lib/content";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://thesabialaga.netlify.app";

// Content comes from the Firestore "content/home" doc the admin publishes.
// At build time we fetch it through the site's own function; if that fails
// (first deploy, network hiccup) the built-in defaults render instead, so the
// page is never empty. LiveSections then re-checks on every visit, so edits
// show up immediately without waiting for a publish.
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

export default async function Page() {
  const sections = (await loadContent()) || DEFAULT_SECTIONS;
  return (
    <>
      <Curtain />
      <LiveSections initial={sections} />
      <WaFab />
      <MotionEffects />
    </>
  );
}
