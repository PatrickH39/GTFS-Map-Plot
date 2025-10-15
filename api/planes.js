import fetch from "node-fetch";

const API_URL = "https://opendata.adsb.fi/api/v2/lat/49.2200/lon/-123.1496/dist/30";

let cachedData = null;
let lastFetch = 0;
const CACHE_DURATION = 15 * 1000; // 15 seconds

export default async function handler(req, res) {
  const now = Date.now();

  // Serve from cache if still valid
  if (cachedData && now - lastFetch < CACHE_DURATION) {
    return res.status(200).json({
      timestamp: lastFetch,
      planes: cachedData
    });
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("ADS-B API error");

    const data = await response.json();
    const planes = (data.aircraft || [])
      .filter(p => p.lat && p.lon)
      .map(p => ({
        id: p.hex,
        flight: p.flight?.trim(),
        lat: p.lat,
        lon: p.lon,
        alt: p.alt_baro,
        desc: p.desc
      }));

    // Update cache only if we got new valid data
    if (planes.length > 0) {
      cachedData = planes;
      lastFetch = now;
      return res.status(200).json({
        timestamp: lastFetch,
        planes
      });
    }

    // If empty response, fall back to cache
    if (cachedData) {
      console.warn("API returned empty data; serving cached planes.");
      return res.status(200).json({
        timestamp: lastFetch,
        planes: cachedData
      });
    }

    // No cached data available
    return res.status(502).json({ error: "No plane data available." });
  } catch (err) {
    console.error("Plane fetch failed:", err.message);

    // Use cached data if available
    if (cachedData) {
      console.warn("Serving cached planes due to fetch failure.");
      return res.status(200).json({
        timestamp: lastFetch,
        planes: cachedData
      });
    }

    // Otherwise return error
    return res.status(500).json({ error: "Failed to fetch planes and no cache available." });
  }
}
