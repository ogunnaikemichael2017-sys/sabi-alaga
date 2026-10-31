"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SECTIONS } from "../lib/content";
import { addPending } from "./pending";

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

function token() {
  const s = JSON.parse(localStorage.getItem("sa_admin") || "null");
  return s && s.idToken;
}

// Section names as shown in the prototype.
const NAMES = {
  hero: "Hero video", marquee: "Praise marquee", services: "Services stack",
  weddings: "Wedding reel", about: "About with scroll video", shop: "Shop",
  testimonials: "Testimonials", training: "Training teaser", booking: "Booking form",
  footer: "Footer",
  text: "Text and image", gallery: "Photo gallery", video: "Video",
  cta: "Call to action", faq: "FAQ", pricing: "Pricing", stats: "Numbers strip",
};

const BLK_DESC = {
  services: "Sticky service cards", weddings: "Sideways video clips", about: "Bio, scrub video",
  testimonials: "Drifting message cards", shop: "What she sells", training: "Invitation ticket",
  text: "Flexible block", gallery: "Flexible block", video: "Flexible block",
  cta: "Flexible block", faq: "Flexible block", pricing: "Flexible block", stats: "Flexible block",
};

// Blocks the "Add a section" picker offers, in the prototype's order.
const NEWT = ["services", "weddings", "testimonials", "shop", "text", "gallery", "video", "cta", "faq", "pricing", "stats"];

// [key, label, long] per section type. long = render a textarea.
// A 4th entry marks a field that picks a file from the media library.
const FIELD_MAP = {
  hero: [["headline", "Headline"], ["sub", "Intro text", 1], ["btn", "Button label"], ["video", "Hero video", 0, 1]],
  marquee: [["words", "Words (comma separated)"]],
  services: [["title", "Heading"], ["intro", "Intro", 1]],
  weddings: [["title", "Heading"], ["sub", "Note under the heading", 1]],
  about: [["title", "Heading"], ["story", "Her story", 1], ["img", "Portrait photo", 0, 1], ["imgAlt", "Portrait description"]],
  shop: [["title", "Heading"]],
  testimonials: [["title", "Heading"], ["quote", "Big quote", 1], ["by", "Who said it"]],
  training: [["title", "Heading"], ["text", "Text", 1], ["btn", "Button label"]],
  booking: [["title", "Heading"], ["intro", "Intro", 1]],
  footer: [["tag", "Tagline"], ["fline", "Footer line", 1]],
};

const LIST_MAP = {
  services: { key: "cards", label: "Cards", fields: [["h", "Title"], ["p", "Description", 1], ["a", "Button label"], ["href", "Button link"], ["img", "Photo", 0, 1], ["alt", "Photo description"]] },
  weddings: { key: "clips", label: "Clips", fields: [["t", "Title"], ["s", "Subtitle"], ["v", "Video", 0, 1]] },
  shop: { key: "cards", label: "Items", fields: [["h", "Name"], ["p", "Description", 1], ["img", "Photo", 0, 1], ["alt", "Photo description"]] },
  testimonials: { key: "cards", label: "Messages", fields: [["i", "Screenshot", 0, 1], ["a", "Caption"]] },
  training: { key: "items", label: "Lines", strings: 1 },
  footer: { key: "soc", label: "Social links", fields: [["l", "Name"], ["n", "Follower count"], ["u", "Address (web link)"]] },
};

const BLANKS = {
  services: { h: "", p: "", a: "Ask about this", href: "#book", img: "", alt: "" },
  weddings: { t: "", s: "", v: "" },
  shop: { h: "", p: "", img: "", alt: "" },
  testimonials: { i: "", a: "" },
  footer: { l: "", n: "", u: "" },
};

const MORE_OFF = ["hero", "marquee", "footer", "booking"];

function singular(word) {
  return word.replace(/s$/, "");
}

function MediaSelect({ media, sectionId, value, onChange, disabled }) {
  const cur = value || "";
  const known = (media || []).find((m) => m.url === cur);
  const inSection = (media || []).filter((m) => sectionId && m.f === sectionId);
  const rest = (media || []).filter((m) => !(sectionId && m.f === sectionId));
  const opt = (m) => <option key={m.id} value={m.url}>{m.name}</option>;
  return (
    <select value={cur} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">None</option>
      {cur && !known && <option value={cur}>(current file)</option>}
      {inSection.length > 0 && <optgroup label="In this section">{inSection.map(opt)}</optgroup>}
      <optgroup label={inSection.length ? "Other files" : "All files"}>{rest.map(opt)}</optgroup>
    </select>
  );
}

