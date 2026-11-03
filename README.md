# Stealth Interview Co-Pilot — phone web app

Next.js 14 app that the phone opens during an interview: live captions, one-tap AI answers, and the
pairing-code entry on the landing page. It talks to the FastAPI backend (repo:
`Stealth-Co-Pilot-interview-backend`) over REST and a websocket.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page; enter the 6-digit pairing code from the desktop app to jump into the room |
| `/teleprompter/<sessionId>` | The live room (captions, Ask AI, history) |
| `/desktop-preview` | Layout preview used by the desktop app |

## Local development

```bash
npm install
cp .env.example .env.local     # point at your backend
npm run dev                    # http://localhost:3000
```

`NEXT_PUBLIC_BACKEND_URL` is inlined at build time. Without it, the app falls back to
`http://<current-host>:8000`, which only works when the backend runs on the same machine.

## Deploying to Vercel

1. Import this repo in Vercel (framework preset: Next.js, no build overrides needed).
2. Add an environment variable for **Production**:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_BACKEND_URL` | `https://<your-backend-host>` |

   It must be `https://` — a page served over https cannot call an `http://` backend, and the
   websocket needs `wss://`.
3. Redeploy after changing the variable (the value is baked into the client bundle).
4. On the backend, add the Vercel origin to `CORS_ORIGINS`
   (`https://<project>.vercel.app`) or allow it with `CORS_ORIGIN_REGEX`.
5. In the desktop app, set `COPILOT_WEB_URL` to this deployment so the room link and QR code point
   at Vercel instead of a LAN address.

## Pairing flow

Desktop creates a room → backend returns a 6-digit `pairing_code` → the landing page resolves it with
`GET /api/session/pairing/<code>` and routes to `/teleprompter/<session_id>`. Pairing a code here does
not change the desktop's paired state; scanning the QR does.
