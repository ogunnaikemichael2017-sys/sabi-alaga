"use client";

import { useEffect, useState } from "react";
import { addPending } from "./pending";
import { cacheGet, cacheSet } from "./cache";

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

// Warm-up: fetch everything the panels need in one parallel batch right after
// sign-in, so each panel opens instantly from cache and only refreshes after.
export async function prefetchAdminData() {
  const t = token();
  if (!t) return;
  const [pg, m, tm, e] = await Promise.all([
    post({ action: "listPages", idToken: t }),
    post({ action: "listMedia", idToken: t }),
    post({ action: "listTeam", idToken: t }),
    post({ action: "listEnquiries", idToken: t }),
  ]);
  if (pg.status === 200) cacheSet("pages", pg.data.pages || []);
  if (m.status === 200) cacheSet("media", (m.data.items || []).map((x) => ({ ...x, f: x.f || "" })));
  if (tm.status === 200) cacheSet("team", tm.data.team || []);
  if (e.status === 200) cacheSet("enquiries", e.data.enquiries || []);
}

function fmtWhen(iso) {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}

function kbText(kb) {
  if (!kb) return "";
  return kb > 999 ? (kb / 1000).toFixed(1) + " MB" : kb + " KB";
}

// Section folders: one per section across every page, plus Unsorted.
function folders(pages, contentByPage) {
  const out = [];
  const seen = {};
  const counts = {};
  (pages || []).forEach((p) => {
    ((contentByPage && contentByPage[p.id]) || []).forEach((s) => {
      if (seen[s.id]) return;
      seen[s.id] = 1;
      let label = s.label + (p.id === "home" ? "" : " (" + (p.title || p.id) + ")");
      counts[label] = (counts[label] || 0) + 1;
      if (counts[label] > 1) label = label + " " + counts[label];
      out.push({ id: s.id, label });
    });
  });
  out.push({ id: "", label: "Unsorted" });
  return out;
}

