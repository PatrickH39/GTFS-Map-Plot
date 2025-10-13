// /api/ships.js
import WebSocket from 'ws';

let cachedShips = [];
let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    connectToAIS();
  }

  res.status(200).json(cachedShips);
}

function connectToAIS() {
  const token = process.env.AISSTREAM_TOKEN; // put your token in Vercel env vars
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream', {
    headers: { Authorization: `Bearer ${token}` },
  });

  ws.on('open', () => {
    console.log('Connected to AISStream');
    ws.send(
      JSON.stringify({
        BoundingBoxes: [
          [
            [48.73, -124.86], // Northwest corner
            [49.58, -121.55], // Southeast corner
          ],
        ],
        FilterMessageTypes: ['PositionReport'],
      })
    );
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (message.MessageType === 'PositionReport') {
      const ship = message.Message;
      cachedShips.push({
        mmsi: ship.UserID,
        lat: ship.Latitude,
        lon: ship.Longitude,
        sog: ship.Sog,
        cog: ship.Cog,
      });

      // keep cache small
      if (cachedShips.length > 500) cachedShips = cachedShips.slice(-500);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected, reconnecting...');
    isConnected = false;
    setTimeout(connectToAIS, 5000);
  });

  isConnected = true;
}
