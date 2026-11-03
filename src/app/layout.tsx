import type { Metadata } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark font-sans"><head><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#171717" /></head><body><ServiceWorker />{children}</body></html>;
}

