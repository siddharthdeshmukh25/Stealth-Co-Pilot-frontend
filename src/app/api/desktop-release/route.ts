import { NextResponse } from "next/server";

// The desktop app publishes a GitHub release for every vX.Y.Z tag, so the setup
// card on the landing page can read the newest release instead of hard-coding a
// version that goes stale on the next build.
const REPO = "siddharthdeshmukh25/Stealth-Co-Pilot";
const ASSET = "StealthInterviewCoPilot.exe";
// A release carries both "...exe" and "...-v1.2.3.exe"; the versioned one wins so
// the file a visitor saves already says which build it is.
const VERSIONED = /^StealthInterviewCoPilot-v[\d.]+\.exe$/i;
const PLAIN = /^StealthInterviewCoPilot\.exe$/i;

const FALLBACK = {
  version: "1.1.2",
  size: "108 MB",
  filename: ASSET,
  url: `https://github.com/${REPO}/releases/latest/download/${ASSET}`,
};

export const revalidate = 300;

export async function GET() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "stealth-co-pilot-web",
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      throw new Error(`GitHub replied ${response.status}`);
    }
    const release = await response.json();
    const assets: Array<{ name?: string; size?: number; browser_download_url?: string }> = release?.assets ?? [];
    const named = (pattern: RegExp) => assets.find((item) => pattern.test(String(item.name ?? "")));
    const asset = named(VERSIONED) ?? named(PLAIN);
    const version = String(release?.tag_name ?? "").replace(/^v/i, "") || FALLBACK.version;
    const size = asset?.size ? `${Math.max(1, Math.round(asset.size / 1048576))} MB` : FALLBACK.size;
    const filename = String(asset?.name ?? `StealthInterviewCoPilot-v${version}.exe`);
    return NextResponse.json(
      { version, size, filename, url: asset?.browser_download_url || FALLBACK.url, publishedAt: release?.published_at ?? null },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
