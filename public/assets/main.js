// Create map centered on Greater Vancouver coordinates
const map = L.map('map', {
   zoomControl: false,
   attributionControl: false,
   scrollWheelZoom: false,
   doubleClickZoom: false,
   touchZoom: false,
   dragging: false,
   keyboard: false,
   tap: false,
   boxZoom: false
}).setView([49.2200, -123.1496], 11.5);

const busLayer = L.layerGroup().addTo(map);
const planeLayer = L.layerGroup().addTo(map);

// Load Vancouver boundary and constrain map
fetch('vancouver.geojson')
   .then(res => res.json())
   .then(data => {
      const vancouverBoundary = L.geoJSON(data, {
         style: {
            color: '#0078ff',
            weight: 0.3,
            fill: true,
            fillOpacity: 0.05
         },
         interactive: false
      }).addTo(map);

   });

// Bus markers
let markers = [];

async function loadBuses() {
  try {
    const res = await fetch('/api/buses');
    const data = await res.json();
    const buses = Array.isArray(data) ? data : data.buses || [];

    // Remove old markers
    markers.forEach(m => map.removeLayer(m));
    busLayer.clearLayers();
    markers = [];

    // Add new bus markers
    buses.forEach(bus => {
      if (!bus.lat || !bus.lon) return; // skip invalid

      const busMarker = L.circleMarker([bus.lat, bus.lon], {
        radius: 6,
        color: null,
        fillColor: '#0078ff',
        fillOpacity: 0.15,
        interactive: false
      }).addTo(busLayer);

      markers.push(busMarker);
    });

  } catch (err) {
    console.error('Failed to load buses', err);
  }
}

// Plane markers
let planeMarkers = [];

async function loadPlanes() {
  try {
    const res = await fetch('/api/planes');
    const data = await res.json();
    const planes = Array.isArray(data) ? data : data.planes || [];

    // Remove old markers
    planeMarkers.forEach(m => map.removeLayer(m));
    planeLayer.clearLayers();
    planeMarkers = [];

    // Add new plane markers
    planes.forEach(plane => {
      if (!plane.lat || !plane.lon) return; // skip invalid
      const planeMarker = L.circleMarker([plane.lat, plane.lon], {
        radius: 10,
        color: null,
        fillColor: '#ee82ee',
        fillOpacity: 0.2,
        interactive: false
      }).addTo(planeLayer);
      planeMarkers.push(planeMarker);
    });

  } catch (err) {
    console.error('Failed to load planes', err);
  }
}

const overlays = {
   "Land": busLayer,
   "Air": planeLayer
};

L.control.layers(null, overlays).addTo(map);

// Initial load + refresh every 10s
loadBuses();
loadPlanes();
setInterval(loadBuses, 10000);
setInterval(loadPlanes, 10000);