import fetch from "node-fetch";

const API_URL =
  "https://opendata.adsb.fi/api/v2/lat/49.2200/lon/-123.1496/dist/30";

let cachedData = null;
let lastFetch = 0;
const CACHE_DURATION = 15 * 1000; // 15 s cache

export default async function handler(req, res) {
  const now = Date.now();

  if (cachedData && now - lastFetch < CACHE_DURATION) {
    res.status(200).json(cachedData);
    return;
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

    cachedData = planes;
    lastFetch = now;
    res.status(200).json(planes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch planes" });
  }
}
