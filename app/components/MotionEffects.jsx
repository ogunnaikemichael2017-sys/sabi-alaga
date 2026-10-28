"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function MotionEffects() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const $ = (s) => gsap.utils.toArray(s);
    const hov = window.matchMedia("(hover:hover)").matches;
    const hero = document.querySelector(".hero");
    const cleanups = [];

    // drifting diamonds
    for (let i = 0; i < 16; i++) {
      const d = document.createElement("i");
      d.className = "dm";
      d.style.left = Math.random() * 100 + "%";
      d.style.top = Math.random() * 100 + "%";
      d.style.scale = 0.5 + Math.random() * 1.3;
      hero.appendChild(d);
      gsap.to(d, { y: "random(-60,60)", x: "random(-40,40)", rotation: "random(0,180)", duration: "random(3,6)", repeat: -1, yoyo: true, ease: "sine.inOut" });
      cleanups.push(() => d.remove());
    }

    gsap.set(".lead,.cta .btn", { opacity: 0, y: 30 });
    gsap.set(".arches", { scale: 0.6, rotation: -8, opacity: 0 });
    gsap.set("c-h", { yPercent: 60, rotation: 10, opacity: 0 });
    const tl = gsap.timeline({ delay: 1.55 })
      .to("c-h", { yPercent: 0, rotation: 0, opacity: 1, duration: 0.9, ease: "back.out(1.7)", stagger: 0.04 })
      .to(".arches", { scale: 1, rotation: 0, opacity: 1, duration: 1.3, ease: "elastic.out(1,.7)" }, 0.1)
      .to(".lead,.cta .btn", { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 0.6);

    if (hov) {
      const ar = $(".arches i"), k = [18, 32, 48];
      const mm = (e) => {
        const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
        ar.forEach((a, n) => gsap.to(a, { x: x * k[n], y: y * k[n], duration: 0.8, overwrite: "auto" }));
      };
      hero.addEventListener("mousemove", mm);
      cleanups.push(() => hero.removeEventListener("mousemove", mm));

      const btns = $(".btn");
      btns.forEach((b) => {
        const mv = (e) => {
          const r = b.getBoundingClientRect();
          gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.3 });
        };
        const ml = () => gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,.4)" });
        b.addEventListener("mousemove", mv);
        b.addEventListener("mouseleave", ml);
        cleanups.push(() => { b.removeEventListener("mousemove", mv); b.removeEventListener("mouseleave", ml); });
      });

      const t = document.querySelector(".ticket");
      if (t) {
        const tmv = (e) => {
          const r = t.getBoundingClientRect();
          gsap.to(t, { rotationY: ((e.clientX - r.left) / r.width - 0.5) * 10, rotationX: -((e.clientY - r.top) / r.height - 0.5) * 10, transformPerspective: 900, duration: 0.5 });
        };
        const tml = () => gsap.to(t, { rotationX: 0, rotationY: 0, duration: 0.8 });
        t.addEventListener("mousemove", tmv);
        t.addEventListener("mouseleave", tml);
        cleanups.push(() => { t.removeEventListener("mousemove", tmv); t.removeEventListener("mouseleave", tml); });
      }
    }

    gsap.to(".prog", { scaleX: 1, ease: "none", scrollTrigger: { scrub: 0.2, start: 0, end: "max" } });

    // marquee speeds up with scroll velocity
    const tr = document.getElementById("tr");
    const an = tr && tr.getAnimations ? tr.getAnimations()[0] : null;
    let dir = 1, boost = 0, tickerFn = null;
    if (an) {
      ScrollTrigger.create({
        onUpdate: (s) => {
          const v = s.getVelocity();
          boost = Math.min(Math.abs(v) / 200, 8);
          if (v) dir = v > 0 ? 1 : -1;
        },
      });
      tickerFn = () => { boost *= 0.94; an.playbackRate = dir * (1 + boost); };
      gsap.ticker.add(tickerFn);
    }

    // pinned sideways wedding rail
    const rail = document.querySelector(".rail");
    if (rail) {
      rail.style.scrollSnapType = "none";
      rail.style.overflow = "hidden";
      const dist = () => rail.scrollWidth - rail.clientWidth;
      const wed = document.querySelector(".wed");
      const inn = wed.querySelector(".wedin");
      const setH = () => { wed.style.height = (dist() + inn.offsetHeight) + "px"; };
      setH();
      ScrollTrigger.addEventListener("refreshInit", setH);
      gsap.fromTo(".clip",
        { rotation: (i) => (i % 2 ? 4 : -4) },
        { x: () => -dist(), rotation: 0, ease: "none",
          scrollTrigger: { trigger: wed, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true } });
      cleanups.push(() => { ScrollTrigger.removeEventListener("refreshInit", setH); wed.style.height = ""; rail.style.overflow = ""; rail.style.scrollSnapType = ""; });
    }

    gsap.set(".small blockquote,.stats>div", { opacity: 0, y: 50 });
    ScrollTrigger.batch(".small blockquote,.stats>div", { start: "top 88%", onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power3.out" }) });
    $("h2").forEach((h) => gsap.from(h, { y: 70, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: h, start: "top 90%" } }));
    gsap.from(".por", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.4, ease: "power3.inOut", scrollTrigger: { trigger: ".por", start: "top 80%" } });
    gsap.from(".ticket", { scale: 0.8, rotation: -4, opacity: 0, duration: 1.2, ease: "back.out(1.4)", scrollTrigger: { trigger: ".ticket", start: "top 85%" } });

    // stacked service cards: text entrance + previous card recedes (no darkening)
    const ps = $(".pn");
    ps.forEach((p, i) => {
      gsap.from(p.querySelector(".txt"), { x: -50, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: p, start: "top 80%" } });
      if (ps[i + 1]) gsap.to(p, { scale: 0.94, ease: "none", scrollTrigger: { trigger: ps[i + 1], start: "top 85%", end: "top " + (54 + i * 20) + "px", scrub: true } });
    });

    // scroll-scrubbed canvas portrait in About (capped at the first 10 seconds of the video)
    const cvs = document.getElementById("sv");
    const sv = document.querySelector(".scrub.sv") || document.querySelector(".scrub");
    if (cvs && sv) {
      sv.classList.add("sv");
      const v = document.createElement("video");
      v.src = "/clips/scrub.mp4";
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto";
      const cx = cvs.getContext("2d");
      let ok = false, busy = false, tg = 0;
      const fit = () => { const w = v.videoWidth, h = v.videoHeight; if (!w) return; const sc = Math.max(cvs.width / w, cvs.height / h); cx.drawImage(v, (cvs.width - w * sc) / 2, (cvs.height - h * sc) / 2, w * sc, h * sc); };
      const seek = () => { if (!ok || busy) return; if (Math.abs(v.currentTime - tg) > 0.03) { busy = true; v.currentTime = tg; } };
      const upd = () => { const r = sv.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / (sv.offsetHeight - innerHeight))); tg = p * Math.min(v.duration || 10, 10); seek(); };
      const onSeeked = () => { fit(); busy = false; seek(); };
      const onLoaded = () => { ok = true; fit(); upd(); const pr = v.play(); if (pr && pr.then) pr.then(() => { v.pause(); busy = true; v.currentTime = 0; }).catch(() => {}); };
      v.addEventListener("seeked", onSeeked);
      v.addEventListener("loadeddata", onLoaded);
      addEventListener("scroll", upd, { passive: true });
      addEventListener("resize", upd);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      v.load();
      cleanups.push(() => { v.removeEventListener("seeked", onSeeked); v.removeEventListener("loadeddata", onLoaded); removeEventListener("scroll", upd); removeEventListener("resize", upd); v.removeAttribute("src"); v.load(); });
    }

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);

    return () => {
      tl.kill();
      cleanups.forEach((fn) => fn());
      if (tickerFn) gsap.ticker.remove(tickerFn);
      window.removeEventListener("load", onLoad);
      ScrollTrigger.getAll().forEach((t) => t.kill());
      gsap.killTweensOf("*");
    };
  }, []);
  return null;
}
