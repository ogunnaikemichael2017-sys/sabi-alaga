// Default site content: the seed for Firestore "content/home" and the
// fallback the site renders when Firestore content is missing or unreachable.
// Field names follow the admin prototype section registry (T).

const C = "https://res.cloudinary.com/di4dlnd5x";

export const DEFAULT_SECTIONS = [
  { id: "hero", type: "hero", vis: true, data: {
    headline: "The Sought After Alaga",
    sub: "I host your introduction, engagement or traditional wedding with dobale, joy and order. Lagos, Ibadan, or wherever your day is.",
    btn: "Check my date",
    video: C + "/video/upload/v1793345885/sabi-alaga/videos/hero.mp4",
  } },
  { id: "marquee", type: "marquee", vis: true, data: {
    words: "\u1EB8 k\u00E1\u00E0b\u1ECD\u0300, D\u1ECD\u0300b\u00E1l\u1EB9\u0300, \u00CCgb\u00E9y\u00E0w\u00F3, Ay\u1ECD\u0300, \u00C0\u1E63\u1EB9, \u1EB8 \u1E63\u00E9",
  } },
  { id: "services", type: "services", vis: true, data: {
    title: "What I do for your day",
    intro: "One alaga from the first knock to the last dance, so both families can simply enjoy the day.",
    cards: [
      { h: "Alaga Iduro and Ijoko", p: "I stand as the traditional host of your ceremony: both families, the prayers, the dobale and the praise.", a: "Ask about this", href: "#book", img: C + "/image/upload/v1793345868/sabi-alaga/images/service-1.jpg", alt: "The alaga seated between a couple in pink and purple aso oke" },
      { h: "Introductions and engagements", p: "I run your parlor and family introductions with warmth, humour and respect for both houses.", a: "Ask about this", href: "#book", img: C + "/image/upload/v1793345869/sabi-alaga/images/service-2.jpg", alt: "The alaga presenting a fan to a couple in royal blue aso oke" },
      { h: "Eru Iyawo setup", p: "I style and present your bride\u2019s entourage and gifts, so the family entrance is a moment to remember.", a: "Ask about this", href: "#book", img: C + "/image/upload/v1793345870/sabi-alaga/images/service-3.jpg", alt: "The alaga holding the microphone beside a bride in purple lace" },
      { h: "Traditional wedding MC", p: "I anchor your day from the first cue to the last dance: order, energy and timing that never slips.", a: "Ask about this", href: "#book", img: C + "/image/upload/v1793345870/sabi-alaga/images/service-4.jpg", alt: "The alaga seated with a couple under a lighted arch backdrop" },
      { h: "Brides gifts", p: "I source, wrap and present gifts for your bride beautifully on the day of the engagement.", a: "Ask about this", href: "#book", img: C + "/image/upload/v1793345866/sabi-alaga/images/brides-gifts.jpg", alt: "Sabi standing beside a styled eru iyawo gift display" },
      { h: "Training and consultation", p: "I teach the work I have done for 5 years, or advise you before your own event.", a: "See training", href: "#training", img: C + "/image/upload/v1793345873/sabi-alaga/images/service-6.jpg", alt: "The alaga seated between a couple in white and gold" },
    ],
  } },
  { id: "weddings", type: "weddings", vis: true, data: {
    title: "Real weddings, real energy",
    sub: "Clips from events I have hosted, shown with each couple\u2019s permission. Tap the speaker at the bottom of a clip to hear the sound.",
    clips: [
      { t: "The beg for the bride", s: "Groom\u2019s side, pleading their case", v: C + "/video/upload/v1793345881/sabi-alaga/videos/beg.mp4" },
      { t: "The dobale moment", s: "Groom\u2019s men, flat on the floor", v: C + "/video/upload/v1793345883/sabi-alaga/videos/dobale.mp4" },
      { t: "Matching your energy", s: "Dancing with the guests", v: C + "/video/upload/v1793345884/sabi-alaga/videos/energy.mp4" },
      { t: "The groom\u2019s men", s: "Steeze and composure", v: C + "/video/upload/v1793345889/sabi-alaga/videos/v3.mp4" },
      { t: "Song and praise", s: "The women lead the entrance", v: C + "/video/upload/v1793345892/sabi-alaga/videos/v4.mp4" },
      { t: "Aso ebi on the floor", s: "The dance floor does not rest", v: C + "/video/upload/v1793345894/sabi-alaga/videos/v5.mp4" },
    ],
  } },
  { id: "about", type: "about", vis: true, data: {
    title: "Hello, I\u2019m Sabi",
    story: "From the first knock on the gate to the last dance, I stand between two families and keep love, laughter and respect flowing. For 5 years I have hosted introductions, engagements and traditional weddings across Lagos and Ibadan: the dobale, the prayers, the eru iyawo, the geles. Every family is treated like my own, so from the moment I pick up the microphone, your people can relax and simply enjoy their day.",
    img: C + "/image/upload/v1793345867/sabi-alaga/images/sabi-portrait.jpg",
    imgAlt: "Sabi in a green lace outfit, standing beside The Sabi Alaga sign",
  } },
  { id: "shop", type: "shop", vis: true, data: {
    title: "Add the finishing touches",
    cards: [
      { h: "Jewelry by Saysay", p: "Pearl and crystal bridal sets from my jewelry plug, Saysay. Message me on WhatsApp to ask what is available for your date.", img: C + "/image/upload/v1793345866/sabi-alaga/images/product-jewelry.jpg", alt: "A pearl and crystal bridal jewelry set on a display bust" },
      { h: "Eru iyawo packages", p: "Trunks, boxes and crates of gifts for your engagement, sourced, wrapped and styled for you.", img: C + "/image/upload/v1793345867/sabi-alaga/images/product-trunk.jpg", alt: "A styled display of wrapped gift trunks, fruit crates and coolers" },
    ],
  } },
  { id: "testimonials", type: "testimonials", vis: true, data: {
    title: "What people say",
    quote: "The bride literally wouldn\u2019t stop talking about you afterwards!",
    by: "Event decorator, Lagos",
    cards: [
      { i: C + "/image/upload/v1793345873/sabi-alaga/images/tst-1.jpg", a: "Real client message: your talent, energy and vibes are unmatched. You made the event so lively and enjoyable." },
      { i: C + "/image/upload/v1793345874/sabi-alaga/images/tst-2.jpg", a: "Real client message: you outdid yourself considering the short notice. You bad my sabi Alaga." },
      { i: C + "/image/upload/v1793345875/sabi-alaga/images/tst-3.jpg", a: "Real client message: you did amazing and I am proud of you." },
      { i: C + "/image/upload/v1793345876/sabi-alaga/images/tst-4.jpg", a: "Real client message from Eventbydaisy: you delivered very well, take your flowers." },
      { i: C + "/image/upload/v1793345876/sabi-alaga/images/tst-5.jpg", a: "Real client message: even with all the ups and downs during the planning you were calm all through and your customer service is top notch. The Sabi Alaga to the world." },
      { i: C + "/image/upload/v1793345877/sabi-alaga/images/tst-6.jpg", a: "Real client message: you helped me come out of my shell and made everyone feel comfortable. We are really glad we chose your service." },
      { i: C + "/image/upload/v1793345877/sabi-alaga/images/tst-7.jpg", a: "Real client message from Decor_with_Dems: the way you handled the guests and kept the ceremony flowing was truly impressive." },
    ],
  } },
  { id: "training", type: "training", vis: true, data: {
    title: "Train with me",
    text: "I will teach you the craft, the culture and the business of hosting, the same way I do it on stage. Small, hands-on classes. Join the waitlist and be the first to hear when my next class opens.",
    btn: "Join the waitlist",
    items: ["Hosting and stage presence", "Traditions and protocols", "Styling and presentation", "Pricing and finding clients"],
  } },
  { id: "booking", type: "booking", vis: true, data: {
    title: "Save your date",
    intro: "Tell me about your event. This opens WhatsApp with your details ready to send.",
  } },
  { id: "footer", type: "footer", vis: true, data: {
    tag: "Yoruba traditional wedding host",
    fline: "Yoruba traditional wedding host. Lagos, Ibadan and wherever your event is. 08089193663",
    soc: [
      { l: "TikTok", n: "102.4K", u: "https://www.tiktok.com/@thesabialaga" },
      { l: "Instagram", n: "3,668", u: "https://www.instagram.com/thesabialaga/" },
      { l: "Facebook", n: "26K", u: "https://www.facebook.com/sarah.safaru.2025" },
      { l: "WhatsApp", n: "Chat now", u: "https://wa.me/2348089193663" },
    ],
  } },
];

export const DEFAULTS = {};
for (const s of DEFAULT_SECTIONS) DEFAULTS[s.type] = s.data;
