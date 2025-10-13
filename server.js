import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TRANSLINK_API_KEY;
const CACHE_DURATION = 10 * 1000; // 10s cache

app.use(cors());
app.use(express.static("public"));

let cachedData = null;
let lastFetchTime = 0;

app.get("/api/buses", async (req, res) => {
  const now = Date.now();

  if (cachedData && now - lastFetchTime < CACHE_DURATION) {
    return res.json(cachedData);
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

    // Extract bus positions
    const buses = feed.entity
      .filter(e => e.vehicle && e.vehicle.position)
      .map(e => ({
        id: e.id,
        route: e.vehicle.trip?.routeId,
        lat: e.vehicle.position.latitude,
        lon: e.vehicle.position.longitude,
        bearing: e.vehicle.position.bearing,
        speed: e.vehicle.position.speed
      }));

    cachedData = buses;
    lastFetchTime = now;

    res.json(buses);
  } catch (err) {
    console.error("GTFS fetch failed:", err);
    res.status(500).json({ error: "Failed to load GTFS position data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
