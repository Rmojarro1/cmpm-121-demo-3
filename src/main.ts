import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Define Interfaces
interface Cell {
  i: number;
  j: number;
}

interface Coin {
  id: string; // Based on Cell coordinates and a serial number
  cell: Cell;
  serial: number;
}

interface Cache {
  coins: Coin[];
}

// Game Configuration
const gameName = "Raul's D3";
document.title = gameName;

// Constants for grid calculation
const TILE_DEGREES = 0.0001; // Width of grid cells in degrees
const NEIGHBORHOOD_SIZE = 8; // Cells to encompass around player
const CACHE_SPAWN_PROBABILITY = 0.1; // 10% of grid cells

// Null Island coordinates
const _NULL_ISLAND = { lat: 0, lng: 0 };

// Player's Initial Location at Oakes College
const PLAYER_START = leaflet.latLng(36.9895, -122.063);

// Player Inventory
const playerInventory: Coin[] = [];

// Caches on the map
const caches: Cache[] = [];

// Flyweight Pattern for managing Cells
const locationFlyweight: { [key: string]: Cell } = {};

function getCell(i: number, j: number): Cell {
  const key = `${i}_${j}`;
  if (!locationFlyweight[key]) {
    locationFlyweight[key] = { i, j };
  }
  return locationFlyweight[key];
}

// Calculate global grid indices
function latLngToCell(lat: number, lng: number): Cell {
  const i = Math.round(lat / TILE_DEGREES);
  const j = Math.round(lng / TILE_DEGREES);
  return getCell(i, j);
}

// Generate a unique id for the coin
function generateCoinId(cell: Cell, serial: number): string {
  return `${cell.i}-${cell.j}-${serial}`;
}

// Create a coin with a serial number starting at 1
function createCoin(cell: Cell, serial: number): Coin {
  return {
    id: generateCoinId(cell, serial),
    cell,
    serial,
  };
}

// Cache functions
function createCache(cell: Cell): Cache {
  return {
    coins: [
      createCoin(cell, 1),
      createCoin(cell, 2),
    ],
  };
}

// Represent coin's identity as a user-readable string
function formatCoinIdentity(coin: Coin): string {
  return `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;
}

function updatePopupContent(cache: Cache, cell: Cell): string {
  let content = `<b>cache [${cell.i}, ${cell.j}]</b><br>Items: <ul>`;

  cache.coins.forEach((coin) => {
    content += `<li>${
      formatCoinIdentity(coin)
    } <button id="collect-${coin.id}">Collect</button></li>`;
  });

  content += "</ul>";

  if (playerInventory.length > 0) {
    content += '<br>Select item to deposit: <select id="depositSelect">';
    playerInventory.forEach((item, index) => {
      content += `<option value="${index}">${
        formatCoinIdentity(item)
      }</option>`;
    });
    content += "</select> ";
    content += `<button id="deposit">Deposit Item</button>`;
  } else {
    content += "<br>Your inventory is empty!";
  }

  return content;
}

// Collect a coin from a cache
function collect(coinId: string, cacheIndex: number) {
  const cache = caches[cacheIndex];
  const coinIndex = cache.coins.findIndex((coin) => coin.id === coinId);

  if (coinIndex > -1) {
    const [coin] = cache.coins.splice(coinIndex, 1);
    playerInventory.push(coin);
    console.log(`Collected: ${formatCoinIdentity(coin)}`);

    // Dispatch events
    globalThis.dispatchEvent(new CustomEvent("player-inventory-changed"));
    globalThis.dispatchEvent(
      new CustomEvent("cache-updated", { detail: { cacheIndex } }),
    );
  }
}

// Deposit a coin into a cache
function deposit(coinIndex: number, cacheIndex: number) {
  const cache = caches[cacheIndex];
  const [coin] = playerInventory.splice(coinIndex, 1);

  cache.coins.push(coin);
  console.log(`Deposited: ${formatCoinIdentity(coin)}`);

  // Dispatch events
  globalThis.dispatchEvent(new CustomEvent("player-inventory-changed"));
  globalThis.dispatchEvent(
    new CustomEvent("cache-updated", { detail: { cacheIndex } }),
  );
}

// Setup map and events
document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  const map = leaflet.map(mapElement, {
    center: PLAYER_START,
    zoom: 19,
    minZoom: 19,
    maxZoom: 19,
    zoomControl: false,
    dragging: true,
    scrollWheelZoom: false,
  });

  leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  const playerCell = latLngToCell(PLAYER_START.lat, PLAYER_START.lng);

  for (let y = -NEIGHBORHOOD_SIZE; y <= NEIGHBORHOOD_SIZE; y++) {
    for (let x = -NEIGHBORHOOD_SIZE; x <= NEIGHBORHOOD_SIZE; x++) {
      const currentCell = getCell(playerCell.i + x, playerCell.j + y);
      const lat = currentCell.i * TILE_DEGREES;
      const lng = currentCell.j * TILE_DEGREES;

      // Use the luck function for deterministic placement
      const chance = luck(`cache-${currentCell.i}-${currentCell.j}`);

      if (chance < CACHE_SPAWN_PROBABILITY) {
        const newCache = createCache(currentCell);
        caches.push(newCache);

        const marker = leaflet.marker(leaflet.latLng(lat, lng)).addTo(map);
        const cacheIndex = caches.length - 1;

        marker.bindPopup(updatePopupContent(newCache, currentCell));

        marker.on("popupopen", function () {
          marker.getPopup()?.setContent(
            updatePopupContent(newCache, currentCell),
          );

          newCache.coins.forEach((coin) => {
            const collectButton = document.getElementById(`collect-${coin.id}`);
            if (collectButton) {
              collectButton.addEventListener("click", function () {
                collect(coin.id, cacheIndex);
                marker.getPopup()?.setContent(
                  updatePopupContent(newCache, currentCell),
                );
              });
            }
          });

          const depositButton = document.getElementById("deposit");
          if (depositButton) {
            depositButton.addEventListener("click", function () {
              const selectElement = document.getElementById(
                "depositSelect",
              ) as HTMLSelectElement;
              if (selectElement) {
                deposit(selectElement.selectedIndex, cacheIndex);
                marker.getPopup()?.setContent(
                  updatePopupContent(newCache, currentCell),
                );
              }
            });
          }
        });
      }
    }
  }

  // Event Listeners
  globalThis.addEventListener("cache-updated", (event) => {
    const customEvent = event as CustomEvent;
    const { cacheIndex } = customEvent.detail;
    console.log(`Cache at index ${cacheIndex} was updated.`);
  });

  globalThis.addEventListener("player-inventory-changed", () => {
    console.log(
      "Player inventory changed:",
      playerInventory.map(formatCoinIdentity).join(", "),
    );
  });

  globalThis.addEventListener("player-moved", () => {
    console.log("Player moved.");
  });
});
