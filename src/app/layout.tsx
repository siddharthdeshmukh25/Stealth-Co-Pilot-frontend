import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stealth-co-pilot.vercel.app";
const SITE_DESCRIPTION =
  "An AI co-pilot for your interview: the desktop app listens to the call, live captions land on your phone, and one tap gives you a short, answer-ready reply from your resume and job description.";
// WhatsApp, Telegram and Slack only render a preview when og:image is an absolute
// URL with a known size, which is why metadataBase is set and the card lives here.
const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "Stealth Interview Co-Pilot - live captions and AI answers on your phone" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Stealth Interview Co-Pilot · live captions and AI answers on your phone",
  description: SITE_DESCRIPTION,
  applicationName: "Stealth Interview Co-Pilot",
  keywords: [
    "interview co-pilot",
    "live interview captions",
    "AI interview assistant",
    "interview helper",
    "real-time transcription",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Stealth Interview Co-Pilot",
    locale: "en_US",
    title: "Stealth Interview Co-Pilot - live captions & AI answers on your phone",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stealth Interview Co-Pilot - live captions & AI answers on your phone",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0f16" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
  ],
};

// Runs before first paint so the saved Light/Dark choice never flashes.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("copilot:theme");var d=t?t==="dark":true;var c=document.documentElement.classList;c.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark font-sans" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
