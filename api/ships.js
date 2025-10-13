import WebSocket from "ws";

const API_KEY = process.env.AISSTREAM_API_KEY;

let cachedShips = [];
let lastUpdate = 0;
let isConnecting = false;

async function connectAISStream() {
  if (isConnecting) return; // Prevent multiple connects
  isConnecting = true;

  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  ws.on("open", () => {
    console.log("AISStream connected");
    const sub = {
      APIKey: API_KEY,
      BoundingBoxes: [
        [
          [48.876613, -123.781860],
          [49.509186, -122.522278],
        ],
      ],
      FiltersShipMessageTypes: ["PositionReport"],
    };
    ws.send(JSON.stringify(sub));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg?.MessageType === "PositionReport") {
        const r = msg.Message.PositionReport;
        const ship = {
          id: r.UserID,
          lat: r.Latitude,
          lon: r.Longitude,
          sog: r.Sog,
          cog: r.Cog,
          timestamp: Date.now(),
        };

        // Upsert into cache
        const idx = cachedShips.findIndex((s) => s.id === ship.id);
        if (idx >= 0) cachedShips[idx] = ship;
        else cachedShips.push(ship);
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  });

  ws.on("close", () => {
    console.log("AISStream closed");
    isConnecting = false;
  });

  ws.on("error", (err) => {
    console.error("AISStream error:", err);
    ws.close();
  });

  // Auto close after 90s (snapshot)
  setTimeout(() => {
    console.log("Closing AIS snapshot connection");
    ws.close();
    isConnecting = false;
    lastUpdate = Date.now();
  }, 90000);
}

export default async function handler(req, res) {
  // Refresh every 3 minutes
  const now = Date.now();
  const cacheAge = (now - lastUpdate) / 1000;

  if (cacheAge > 180 && !isConnecting) {
    console.log("Refreshing AIS data…");
    connectAISStream();
  }

  // Return cached snapshot
  res.status(200).json({
    updated: new Date(lastUpdate).toISOString(),
    ships: cachedShips,
  });
}
