/* ============================================================
   CONFIG — edit this file, then save. Nothing else to change.
   ============================================================ */
const CONFIG = {
  // --- TIDES (ADMIRALTY UK Tidal API) ------------------------
  // 1. Register for a FREE key (takes ~2 min):
  //      https://admiralty.azure-api.net/  ->  sign up -> subscribe
  //      to the "UK Tidal API - Discovery" product.
  // 2. Paste your Primary key between the quotes below.
  ADMIRALTY_API_KEY: "d39c3cd5c0e24fb684c6cd54c6e0a5f4",

  // Plymouth (Devonport) tidal station. Leave as is for Plymouth.
  ADMIRALTY_STATION_ID: "0014",

  // The ADMIRALTY API sometimes blocks direct browser calls (CORS).
  // If tides fail to load, paste a CORS proxy URL here, e.g.:
  //   "https://corsproxy.io/?url="   (the request URL is appended)
  // Leave empty ("") to try a direct call first.
  CORS_PROXY: "https://corsproxy.io/?url= ",

  // --- LOCATION (Plymouth, UK) -------------------------------
  LAT: 50.3712,
  LON: -4.1427,
  // Marine grid point just offshore in Plymouth Sound.
  MARINE_LAT: 50.33,
  MARINE_LON: -4.13,
  PLACE_NAME: "Plymouth, UK",

  TIMEZONE: "Europe/London",
};
