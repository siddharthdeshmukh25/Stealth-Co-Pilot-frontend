import { NextResponse } from "next/server";

// The desktop app publishes a GitHub release for every vX.Y.Z tag, so the setup
// card on the landing page can read the newest release instead of hard-coding a
// version that goes stale on the next build.
const REPO = "siddharthdeshmukh25/Stealth-Co-Pilot";
const ASSET = "StealthInterviewCoPilot.exe";

const FALLBACK = {
  version: "1.1.2",
  size: "108 MB",
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
    const asset = assets.find((item) => String(item.name ?? "").toLowerCase() === ASSET.toLowerCase());
    const version = String(release?.tag_name ?? "").replace(/^v/i, "") || FALLBACK.version;
    const size = asset?.size ? `${Math.max(1, Math.round(asset.size / 1048576))} MB` : FALLBACK.size;
    return NextResponse.json(
      { version, size, url: asset?.browser_download_url || FALLBACK.url, publishedAt: release?.published_at ?? null },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "public, s-maxage=60" } });
  }
}
