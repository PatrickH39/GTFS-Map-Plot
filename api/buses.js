import fetch from "node-fetch";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const API_KEY = process.env.TRANSLINK_API_KEY;
const CACHE_DURATION = 10 * 1000;

let cachedData = null;
let lastFetchTime = 0;

export default async function handler(req, res) {
  const now = Date.now();

  if (cachedData && now - lastFetchTime < CACHE_DURATION) {
    res.status(200).json(cachedData);
    return;
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
        lon: e.vehicle.position.longitude,
      }));

    cachedData = buses;
    lastFetchTime = now;

    res.status(200).json(buses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load GTFS position data" });
  }
}
