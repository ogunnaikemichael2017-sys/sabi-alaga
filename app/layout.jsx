import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://thesabialaga.netlify.app"),
  title: "The Sabi Alaga | Yoruba traditional wedding host, Lagos and Ibadan",
  description:
    "Alaga iduro and ijoko for Yoruba introductions, engagements and traditional weddings, hosted with dobale, joy and order. Lagos, Ibadan and beyond. Book The Sabi Alaga.",
  openGraph: {
    type: "website",
    title: "The Sabi Alaga | The Sought After Alaga",
    description:
      "Introductions, engagements and traditional weddings, hosted with dobale, joy and order. Lagos, Ibadan and wherever your event is.",
    images: ["/og-cover.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#C4175F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,900;1,600;1,900&family=Figtree:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
