import { NextResponse } from "next/server";

// The desktop app publishes a GitHub release for every vX.Y.Z tag, so the setup
// card reads the newest release instead of hard-coding a version that goes stale
// on the next build. GitHub allows 60 unauthenticated calls an hour per IP, so the
// answer is held in memory for a couple of minutes and the CDN caches it for one.
const REPO = "siddharthdeshmukh25/Stealth-Co-Pilot";
const ASSET = "StealthInterviewCoPilot.exe";
// A release carries both "...exe" and "...-v1.2.3.exe"; the versioned one wins so
// the file a visitor saves already says which build it is.
const VERSIONED = /^StealthInterviewCoPilot-v[\d.]+\.exe$/i;
const PLAIN = /^StealthInterviewCoPilot\.exe$/i;

const FALLBACK = {
  version: "1.1.4",
  size: "108 MB",
  filename: ASSET,
  url: `https://github.com/${REPO}/releases/latest/download/${ASSET}`,
  publishedAt: null as string | null,
};

const TTL_MS = 120_000;
let cache: { at: number; data: typeof FALLBACK } | null = null;

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readRelease(): Promise<typeof FALLBACK> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "stealth-co-pilot-web" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GitHub replied ${response.status}`);
  }
  const release = await response.json();
  const assets: Array<{ name?: string; size?: number; browser_download_url?: string }> = release?.assets ?? [];
  const named = (pattern: RegExp) => assets.find((item) => pattern.test(String(item.name ?? "")));
  const asset = named(VERSIONED) ?? named(PLAIN);
  const version = String(release?.tag_name ?? "").replace(/^v/i, "") || FALLBACK.version;
  return {
    version,
    size: asset?.size ? `${Math.max(1, Math.round(asset.size / 1048576))} MB` : FALLBACK.size,
    filename: String(asset?.name ?? `StealthInterviewCoPilot-v${version}.exe`),
    url: asset?.browser_download_url || FALLBACK.url,
    publishedAt: release?.published_at ?? null,
  };
}

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, { headers });
  }
  try {
    const data = await readRelease();
    cache = { at: Date.now(), data };
    return NextResponse.json(data, { headers });
  } catch {
    if (cache) {
      return NextResponse.json(cache.data, { headers });
    }
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "public, s-maxage=30" } });
  }
}
