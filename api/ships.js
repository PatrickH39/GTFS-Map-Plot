import WebSocket from "ws";

let ships = [];
let socket = null;

const API_KEY = process.env.AISSTREAM_API_KEY;

// Function to start WebSocket connection (runs once per server)
function initAISStream() {
  if (socket) return; // Prevent multiple connections

  socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

  socket.on("open", () => {
    console.log("AISStream connected");
    const subscriptionMessage = {
      APIKey: API_KEY,
      BoundingBoxes: [
    [
        [48.6841, -124.5104], // top left of Vancouver
        [49.604, -122.5637], // bottom right near the US
      ],
    ],
    };
    console.log(JSON.stringify(subscriptionMessage));
    socket.send(JSON.stringify(subscriptionMessage));
  });

  socket.on("message", (event) => {
    try {
      const aisMessage = JSON.parse(event.toString());
      if (aisMessage.MessageType === "PositionReport") {
        const p = aisMessage.Message.PositionReport;

        // Add or update ship info
        const existing = ships.find((s) => s.id === p.UserID);
        const shipData = {
          id: p.UserID,
          lat: p.Latitude,
          lon: p.Longitude,
          heading: p.TrueHeading,
          name: p.VesselName || "Unknown",
          timestamp: Date.now(),
        };

        if (existing) {
          Object.assign(existing, shipData);
        } else {
          ships.push(shipData);
        }
      }
    } catch (err) {
      console.error("AIS parse error:", err);
    }
  });

  socket.on("error", (err) => console.error("AISStream error:", err));
  socket.on("close", () => {
    console.log("AISStream closed. Reconnecting...");
    socket = null;
    setTimeout(initAISStream, 5000);
  });
}

// Start stream when the server initializes
initAISStream();

export default async function handler(req, res) {
  // Return current snapshot of ships
  res.status(200).json(ships);
}