function Field({ label, value, long, media, mediaList, sectionId, disabled, onChange }) {
  if (media) {
    return (
      <label>
        {label}
        <MediaSelect media={mediaList} sectionId={sectionId} value={value} onChange={onChange} disabled={disabled} />
      </label>
    );
  }
  const common = { value: value == null ? "" : value, disabled, onChange: (e) => onChange(e.target.value) };
  return (
    <label>
      {label}
      {long ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
    </label>
  );
}

export default function Editor({ me, page = "home", onPageChange, toast }) {
  const [sections, setSections] = useState(null);
  const [orig, setOrig] = useState("");
  const [title, setTitle] = useState("");
  const [origTitle, setOrigTitle] = useState("");
  const [pages, setPages] = useState([]);
  const [media, setMedia] = useState([]);
  const [edit, setEdit] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState("");
  const [loaded, setLoaded] = useState(false);

  const canEdit = me && ["owner", "editor"].includes(me.role);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = token();
        const [p, m] = await Promise.all([
          post({ action: "listPages", idToken: t }),
          post({ action: "listMedia", idToken: t }),
        ]);
        if (alive && p.status === 200) setPages(p.data.pages || []);
        if (alive && m.status === 200) setMedia((m.data.items || []).map((x) => ({ ...x, f: x.f || "" })));
      } catch (e) {}
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setEdit(null);
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
      setTitle(t || "");
      setOrigTitle(t || "");
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [page]);

  const dirty = loaded && (JSON.stringify(sections) !== orig || title !== origTitle);

  const pageSlug = (p) => (p.id === "home" ? "/" : "/" + p.id);
  const pageLabel = (p) => (p.title || p.id) + " (" + pageSlug(p) + ")";

  function bump() { addPending(1); }

  function setSection(i, data) {
    setSections((cur) => cur.map((s, n) => (n === i ? { ...s, data } : s)));
  }
  function setVis(i, vis) {
    setSections((cur) => cur.map((s, n) => (n === i ? { ...s, vis } : s)));
    bump();
  }
  function setItem(i, key, n, k, v) {
    setSection(i, { ...sections[i].data, [key]: sections[i].data[key].map((it, j) => (j === n ? { ...it, [k]: v } : it)) });
  }
  function addItem(i, key) {
    const list = LIST_MAP[sections[i].type];
    const blank = list.strings ? "" : JSON.parse(JSON.stringify(BLANKS[sections[i].type]));
    setSection(i, { ...sections[i].data, [key]: [...(sections[i].data[key] || []), blank] });
    bump();
  }
  function delItem(i, key, n) {
    setSection(i, { ...sections[i].data, [key]: sections[i].data[key].filter((x, j) => j !== n) });
    bump();
  }
  function setStringItem(i, key, n, v) {
    setSection(i, { ...sections[i].data, [key]: sections[i].data[key].map((x, j) => (j === n ? v : x)) });
  }
  function moveItem(i, key, n, d) {
    const arr = sections[i].data[key];
    const j = n + d;
    if (j < 0 || j >= arr.length) return;
    const next = arr.slice();
    const x = next[n]; next[n] = next[j]; next[j] = x;
    setSection(i, { ...sections[i].data, [key]: next });
    bump();
  }
  function setMore(i, patch) {
    setSections((cur) => cur.map((s, n) => (n === i ? { ...s, more: { on: false, label: "See more", page: "", ...(s.more || {}), ...patch } } : s)));
    bump();
  }

  function moveSection(id, d) {
    const i = sections.findIndex((s) => s.id === id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= sections.length) return;
    const next = sections.slice();
    const x = next[i]; next[i] = next[j]; next[j] = x;
    setSections(next);
    bump();
  }

  function addSection(type) {
    const data = {};
    (FIELD_MAP[type] || []).forEach(([k]) => { data[k] = ""; });
    (LIST_MAP[type] ? [LIST_MAP[type]] : []).forEach((l) => { data[l.key] = []; });
    if (data.title === "") data.title = "New " + (NAMES[type] || type).toLowerCase();
    const s = { id: type + "-" + Math.random().toString(36).slice(2, 7), type, vis: true, data };
    const at = page === "home" ? sections.length - 1 : sections.length;
    const next = sections.slice();
    next.splice(at, 0, s);
    setSections(next);
    setModal(null);
    setEdit(s.id);
    bump();
    toast && toast("Section added to your draft");
  }

  function removeSection(id) {
    setSections((cur) => cur.filter((s) => s.id !== id));
    setModal(null);
    bump();
    toast && toast("Section removed from draft");
  }

  async function createPageFor(i) {
    if (!canEdit || busy) return;
    setBusy(true);
    const s = sections[i];
    const base = (s.data.title || NAMES[s.type] || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "section";
    const r = await post({ action: "savePage", idToken: token(), title: s.data.title || NAMES[s.type] || "New page", slug: base });
    if (r.status === 200 && r.data.ok) {
      const fresh = await post({ action: "listPages", idToken: token() });
      if (fresh.status === 200) setPages(fresh.data.pages || []);
      setMore(i, { on: true, page: r.data.slug });
      toast && toast("Dedicated page created at /" + r.data.slug + ". Add its content in Sections.");
    } else {
      toast && toast(r.data.error || "Could not create the page.");
    }
    setBusy(false);
  }

  async function save() {
    if (!canEdit || busy || !dirty) return;
    setBusy(true);
    setNote("");
    try {
      const r = await post({ action: "saveContent", page, idToken: token(), sections, title: title || undefined });
      if (r.status === 200 && r.data.ok) {
        setOrig(JSON.stringify(sections));
        setOrigTitle(title);
        setNote("Saved. Publish to send it to the live site.");
        setTone("ok");
      } else {
        setNote(r.data.error === "your role cannot edit content" ? "Your role cannot edit content." : "Could not save: " + (r.data.error || "try again."));
        setTone("bad");
      }
    } catch (e) {
      setNote("Could not save. Check your connection and try again.");
      setTone("bad");
    }
    setBusy(false);
  }

  if (!loaded) return <p className="mut">Loading your content&hellip;</p>;

  // ---------- the section editor screen ----------
  if (edit) {
    const i = sections.findIndex((s) => s.id === edit);
    if (i < 0) { setEdit(null); return null; }
    const s = sections[i];
    const d = s.data || {};
    const fields = FIELD_MAP[s.type] || [];
    const list = LIST_MAP[s.type];
    const head = d.headline || d.title || d.tag || NAMES[s.type] || s.type;
    const intro = d.sub || d.intro || d.text || d.body || d.story || "";
    return (
      <div>
        <div>
          <button className="btn s" type="button" onClick={() => setEdit(null)}>Back to sections</button>{" "}
          <span className="pill f">{NAMES[s.type] || s.type}</span>
        </div>
        <div style={{ height: 12 }} />
        <div className="prev">
          <h3>{head}</h3>
          {intro ? <p>{intro}</p> : <p>Preview of this section on the live site</p>}
        </div>
        {fields.map(([k, label, long, isMedia]) => (
          <Field
            key={k}
            label={label}
            value={d[k]}
            long={long}
            media={isMedia}
            mediaList={media}
            sectionId={s.id}
            disabled={!canEdit}
            onChange={(v) => { setSection(i, { ...d, [k]: v }); bump(); }}
          />
        ))}
        {list && (
          <div>
            <h3 style={{ fontSize: 18, margin: "6px 0 10px" }}>{list.label} ({(d[list.key] || []).length})</h3>
            {(d[list.key] || []).map((it, n) => (
              <div className="it" key={n}>
                <div className="ith">
                  <span>{singular(list.label)} {n + 1}</span>
                  <span className="ib">
                    <button className="btn s" type="button" disabled={n === 0} onClick={() => moveItem(i, list.key, n, -1)}>Up</button>
                    <button className="btn s" type="button" disabled={n === (d[list.key] || []).length - 1} onClick={() => moveItem(i, list.key, n, 1)}>Down</button>
                    <button className="btn s d" type="button" onClick={() => delItem(i, list.key, n)}>Remove</button>
                  </span>
                </div>
                {list.strings ? (
                  <Field label={"Line " + (n + 1)} value={it} disabled={!canEdit} onChange={(v) => setStringItem(i, list.key, n, v)} />
                ) : (
                  list.fields.map(([k, label, long, isMedia]) => (
                    <Field
                      key={k}
                      label={label}
                      value={it[k]}
                      long={long}
                      media={isMedia}
                      mediaList={media}
                      sectionId={s.id}
                      disabled={!canEdit}
                      onChange={(v) => { setItem(i, list.key, n, k, v); bump(); }}
                    />
                  ))
                )}
              </div>
            ))}
            {canEdit && <button className="btn s g" type="button" onClick={() => addItem(i, list.key)}>Add {singular(list.label).toLowerCase()}</button>}
            <div style={{ height: 16 }} />
          </div>
        )}
        {!MORE_OFF.includes(s.type) && (
          <div className="card" style={{ marginTop: 8 }}>
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>&ldquo;See more&rdquo; button</h3>
            <p className="mut">Add a button under this section that takes visitors to a dedicated page.</p>
            <label className="chk">
              <input type="checkbox" checked={!!(s.more && s.more.on)} disabled={!canEdit} onChange={(e) => setMore(i, { on: e.target.checked })} />
              Show the button
            </label>
            {s.more && s.more.on && (
              <>
                <Field label="Button label" value={(s.more && s.more.label) || "See more"} disabled={!canEdit} onChange={(v) => setMore(i, { label: v })} />
                <label>
                  Opens this page
                  <select value={(s.more && s.more.page) || ""} disabled={!canEdit} onChange={(e) => setMore(i, { page: e.target.value })}>
                    <option value="">Choose a page</option>
                    {pages.filter((p) => p.id !== "home" && p.id !== page).map((p) => (
                      <option key={p.id} value={p.id}>{(p.title || p.id) + " (" + pageSlug(p) + ")"}</option>
                    ))}
                  </select>
                </label>
                <button className="btn g" type="button" disabled={busy || !canEdit} onClick={() => createPageFor(i)}>Create a dedicated page for this section</button>
                {s.more.page && (
                  <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={() => { onPageChange && onPageChange(s.more.page); }}>Edit that page</button>
                )}
              </>
            )}
          </div>
        )}
        <div style={{ height: 16 }} />
        <button className="btn p" type="button" disabled={!dirty || busy || !canEdit} onClick={save}>
          {busy ? "Saving\u2026" : dirty ? "Save changes" : "Saved"}
        </button>
        {note && <p className={"mut"} style={{ marginTop: 8, color: tone === "bad" ? "var(--fuchsia)" : undefined }}>{note}</p>}
      </div>
    );
  }

  // ---------- the sections list ----------
  const pg = pages.find((p) => p.id === page);
  return (
    <div>
      <h2>Sections</h2>
      <label>
        Editing page
        <select className="keep" value={page} onChange={(e) => onPageChange && onPageChange(e.target.value)}>
          {pages.length === 0 && <option value={page}>{pageLabel({ id: page, title: title || page })}</option>}
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{pageLabel(p)}</option>
          ))}
        </select>
      </label>
      {page !== "home" && <p className="mut" style={{ marginTop: -6 }}>This is a dedicated page. Visitors reach it from a &ldquo;See more&rdquo; button.</p>}
      <label>
        Page name (shows in the Pages list)
        <input type="text" value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <p className="mut">Change the order, hide, edit or remove any part of the page. Nothing goes live until you publish.</p>
      {canEdit && <button className="btn g" type="button" style={{ marginBottom: 14 }} onClick={() => setModal({ t: "add" })}>Add a section</button>}
      {(sections || []).map((s, i) => {
        const d = s.data || {};
        const badge = s.more && s.more.on && s.more.page ? (
          <span> <span className="pill ok">See more &rarr; /{s.more.page}</span></span>
        ) : null;
        return (
          <div className={"row" + (s.vis === false ? " hid" : "")} key={s.id || i}>
            <span className="nm">
              {NAMES[s.type] || s.type}
              <br />
              <span className="mut">{d.headline || d.title || d.tag || "Untitled"}</span>
              {badge}
            </span>
            <button className="btn s" type="button" disabled={i === 0} onClick={() => moveSection(s.id, -1)}>Up</button>
            <button className="btn s" type="button" disabled={i === sections.length - 1} onClick={() => moveSection(s.id, 1)}>Down</button>
            <button className="btn s" type="button" onClick={() => setVis(i, s.vis === false)}>{s.vis === false ? "Show" : "Hide"}</button>
            <button className="btn s p" type="button" onClick={() => setEdit(s.id)}>Edit</button>
            {canEdit && <button className="btn s d" type="button" onClick={() => setModal({ t: "del", id: s.id })}>Remove</button>}
          </div>
        );
      })}
      {modal && modal.t === "add" && (
        <div className="modal" onClick={() => setModal(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h3>Add a section</h3>
            <p className="mut">Pick a block. You fill in the content next.</p>
            <div className="blocks">
              {NEWT.map((k) => (
                <button key={k} type="button" onClick={() => addSection(k)}>
                  <b>{NAMES[k]}</b>
                  <span>{BLK_DESC[k]}</span>
                </button>
              ))}
            </div>
            <button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
      {modal && modal.t === "del" && (
        <div className="modal" onClick={() => setModal(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h3>Remove this section?</h3>
            <p className="mut">It leaves the page when you save. Keep a copy of anything you want back.</p>
            <button className="btn p" type="button" onClick={() => removeSection(modal.id)}>Remove</button>{" "}
            <button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ height: 8 }} />
      <button className="btn p" type="button" disabled={!dirty || busy || !canEdit} onClick={save}>
        {busy ? "Saving\u2026" : dirty ? "Save changes" : "Saved"}
      </button>
      {note && <p className="mut" style={{ marginTop: 8, color: tone === "bad" ? "var(--fuchsia)" : undefined }}>{note}</p>}
      {pg && pg.updated && <p className="mut" style={{ marginTop: 6 }}>This page was last saved {new Date(pg.updated).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>}
    </div>
  );
}
