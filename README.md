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
| `config.js` | **The only file you edit** — API key & location |

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
If you see that error on the tides card, open `config.js` and set:
```js
CORS_PROXY: "https://corsproxy.io/?url=",
```
then refresh. (A public proxy is fine for a demo; for production you'd
route the call through your own small backend instead.)

## Changing location

Everything is in `config.js` — `LAT`, `LON`, `MARINE_LAT`, `MARINE_LON`,
`PLACE_NAME`, and `ADMIRALTY_STATION_ID` (find other UK stations in the
ADMIRALTY station list).

---
*For recreational planning only — always check official sources before going out on the water.*
