/* ============================================================
   Plymouth Fishing — app logic
   Fetches weather (Open-Meteo, no key) + tides (ADMIRALTY).
   ============================================================ */

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);

/* ---------- Response cache (localStorage) ----------
   Cuts API calls: page reloads, extra tabs and routine refreshes reuse a
   recent response instead of re-hitting the network. Tide predictions in
   particular barely change, so they get a long TTL — important because the
   ADMIRALTY free tier has a limited request quota.
   `force` bypasses the cache (the manual Refresh button uses it). */
function cacheGet(key, maxAgeMs, force) {
  if (force) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > maxAgeMs) return null;
    return data;
  } catch { return null; }
}
function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch { /* quota / private mode — just skip caching */ }
}

const WMO = {
  0:  ["Clear sky", "☀️"],
  1:  ["Mainly clear", "🌤️"],
  2:  ["Partly cloudy", "⛅"],
  3:  ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm + hail", "⛈️"],
  99: ["Thunderstorm + hail", "⛈️"],
};
const wmo = (code) => WMO[code] || ["—", "❔"];

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) =>
  deg == null ? "—" : COMPASS[Math.round(deg / 22.5) % 16];

const fmtTime = (date) =>
  date.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: CONFIG.TIMEZONE,
  });

// Open-Meteo returns times already in the requested local timezone as plain
// wall-clock strings ("2026-06-05T05:07"). Display the HH:MM part directly so
// it stays correct regardless of the viewer's own timezone.
const fmtLocalIso = (iso) => (iso || "").slice(11, 16) || "—";

const fmtDayName = (date, i) => {
  if (i === 0) return "Today";
  return date.toLocaleDateString("en-GB", { weekday: "short", timeZone: CONFIG.TIMEZONE });
};

const dayKey = (date) =>
  date.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short", timeZone: CONFIG.TIMEZONE,
  });

/* ---------- Moon phase (simple synodic calc) ---------- */
function moonPhase(date) {
  const synodic = 29.53058867;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  let phase = (((date.getTime() / 86400000) - knownNew) % synodic) / synodic;
  if (phase < 0) phase += 1;

  const names = [
    [0.0625, "New moon", "🌑"],
    [0.1875, "Waxing crescent", "🌒"],
    [0.3125, "First quarter", "🌓"],
    [0.4375, "Waxing gibbous", "🌔"],
    [0.5625, "Full moon", "🌕"],
    [0.6875, "Waning gibbous", "🌖"],
    [0.8125, "Last quarter", "🌗"],
    [0.9375, "Waning crescent", "🌘"],
  ];
  for (const [edge, name, icon] of names) {
    if (phase < edge) return { name, icon, illum: Math.round((1 - Math.abs(0.5 - phase) * 2) * 100) };
  }
  return { name: "New moon", icon: "🌑", illum: 0 };
}

/* ============================================================
   WEATHER — Open-Meteo (forecast + marine), no key needed
   ============================================================ */
async function loadWeather(force) {
  const f = new URL("https://api.open-meteo.com/v1/forecast");
  f.search = new URLSearchParams({
    latitude: CONFIG.LAT,
    longitude: CONFIG.LON,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl",
    hourly: "pressure_msl,weather_code,wind_speed_10m,wind_direction_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum",
    timezone: CONFIG.TIMEZONE,
    wind_speed_unit: "mph",
    temperature_unit: "celsius",
    forecast_days: "7",
  }).toString();

  const cacheKey = "fw:weather:" + CONFIG.LAT + "," + CONFIG.LON;
  let data = cacheGet(cacheKey, 15 * 60 * 1000, force);
  if (!data) {
    const res = await fetch(f);
    if (!res.ok) throw new Error("Weather request failed: " + res.status);
    data = await res.json();
    cacheSet(cacheKey, data);
  }

  fishState.current = data.current;
  fishState.hourly = data.hourly;
  fishState.daily = data.daily;

  renderCurrent(data.current);
  renderFishing();
  renderForecast(data.daily);
  renderSunMoon(data.daily);
}

