/**
 * Cloudflare Worker — ADMIRALTY tide proxy
 * =========================================
 * Fetches tide predictions from the ADMIRALTY UK Tidal API server-side, so
 * your API key stays secret (never shipped to the browser), and adds the CORS
 * headers the static site needs.
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
    const station = (url.searchParams.get("station") || "0014").replace(/[^0-9]/g, "") || "0014";
    const duration = Math.min(7, Math.max(1, parseInt(url.searchParams.get("duration") || "7", 10) || 7));

    const api =
      `https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations/` +
      `${station}/TidalEvents?duration=${duration}`;

    let upstream;
    try {
      upstream = await fetch(api, {
        headers: { "Ocp-Apim-Subscription-Key": env.ADMIRALTY_API_KEY },
        cf: { cacheTtl: 21600, cacheEverything: true },
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
