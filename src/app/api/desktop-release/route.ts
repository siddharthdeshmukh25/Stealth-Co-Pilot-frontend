import { NextResponse } from "next/server";

/**
 * Live desktop release details, read straight from GitHub.
 *
 * Visitors download the Inno Setup wizard (`…-Setup.exe`), which asks for the
 * licence, install folder, Start Menu group and shortcuts and registers an
 * uninstaller. The portable `StealthInterviewCoPilot.exe` in the same release is
 * what the in-app updater patches, so it is deliberately not the page's link.
 */
const REPO = "siddharthdeshmukh25/Stealth-Co-Pilot";
const SETUP_ASSET = "StealthInterviewCoPilot-Setup.exe";

const FALLBACK_RELEASE = {
  version: "1.1.7",
  sizeMb: "108.5",
  filename: SETUP_ASSET,
  downloadUrl: `https://github.com/${REPO}/releases/latest/download/${SETUP_ASSET}`,
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
      const setup = assets.find((asset) => asset.name === SETUP_ASSET)
        || assets.find((asset) => /-Setup-v\d+\.\d+\.\d+\.exe$/i.test(asset.name || ""));
      const version = tag.replace(/^v/i, "");
      if (/^\d+\.\d+\.\d+$/.test(version) && setup?.size) {
        release = {
          version,
          sizeMb: (setup.size / (1024 * 1024)).toFixed(1),
          filename: setup.name || SETUP_ASSET,
          downloadUrl: `https://github.com/${REPO}/releases/latest/download/${SETUP_ASSET}`,
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
