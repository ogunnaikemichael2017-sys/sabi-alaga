"use client";

import { useState } from "react";

const NUMBER = "2348089193663";

export default function Booking() {
  const [f, setF] = useState({ n: "", t: "Traditional wedding", d: "", c: "", g: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const v = (x) => f[x] || "not sure yet";
    const m = "Hello Sabi, I\u2019m " + v("n") + ". I\u2019d like to ask about a " + v("t") + " on " + v("d") + " in " + v("c") + ", about " + v("g") + " guests.";
    window.open("https://wa.me/" + NUMBER + "?text=" + encodeURIComponent(m), "_blank");
  };
  return (
    <section className="book" id="book">
      <div className="wrap">
        <h2>Save your date</h2>
        <p className="sub">Tell me about your event. This opens WhatsApp with your details ready to send.</p>
        <form onSubmit={submit} id="f">
          <label>Your name<input required autoComplete="name" value={f.n} onChange={set("n")} /></label>
          <label>Event type
            <select value={f.t} onChange={set("t")}>
              <option>Traditional wedding</option>
              <option>Introduction</option>
              <option>Engagement</option>
              <option>Training or consultation</option>
            </select>
          </label>
          <label>Event date<input type="date" value={f.d} onChange={set("d")} /></label>
          <label>City or venue<input placeholder="Lagos, Ibadan or elsewhere" value={f.c} onChange={set("c")} /></label>
          <label className="f">Estimated guests<input inputMode="numeric" placeholder="e.g. 300" value={f.g} onChange={set("g")} /></label>
          <button className="btn gold" type="submit">Send on WhatsApp</button>
          <p className="note">Opens WhatsApp with your message ready, so you can review it before it sends.</p>
        </form>
      </div>
    </section>
  );
}