async function loadMarine(force) {
  const m = new URL("https://marine-api.open-meteo.com/v1/marine");
  m.search = new URLSearchParams({
    latitude: CONFIG.MARINE_LAT,
    longitude: CONFIG.MARINE_LON,
    current: "wave_height,wave_direction,wave_period,sea_surface_temperature",
    timezone: CONFIG.TIMEZONE,
  }).toString();

  const cacheKey = "fw:marine:" + CONFIG.MARINE_LAT + "," + CONFIG.MARINE_LON;
  let data = cacheGet(cacheKey, 15 * 60 * 1000, force);
  if (!data) {
    const res = await fetch(m);
    if (!res.ok) throw new Error("Marine request failed: " + res.status);
    data = await res.json();
    cacheSet(cacheKey, data);
  }
  renderMarine(data.current, data.current_units || {});
}

/* ---------- Renderers ---------- */
function renderCurrent(c) {
  const [desc, icon] = wmo(c.weather_code);
  $("#place").textContent = CONFIG.PLACE_NAME.replace(/, UK$/, "");
  $("#cur-icon").textContent = icon;
  $("#cur-temp").textContent = Math.round(c.temperature_2m) + "°";
  $("#cur-desc").textContent = desc;
  $("#cur-feels").textContent = Math.round(c.apparent_temperature) + "°";
  $("#cur-wind").textContent =
    Math.round(c.wind_speed_10m) + " mph " + compass(c.wind_direction_10m);
  $("#cur-humidity").textContent = c.relative_humidity_2m + "%";
  $("#cur-pressure").textContent = Math.round(c.pressure_msl) + " hPa";
}

// Fill the "Tide" stat in the Right-now box: rising/falling now + next event.
function updateHeroTide(tides) {
  const el = $("#cur-tide");
  if (!el) return;
  const now = new Date();
  const evs = (Array.isArray(tides) ? tides : [])
    .map((ev) => ({
      date: new Date(ev.DateTime + (ev.DateTime.endsWith("Z") ? "" : "Z")),
      high: ev.EventType === "HighWater",
    }))
    .sort((a, b) => a.date - b.date);
  const next = evs.find((e) => e.date > now);
  if (!next) { el.textContent = "—"; return; }

  const rising = next.high; // heading toward high water => water is rising
  const mins = Math.round((next.date - now) / 60000);
  const eta = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  el.innerHTML =
    `<span class="tide-state">${rising ? "Rising ▲" : "Falling ▼"}</span>` +
    `<span class="tide-next">${next.high ? "High" : "Low"} ${fmtTime(next.date)} · in ${eta}</span>`;
}

/* ---------- Fishing conditions (bite forecast) ----------
   Combines several angling rules of thumb into a single 0–100 score. Each
   factor contributes points out of its own max; the final score is the total
   normalised against the maxes of whichever factors had data — so missing
   inputs (no tide key, etc.) don't skew the result.

   • Tide state — arguably the #1 factor in UK sea fishing: moving water (the
     flood especially) triggers feeding; slack water around high/low is slow.
   • Light — dawn & dusk are peak feeding windows; bright midday sends fish
     deep; many sea species also feed after dark.
   • Pressure level & trend — a falling barometer ahead of a front is a classic
     "feed up" signal (weak direct evidence for sea fish, so weighted modestly).
   • Sky / rain — overcast & light rain make fish feel safe to feed up high.
   • Wind — mild southerly/westerly airflow generally fishes better than cold
     easterlies (a rough proxy; true effect is onshore-vs-offshore at the mark).

   Shared state: weather and tides load independently and either can fail, so
   the card renders from whatever's arrived and re-renders when more turns up. */
const fishState = { current: null, hourly: null, daily: null, tides: null, selectedIso: null };

// Offset (ms) between the API's local wall-clock strings and real UTC, rounded
// to the nearest half hour — lets us turn a wall-clock hour into a real instant
// for comparison against the (UTC) tide events.
function wallClockOffset(c) {
  if (!c || !c.time) return 0;
  return Math.round((new Date(c.time + "Z") - new Date()) / 1800000) * 1800000;
}

