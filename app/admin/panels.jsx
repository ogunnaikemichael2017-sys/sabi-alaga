"use client";

import { useEffect, useState } from "react";

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

export function Overview({ me, go }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const t = token();
      const [p, m, e, tm, home] = await Promise.all([
        post({ action: "listPages", idToken: t }),
        post({ action: "listMedia", idToken: t }),
        post({ action: "listEnquiries", idToken: t }),
        post({ action: "listTeam", idToken: t }),
        post({ action: "publicContent", page: "home" }),
      ]);
      if (!alive) return;
      setD({
        pages: p.data.pages || [],
        media: m.data.items || [],
        enq: e.data.enquiries || [],
        team: tm.data.team || [],
        homeUpdated: (home.data.content && home.data.content.updated) || "",
      });
    })();
    return () => { alive = false; };
  }, []);
  if (!d) return <p className="sa-sub">Loading&hellip;</p>;
  const newEnq = d.enq.filter((x) => x.status === "New").length;
  return (
    <div>
      <div className="sa-counts">
        <div className="sa-count"><b>{d.pages.length}</b><span>Pages</span></div>
        <div className="sa-count"><b>{d.media.length}</b><span>Media items</span></div>
        <div className="sa-count"><b>{newEnq}</b><span>New enquiries</span></div>
        <div className="sa-count"><b>{d.team.length}</b><span>Team members</span></div>
      </div>
      <p className="sa-hint">Content last saved {fmtWhen(d.homeUpdated)}. Changes reach the website after you publish in Settings.</p>
      <div className="sa-quick">
        <button className="sa-btn" type="button" onClick={() => go("sections")}>Edit the website</button>
        <button className="sa-btn" type="button" onClick={() => go("enquiries")}>See enquiries</button>
        <button className="sa-btn" type="button" onClick={() => go("settings")}>Publish changes</button>
      </div>
      {d.enq.slice(0, 3).length > 0 && (
        <div className="sa-panel">
          <h3>Latest enquiries</h3>
          {d.enq.slice(0, 3).map((x) => (
            <p key={x.id} className="sa-hint">
              {x.name} &middot; {x.eventType || "event"} &middot; {x.date || "date not set"} &middot; <b>{x.status}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pages({ me, onOpen }) {
  const [pages, setPages] = useState(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState("ok");
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
    setBusy(true); setNote("");
    const r = await post({ action: "savePage", idToken: token(), title, slug });
    if (r.status === 200) {
      setTitle(""); setSlug("");
      await load();
      setNote("Page created. Open it in Sections to add its content.");
      setTone("ok");
    } else {
      setNote(r.data.error || "Could not create the page.");
      setTone("bad");
    }
    setBusy(false);
  }

  async function del(slug) {
    if (!isOwner) return;
    if (!window.confirm("Delete the page " + slug + "? Its content is lost.")) return;
    const r = await post({ action: "deletePage", idToken: token(), slug });
    if (r.status === 200) {
      await load();
      setNote("Page deleted."); setTone("ok");
    } else {
      setNote(r.data.error || "Could not delete the page."); setTone("bad");
    }
  }

  if (!pages) return <p className="sa-sub">Loading&hellip;</p>;
  return (
    <div>
      <h3 className="sa-tabtitle">Pages</h3>
      <p className="sa-hint">Home is the main page. Extra pages are reached from a "See more" button you set on a section.</p>
      <ul className="sa-rows">
        {pages.map((p) => (
          <li key={p.id} className="sa-row">
            <div>
              <b>{p.title || p.id}</b>
              <span className="sa-hint"> {p.id === "home" ? " (home)" : " (/" + p.id + ")"} &middot; {p.sectionCount} sections &middot; saved {fmtWhen(p.updated)}</span>
            </div>
            <div className="sa-rowbtns">
              <button className="sa-mini" type="button" onClick={() => onOpen(p.id)}>Open in Sections</button>
              {isOwner && p.id !== "home" && (
                <button className="sa-mini sa-danger" type="button" onClick={() => del(p.id)}>Delete</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form className="sa-panel" onSubmit={create}>
          <h3>New page</h3>
          <div className="sa-field">
            <label htmlFor="sa-pg-title"><span>Page name</span></label>
            <input id="sa-pg-title" type="text" placeholder="Real weddings gallery" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="sa-field">
            <label htmlFor="sa-pg-slug"><span>Page address ending (letters and dashes)</span></label>
            <input id="sa-pg-slug" type="text" placeholder="real-weddings" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <button className="sa-btn sa-primary" disabled={busy || !slug.trim()} type="submit">{busy ? "Creating\u2026" : "Create page"}</button>
        </form>
      ) : (
        <p className="sa-note">Your role cannot create pages.</p>
      )}
      {note && <p className={`sa-note ${tone}`}>{note}</p>}
    </div>
  );
}

export function Media({ me }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState("ok");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const canEdit = me && ["owner", "editor"].includes(me.role);

  async function load() {
    const r = await post({ action: "listMedia", idToken: token() });
    setItems(r.data.items || []);
  }
  useEffect(() => { load(); }, []);

  async function persist(next) {
    const r = await post({ action: "saveMedia", idToken: token(), items: next });
    if (r.status === 200) { setItems(next); return true; }
    setNote(r.data.error || "Could not save the media library."); setTone("bad");
    return false;
  }

  async function upload(file) {
    if (!canEdit || busy || !file) return;
    setBusy(true); setNote("");
    try {
      const fd = new FormData();
      fd.append("upload_preset", "ciya_academy");
      fd.append("file", file);
      const r = await fetch("https://api.cloudinary.com/v1_1/di4dlnd5x/auto/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.secure_url) {
        setNote("Upload failed. Try a smaller file, or add it by link below.");
        setTone("bad");
      } else {
        const it = {
          id: j.public_id || ("up-" + Date.now()),
          name: (j.original_filename || "file") + "." + (j.format || ""),
          type: j.resource_type === "video" ? "video" : "image",
          kb: Math.round((j.bytes || 0) / 1024),
          url: j.secure_url,
          alt: "",
        };
        if (await persist([...(items || []), it])) { setNote("Uploaded and saved."); setTone("ok"); }
      }
    } catch (e) {
      setNote("Upload failed. Check your connection and try again."); setTone("bad");
    }
    setBusy(false);
  }

  async function addByLink(e) {
    e.preventDefault();
    if (!canEdit || busy || !url.trim()) return;
    setBusy(true); setNote("");
    const it = {
      id: "link-" + Date.now(),
      name: name.trim() || "linked item",
      type: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image",
      kb: 0,
      url: url.trim(),
      alt: "",
    };
    if (await persist([...(items || []), it])) { setUrl(""); setName(""); setNote("Added."); setTone("ok"); }
    setBusy(false);
  }

  async function remove(id) {
    if (!canEdit || busy) return;
    if (!(await persist((items || []).filter((x) => x.id !== id)))) return;
    setNote("Removed."); setTone("ok");
  }

  if (!items) return <p className="sa-sub">Loading&hellip;</p>;
  return (
    <div>
      <h3 className="sa-tabtitle">Media library</h3>
      <p className="sa-hint">Photos and videos stored here, ready to paste into any section.</p>
      {canEdit && (
        <div className="sa-panel">
          <h3>Upload</h3>
          <input type="file" accept="image/*,video/*" disabled={busy} onChange={(e) => upload(e.target.files && e.target.files[0])} />
          <p className="sa-hint">Photos or short videos. They upload straight to the media store.</p>
        </div>
      )}
      {canEdit && (
        <form className="sa-panel" onSubmit={addByLink}>
          <h3>Add by link</h3>
          <div className="sa-field">
            <label htmlFor="sa-md-url"><span>Image or video address</span></label>
            <input id="sa-md-url" type="text" placeholder="https://res.cloudinary.com/\u2026" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="sa-field">
            <label htmlFor="sa-md-name"><span>Give it a name</span></label>
            <input id="sa-md-name" type="text" placeholder="Couple dancing clip" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="sa-btn" disabled={busy || !url.trim()} type="submit">Add</button>
        </form>
      )}
      <ul className="sa-rows">
        {items.map((it) => (
          <li key={it.id} className="sa-row">
            <div className="sa-media">
              {it.type === "video"
                ? <span className="sa-thumb sa-thumbv">&#9654;</span>
                : <img className="sa-thumb" src={it.url} alt={it.alt || it.name} />}
              <div>
                <b>{it.name}</b>
                <span className="sa-hint"> {it.type}{it.kb ? " \u00b7 " + it.kb + " KB" : ""}</span>
              </div>
            </div>
            <div className="sa-rowbtns">
              {canEdit && <button className="sa-mini sa-danger" type="button" onClick={() => remove(it.id)}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
      {note && <p className={`sa-note ${tone}`}>{note}</p>}
    </div>
  );
}

export function Enquiries({ me }) {
  const [list, setList] = useState(null);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState("ok");
  const canEdit = me && ["owner", "editor"].includes(me.role);

  async function load() {
    const r = await post({ action: "listEnquiries", idToken: token() });
    setList(r.data.enquiries || []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    if (!canEdit) return;
    const r = await post({ action: "updateEnquiry", idToken: token(), id, status });
    if (r.status === 200) { await load(); }
    else { setNote(r.data.error || "Could not update."); setTone("bad"); }
  }

  async function del(id) {
    if (!canEdit) return;
    if (!window.confirm("Delete this enquiry?")) return;
    const r = await post({ action: "deleteEnquiry", idToken: token(), id });
    if (r.status === 200) { await load(); setNote("Deleted."); setTone("ok"); }
    else { setNote(r.data.error || "Could not delete."); setTone("bad"); }
  }

  if (!list) return <p className="sa-sub">Loading&hellip;</p>;
  return (
    <div>
      <h3 className="sa-tabtitle">Enquiries</h3>
      <p className="sa-hint">Every message from the website's booking form lands here, and also opens WhatsApp for the couple.</p>
      {list.length === 0 && <p className="sa-note">No enquiries yet. When someone fills the booking form on the website, it appears here.</p>}
      <ul className="sa-rows">
        {list.map((x) => (
          <li key={x.id} className="sa-row sa-enq">
            <div>
              <b>{x.name}</b>
              <span className="sa-hint"> &middot; {x.eventType || "event"} &middot; {x.date || "date not set"} &middot; {x.location || "location not set"}{x.note ? " \u00b7 " + x.note : ""}</span>
              <span className="sa-hint">Contact: {x.contact || "not given"} &middot; received {fmtWhen(x.createdAt)}</span>
            </div>
            <div className="sa-rowbtns">
              <span className={"sa-pill " + (x.status === "New" ? "w" : "ok")}>{x.status}</span>
              {canEdit && x.status !== "Replied" && (
                <button className="sa-mini" type="button" onClick={() => setStatus(x.id, "Replied")}>Mark replied</button>
              )}
              {canEdit && x.status !== "New" && (
                <button className="sa-mini" type="button" onClick={() => setStatus(x.id, "New")}>Mark new</button>
              )}
              {canEdit && <button className="sa-mini sa-danger" type="button" onClick={() => del(x.id)}>Delete</button>}
            </div>
          </li>
        ))}
      </ul>
      {note && <p className={`sa-note ${tone}`}>{note}</p>}
    </div>
  );
}

const ROLE_DESC = {
  owner: "Owner: do everything, including the team",
  editor: "Editor: edit and publish",
  contributor: "Contributor: edit drafts, needs approval to publish",
  viewer: "Viewer: look only",
};

export function Team({ me }) {
  const [team, setTeam] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState("ok");
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
    setBusy(true); setNote("");
    const r = await post({ action: "inviteUser", idToken: token(), email, role });
    if (r.status === 200 && r.data.ok) {
      setInvite({ email: r.data.email, role: r.data.role, tempPassword: r.data.tempPassword });
      setEmail("");
      await load();
    } else {
      setNote(r.data.error || "Could not send the invite."); setTone("bad");
    }
    setBusy(false);
  }

  async function changeRole(uid, r2) {
    if (!isOwner || busy) return;
    const res = await post({ action: "setUserRole", idToken: token(), targetUid: uid, role: r2 });
    if (res.status === 200) { await load(); setNote("Role changed."); setTone("ok"); }
    else { setNote(res.data.error || "Could not change the role."); setTone("bad"); }
  }

  async function remove(uid, em) {
    if (!isOwner || busy) return;
    if (!window.confirm("Remove " + em + " from the team? They lose admin access at once.")) return;
    const res = await post({ action: "removeUser", idToken: token(), targetUid: uid });
    if (res.status === 200) { await load(); setNote("Removed."); setTone("ok"); }
    else { setNote(res.data.error || "Could not remove."); setTone("bad"); }
  }

  if (!team) return <p className="sa-sub">Loading&hellip;</p>;
  return (
    <div>
      <h3 className="sa-tabtitle">Team</h3>
      <p className="sa-hint">Who can use this admin, and what each person may do.</p>
      <ul className="sa-rows">
        {team.map((m) => (
          <li key={m.uid} className="sa-row">
            <div>
              <b>{m.email}</b>
              <span className="sa-hint"> {ROLE_DESC[m.role] ? "\u00b7 " + ROLE_DESC[m.role] : ""}</span>
            </div>
            <div className="sa-rowbtns">
              <span className={"sa-pill " + (m.status === "Invited" ? "w" : "ok")}>{m.status || "Active"}</span>
              {isOwner && (
                <select value={m.role} onChange={(e) => changeRole(m.uid, e.target.value)}>
                  <option value="editor">Editor</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
              {isOwner && m.role !== "owner" && (
                <button className="sa-mini sa-danger" type="button" onClick={() => remove(m.uid, m.email)}>Remove</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form className="sa-panel" onSubmit={sendInvite}>
          <h3>Invite someone</h3>
          <p className="sa-hint">They get a temporary password. You send it to them; they choose their own password at first sign-in.</p>
          <div className="sa-field">
            <label htmlFor="sa-tm-email"><span>Their email</span></label>
            <input id="sa-tm-email" type="email" placeholder="sarah@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sa-field">
            <label htmlFor="sa-tm-role"><span>Their role</span></label>
            <select id="sa-tm-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button className="sa-btn sa-primary" disabled={busy || !email.trim()} type="submit">{busy ? "Inviting\u2026" : "Send invite"}</button>
        </form>
      ) : (
        <p className="sa-note">Only an owner can invite or change roles.</p>
      )}
      {note && <p className={`sa-note ${tone}`}>{note}</p>}
      {invite && (
        <div className="sa-modal" onClick={() => setInvite(null)}>
          <div className="sa-modalcard" onClick={(e) => e.stopPropagation()}>
            <h3>Invite ready: {invite.email}</h3>
            <p className="sa-hint">Copy this and send it to them (WhatsApp is fine):</p>
            <p className="sa-invite">
              Sign in at the Sabi Alaga admin with this email and temporary password:<br />
              Email: {invite.email}<br />
              Temporary password: <b>{invite.tempPassword}</b><br />
              You will choose your own password at first sign-in.
            </p>
            <button className="sa-btn sa-primary" type="button" onClick={() => setInvite(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Settings({ me, onSavePassword, onSignOut, busy, pw1, setPw1, pw2, setPw2 }) {
  const [confirmPub, setConfirmPub] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const [pubNote, setPubNote] = useState("");
  const [pubTone, setPubTone] = useState("ok");
  const canPub = me && ["owner", "editor"].includes(me.role);

  async function doPublish() {
    setConfirmPub(false);
    setPubBusy(true); setPubNote("");
    const r = await post({ action: "publish", idToken: token() });
    if (r.status === 200) {
      setPubNote("Publish started. The live website updates in 2 to 3 minutes.");
      setPubTone("ok");
    } else {
      setPubNote(r.data.error || "Publish failed. Try again.");
      setPubTone("bad");
    }
    setPubBusy(false);
  }

  return (
    <div>
      <h3 className="sa-tabtitle">Settings</h3>
      <div className="sa-panel">
        <h3>Publishing</h3>
        {canPub ? (
          <>
            <p className="sa-hint">Sending your saved changes to the live website. It uses one production build (about 15 of the 300 monthly builds) and takes 2 to 3 minutes.</p>
            <button className="sa-btn sa-primary" disabled={pubBusy} type="button" onClick={() => setConfirmPub(true)}>{pubBusy ? "Publishing\u2026" : "Publish to the website"}</button>
          </>
        ) : (
          <p className="sa-note">Your role cannot publish.</p>
        )}
        {pubNote && <p className={`sa-note ${pubTone}`}>{pubNote}</p>}
      </div>
      <div className="sa-panel">
        <h3>Your account</h3>
        <form onSubmit={onSavePassword}>
          <div className="sa-field">
            <label htmlFor="sa-np"><span>{me.hasPassword ? "New password" : "New password for email sign-in"}</span></label>
            <input id="sa-np" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="sa-field">
            <label htmlFor="sa-np2"><span>Repeat it</span></label>
            <input id="sa-np2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="sa-btn sa-primary" disabled={busy} type="submit">{me.hasPassword ? "Update password" : "Set password"}</button>
        </form>
        <p className="sa-hint">
          {me.hasPassword
            ? "You can always sign in with Google or with email and this password."
            : "Set one now and Google sign-in AND email sign-in both work for this account."}
        </p>
        <button className="sa-btn sa-ghost" type="button" onClick={onSignOut}>Sign out</button>
      </div>
      {confirmPub && (
        <div className="sa-modal" onClick={() => setConfirmPub(false)}>
          <div className="sa-modalcard" onClick={(e) => e.stopPropagation()}>
            <h3>Publish now?</h3>
            <p className="sa-hint">Your saved changes go to the live website. This uses one production build, about 15 of the 300 monthly builds, and the website updates in 2 to 3 minutes.</p>
            <div className="sa-rowbtns">
              <button className="sa-btn" type="button" onClick={() => setConfirmPub(false)}>Not now</button>
              <button className="sa-btn sa-primary" type="button" onClick={doPublish}>Publish now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