export function Overview({ me, go }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    const build = (media, enq, team, home, metaD) => {
      const homeSections = (home && home.sections) || [];
      return {
        media, enq, team,
        live: homeSections.filter((x) => x.vis !== false).length,
        total: homeSections.length,
        activity: ((metaD && metaD.activity) || []).map((x) => {
          const at = String(x || "").split("::");
          return { when: at[0] || "", text: at.slice(1).join("::") || String(x) };
        }),
      };
    };
    const paint = () => {
      const cm = cacheGet("media"), ce = cacheGet("enquiries"), ct = cacheGet("team"), ch = cacheGet("home");
      if (cm && ce && ct && ch) setD(build(cm, ce, ct, ch, cacheGet("meta") || {}));
    };
    paint();
    (async () => {
      const t = token();
      const [m, e, tm, home, meta] = await Promise.all([
        post({ action: "listMedia", idToken: t }),
        post({ action: "listEnquiries", idToken: t }),
        post({ action: "listTeam", idToken: t }),
        post({ action: "publicContent", page: "home" }),
        post({ action: "getMeta", idToken: t }),
      ]);
      if (!alive) return;
      const media = (m.data.items || []).map((x) => ({ ...x, f: x.f || "" }));
      const enq = e.data.enquiries || [];
      const team = tm.data.team || [];
      const hc = home.data.content || {};
      const metaD = { activity: meta.data.activity || [], blocked: meta.data.blocked || [], settings: meta.data.settings || {} };
      cacheSet("media", media);
      cacheSet("enquiries", enq);
      cacheSet("team", team);
      cacheSet("home", hc);
      cacheSet("meta", metaD);
      setD(build(media, enq, team, hc, metaD));
    })();
    return () => { alive = false; };
  }, []);
  if (!d) return <p className="mut">Loading&hellip;</p>;
  const newEnq = d.enq.filter((x) => x.status === "New").length;
  const toFix = d.media.filter((m) => !m.f).length;
  const name = (me.email || "").split("@")[0].replace(/[^a-zA-Z]+/g, " ").trim();
  const who = name ? name.charAt(0).toUpperCase() + name.slice(1) : "there";
  return (
    <div>
      <h2 style={{ fontSize: 40 }}>Welcome back, {who}</h2>
      <div className="grid">
        <div className="card"><div className="mut">New enquiries</div><div className="big">{newEnq}</div></div>
        <div className="card"><div className="mut">Sections live</div><div className="big">{d.live}/{d.total}</div></div>
        <div className="card"><div className="mut">Media to fix</div><div className="big">{toFix}</div></div>
        <div className="card"><div className="mut">Team</div><div className="big">{d.team.length}</div></div>
      </div>
      <div className="card">
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>Recent activity</h3>
        {d.activity.length === 0 && <div className="mut">No activity yet. Draft saves, uploads and publishes show up here.</div>}
        {d.activity.map((a, i) => (
          <div key={i} className="mut" style={{ padding: "5px 0" }}>
            {a.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pages({ me, onOpen, toast }) {
  const [pages, setPages] = useState(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOwner = me && me.role === "owner";
  const canEdit = me && ["owner", "editor"].includes(me.role);

  async function load() {
    const cp = cacheGet("pages");
    if (cp) setPages(cp);
    const r = await post({ action: "listPages", idToken: token() });
    const ps = r.data.pages || [];
    cacheSet("pages", ps);
    setPages(ps);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!canEdit || busy) return;
    setBusy(true);
    const r = await post({ action: "savePage", idToken: token(), title, slug });
    if (r.status === 200) {
      setTitle(""); setSlug("");
      await load();
      toast && toast("Page created. Open it in Sections to add its content.");
    } else {
      toast && toast(r.data.error || "Could not create the page.");
    }
    setBusy(false);
  }

  async function del(slug) {
    if (!isOwner) return;
    if (!window.confirm("Delete the page " + slug + "? Its content is lost.")) return;
    const r = await post({ action: "deletePage", idToken: token(), slug });
    if (r.status === 200) {
      await load();
      toast && toast("Page removed from draft.");
    } else {
      toast && toast(r.data.error || "Could not delete the page.");
    }
  }

  if (!pages) return <p className="mut">Loading&hellip;</p>;
  return (
    <div>
      <h2>Pages</h2>
      <p className="mut">Home is the main page. A dedicated page gives a section more room, such as every wedding video, and visitors reach it from a &ldquo;See more&rdquo; button.</p>
      {canEdit && (
        <div style={{ margin: "12px 0 14px" }}>
          <button className="btn g" type="button" onClick={() => setAdding(!adding)}>New blank page</button>
        </div>
      )}
      {pages.map((p) => (
        <div className="card" style={{ marginBottom: 12 }} key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <b>{p.title || (p.id === "home" ? "Home" : p.id)}</b>
            <span className={"pill " + (p.id === "home" ? "ok" : "f")}>{p.id === "home" ? "Main page" : "Dedicated page"}</span>
          </div>
          <p className="mut" style={{ margin: "6px 0 0" }}>Address: {p.id === "home" ? "/" : "/" + p.id}</p>
          <p className="mut" style={{ margin: "2px 0 0" }}>{p.sectionCount} sections</p>
          <div style={{ marginTop: 10 }}>
            <button className="btn s p" type="button" onClick={() => onOpen(p.id)}>Edit sections</button>{" "}
            {isOwner && p.id !== "home" && <button className="btn s d" type="button" onClick={() => del(p.id)}>Remove page</button>}
          </div>
        </div>
      ))}
      {canEdit ? (adding ? (
        <form onSubmit={create} style={{ marginTop: 14 }}>
          <div className="card">
            <h3 style={{ fontSize: 18, marginBottom: 10 }}>New blank page</h3>
            <label>Page title<input type="text" placeholder="Real weddings gallery" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label>Address ending (letters and dashes)<input type="text" placeholder="real-weddings" value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
            <button className="btn p" disabled={busy || !slug.trim()} type="submit">{busy ? "Creating\u2026" : "Create page"}</button>
          </div>
        </form>
      ) : null) : (
        <p className="mut">Your role cannot create pages.</p>
      )}
    </div>
  );
}

export function Media({ me, toast }) {
  const [items, setItems] = useState(null);
  const [pages, setPages] = useState([]);
  const [contentByPage, setContentByPage] = useState({});
  const [busy, setBusy] = useState(false);
  const [mf, setMf] = useState("all");
  const [uf, setUf] = useState("");
  const [preview, setPreview] = useState(null);
  const [editM, setEditM] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFile, setEditFile] = useState(null);
  const canEdit = me && ["owner", "editor"].includes(me.role);

  async function load() {
    const cm = cacheGet("media"), cp = cacheGet("pages");
    if (cm) setItems(cm);
    if (cp) setPages(cp);
    const [m, p] = await Promise.all([
      post({ action: "listMedia", idToken: token() }),
      post({ action: "listPages", idToken: token() }),
    ]);
    const list = (m.data.items || []).map((x) => ({ ...x, f: x.f || "" }));
    cacheSet("media", list);
    setItems(list);
    const ps = p.data.pages || [];
    cacheSet("pages", ps);
    setPages(ps);
    const byPage = {};
    await Promise.all(ps.map(async (pg) => {
      const r = await post({ action: "publicContent", page: pg.id });
      const secs = (r.data.content && r.data.content.sections) || [];
      byPage[pg.id] = secs.map((s) => ({ id: s.id, label: NAMEMAP[s.type] || s.type }));
      cacheSet("content:" + pg.id, secs);
    }));
    setContentByPage(byPage);
    if (!uf) {
      const first = ps.length && byPage[ps[0].id] && byPage[ps[0].id][0];
      if (first) setUf(first.id);
    }
  }
  useEffect(() => { load(); }, []);

  async function persist(next) {
    const r = await post({ action: "saveMedia", idToken: token(), items: next });
    if (r.status === 200) { setItems(next); cacheSet("media", next); return true; }
    toast && toast(r.data.error || "Could not save the media library.");
    return false;
  }

  async function uploadOne(file) {
    const rtype = file.type && file.type.indexOf("video/") === 0 ? "video" : "image";
    if (file.size <= 4000000) {
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const r = await post({ action: "cloudUpload", idToken: token(), file: b64, resourceType: rtype, folder: "sabialaga" });
      if (r.status === 200 && r.data.ok) {
        return { secure_url: r.data.secure_url, public_id: r.data.public_id, resource_type: r.data.resource_type, bytes: r.data.bytes, original_filename: r.data.original_filename, format: r.data.format };
      }
    }
    const fd = new FormData();
    fd.append("upload_preset", "ciya_academy");
    fd.append("file", file);
    const r = await fetch("https://api.cloudinary.com/v1_1/di4dlnd5x/auto/upload", { method: "POST", body: fd });
    return r.json();
  }

  async function upload(files) {
    if (!canEdit || busy || !files || !files.length) return;
    setBusy(true);
    const added = [];
    for (const file of Array.from(files)) {
      try {
        const j = await uploadOne(file);
        if (!j || !j.secure_url) {
          toast && toast("Upload failed for " + file.name + ". Try a smaller file.");
          continue;
        }
        added.push({
          id: j.public_id || ("up-" + Date.now()),
          name: (j.original_filename || "file") + "." + (j.format || ""),
          type: j.resource_type === "video" ? "video" : "image",
          kb: Math.round((j.bytes || 0) / 1024),
          url: j.secure_url,
          alt: "",
          f: uf,
        });
      } catch (e) {
        toast && toast("Upload failed. Check your connection and try again.");
      }
    }
    if (added.length) {
      const ok = await persist([...added, ...(items || [])]);
      if (ok) { toast && toast(added.length + " file" + (added.length > 1 ? "s" : "") + " uploaded"); addPending(added.length); }
    }
    setBusy(false);
  }

  function openEdit(m) { setEditM(m); setEditTitle(m.name || ""); setEditFile(null); }
  async function saveEdit() {
    const m = editM;
    if (!m) return;
    setBusy(true);
    try {
      const patch = { name: editTitle.trim() || m.name };
      if (editFile) {
        const j = await uploadOne(editFile);
        if (!j || !j.secure_url) {
          toast && toast("Could not upload the new file. Nothing changed.");
          setBusy(false);
          return;
        }
        patch.id = j.public_id || m.id;
        patch.url = j.secure_url;
        patch.kb = Math.round((j.bytes || 0) / 1024);
        patch.type = j.resource_type === "video" ? "video" : "image";
      }
      const next = (items || []).map((x) => (x.id === m.id ? { ...x, ...patch } : x));
      if (await persist(next)) { toast && toast("Saved"); addPending(1); setEditM(null); }
    } catch (e) {
      toast && toast("Could not save. Check your connection and try again.");
    }
    setBusy(false);
  }
  async function remove(id) {
    if (!canEdit || busy) return;
    setBusy(true);
    const m = (items || []).find((x) => x.id === id);
    let cloudOk = true, cloudMsg = "";
    if (m && m.id && !m.id.startsWith("up-")) {
      const r = await post({ action: "cloudDelete", idToken: token(), publicId: m.id, resourceType: m.type === "video" ? "video" : "image" });
      if (!(r.status === 200 && r.data.ok)) { cloudOk = false; cloudMsg = (r.data && r.data.error) || "Cloudinary refused"; }
    }
    const ok = await persist((items || []).filter((x) => x.id !== id));
    if (ok) { toast && toast(cloudOk ? "File deleted" : "Removed from the library, but " + cloudMsg); addPending(1); }
    setBusy(false);
  }

  if (!items) return <p className="mut">Loading&hellip;</p>;
  const fs = folders(pages, contentByPage);
  const unsorted = items.filter((m) => !fs.some((f) => f.id === m.f));
  const cnt = (id) => (id === "unsorted" ? unsorted.length : items.filter((m) => (m.f || "") === id).length);
  const shown = mf === "all" ? fs : fs.filter((f) => f.id === mf);
  const vidThumb = (u) => (u ? String(u).replace(/\.[a-z0-9]+(\?|$)/i, ".jpg$1") : "");
  return (
    <div>
      <h2>Media library</h2>
      <p className="mut">Files are sorted by the section they belong to, so each section&rsquo;s photos and videos are in one place.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ margin: 0 }}>Upload into
          <select className="keep" style={{ width: "auto" }} value={uf} onChange={(e) => setUf(e.target.value)}>
            {fs.map((f) => <option key={f.id || "u"} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        {canEdit && (
          <label className="btn g keep" style={{ margin: 0, display: "inline-block", width: "auto", cursor: "pointer" }}>
            Upload files
            <input type="file" multiple accept="image/*,video/*" style={{ display: "none" }} disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <div className="chips">
        <button className={"chip keep" + (mf === "all" ? " on" : "")} type="button" onClick={() => setMf("all")}>All ({items.length})</button>
        {fs.filter((f) => cnt(f.id) > 0).map((f) => (
          <button className={"chip keep" + (mf === f.id ? " on" : "")} key={f.id || "u"} type="button" onClick={() => setMf(f.id)}>{f.label} ({cnt(f.id)})</button>
        ))}
        {unsorted.length > 0 && (
          <button className={"chip keep" + (mf === "unsorted" ? " on" : "")} type="button" onClick={() => setMf("unsorted")}>Unsorted ({unsorted.length})</button>
        )}
      </div>
      {shown.map((f) => {
        const its = items.map((m, i) => [m, i]).filter((q) => (q[0].f || "") === f.id);
        if (!its.length) return null;
        return (
          <div key={f.id || "u"}>
            <div className="grp">{f.label}</div>
            <div className="tiles">
              {its.map(([m]) => (
                <div className="tile" key={m.id}>
                  <div
                    className={"th" + (m.type === "video" ? " v" : "")}
                    style={m.url ? { backgroundImage: "url('" + (m.type === "video" ? vidThumb(m.url) : m.url) + "')" } : undefined}
                      onClick={() => setPreview(m)}
                      title="Click to preview"
                    >
                    {m.type === "video" ? (vidThumb(m.url) ? "" : "Video") : m.url ? "" : "Photo"}
                  </div>
                  <div className="b">
                    <b>{m.name}</b>
                    {kbText(m.kb)}
                    
                    
                    {canEdit && (
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button className="btn s" type="button" onClick={() => openEdit(m)}>Edit</button>
                        <button className="btn s d" type="button" onClick={() => remove(m.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {mf === "unsorted" && unsorted.length > 0 && (
        <div>
          <div className="grp">Unsorted</div>
          <div className="tiles">
            {unsorted.map((m) => (
              <div className="tile" key={m.id}>
                <div
                  className={"th" + (m.type === "video" ? " v" : "")}
                  style={m.url ? { backgroundImage: "url('" + (m.type === "video" ? vidThumb(m.url) : m.url) + "')" } : undefined}
                    onClick={() => setPreview(m)}
                    title="Click to preview"
                  >
                  {m.type === "video" ? (vidThumb(m.url) ? "" : "Video") : m.url ? "" : "Photo"}
                </div>
                <div className="b">
                  <b>{m.name}</b>
                  {kbText(m.kb)}
                  
                  {canEdit && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button className="btn s" type="button" onClick={() => openEdit(m)}>Edit</button>
                      <button className="btn s d" type="button" onClick={() => remove(m.id)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <div className="card" style={{ maxWidth: 720, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            {preview.type === "video" ? (
              <video src={preview.url} controls autoPlay muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#000", display: "block" }} />
            ) : (
              <img src={preview.url} alt={preview.alt || preview.name} style={{ width: "100%", borderRadius: 12, display: "block" }} />
            )}
            <p style={{ margin: "10px 0 12px" }}>
              <b>{preview.name}</b> <span className="mut">{kbText(preview.kb)}</span>
              {preview.type === "video" && preview.kb > 20000 && <> <span className="pill f">Too heavy</span></>}
            </p>
            <button className="btn s" type="button" onClick={() => setPreview(null)}>Close</button>
          </div>
        </div>
      )}
      {editM && (
        <div className="modal" onClick={() => setEditM(null)}>
          <div className="card" style={{ maxWidth: 480, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit media</h3>
            <p className="mut">{editM.type === "video" ? "Video" : "Photo"} · {kbText(editM.kb)}</p>
            <label>
              Title
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </label>
            <label>
              Change file
              <input type="file" accept={editM.type === "video" ? "video/*" : "image/*"} onChange={(e) => setEditFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
            </label>
            {editFile && <p className="mut">New file ready: {editFile.name}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn p" type="button" disabled={busy} onClick={saveEdit}>{busy ? "Saving\u2026" : "Save"}</button>
              <button className="btn s" type="button" onClick={() => setEditM(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {items.length === 0 && <p className="mut">No files yet. Upload photos and videos above and they appear under their section.</p>}
    </div>
  );
}

const NAMEMAP = {
  hero: "Hero video", marquee: "Praise marquee", services: "Services stack",
  weddings: "Wedding reel", about: "About with scroll video", shop: "Shop",
  testimonials: "Testimonials", training: "Training teaser", booking: "Booking form",
  footer: "Footer", text: "Text and image", gallery: "Photo gallery", video: "Video",
  cta: "Call to action", faq: "FAQ", pricing: "Pricing", stats: "Numbers strip",
};

export function Enquiries({ me, toast }) {
  const [list, setList] = useState(null);
  const [month, setMonth] = useState(11);
  const [blocked, setBlocked] = useState(null);
  const canEdit = me && ["owner", "editor"].includes(me.role);

  async function load() {
    const ce = cacheGet("enquiries"), cmeta = cacheGet("meta");
    if (ce) setList(ce);
    if (cmeta && cmeta.blocked) setBlocked(cmeta.blocked);
    const [r, meta] = await Promise.all([
      post({ action: "listEnquiries", idToken: token() }),
      post({ action: "getMeta", idToken: token() }),
    ]);
    const el = r.data.enquiries || [];
    const bl = meta.data.blocked || [];
    cacheSet("enquiries", el);
    cacheSet("meta", { ...(cacheGet("meta") || {}), blocked: bl });
    setList(el);
    setBlocked(bl);
  }
  useEffect(() => { load(); }, []);

  async function toggleDay(key) {
    if (!canEdit || !blocked) return;
    setBlocked((cur) => (cur.includes(key) ? cur.filter((x) => x !== key) : cur.concat([key]).sort()));
    const r = await post({ action: "toggleBlocked", idToken: token(), key });
    if (r.status === 200 && r.data.blocked) setBlocked(r.data.blocked);
    else if (r.data && r.data.error) toast && toast(r.data.error);
  }

  async function setStatus(id, status) {
    if (!canEdit) return;
    const r = await post({ action: "updateEnquiry", idToken: token(), id, status });
    if (r.status === 200) { await load(); }
    else { toast && toast(r.data.error || "Could not update."); }
  }

  async function del(id) {
    if (!canEdit) return;
    if (!window.confirm("Delete this enquiry?")) return;
    const r = await post({ action: "deleteEnquiry", idToken: token(), id });
    if (r.status === 200) { await load(); toast && toast("Enquiry deleted."); }
    else { toast && toast(r.data.error || "Could not delete."); }
  }

  if (!list) return <p className="mut">Loading&hellip;</p>;
  return (
    <div>
      <h2>Enquiries</h2>
      <p className="mut">Every booking form submission lands here and in her email.</p>
      {list.length === 0 && <p className="mut">No enquiries yet. When someone fills the booking form on the website, it appears here.</p>}
      {list.map((x) => (
        <div className="row" key={x.id}>
          <span className="nm">
            {x.name}
            <br />
            <span className="mut">{x.eventType || "event"} &middot; {x.date || "date not set"} &middot; {x.location || "location not set"}{x.note ? " \u00b7 " + x.note : ""}</span>
            <br />
            <span className="mut">Contact: {x.contact || "not given"} &middot; received {fmtWhen(x.createdAt)}</span>
          </span>
          <span className={"pill" + (x.status === "New" ? " f" : "")}>{x.status}</span>
          {canEdit && x.status !== "Replied" && <button className="btn s" type="button" onClick={() => setStatus(x.id, "Replied")}>Mark replied</button>}
          {canEdit && x.status !== "New" && <button className="btn s" type="button" onClick={() => setStatus(x.id, "New")}>Mark new</button>}
          {canEdit && <button className="btn s d" type="button" onClick={() => del(x.id)}>Delete</button>}
        </div>
      ))}
      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 18 }}>Dates she is booked</h3>
        <p className="mut">Tap a date to block or open it. Blocked dates show as taken on the site.</p>
        <label style={{ width: "auto", maxWidth: 220 }}>
          <select className="keep" style={{ width: "auto" }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            <option value={11}>November 2026</option>
            <option value={12}>December 2026</option>
          </select>
        </label>
        <div className="cal">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={"h" + i}>{d}</div>)}
          {Array.from({ length: new Date(2026, month - 1, 1).getDay() }, (_, i) => <div key={"b" + i} />)}
          {Array.from({ length: new Date(2026, month, 0).getDate() }, (_, i) => {
            const key = "2026-" + ("0" + month).slice(-2) + "-" + ("0" + (i + 1)).slice(-2);
            const isBlocked = blocked && blocked.includes(key);
            return (
              <button key={key} type="button" className={isBlocked ? "x" : ""} disabled={!canEdit} onClick={() => toggleDay(key)}>
                {i + 1}
              </button>
            );
          })}
        </div>
        {!canEdit && <p className="mut" style={{ marginTop: 8 }}>Only the owner or an editor can change the calendar.</p>}
      </div>
    </div>
  );
}

const ROLE_DESC = {
  owner: "Owner: everything, including the team",
  editor: "Editor: edit and publish",
  contributor: "Contributor: edit drafts, needs approval to publish",
};

export function Team({ me, toast }) {
  const [team, setTeam] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);
  const isOwner = me && me.role === "owner";
  const isSelf = (x) => (me.uid && x.uid === me.uid) || (me.email && x.email && String(me.email).toLowerCase() === String(x.email).toLowerCase());

  async function load() {
    const ct = cacheGet("team");
    if (ct) setTeam(ct);
    const r = await post({ action: "listTeam", idToken: token() });
    const tt = r.data.team || [];
    cacheSet("team", tt);
    setTeam(tt);
  }
  useEffect(() => { load(); }, []);

  async function sendInvite(e) {
    e.preventDefault();
    if (!isOwner || busy) return;
    setBusy(true);
    const r = await post({ action: "inviteUser", idToken: token(), email, role, name: name.trim() });
    if (r.status === 200 && r.data.ok) {
      setInvite({ email: r.data.email, role: r.data.role, tempPassword: r.data.tempPassword });
      setEmail("");
      setName("");
      await load();
    } else {
      toast && toast(r.data.error || "Could not send the invite.");
    }
    setBusy(false);
  }

  async function changeRole(uid, r2) {
    if (!isOwner || busy) return;
    const res = await post({ action: "setUserRole", idToken: token(), targetUid: uid, role: r2 });
    if (res.status === 200) { await load(); toast && toast("Role changed to " + r2); }
    else { toast && toast(res.data.error || "Could not change the role."); }
  }

  async function remove(uid, em) {
    if (!isOwner || busy) return;
    if (!window.confirm("Remove " + em + " from the team? They lose admin access at once.")) return;
    const res = await post({ action: "removeUser", idToken: token(), targetUid: uid });
    if (res.status === 200) { await load(); toast && toast("Access removed"); }
    else { toast && toast(res.data.error || "Could not remove."); }
  }

  if (!team) return <p className="mut">Loading&hellip;</p>;
  return (
    <div>
      <h2>Team</h2>
      <p className="mut">Invite helpers by name and email. They sign in with a password using that same email, and get the role you choose.</p>
      {team.map((m) => (
        <div className="row" key={m.uid}>
          <span className="nm">{m.name ? (<>{m.name}<br /><span className="mut" style={{ fontSize: 13 }}>{m.email}</span></>) : m.email}</span>
          <span className={"pill " + (m.status === "Invited" ? "w" : "ok")}>{m.status || "Active"}</span>
          {isSelf(m) ? (
            <span className="pill f">{m.role || "you"}</span>
          ) : (
            <>
              {isOwner && (
                <select className="keep" style={{ width: "auto" }} value={m.role} onChange={(e) => changeRole(m.uid, e.target.value)}>
                  <option value="editor">editor</option>
                  <option value="contributor">contributor</option>
                </select>
              )}
              {isOwner && <button className="btn s d" type="button" onClick={() => remove(m.uid, m.email)}>Remove</button>}
            </>
          )}
        </div>
      ))}
      {isOwner ? (
        <div className="card" style={{ marginTop: 14 }} onSubmit={() => {}}>
          <h3 style={{ fontSize: 18, marginBottom: 10 }}>Invite someone</h3>
          <form onSubmit={sendInvite}>
            <label>Name<input type="text" placeholder="e.g. Sarah Safaru" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Email<input type="email" placeholder="helper@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="editor">editor</option>
                <option value="contributor">contributor</option>
              </select>
            </label>
            <button className="btn p" disabled={busy || !email.trim()} type="submit">{busy ? "Inviting\u2026" : "Send invite"}</button>
          </form>
        </div>
      ) : (
        <p className="mut" style={{ marginTop: 10 }}>Only the owner can invite or remove people.</p>
      )}
      <div className="card" style={{ marginTop: 14 }}>
        {Object.keys(ROLE_DESC).map((r) => (
          <div className="mut" style={{ padding: "3px 0" }} key={r}>{ROLE_DESC[r]}</div>
        ))}
      </div>
      {invite && (
        <div className="modal" onClick={() => setInvite(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <h3>Invite ready: {invite.email}</h3>
            <p className="mut">Copy this and send it to them (WhatsApp is fine):</p>
            <p className="mut" style={{ border: "2px dashed var(--line)", borderRadius: 14, padding: 12 }}>
              Sign in at the Sabi Alaga admin with this email and temporary password:<br />
              Email: {invite.email}<br />
              Temporary password: <b>{invite.tempPassword}</b><br />
              You will choose your own password at first sign-in.
            </p>
            <button className="btn p" type="button" onClick={() => setInvite(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

const SET_FIELDS = [
  ["brand", "Brand name", false],
  ["wa", "WhatsApp number (with country code)", false],
  ["pop", "WhatsApp welcome message", true],
  ["ig", "Instagram", false],
  ["tt", "TikTok", false],
  ["seoT", "Search title", false],
  ["seoD", "Search description", true],
];

export function Settings({ me, onSavePassword, busy, pw1, setPw1, pw2, setPw2 }) {
  const [set, setSet] = useState({ brand: "", wa: "", pop: "", ig: "", tt: "", seoT: "", seoD: "", logo: "" });
  const [media, setMedia] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const canEdit = me && ["owner", "editor"].includes(me.role);

  useEffect(() => {
    let alive = true;
    const cm = cacheGet("media"), cmeta = cacheGet("meta");
    if (cm) setMedia(cm);
    if (cmeta && cmeta.settings) { setSet((cur) => ({ ...cur, ...cmeta.settings })); setLoaded(true); }
    (async () => {
      const [m, meta] = await Promise.all([
        post({ action: "listMedia", idToken: token() }),
        post({ action: "getMeta", idToken: token() }),
      ]);
      if (!alive) return;
      const ml = m.data.items || [];
      const st = meta.data.settings || {};
      cacheSet("media", ml.map((x) => ({ ...x, f: x.f || "" })));
      cacheSet("meta", { ...(cacheGet("meta") || {}), settings: st, blocked: meta.data.blocked || [] });
      setMedia(ml);
      setSet((cur) => ({ ...cur, ...st }));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  async function save(e) {
    e.preventDefault();
    if (!canEdit || busySave) return;
    setBusySave(true);
    const r = await post({ action: "saveMeta", idToken: token(), settings: set });
    if (r.status === 200) toast && toast("Site settings saved.");
    else toast && toast(r.data.error || "Could not save the settings.");
    setBusySave(false);
  }

  return (
    <div>
      <h2>Site settings</h2>
      <div className="card">
        <form onSubmit={save}>
          {SET_FIELDS.map(([k, label, area]) => (
            <label key={k}>
              {label}
              {area ? (
                <textarea value={set[k] || ""} disabled={!canEdit || !loaded} onChange={(e) => setSet({ ...set, [k]: e.target.value })} />
              ) : (
                <input value={set[k] || ""} disabled={!canEdit || !loaded} onChange={(e) => setSet({ ...set, [k]: e.target.value })} />
              )}
            </label>
          ))}
          <label>
            Logo
            <select value={set.logo || ""} disabled={!canEdit || !loaded} onChange={(e) => setSet({ ...set, logo: e.target.value })}>
              <option value="">None</option>
              {media.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </label>
          <button className="btn p" disabled={!canEdit || busySave || !loaded} type="submit">
            {busySave ? "Saving\u2026" : "Save settings"}
          </button>
        </form>
        <p className="mut" style={{ marginTop: 10 }}>
          The WhatsApp number is what the booking form opens, and the search fields are what Google shows for the site.
        </p>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 18, marginBottom: 10 }}>Your account</h3>
        <form onSubmit={onSavePassword}>
          <label>{me.hasPassword ? "New password" : "New password for email sign-in"}
            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
          </label>
          <label>Repeat it
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="btn p" disabled={busy} type="submit">{me.hasPassword ? "Update password" : "Set password"}</button>
        </form>
        <p className="mut" style={{ marginTop: 10 }}>
          {me.hasPassword
            ? "You can always sign in with Google or with email and this password."
            : "Set one now and Google sign-in AND email sign-in both work for this account."}
        </p>
      </div>
    </div>
  );
}