// Tide factor (max 30). Works out whether the water is flooding/ebbing and how
// strong the flow is at instant `at`, from the ADMIRALTY high/low-water events.
function scoreTide(at, tides) {
  if (!Array.isArray(tides) || tides.length === 0) return null;
  const evs = tides
    .map((ev) => ({
      date: new Date(ev.DateTime + (ev.DateTime.endsWith("Z") ? "" : "Z")),
      high: ev.EventType === "HighWater",
    }))
    .sort((a, b) => a.date - b.date);

  let prev = null, next = null;
  for (const e of evs) {
    if (e.date <= at) prev = e; else { next = e; break; }
  }
  if (!prev || !next) return null; // outside the tide window

  const span = next.date - prev.date;
  const f = span > 0 ? (at - prev.date) / span : 0.5;
  const flow = Math.sin(Math.min(1, Math.max(0, f)) * Math.PI); // 0 at slack, 1 mid-tide
  const rising = next.high; // heading toward high water
  const nearSlack = Math.min(at - prev.date, next.date - at) < 45 * 60 * 1000;
  const slackEv = (at - prev.date) <= (next.date - at) ? prev : next;

  let pts, note;
  if (nearSlack && slackEv.high) { pts = 16; note = "Around high water — flow easing"; }
  else if (nearSlack)            { pts = 8;  note = "Slack at low water — slow"; }
  else if (rising)               { pts = 16 + 14 * flow; note = "Rising (flood) tide — prime feeding"; }
  else                           { pts = 11 + 9 * flow;  note = "Falling (ebb) tide — fish on the move"; }
  pts = Math.round(pts);

  const mins = Math.round((next.date - at) / 60000);
  const eta = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return {
    pts, max: 30, note,
    icon: "🌊",
    label: "Tide",
    value: `${next.high ? "High" : "Low"} in ${eta}`,
    verdict: pts >= 20 ? "good" : pts >= 12 ? "ok" : "bad",
  };
}

// Light factor (max 12) from sunrise/sunset for the snapshot's own day.
function scoreDaylight(c, daily) {
  if (!daily || !daily.sunrise || !daily.sunset || !c.time) return null;
  const mins = (iso) => (+iso.slice(11, 13)) * 60 + (+iso.slice(14, 16));
  const day = c.time.slice(0, 10);
  let di = daily.time ? daily.time.indexOf(day) : 0;
  if (di < 0) di = 0;
  const sr = mins(daily.sunrise[di]);
  const ss = mins(daily.sunset[di]);
  const nowM = mins(c.time);
  const golden = Math.min(Math.abs(nowM - sr), Math.abs(nowM - ss)) <= 75;
  const isDay = nowM >= sr && nowM <= ss;
  const midday = Math.abs(nowM - (sr + ss) / 2) <= 90;

  let pts, note, icon, value, verdict;
  if (golden)       { pts = 12; verdict = "good"; note = "Dawn/dusk — peak feeding light";
                      icon = Math.abs(nowM - sr) <= Math.abs(nowM - ss) ? "🌅" : "🌇";
                      value = Math.abs(nowM - sr) <= Math.abs(nowM - ss) ? "Near sunrise" : "Near sunset"; }
  else if (!isDay)  { pts = 8;  verdict = "ok";   note = "After dark — many sea species feed at night"; icon = "🌙"; value = "Night"; }
  else if (midday)  { pts = 5;  verdict = "bad";  note = "Bright midday — fish hold deeper"; icon = "☀️"; value = "Midday"; }
  else              { pts = 7;  verdict = "ok";   note = ""; icon = "🌤️"; value = "Daytime"; }
  return { pts, max: 12, note, icon, label: "Light", value, verdict };
}

