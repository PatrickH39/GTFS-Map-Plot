import fetch from "node-fetch";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const API_KEY = process.env.TRANSLINK_API_KEY;

const CACHE_DURATION = 15 * 1000; // 15 seconds

let cachedData = null;
let lastFetchTime = 0;

export default async function handler(req, res) {
  const now = Date.now();

  // Serve cached data if still valid
  if (cachedData && now - lastFetchTime < CACHE_DURATION) {
    return res.status(200).json({
      timestamp: lastFetchTime,
      buses: cachedData
    });
  }

  try {
    const response = await fetch(
      `https://gtfsapi.translink.ca/v3/gtfsposition?apikey=${API_KEY}`
    );

    if (!response.ok) throw new Error(`TransLink API error: ${response.status}`);

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    const buses = feed.entity
      .filter(e => e.vehicle && e.vehicle.position)
      .map(e => ({
        id: e.id,
        route: e.vehicle.trip?.routeId,
        lat: e.vehicle.position.latitude,
        lon: e.vehicle.position.longitude
      }));

    // Update cache only if we got valid bus data
    if (buses.length > 0) {
      cachedData = buses;
      lastFetchTime = now;
      return res.status(200).json({
        timestamp: lastFetchTime,
        buses
      });
    }

    // Empty data: fall back to last known cache
    if (cachedData) {
      console.warn("GTFS returned empty; serving cached buses.");
      return res.status(200).json({
        timestamp: lastFetchTime,
        buses: cachedData
      });
    }

    // No cache available at all
    return res.status(502).json({ error: "No bus data available." });
  } catch (err) {
    console.error("GTFS fetch failed:", err.message);

    // Fallback: serve cached data if possible
    if (cachedData) {
      console.warn("Serving cached buses due to fetch failure.");
      return res.status(200).json({
        timestamp: lastFetchTime,
        buses: cachedData
      });
    }

    // No cache to use
    return res.status(500).json({ error: "Failed to fetch GTFS data and no cache available." });
  }
}