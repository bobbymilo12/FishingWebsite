/* ============================================================
   CONFIG — edit this file, then save. Nothing else to change.
   ============================================================ */
const CONFIG = {
  // --- TIDES (ADMIRALTY UK Tidal API) ------------------------
  // RECOMMENDED: route tide requests through the free Cloudflare Worker
  // (see cloudflare-worker.js). It keeps your ADMIRALTY key server-side so
  // it is NOT exposed in the browser, and handles CORS. Paste the Worker's
  // URL here once deployed, e.g.
  //   "https://fishing-tides.your-name.workers.dev"
  // When this is set, ADMIRALTY_API_KEY and CORS_PROXY below are unused
  // (you can safely blank out the key).
  TIDES_PROXY_URL: "https://fishing-tides.plymouthfishing.workers.dev/",

  // DIRECT MODE (only used when TIDES_PROXY_URL is empty) ------
  // Register for a FREE key (~2 min) at https://admiralty.azure-api.net/
  // and subscribe to the "UK Tidal API - Discovery" product, then paste
  // your Primary key here. NOTE: in direct mode this key is visible to
  // anyone using the site — prefer the Worker above for a public site.
  ADMIRALTY_API_KEY: "",

  // Plymouth (Devonport) tidal station. Leave as is for Plymouth.
  ADMIRALTY_STATION_ID: "0014",

  // CORS proxy for DIRECT MODE (the ADMIRALTY API often blocks browser
  // calls). Leave empty ("") to try a direct call first.
  CORS_PROXY: "https://corsproxy.io/?url=",

  // --- LOCATION (Plymouth, UK) -------------------------------
  LAT: 50.3712,
  LON: -4.1427,
  // Marine grid point just offshore in Plymouth Sound.
  MARINE_LAT: 50.33,
  MARINE_LON: -4.13,
  PLACE_NAME: "Plymouth, UK",

  TIMEZONE: "Europe/London",
};