function fishingScore(c, hourly, daily, tides, at) {
  const factors = [];
  let raw = 0, max = 0;
  const add = (f) => { raw += f.pts; max += f.max; factors.push(f); };

  // Tide state (heaviest weight — the key driver for sea fishing).
  const tide = scoreTide(at || new Date(), tides);
  if (tide) add(tide);

  // Light / time of day.
  const light = scoreDaylight(c, daily);
  if (light) add(light);

  // Barometric pressure level.
  const p = c.pressure_msl;
  let pPts, pVerdict, pNote;
  if (p < 1000)      { pPts = 20; pVerdict = "good"; pNote = "Low & stormy — fish stirred into action"; }
  else if (p <= 1010){ pPts = 16; pVerdict = "good"; pNote = "Below 1010 mb — feed-up pressure"; }
  else if (p <= 1020){ pPts = 9;  pVerdict = "ok";   pNote = "Moderate"; }
  else               { pPts = 0;  pVerdict = "bad";  pNote = "High pressure — fish often sluggish"; }
  add({ icon: "📊", label: "Pressure", value: Math.round(p) + " mb", note: pNote, verdict: pVerdict, pts: pPts, max: 20 });

  // Pressure trend over the last 3 hours.
  let trend = null;
  if (hourly && hourly.time && hourly.pressure_msl) {
    const stamp = (c.time || "").slice(0, 13);
    let idx = hourly.time.findIndex((t) => t.slice(0, 13) === stamp);
    if (idx === -1) idx = hourly.pressure_msl.length - 1;
    if (idx >= 3) trend = hourly.pressure_msl[idx] - hourly.pressure_msl[idx - 3];
  }
  if (trend != null) {
    let tPts, tVerdict, tNote;
    if (trend <= -1.5)     { tPts = 22; tVerdict = "good"; tNote = "Falling fast — pre-storm feeding frenzy"; }
    else if (trend <= -0.5){ tPts = 17; tVerdict = "good"; tNote = "Dropping — bite improving"; }
    else if (trend < 0.5)  { tPts = 9;  tVerdict = "ok";   tNote = "Steady"; }
    else if (trend < 1.5)  { tPts = 3;  tVerdict = "ok";   tNote = "Rising"; }
    else                   { tPts = 0;  tVerdict = "bad";  tNote = "Rising fast — likely post cold front"; }
    add({
      icon: trend < 0 ? "📉" : "📈", label: "Pressure trend",
      value: (trend > 0 ? "+" : "") + trend.toFixed(1) + " mb/3h",
      note: tNote, verdict: tVerdict, pts: tPts, max: 22,
    });
  }

  // Sky & rain (from WMO weather code).
  const code = c.weather_code;
  let sPts, sVerdict, sNote;
  if ([51, 53, 55, 61, 63, 80, 81].includes(code))      { sPts = 20; sVerdict = "good"; sNote = "Light rain washes in food & hides the surface"; }
  else if ([2, 3, 45, 48].includes(code))               { sPts = 15; sVerdict = "good"; sNote = "Overcast — fish feel safe to feed up high"; }
  else if ([65, 82, 95, 96, 99].includes(code))         { sPts = 6;  sVerdict = "ok";   sNote = "Stormy — best just before, rough during"; }
  else if ([0, 1].includes(code))                       { sPts = 5;  sVerdict = "bad";  sNote = "Bright & clear — fish hold deep"; }
  else                                                  { sPts = 8;  sVerdict = "ok";   sNote = ""; }
  add({ icon: wmo(code)[1], label: "Sky", value: wmo(code)[0], note: sNote, verdict: sVerdict, pts: sPts, max: 20 });

  // Wind direction.
  const dir = c.wind_direction_10m;
  let wPts, wVerdict, wNote;
  if (dir == null)                          { wPts = 7;  wVerdict = "ok";   wNote = ""; }
  else if (dir >= 157.5 && dir <= 292.5)    { wPts = 15; wVerdict = "good"; wNote = "Southerly/westerly — mild airflow"; }
  else if (dir >= 67.5 && dir <= 112.5)     { wPts = 0;  wVerdict = "bad";  wNote = "Cold easterly — fish often lethargic"; }
  else                                      { wPts = 7;  wVerdict = "ok";   wNote = ""; }
  add({
    icon: "🧭", label: "Wind",
    value: Math.round(c.wind_speed_10m) + " mph " + compass(dir),
    note: wNote, verdict: wVerdict, pts: wPts, max: 15,
  });

  const score = max > 0 ? Math.round((raw / max) * 100) : 0;
  return { score: Math.max(0, Math.min(100, score)), factors };
}

function fishingRating(score) {
  if (score >= 78) return ["Excellent", "🔥", "good"];
  if (score >= 62) return ["Good", "👍", "good"];
  if (score >= 46) return ["Fair", "🙂", "ok"];
  if (score >= 30) return ["Slow", "😐", "bad"];
  return ["Poor", "💤", "bad"];
}

