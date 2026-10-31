"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SECTIONS } from "../lib/content";

const API = "/.netlify/functions/firebase-proxy";

async function post(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const NAMES = {
  hero: "Top banner", marquee: "Scrolling words", services: "What she does",
  weddings: "Wedding videos", about: "About Sabi", shop: "What she sells",
  testimonials: "Kind words", training: "Training", booking: "Booking", footer: "Footer",
};

// [key, label, long] per section type. long = render a textarea.
const FIELD_MAP = {
  hero: [["headline", "Headline"], ["sub", "Text under the headline", 1], ["btn", "Button text"], ["video", "Hero video address"]],
  marquee: [["words", "Scrolling words"]],
  services: [["title", "Title"], ["intro", "Intro", 1]],
  weddings: [["title", "Title"], ["sub", "Note under the title", 1]],
  about: [["title", "Title"], ["story", "Her story", 1], ["img", "Portrait image address"], ["imgAlt", "Portrait description"]],
  shop: [["title", "Title"]],
  testimonials: [["title", "Title"], ["quote", "Big quote", 1], ["by", "Who said it"]],
  training: [["title", "Title"], ["text", "Text", 1], ["btn", "Button text"]],
  booking: [["title", "Title"], ["intro", "Intro", 1]],
  footer: [["tag", "Tagline"], ["fline", "Footer line", 1]],
};

const LIST_MAP = {
  services: { key: "cards", label: "Service cards", fields: [["h", "Name"], ["p", "Description", 1], ["a", "Link text"], ["href", "Link address"], ["img", "Image address"], ["alt", "Image description"]] },
  weddings: { key: "clips", label: "Video clips", fields: [["t", "Title"], ["s", "Small text"], ["v", "Video address"]] },
  shop: { key: "cards", label: "Products", fields: [["h", "Name"], ["p", "Description", 1], ["img", "Image address"], ["alt", "Image description"]] },
  testimonials: { key: "cards", label: "Message screenshots", fields: [["i", "Image address"], ["a", "Description"]] },
  training: { key: "items", label: "What she teaches", strings: 1 },
  footer: { key: "soc", label: "Social links", fields: [["l", "Name"], ["n", "Follower count"], ["u", "Address (web link)"]] },
};

const BLANKS = {
  services: { h: "", p: "", a: "Ask about this", href: "#book", img: "", alt: "" },
  weddings: { t: "", s: "", v: "" },
  shop: { h: "", p: "", img: "", alt: "" },
  testimonials: { i: "", a: "" },
  footer: { l: "", n: "", u: "" },
};

function Field({ label, value, long, disabled, onChange }) {
  const common = { value: value == null ? "" : value, disabled, onChange: (e) => onChange(e.target.value) };
  return (
    <label className="sa-field">
      <span>{label}</span>
      {long ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
    </label>
  );
}

export default function Editor({ me, page = "home", onPageChange }) {
  const [sections, setSections] = useState(null);
  const [orig, setOrig] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tone, setTone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pages, setPages] = useState([]);
  const [title, setTitle] = useState("");
  const [origTitle, setOrigTitle] = useState("");

  const canEdit = me && ["owner", "editor"].includes(me.role);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem("sa_admin") || "null");
        const r = await post({ action: "listPages", idToken: saved && saved.idToken });
        if (alive && r.status === 200) setPages(r.data.pages || []);
      } catch (e) {}
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    (async () => {
      let list = null;
      let t = "";
      try {
        const r = await post({ action: "publicContent", page });
        if (r.status === 200 && r.data.content && Array.isArray(r.data.content.sections)) {
          list = r.data.content.sections;
          t = r.data.content.title || "";
        }
      } catch (e) {}
      if (!alive) return;
      if (!list) list = page === "home" ? JSON.parse(JSON.stringify(DEFAULT_SECTIONS)) : [];
      setSections(list);
      setOrig(JSON.stringify(list));
      setTitle(t || page);
      setOrigTitle(t || page);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [page]);

  const dirty = loaded && (JSON.stringify(sections) !== orig || title !== origTitle);
  const shown = useMemo(() => (sections || []).length, [sections]);

  function setSection(i, data) {
    setSections((cur) => cur.map((s, n) => (n === i ? { ...s, data } : s)));
  }
  function setVis(i, vis) {
    setSections((cur) => cur.map((s, n) => (n === i ? { ...s, vis } : s)));
  }
  function setItem(i, key, n, k, v) {
    setSection(i, { ...sections[i].data, [key]: sections[i].data[key].map((it, j) => (j === n ? { ...it, [k]: v } : it)) });
  }
  function addItem(i, key) {
    const blank = LIST_MAP[sections[i].type].strings ? "" : JSON.parse(JSON.stringify(BLANKS[sections[i].type]));
    setSection(i, { ...sections[i].data, [key]: [...(sections[i].data[key] || []), blank] });
  }
  function delItem(i, key, n) {
    setSection(i, { ...sections[i].data, [key]: sections[i].data[key].filter((x, j) => j !== n) });
  }
  function setStringItem(i, key, n, v) {
    setSection(i, { ...sections[i].data, [key]: sections[i].data[key].map((x, j) => (j === n ? v : x)) });
  }

  const MORE_OFF = ["hero", "marquee", "footer", "booking"];
  function setMore(i, patch) {
    setSections((cur) => cur.map((s, n) => (n === i ? { ...s, more: { on: false, label: "See more", page: "", ...(s.more || {}), ...patch } } : s)));
  }

  async function save() {
    if (!canEdit || busy || !dirty) return;
    setBusy(true);
    setNotice("");
    try {
      const saved = JSON.parse(localStorage.getItem("sa_admin") || "null");
      const r = await post({ action: "saveContent", page, idToken: saved && saved.idToken, sections, title });
      if (r.status === 200 && r.data.ok) {
        setOrig(JSON.stringify(sections));
        setOrigTitle(title);
        setNotice("Saved. Your changes reach the website on the next publish.");
        setTone("ok");
      } else {
        setNotice(r.data.error === "your role cannot edit content" ? "Your role cannot edit content." : "Could not save: " + (r.data.error || "try again."));
        setTone("bad");
      }
    } catch (e) {
      setNotice("Could not save. Check your connection and try again.");
      setTone("bad");
    }
    setBusy(false);
  }

  if (!canEdit) {
    return <p className="sa-note bad">This account can look around but not edit content. Michael can change your role.</p>;
  }
  if (!loaded) return <p className="sa-sub">Loading your content&hellip;</p>;

  return (
    <div className="sa-editor">
      <h3>Website content</h3>
      <label className="sa-field">
        <span>Editing page</span>
        <select value={page} onChange={(e) => onPageChange && onPageChange(e.target.value)}>
          {pages.length === 0 && <option value={page}>{page}</option>}
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{(p.title || p.id) + (p.id === "home" ? " (home)" : "")}</option>
          ))}
        </select>
      </label>
      {page !== "home" && <p className="sa-hint">This is a dedicated page. Visitors reach it from a &quot;See more&quot; button.</p>}
      <label className="sa-field">
        <span>Page name (shows in the Pages list)</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <p className="sa-hint">{shown} sections on the page. Open one, change the words, then save.</p>
      {(sections || []).map((s, i) => {
        const d = s.data || {};
        const fields = FIELD_MAP[s.type] || [];
        const list = LIST_MAP[s.type];
        return (
          <details className="sa-sec" key={s.id || i}>
            <summary>
              {NAMES[s.type] || s.type}
              {dirty ? "" : ""}
              <label className="sa-vis" onClick={(e) => e.preventDefault()}>
                <input type="checkbox" checked={s.vis !== false} disabled={!canEdit} onChange={(e) => setVis(i, e.target.checked)} />
                Shown
              </label>
            </summary>
            <div>
              {fields.map(([k, label, long]) => (
                <Field key={k} label={label} value={d[k]} long={long} disabled={!canEdit} onChange={(v) => setSection(i, { ...d, [k]: v })} />
              ))}
              {list && (
                <div className="sa-list">
                  <p className="sa-hint">{list.label}</p>
                  {(d[list.key] || []).map((it, n) => (
                    <div className="sa-item" key={n}>
                      {list.strings ? (
                        <Field label={"Line " + (n + 1)} value={it} disabled={!canEdit} onChange={(v) => setStringItem(i, list.key, n, v)} />
                      ) : (
                        list.fields.map(([k, label, long]) => (
                          <Field key={k} label={label} value={it[k]} long={long} disabled={!canEdit} onChange={(v) => setItem(i, list.key, n, k, v)} />
                        ))
                      )}
                      {canEdit && <button type="button" className="sa-mini" onClick={() => delItem(i, list.key, n)}>Remove</button>}
                    </div>
                  ))}
                  {canEdit && <button type="button" className="sa-mini" onClick={() => addItem(i, list.key)}>Add one</button>}
                </div>
              )}
              {!MORE_OFF.includes(s.type) && (
                <div className="sa-card">
                  <h4>&quot;See more&quot; button</h4>
                  <p className="sa-hint">Add a button under this section that takes visitors to a dedicated page.</p>
                  <label className="sa-vis">
                    <input type="checkbox" checked={!!(s.more && s.more.on)} onChange={(e) => setMore(i, { on: e.target.checked })} />
                    Show the button
                  </label>
                  {s.more && s.more.on && (
                    <>
                      <Field label="Button label" value={(s.more && s.more.label) || "See more"} onChange={(v) => setMore(i, { label: v })} />
                      <label className="sa-field">
                        <span>Opens this page</span>
                        <select value={(s.more && s.more.page) || ""} onChange={(e) => setMore(i, { page: e.target.value })}>
                          <option value="">Choose a page</option>
                          {pages.filter((p) => p.id !== page).map((p) => (
                            <option key={p.id} value={p.id}>{p.title || p.id}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          </details>
        );
      })}
      <button className="sa-btn sa-primary" disabled={!dirty || busy} onClick={save}>
        {busy ? "Saving\u2026" : dirty ? "Save changes" : "Saved"}
      </button>
      <p className={`sa-note ${tone}`} role="status">{notice}</p>
    </div>
  );
}
