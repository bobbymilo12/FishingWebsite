/* ============================================================
   CONFIG — edit this file, then save. Nothing else to change.
   ============================================================ */
const CONFIG = {
  // --- TIDES (ADMIRALTY UK Tidal API) ------------------------
  // Register for a FREE key (~2 min) at https://admiralty.azure-api.net/
  // and subscribe to the "UK Tidal API - Discovery" product, then paste
  // your Primary key here.
  ADMIRALTY_API_KEY: "71f55373813c4452a0263d564638c327",

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