// A weather snapshot at hourly index `i`, shaped like the `current` object so
// fishingScore() can reuse it for "later" predictions.
function hourSnapshot(hourly, i) {
  return {
    time: hourly.time[i],
    pressure_msl: hourly.pressure_msl[i],
    weather_code: hourly.weather_code[i],
    wind_speed_10m: hourly.wind_speed_10m[i],
    wind_direction_10m: hourly.wind_direction_10m[i],
  };
}

// "18:00" for later today, or "Sat 06:00" when it rolls to another day.
function laterLabel(iso, baseIso) {
  const time = iso.slice(11, 16);
  if (iso.slice(0, 10) === baseIso.slice(0, 10)) return time;
  const wd = new Date(iso + "Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${wd} ${time}`;
}

function buildLater(c, hourly, daily, tides) {
  if (!hourly || !hourly.time || !hourly.pressure_msl) return [];
  const stamp = (c.time || "").slice(0, 13);
  const now = hourly.time.findIndex((t) => t.slice(0, 13) === stamp);
  if (now === -1) return [];
  const offset = wallClockOffset(c);
  return [3, 6, 9, 12]
    .map((h) => now + h)
    .filter((i) => i < hourly.time.length)
    .map((i) => {
      const snap = hourSnapshot(hourly, i);
      // Convert the snapshot's wall-clock hour into a real instant for the tide lookup.
      const at = new Date(new Date(snap.time + "Z").getTime() - offset);
      const { score } = fishingScore(snap, hourly, daily, tides, at);
      const [label, icon, cls] = fishingRating(score);
      return { time: laterLabel(snap.time, c.time), score, label, icon, cls };
    });
}

function renderFishing() {
  const { current: c, hourly, daily, tides, selectedIso } = fishState;
  if (!c) return; // weather not in yet — keep the loading placeholder

  const todayIso = isoDayKey(new Date());
  const isToday = !selectedIso || selectedIso === todayIso;
  const subEl = $("#fishing-sub");

  if (!isToday) {
    if (subEl) {
      const d = new Date(selectedIso + "T12:00:00Z");
      subEl.textContent = d.toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "short", timeZone: "UTC",
      });
    }
    renderFishingForDay(selectedIso);
    return;
  }

  if (subEl) subEl.textContent = "Bite forecast from pressure, sky & wind";
  updateHeroTide(tides);

  const { score, factors } = fishingScore(c, hourly, daily, tides, new Date());
  const [label, icon, cls] = fishingRating(score);
  const rows = factors.map((f) => `
    <li class="fish-factor ${f.verdict}">
      <span class="ff-icon">${f.icon}</span>
      <span class="ff-main">
        <span class="ff-label">${f.label}</span>
        ${f.note ? `<span class="ff-note">${f.note}</span>` : ""}
      </span>
      <span class="ff-value">${f.value}</span>
    </li>`).join("");

  const later = buildLater(c, hourly, daily, tides);
  const laterHtml = later.length ? `
    <div class="fish-later">
      <div class="fish-later-title">Outlook</div>
      <div class="fish-later-row">
        ${later.map((p) => `
          <div class="later-chip ${p.cls}" title="${p.label} — ${p.score}/100">
            <span class="lc-time">${p.time}</span>
            <span class="lc-icon">${p.icon}</span>
            <span class="lc-score">${p.score}</span>
          </div>`).join("")}
      </div>
    </div>` : "";

  $("#fishing-body").innerHTML = `
    <div class="fish-head ${cls}">
      <div class="fish-gauge" style="--pct:${score}">
        <span class="fish-pct">${score}</span>
      </div>
      <div class="fish-verdict">
        <span class="fish-vlabel">${icon} ${label}</span>
        <span class="fish-vsub">bite forecast — now</span>
      </div>
    </div>
    <ul class="fish-factors">${rows}</ul>
    ${laterHtml}`;
}

