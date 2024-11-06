import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const gameName = "Raul's D3";

document.title = gameName;

const header = document.createElement("h1");
header.innerHTML = gameName;

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.5;

const hotspots: Array<{ position: leaflet.LatLng; items: string[] }> = [];

document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  const map = leaflet.map(mapElement, {
    center: OAKES_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    dragging: true,
    scrollWheelZoom: false,
  });

  leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  for (let y = -NEIGHBORHOOD_SIZE; y <= NEIGHBORHOOD_SIZE; y++) {
    for (let x = -NEIGHBORHOOD_SIZE; x <= NEIGHBORHOOD_SIZE; x++) {
      const position = leaflet.latLng(
        OAKES_CLASSROOM.lat + y * TILE_DEGREES,
        OAKES_CLASSROOM.lng + x * TILE_DEGREES,
      );
      const chance = luck(`hotspot-${position.lat}-${position.lng}`);

      console.log(
        `Chance for hotspot at (${position.lat}, ${position.lng}): ${chance}`,
      );

      if (chance < CACHE_SPAWN_PROBABILITY) {
        const newHotspot = {
          position: position,
          items: ["Gold Coin", "Silver Key"],
        };

        hotspots.push(newHotspot);

        const marker = leaflet.marker(newHotspot.position).addTo(map);
        marker.bindPopup(
          `<b>Hotspot</b><br>Items: ${newHotspot.items.join(", ")}`,
        );
      }
    }
  }

  map.on("click", (e: leaflet.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    const randomValue = luck(`Click at ${lat},${lng}`);

    console.log(
      `Clicked at (${lat}, ${lng}) with random value: ${randomValue}`,
    );

    if (randomValue < 0.1) {
      const newMarker = leaflet.marker([lat, lng]).addTo(map);
      newMarker.bindPopup(`Newly added hotspot! Random value: ${randomValue}`)
        .openPopup();
    }
  });
});

/*const moveKeyContainer = document.createElement("div");
app.appendChild(moveKeyContainer);
const leftMoveButton = document.createElement("button");
leftMoveButton.innerHTML = "⬅️";
moveKeyContainer.appendChild(leftMoveButton);
const rightMoveButton = document.createElement("button");
rightMoveButton.innerHTML = "➡️";
moveKeyContainer.appendChild(rightMoveButton);
const upMoveButton = document.createElement("button");
upMoveButton.innerHTML = "⬆️";
moveKeyContainer.appendChild(upMoveButton);
const downMoveButton = document.createElement("button");
downMoveButton.innerHTML = "⬇️";
moveKeyContainer.appendChild(downMoveButton);

leftMoveButton.addEventListener("click", () => {
  alert("left");
}); */
