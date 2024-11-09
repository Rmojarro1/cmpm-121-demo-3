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

// Player inventory, initially empty
const playerInventory: string[] = [];

const hotspots: Array<{ position: leaflet.LatLng; items: string[] }> = [];

function updatePopupContent(hotspotIndex: number): string {
  const hotspot = hotspots[hotspotIndex];
  let content = "<b>Hotspot</b><br>Items: <ul>";

  hotspot.items.forEach((item: string, index: number) => {
    content +=
      `<li>${item} <button id="collect-${hotspotIndex}-${index}">Collect</button></li>`;
  });

  content += "</ul>";

  if (playerInventory.length > 0) {
    content += '<br>Select item to deposit: <select id="depositSelect">';
    playerInventory.forEach((item, index) => {
      content += `<option value="${index}">${item}</option>`;
    });
    content += "</select> ";
    content += `<button id="deposit-${hotspotIndex}">Deposit Item</button>`;
  } else {
    content += "<br>Your inventory is empty!";
  }

  return content;
}

function depositItem(hotspotIndex: number): void {
  const selectElement = document.getElementById(
    "depositSelect",
  ) as HTMLSelectElement;
  if (selectElement) {
    const selectedIndex = selectElement.selectedIndex;
    const selectedItem = playerInventory[selectedIndex];

    playerInventory.splice(selectedIndex, 1);
    hotspots[hotspotIndex].items.push(selectedItem);

    console.log(`Deposited ${selectedItem} into hotspot.`);
    console.log(`Updated Player Inventory: ${playerInventory.join(", ")}`);
  }
}

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
      const randomOffsetLat = (Math.random() - 0.5) * TILE_DEGREES;
      const randomOffsetLng = (Math.random() - 0.5) * TILE_DEGREES;

      const position = leaflet.latLng(
        OAKES_CLASSROOM.lat + y * TILE_DEGREES + randomOffsetLat,
        OAKES_CLASSROOM.lng + x * TILE_DEGREES + randomOffsetLng,
      );

      const chance = luck(`hotspot-${position.lat}-${position.lng}`);

      if (chance < CACHE_SPAWN_PROBABILITY) {
        const newHotspot = {
          position: position,
          items: ["Gold Coin", "Silver Key"],
        };

        hotspots.push(newHotspot);

        const marker = leaflet.marker(newHotspot.position).addTo(map);
        const hotspotIndex = hotspots.length - 1;

        marker.on("popupopen", function () {
          marker.getPopup()?.setContent(updatePopupContent(hotspotIndex));

          const hotspot = hotspots[hotspotIndex];

          hotspot.items.forEach((_item, index: number) => {
            const collectButton = document.getElementById(
              `collect-${hotspotIndex}-${index}`,
            );
            if (collectButton) {
              collectButton.addEventListener("click", function () {
                const itemToCollect = hotspot.items[index];
                playerInventory.push(itemToCollect);
                hotspot.items.splice(index, 1);
                marker.getPopup()?.setContent(updatePopupContent(hotspotIndex));
                console.log(`Collected: ${itemToCollect}`);
                console.log(`Player Inventory: ${playerInventory.join(", ")}`);
              });
            }
          });

          const depositButton = document.getElementById(
            `deposit-${hotspotIndex}`,
          );
          if (depositButton) {
            depositButton.addEventListener("click", function () {
              depositItem(hotspotIndex);
              marker.getPopup()?.setContent(updatePopupContent(hotspotIndex));
            });
          }
        });

        marker.bindPopup(updatePopupContent(hotspotIndex));
      }
    }
  }
});