function renderFishingForDay(iso) {
  const { hourly, daily, tides } = fishState;
  if (!hourly || !hourly.time) return;

  const offset = wallClockOffset(fishState.current);
  const KEY_HOURS = [6, 9, 12, 15, 18, 21];
  const slots = [];

  for (const h of KEY_HOURS) {
    const stamp = `${iso}T${String(h).padStart(2, "0")}:00`;
    const i = hourly.time.findIndex((t) => t === stamp);
    if (i === -1) continue;
    const snap = hourSnapshot(hourly, i);
    const at = new Date(new Date(snap.time + "Z").getTime() - offset);
    const { score, factors } = fishingScore(snap, hourly, daily, tides, at);
    const [label, icon, cls] = fishingRating(score);
    slots.push({ time: String(h).padStart(2, "0") + ":00", score, factors, label, icon, cls });
  }

  if (slots.length === 0) {
    $("#fishing-body").innerHTML = `<p class="loading">No forecast data for this day.</p>`;
    return;
  }

  const best = slots.reduce((a, b) => (b.score > a.score ? b : a));

  const rows = best.factors.map((f) => `
    <li class="fish-factor ${f.verdict}">
      <span class="ff-icon">${f.icon}</span>
      <span class="ff-main">
        <span class="ff-label">${f.label}</span>
        ${f.note ? `<span class="ff-note">${f.note}</span>` : ""}
      </span>
      <span class="ff-value">${f.value}</span>
    </li>`).join("");

  const chipsHtml = `
    <div class="fish-later">
      <div class="fish-later-title">Throughout the day</div>
      <div class="fish-later-row">
        ${slots.map((p) => `
          <div class="later-chip ${p.cls}${p === best ? " best-chip" : ""}" title="${p.label} — ${p.score}/100">
            <span class="lc-time">${p.time}</span>
            <span class="lc-icon">${p.icon}</span>
            <span class="lc-score">${p.score}</span>
          </div>`).join("")}
      </div>
    </div>`;

  $("#fishing-body").innerHTML = `
    <div class="fish-head ${best.cls}">
      <div class="fish-gauge" style="--pct:${best.score}">
        <span class="fish-pct">${best.score}</span>
      </div>
      <div class="fish-verdict">
        <span class="fish-vlabel">${best.icon} ${best.label}</span>
        <span class="fish-vsub">best window · ${best.time}</span>
      </div>
    </div>
    <ul class="fish-factors">${rows}</ul>
    ${chipsHtml}`;
}

function renderForecast(d) {
  const out = [];
  for (let i = 0; i < d.time.length; i++) {
    const date = new Date(d.time[i] + "T12:00:00");
    const [desc, icon] = wmo(d.weather_code[i]);
    out.push(`
      <div class="day">
        <div class="day-name">${fmtDayName(date, i)}</div>
        <div class="day-icon" title="${desc}">${icon}</div>
        <div class="day-temps">
          <span class="day-hi">${Math.round(d.temperature_2m_max[i])}°</span>
          <span class="day-lo">${Math.round(d.temperature_2m_min[i])}°</span>
        </div>
        <div class="day-wind">💨 ${Math.round(d.wind_speed_10m_max[i])} mph
          ${compass(d.wind_direction_10m_dominant[i])}</div>
      </div>`);
  }
  $("#forecast-body").innerHTML = out.join("");
}

function renderSunMoon(d) {
  // Parse as UTC purely to compute the daylight *duration* (tz-agnostic);
  // the displayed clock times come straight from the local wall-clock string.
  const sunrise = new Date(d.sunrise[0] + "Z");
  const sunset = new Date(d.sunset[0] + "Z");
  const dayMs = sunset - sunrise;
  const h = Math.floor(dayMs / 3600000);
  const m = Math.round((dayMs % 3600000) / 60000);
  const moon = moonPhase(new Date());

  $("#sunmoon-body").innerHTML = `
    <div class="stat-box">
      <div class="icon">🌅</div>
      <div class="big">${fmtLocalIso(d.sunrise[0])}</div>
      <div class="small">Sunrise</div>
    </div>
    <div class="stat-box">
      <div class="icon">🌇</div>
      <div class="big">${fmtLocalIso(d.sunset[0])}</div>
      <div class="small">Sunset</div>
    </div>
    <div class="stat-box">
      <div class="icon">⏳</div>
      <div class="big">${h}h ${m}m</div>
      <div class="small">Daylight</div>
    </div>
    <div class="stat-box">
      <div class="icon">${moon.icon}</div>
      <div class="big" style="font-size:1.05rem">${moon.name}</div>
      <div class="small">${moon.illum}% illuminated</div>
    </div>`;
}

