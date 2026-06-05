/**
 * Cloudflare Worker — ADMIRALTY tide proxy
 * =========================================
 * Fetches tide predictions from the ADMIRALTY UK Tidal API server-side, so
 * your API key stays secret (never shipped to the browser), and adds the CORS
 * headers the static site needs. This replaces the public corsproxy.io hop.
 *
 * DEPLOY (free tier, ~5 minutes)
 * ------------------------------
 * Easiest — dashboard:
 *   1. https://dash.cloudflare.com  →  Workers & Pages  →  Create  →  Worker.
 *   2. Give it a name (e.g. "fishing-tides"), Deploy, then "Edit code".
 *   3. Replace the sample with THIS file's contents and Deploy.
 *   4. Settings → Variables and Secrets → add a secret:
 *        name:  ADMIRALTY_API_KEY    value: <your ADMIRALTY Primary key>
 *      (tick "Encrypt" / type Secret). Optionally add a plain variable
 *        ALLOW_ORIGIN = https://<your-username>.github.io
 *      to lock the proxy to your site (defaults to "*").
 *   5. Copy the Worker URL (https://fishing-tides.<subdomain>.workers.dev)
 *      and paste it into config.js as TIDES_PROXY_URL.
 *
 * Or with the CLI:
 *   npm i -g wrangler
 *   wrangler deploy cloudflare-worker.js --name fishing-tides
 *   wrangler secret put ADMIRALTY_API_KEY
 */
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };
    const json = (obj, status) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    if (!env.ADMIRALTY_API_KEY) return json({ error: "ADMIRALTY_API_KEY secret not set on the Worker" }, 500);

    const url = new URL(request.url);
    // Sanitise inputs: station is digits only, duration clamped to 1–7 days.
    const station = (url.searchParams.get("station") || "0014").replace(/[^0-9]/g, "") || "0014";
    const duration = Math.min(7, Math.max(1, parseInt(url.searchParams.get("duration") || "7", 10) || 7));

    const api =
      `https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations/` +
      `${station}/TidalEvents?duration=${duration}`;

    let upstream;
    try {
      upstream = await fetch(api, {
        headers: { "Ocp-Apim-Subscription-Key": env.ADMIRALTY_API_KEY },
        cf: { cacheTtl: 21600, cacheEverything: true }, // 6h edge cache — spares the ADMIRALTY quota
      });
    } catch (e) {
      return json({ error: "Upstream fetch failed", detail: String(e) }, 502);
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600",
      },
    });
  },
};
