"use client";

import { useEffect, useState } from "react";
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
      const homeSections = (home.data.content && home.data.content.sections) || [];
      setD({
        media: m.data.items || [],
        enq: e.data.enquiries || [],
        team: tm.data.team || [],
        live: homeSections.filter((s) => s.vis !== false).length,
        total: homeSections.length,
        activity: (meta.data.activity || []).map((x) => {
          const at = String(x || "").split("::");
          return { when: at[0] || "", text: at.slice(1).join("::") || String(x) };
        }),
      });
    })();
    return () => { alive = false; };
  }, []);
  if (!d) return <p className="mut">Loading&hellip;</p>;
  const newEnq = d.enq.filter((x) => x.status === "New").length;
  const toFix = d.media.filter((m) => (m.type !== "video" && !m.alt) || (m.type === "video" && m.kb > 20000)).length;
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
            {a.text} &middot; {fmtWhen(a.when)}
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
    const r = await post({ action: "listPages", idToken: token() });
    setPages(r.data.pages || []);
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
  const canEdit = me && ["owner", "editor"].includes(me.role);

  async function load() {
    const [m, p] = await Promise.all([
      post({ action: "listMedia", idToken: token() }),
      post({ action: "listPages", idToken: token() }),
    ]);
    const list = (m.data.items || []).map((x) => ({ ...x, f: x.f || "" }));
    setItems(list);
    const ps = p.data.pages || [];
    setPages(ps);
    const byPage = {};
    await Promise.all(ps.map(async (pg) => {
      const r = await post({ action: "publicContent", page: pg.id });
      const secs = (r.data.content && r.data.content.sections) || [];
      byPage[pg.id] = secs.map((s) => ({ id: s.id, label: NAMEMAP[s.type] || s.type }));
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
    if (r.status === 200) { setItems(next); return true; }
    toast && toast(r.data.error || "Could not save the media library.");
    return false;
  }

  async function upload(files) {
    if (!canEdit || busy || !files || !files.length) return;
    setBusy(true);
    const added = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("upload_preset", "ciya_academy");
        fd.append("file", file);
        const r = await fetch("https://api.cloudinary.com/v1_1/di4dlnd5x/auto/upload", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok || !j.secure_url) {
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

  async function setAlt(id, alt) {
    const next = (items || []).map((x) => (x.id === id ? { ...x, alt } : x));
    await persist(next);
  }
  async function moveTo(id, f) {
    const next = (items || []).map((x) => (x.id === id ? { ...x, f } : x));
    if (await persist(next)) { toast && toast("File moved"); addPending(1); }
  }
  async function remove(id) {
    if (!canEdit || busy) return;
    if (await persist((items || []).filter((x) => x.id !== id))) { toast && toast("File deleted"); addPending(1); }
  }

  if (!items) return <p className="mut">Loading&hellip;</p>;
  const fs = folders(pages, contentByPage);
  const cnt = (id) => items.filter((m) => (m.f || "") === id).length;
  const shown = mf === "all" ? fs : fs.filter((f) => f.id === mf);
  return (
    <div>
      <h2>Media library</h2>
      <p className="mut">Files are sorted by the section they belong to, so each section&rsquo;s photos and videos are in one place. Videos over 20 MB are flagged because they slow the site.</p>
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
                  <div className={"th" + (m.type === "video" ? " v" : "")} style={m.type !== "video" && m.url ? { backgroundImage: "url('" + m.url + "')" } : undefined}>
                    {m.type === "video" ? "Video" : m.url ? "" : "Photo"}
                  </div>
                  <div className="b">
                    <b>{m.name}</b>
                    {kbText(m.kb)}
                    {m.type === "video" && m.kb > 20000 && <> <span className="pill f">Too heavy</span></>}
                    {m.type !== "video" && !m.alt && <> <span className="pill w">Add alt text</span></>}
                    {m.type !== "video" && (
                      <input
                        type="text"
                        placeholder="Alt text"
                        defaultValue={m.alt || ""}
                        style={{ margin: "6px 0", padding: "6px 8px", fontSize: 12 }}
                        onBlur={(e) => { if (e.target.value !== (m.alt || "")) setAlt(m.id, e.target.value); }}
                      />
                    )}
                    <select
                      value={m.f || ""}
                      style={{ margin: "4px 0", padding: "5px 6px", fontSize: 12 }}
                      onChange={(e) => moveTo(m.id, e.target.value)}
                    >
                      {fs.map((fo) => <option key={fo.id || "u"} value={fo.id}>Move to: {fo.label}</option>)}
                    </select>
                    {canEdit && <button className="btn s d" type="button" onClick={() => remove(m.id)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
    const [r, meta] = await Promise.all([
      post({ action: "listEnquiries", idToken: token() }),
      post({ action: "getMeta", idToken: token() }),
    ]);
    setList(r.data.enquiries || []);
    setBlocked(meta.data.blocked || []);
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
      <p className="mut">Every booking form submission lands here, and also opens WhatsApp for the couple.</p>
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
          Month
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
  viewer: "Viewer: look only",
};

export function Team({ me, toast }) {
  const [team, setTeam] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);
  const isOwner = me && me.role === "owner";

  async function load() {
    const r = await post({ action: "listTeam", idToken: token() });
    setTeam(r.data.team || []);
  }
  useEffect(() => { load(); }, []);

  async function sendInvite(e) {
    e.preventDefault();
    if (!isOwner || busy) return;
    setBusy(true);
    const r = await post({ action: "inviteUser", idToken: token(), email, role });
    if (r.status === 200 && r.data.ok) {
      setInvite({ email: r.data.email, role: r.data.role, tempPassword: r.data.tempPassword });
      setEmail("");
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
      <p className="mut">Invite helpers by email. They sign in with a password or Google using that same email, and get the role you choose.</p>
      {team.map((m) => (
        <div className="row" key={m.uid}>
          <span className="nm">
            {m.email}
            <br />
            <span className="mut">{ROLE_DESC[m.role] ? ROLE_DESC[m.role].split(":")[1].trim() : ""}</span>
          </span>
          <span className={"pill " + (m.status === "Invited" ? "w" : "ok")}>{m.status || "Active"}</span>
          {m.role === "owner" ? (
            <span className="pill f">owner</span>
          ) : (
            <>
              {isOwner && (
                <select className="keep" style={{ width: "auto" }} value={m.role} onChange={(e) => changeRole(m.uid, e.target.value)}>
                  <option value="editor">editor</option>
                  <option value="contributor">contributor</option>
                  <option value="viewer">viewer</option>
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
            <label>Email<input type="email" placeholder="helper@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="editor">editor</option>
                <option value="contributor">contributor</option>
                <option value="viewer">viewer</option>
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
    (async () => {
      const [m, meta] = await Promise.all([
        post({ action: "listMedia", idToken: token() }),
        post({ action: "getMeta", idToken: token() }),
      ]);
      if (!alive) return;
      setMedia(m.data.items || []);
      setSet((cur) => ({ ...cur, ...(meta.data.settings || {}) }));
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
