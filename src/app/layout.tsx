import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Stealth Interview Co-Pilot · live captions and AI answers on your phone",
  description:
    "Pair your phone with the desktop app and follow the interview through live captions and one-tap AI answers built from your own resume and job description.",
  applicationName: "Stealth Interview Co-Pilot",
  openGraph: {
    title: "Stealth Interview Co-Pilot",
    description: "Live interview captions and AI answers on your phone, paired from the desktop app.",
    type: "website",
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
