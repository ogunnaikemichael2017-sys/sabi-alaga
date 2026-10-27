# The Sabi Alaga — landing page

Landing page for The Sabi Alaga (Yoruba traditional wedding MC/coordinator), built with Next.js 14 App Router in plain JavaScript, static-exported and deployed on Netlify.

- Live site: https://thesabialaga.netlify.app
- Design + motion reference: the original GSAP prototype (curtain intro, sticky stacked service cards, pinned sideways wedding rail, auto-drifting 3D testimonial carousel, drifting hero diamonds, scroll-velocity marquee, scroll progress bar).
- Components live in `app/components/`; GSAP motion layer is `app/components/MotionEffects.jsx`.
- Deploy: zip upload of `out/` to Netlify (project `thesabialaga`).

## Launch TODOs

- [ ] Replace couple-name placeholder cards in `Weddings.jsx` with real couples (each couple's permission needed first)
- [ ] Replace About portrait + story placeholders (`About.jsx`) with real photos and copy
- [ ] Replace testimonial placeholders (`Testimonials.jsx`) with real quotes
- [ ] Training photo placeholder (`Services.jsx`) once photos exist
- [ ] Add `public/og-cover.jpg` (1200×630) for social sharing
- [ ] Clips in `public/clips/` are uploaded with the deploy but are not yet in this repo (binary push pending); they land here once a fine-grained git token is saved or they are added by hand