function renderMarine(c, units) {
  const waveDir = compass(c.wave_direction);
  const hUnit = units.wave_height || "m";
  const tUnit = units.wave_period || "s";
  const seaUnit = units.sea_surface_temperature || "°C";
  $("#marine-body").innerHTML = `
    <div class="stat-box">
      <div class="icon">🌊</div>
      <div class="big">${c.wave_height ?? "—"} ${hUnit}</div>
      <div class="small">Wave height (${waveDir})</div>
    </div>
    <div class="stat-box">
      <div class="icon">⏱️</div>
      <div class="big">${c.wave_period ?? "—"} ${tUnit}</div>
      <div class="small">Wave period</div>
    </div>
    <div class="stat-box">
      <div class="icon">🌡️</div>
      <div class="big">${c.sea_surface_temperature ?? "—"}${seaUnit}</div>
      <div class="small">Sea temperature</div>
    </div>
    <div class="stat-box">
      <div class="icon">🧭</div>
      <div class="big">${waveDir}</div>
      <div class="small">Swell direction</div>
    </div>`;
}

/* ============================================================
   TIDES — ADMIRALTY UK Tidal API
   ============================================================ */
async function loadTides(force) {
  const body = $("#tides-body");

  if (!CONFIG.TIDES_PROXY_URL) {
    body.innerHTML = `
      <div class="error-note">
        <strong>Tide proxy not configured.</strong> Deploy the Cloudflare Worker
        (see cloudflare-worker.js) and set <code>TIDES_PROXY_URL</code> in config.js.
      </div>`;
    return;
  }

  try {
    // Tide predictions barely change, so cache for 6h to spare the ADMIRALTY
    // free-tier request quota.
    const cacheKey = "fw:tides:" + CONFIG.ADMIRALTY_STATION_ID;
    let events = cacheGet(cacheKey, 6 * 60 * 60 * 1000, force);
    if (!events) {
      const u = new URL(CONFIG.TIDES_PROXY_URL);
      u.searchParams.set("station", CONFIG.ADMIRALTY_STATION_ID);
      u.searchParams.set("duration", "7");
      const res = await fetch(u.toString());
      if (!res.ok) throw new Error("HTTP " + res.status);
      events = await res.json();
      cacheSet(cacheKey, events);
    }
    renderTides(events);
    fishState.tides = events;
    renderFishing(); // fold tide state into the bite forecast
  } catch (err) {
    body.innerHTML = `<div class="error-note">
      <strong>Couldn't load tides from the proxy.</strong> Check that the Worker is deployed, <code>TIDES_PROXY_URL</code> is correct, and the <code>ADMIRALTY_API_KEY</code> secret is set on the Worker.
      <br><span class="small">(${err.message})</span>
    </div>`;
  }
}

// YYYY-MM-DD in the configured timezone (en-CA gives that exact format).
const isoDayKey = (date) =>
  date.toLocaleDateString("en-CA", { timeZone: CONFIG.TIMEZONE });

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad2 = (n) => String(n).padStart(2, "0");

