import WebSocket from "ws";

let ships = [];
let socket = null;
let lastConnect = 0;

const API_KEY = process.env.AISSTREAM_API_KEY;

function connectAISStream() {
  const now = Date.now();
  if (socket && socket.readyState === WebSocket.OPEN) return;
  if (now - lastConnect < 5000) return; // prevent reconnect spam
  lastConnect = now;

  console.log("Connecting to AISStream");
  socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

  socket.on("open", () => {
    console.log("AISStream connected");
    const sub = {
      APIkey: API_KEY,
      BoundingBoxes: [
        [
          [48.6841, -124.5104],
          [49.604, -122.5637],
        ],
      ],
    };
    socket.send(JSON.stringify(sub));
  });

  socket.on("message", (event) => {
    try {
      const aisMessage = JSON.parse(event.toString());
      if (aisMessage.MessageType === "PositionReport") {
        const p = aisMessage.Message.PositionReport;

        const shipData = {
          id: p.UserID,
          lat: p.Latitude,
          lon: p.Longitude,
          heading: p.TrueHeading,
          name: p.VesselName || "Unknown",
          timestamp: Date.now(),
        };

        const existing = ships.find((s) => s.id === p.UserID);
        if (existing) Object.assign(existing, shipData);
        else ships.push(shipData);
      }
    } catch (err) {
      console.error("AIS parse error:", err);
    }
  });

  socket.on("close", () => {
    console.log("AISStream closed. Reconnecting...");
    socket = null;
    setTimeout(connectAISStream, 5000);
  });

  socket.on("error", (err) => {
    console.error("AISStream error:", err);
    socket?.close();
  });
}

// periodically prune stale ships
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
  const before = ships.length;
  ships = ships.filter((s) => s.timestamp > cutoff);
  const after = ships.length;
  if (before !== after) console.log(`Pruned ${before - after} old ships`);
}, 60 * 1000);

connectAISStream();

export default async function handler(req, res) {
  connectAISStream(); // ensure it’s running
  res.status(200).json(ships);
}