/* ============================================================
   CONFIG — edit this file, then save. Nothing else to change.
   ============================================================ */
const CONFIG = {
  // --- TIDES (ADMIRALTY UK Tidal API) ------------------------
  // Use the Cloudflare Worker proxy (keeps API key server-side).
  // Do not rely on the cors-anywhere demo proxy for production.
  TIDES_PROXY_URL: "https://fishing-tides.plymouthfishing.workers.dev/",

  // Plymouth (Devonport) tidal station. Leave as is for Plymouth.
  ADMIRALTY_STATION_ID: "0014",

  // --- LOCATION (Plymouth, UK) -------------------------------
  LAT: 50.3712,
  LON: -4.1427,
  // Marine grid point just offshore in Plymouth Sound.
  MARINE_LAT: 50.33,
  MARINE_LON: -4.13,
  PLACE_NAME: "Plymouth, UK",

  TIMEZONE: "Europe/London",
};