function renderTides(events) {
  if (!Array.isArray(events) || events.length === 0) {
    $("#tide-calendar").innerHTML = "";
    $("#tides-body").innerHTML = `<p class="loading">No tide data returned.</p>`;
    return;
  }

  // Group events by ISO date for calendar lookup.
  const byIso = new Map();
  for (const ev of events) {
    const date = new Date(ev.DateTime + (ev.DateTime.endsWith("Z") ? "" : "Z"));
    const iso = isoDayKey(date);
    if (!byIso.has(iso)) byIso.set(iso, { label: dayKey(date), events: [] });
    byIso.get(iso).events.push({ ...ev, date });
  }
  for (const d of byIso.values()) d.events.sort((a, b) => a.date - b.date);

  const isoKeys = [...byIso.keys()].sort();
  const firstIso = isoKeys[0];
  const lastIso = isoKeys[isoKeys.length - 1];
  const todayIso = isoDayKey(new Date());
  const monthIdx = (y, m) => y * 12 + m;
  const firstM = monthIdx(+firstIso.slice(0, 4), +firstIso.slice(5, 7) - 1);
  const lastM = monthIdx(+lastIso.slice(0, 4), +lastIso.slice(5, 7) - 1);

  // State: which day is selected, which month is on screen.
  let selectedIso = byIso.has(todayIso) ? todayIso : firstIso;
  let viewYear = +selectedIso.slice(0, 4);
  let viewMonth = +selectedIso.slice(5, 7) - 1; // 0-based

  const calEl = $("#tide-calendar");
  const bodyEl = $("#tides-body");

  // Render the selected day's tide events.
  const showDay = (iso) => {
    const day = byIso.get(iso);
    if (!day) {
      bodyEl.innerHTML = `<p class="loading">No tide data for this day.</p>`;
      return;
    }
    const isToday = iso === todayIso;
    const eventsHtml = day.events.map((ev) => {
      const high = ev.EventType === "HighWater";
      return `
        <div class="tide-event ${high ? "high" : "low"}">
          <span class="tide-arrow">${high ? "▲" : "▼"}</span>
          <div>
            <div class="tide-type">${high ? "High" : "Low"}</div>
            <div class="tide-time">${fmtTime(ev.date)}</div>
            <div class="tide-height">${ev.Height != null ? ev.Height.toFixed(1) + " m" : ""}</div>
          </div>
        </div>`;
    }).join("");
    bodyEl.innerHTML = `
      <div class="tide-day ${isToday ? "today" : ""}">
        <div class="tide-day-label">${day.label}${isToday ? " · Today" : ""}</div>
        <div class="tide-events">${eventsHtml}</div>
      </div>`;
  };

  // Render the month grid for the current view.
  const renderCal = () => {
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const firstDow = (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7; // Mon=0

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(`<span class="cal-day empty"></span>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      const has = byIso.has(iso);
      const cls = ["cal-day", has ? "has-tide" : "no-tide",
        iso === todayIso ? "today" : "", iso === selectedIso ? "selected" : ""]
        .filter(Boolean).join(" ");
      cells.push(has
        ? `<button class="${cls}" data-iso="${iso}">${d}</button>`
        : `<span class="${cls}">${d}</span>`);
    }

    const dowHtml = DOW.map((d) => `<span class="cal-dow">${d}</span>`).join("");
    const prevDisabled = monthIdx(viewYear, viewMonth) <= firstM;
    const nextDisabled = monthIdx(viewYear, viewMonth) >= lastM;

    calEl.innerHTML = `
      <div class="cal-head">
        <button class="cal-nav" data-dir="-1" ${prevDisabled ? "disabled" : ""} aria-label="Previous month">‹</button>
        <span class="cal-title">${MONTH_NAMES[viewMonth]} ${viewYear}</span>
        <button class="cal-nav" data-dir="1" ${nextDisabled ? "disabled" : ""} aria-label="Next month">›</button>
      </div>
      <div class="cal-grid">${dowHtml}${cells.join("")}</div>`;

    calEl.querySelectorAll(".cal-day.has-tide").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedIso = btn.dataset.iso;
        fishState.selectedIso = selectedIso;
        renderCal();
        showDay(selectedIso);
        renderFishing();
      });
    });
    calEl.querySelectorAll(".cal-nav").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        viewMonth += +btn.dataset.dir;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCal();
      });
    });
  };

  renderCal();
  showDay(selectedIso);
}

/* ============================================================
   Orchestration
   ============================================================ */
function setError(id, msg) {
  const el = $(id);
  if (el) el.innerHTML = `<div class="error-note">${msg}</div>`;
}

// `force` (set by the manual Refresh button) bypasses the response cache.
async function loadAll(force) {
  $("#updated").textContent = "Updating…";

  await Promise.allSettled([
    loadWeather(force).catch((e) => {
      setError("#current-card .hero-body", "Weather unavailable: " + e.message);
      setError("#forecast-body", "Forecast unavailable.");
      setError("#fishing-body", "Fishing conditions unavailable.");
    }),
    loadMarine(force).catch((e) => setError("#marine-body", "Marine data unavailable: " + e.message)),
    loadTides(force),
  ]);

  const now = new Date();
  $("#updated").textContent = "Updated " + fmtTime(now);
}

$("#refresh").addEventListener("click", () => loadAll(true));
loadAll();
// Auto-refresh every 15 minutes, but skip while the tab is hidden — no point
// fetching for a page nobody's looking at. Cached responses mean a wake-up
// only hits the network if the data has actually gone stale.
setInterval(() => { if (!document.hidden) loadAll(); }, 15 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadAll();
});
