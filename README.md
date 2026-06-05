# 🎣 Plymouth Fishing — Tides & Weather

A single-page website showing live **tide times**, **weather**, **wind**, **marine
conditions**, **sun/moon** and a **7-day forecast** for fishing around Plymouth, UK.

Plain HTML / CSS / JavaScript — no build step, no framework, no install.

## Files

| File | What it does |
|------|--------------|
| `index.html` | Page structure |
| `styles.css` | Ocean-themed styling |
| `app.js` | Fetches and renders all data |
| `config.js` | **The only file you edit** — API key/proxy & location |
| `cloudflare-worker.js` | Optional free proxy that hides the tide key (for hosting) |

## Running it

Because the page makes web requests, open it through a tiny local server
(opening `index.html` directly via `file://` works for weather but some
browsers block API calls).

**Option A — Python (already on most machines):**
```powershell
cd "C:\Users\kamer\OneDrive\UNI\FishingWebsite"
python -m http.server 8000
```
Then visit http://localhost:8000

**Option B — VS Code:** install the *Live Server* extension, right-click
`index.html` → *Open with Live Server*.

## Data sources

- **Weather, wind, marine, sun times** — [Open-Meteo](https://open-meteo.com).
  Free, **no API key**, works immediately.
- **Tide times** — [ADMIRALTY UK Tidal API](https://admiralty.azure-api.net/)
  (Plymouth = Devonport, station `0014`). Free but needs a key.

## Getting the tide (ADMIRALTY) key — ~2 minutes

1. Go to https://admiralty.azure-api.net/ and **sign up**.
2. **Subscribe** to the *"UK Tidal API - Discovery"* product.
3. Open your **Profile** → copy your **Primary key**.
4. Paste it into `config.js`:
   ```js
   ADMIRALTY_API_KEY: "your-key-here",
   ```
5. Refresh the page.

### If tides still don't load (CORS)

The ADMIRALTY API sometimes refuses direct browser calls (a CORS block).
If that happens, use the Cloudflare Worker proxy in `cloudflare-worker.js`
instead of a public demo proxy. The public `cors-anywhere.herokuapp.com`
service is only for temporary development use and may return 403/Forbidden.

## Hosting it (free) — GitHub Pages

This is a static site, so GitHub Pages serves it for free:

1. Push the repo to GitHub and make it **public**.
2. **Settings → Pages → Source:** *Deploy from a branch* → branch `main`,
   folder `/ (root)` → **Save**.
3. After ~1 min it's live at `https://<your-username>.github.io/<repo>/`.

## Keeping the tide key private — Cloudflare Worker (recommended for a public site)

Because this is a client-side app, anything in `config.js` is visible to
visitors. To avoid exposing your ADMIRALTY key on a public site, route tide
requests through the free Cloudflare Worker in **`cloudflare-worker.js`** — it
holds the key as a server-side secret, adds CORS, and replaces the
`corsproxy.io` hop.

1. Deploy `cloudflare-worker.js` — either paste it into the Cloudflare
   dashboard (steps in the file's header comment), **or** with the CLI from
   this folder (uses the included `wrangler.toml`):
   ```powershell
   npx wrangler deploy
   npx wrangler secret put ADMIRALTY_API_KEY
   ```
2. Add the Worker secret `ADMIRALTY_API_KEY` (your ADMIRALTY Primary key) —
   the second command above does this.
3. Put the Worker URL into `config.js`:
   ```js
   TIDES_PROXY_URL: "https://fishing-tides.your-name.workers.dev",
   ```
4. You can now blank out `ADMIRALTY_API_KEY` in `config.js` — it's no longer
   used by the browser.

## Changing location

Everything is in `config.js` — `LAT`, `LON`, `MARINE_LAT`, `MARINE_LON`,
`PLACE_NAME`, and `ADMIRALTY_STATION_ID` (find other UK stations in the
ADMIRALTY station list).

---
*For recreational planning only — always check official sources before going out on the water.*
