/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Firebase ka auth helper hamare hi domain se serve hota hai (neeche rewrite).
  // Isse sign-in ki storage first-party rehti hai: 3rd-party storage block karne
  // wale browsers me bhi redirect ke baad session bachta hai.
  async rewrites() {
    return [
      { source: "/__/auth/:path*", destination: "https://stealth-co-pilot.firebaseapp.com/__/auth/:path*" },
      { source: "/__/firebase/init.json", destination: "https://stealth-co-pilot.firebaseapp.com/__/firebase/init.json" },
    ];
  },
};

module.exports = nextConfig;
