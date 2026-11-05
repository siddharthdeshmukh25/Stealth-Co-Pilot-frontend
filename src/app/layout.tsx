import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "AI interview assistant · live captions and answers on your phone",
  description:
    "An AI assistant for live interviews: the desktop app listens to the interviewer, writes live captions and sends one-tap answers to your phone using your own resume and the job description.",
  applicationName: "Stealth Interview Co-Pilot",
  openGraph: {
    title: "AI interview assistant",
    description: "Live interview captions and one-tap AI answers on your phone, paired from the desktop app.",
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
