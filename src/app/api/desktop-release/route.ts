import { NextResponse } from "next/server";

/**
 * Live desktop release details, read straight from GitHub.
 *
 * The release workflow publishes `StealthInterviewCoPilot.exe` (stable name, used
 * by the download button) next to `StealthInterviewCoPilot-vX.Y.Z.exe`. Reading
 * the tag here keeps the version and size on the page in step with the build
 * without another source of truth to update by hand.
 */
const REPO = "siddharthdeshmukh25/Stealth-Co-Pilot";
const STABLE_ASSET = "StealthInterviewCoPilot.exe";

const FALLBACK_RELEASE = {
  version: "1.1.6",
  sizeMb: "108.5",
  filename: STABLE_ASSET,
  downloadUrl: `https://github.com/${REPO}/releases/latest/download/${STABLE_ASSET}`,
};

type ReleaseAsset = { name?: string; size?: number };

export async function GET() {
  let release = FALLBACK_RELEASE;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "stealth-co-pilot-web" },
      next: { revalidate: 300 },
    });
    if (response.ok) {
      const body = (await response.json()) as { tag_name?: string; assets?: ReleaseAsset[] };
      const tag = (body.tag_name || "").trim();
      const assets = body.assets || [];
      const stable = assets.find((asset) => asset.name === STABLE_ASSET) || assets.find((asset) => /\.exe$/i.test(asset.name || ""));
      const version = tag.replace(/^v/i, "");
      if (/^\d+\.\d+\.\d+$/.test(version) && stable?.size) {
        release = {
          version,
          sizeMb: (stable.size / (1024 * 1024)).toFixed(1),
          filename: stable.name || STABLE_ASSET,
          downloadUrl: `https://github.com/${REPO}/releases/latest/download/${STABLE_ASSET}`,
        };
      }
    }
  } catch {
    /* GitHub unreachable: the cached fallback still downloads the newest build. */
  }

  return NextResponse.json(release, {
    headers: { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}
