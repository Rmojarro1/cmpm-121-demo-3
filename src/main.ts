import leaflet, { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Cell } from "./Cell.ts";
import { Coin } from "./Coin.ts";
import { MyCache } from "./MyCache.ts";
import { CacheBounds } from "./CacheBounds.ts";
import { CacheManager } from "./CacheManager.ts";
import { CacheMemento } from "./CacheMemento.ts";

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

const cacheManager = new CacheManager();
const cacheMarkers: Map<string, leaflet.Marker> = new Map();
const cacheMementos: Map<string, string> = new Map();
const playerCoins: Coin[] = [];
const app = document.querySelector<HTMLDivElement>("#app")!;

const mapElement = document.getElementById("map");
if (!mapElement) {
  throw new Error("Map element (#map) not found in the document.");
}

const map = leaflet.map(mapElement, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const redIcon = leaflet.divIcon({
  className: "custom-div-icon",
  html:
    "<div style='background-color:red;width:10px;height:10px;border-radius:50%;'></div>",
  iconSize: [10, 10],
});

const playerMarker = leaflet.marker(OAKES_CLASSROOM, { icon: redIcon }).addTo(
  map,
);
playerMarker.bindTooltip("You");

const polyline = leaflet.polyline([OAKES_CLASSROOM], { color: "blue" }).addTo(
  map,
);

const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
statusPanel.innerHTML = "<h3>Collected Coins</h3><ul><li>None</li></ul>";
app.appendChild(statusPanel);

class CellFactory {
  private static cellCache: Map<string, Cell> = new Map();

  static getCellFromLatLng(lat: number, lng: number): Cell {
    const i = Math.floor(lat / TILE_DEGREES);
    const j = Math.floor(lng / TILE_DEGREES);
    return this.getCell(i, j);
  }

  static getCell(i: number, j: number): Cell {
    const key = `${i},${j}`;
    if (!this.cellCache.has(key)) {
      this.cellCache.set(key, { i, j });
    }
    return this.cellCache.get(key)!;
  }
}

function updateCoinStatus() {
  const coinDetails = playerCoins.map((coin) => `<li>${coin.toString()}</li>`)
    .join("");
  statusPanel.innerHTML = `<h3>Collected Coins</h3><ul>${
    coinDetails || "<li>None</li>"
  }</ul>`;
}

function saveGameData() {
  const gameData = {
    playerPosition: playerMarker.getLatLng(),
    playerCoins: playerCoins.map((coin) => ({
      serial: coin.serial,
      cell: coin.cell,
    })),
    cacheStates: cacheManager.getAllCaches().map((cache) => ({
      position: cache.position,
      coins: cache.coins.map((coin) => ({
        serial: coin.serial,
        cell: coin.cell,
      })),
    })),
  };

  localStorage.setItem("gameState", JSON.stringify(gameData));
}

function movePlayer(direction: [number, number]) {
  const current = playerMarker.getLatLng();
  const newPos = leaflet.latLng(
    current.lat + TILE_DEGREES * direction[0],
    current.lng + TILE_DEGREES * direction[1],
  );
  playerMarker.setLatLng(newPos);
  polyline.addLatLng(newPos);
  map.setView(newPos, GAMEPLAY_ZOOM_LEVEL);
  spawnNearbyCaches(newPos);
  saveGameData();
}

function spawnNearbyCaches(center: LatLng) {
  const centerCell = CellFactory.getCellFromLatLng(center.lat, center.lng);

  clearCaches();

  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const gridI = centerCell.i + i;
      const gridJ = centerCell.j + j;

      if (luck([gridI, gridJ].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(gridI, gridJ);
      }
    }
  }
}

function spawnCache(i: number, j: number): MyCache {
  const cell = CellFactory.getCell(i, j);
  const bounds = new CacheBounds(
    leaflet.latLng(i * TILE_DEGREES, j * TILE_DEGREES),
    leaflet.latLng((i + 1) * TILE_DEGREES, (j + 1) * TILE_DEGREES),
  );

  let cache: MyCache;
  const positionKey = `${i},${j}`;

  if (cacheMementos.has(positionKey)) {
    cache = CacheMemento.fromMemento(cacheMementos.get(positionKey)!, bounds);
  } else {
    cache = new MyCache(cell, bounds);
    const initialCoins = 1 +
      Math.floor(luck([i, j, "initialValue"].toString()) * 3);
    for (let serial = 0; serial < initialCoins; serial++) {
      cache.addCoin(new Coin(serial, cell));
    }
  }

  cacheManager.addCache(cache);

  const marker = leaflet.marker(bounds.getCenter()).addTo(map);
  marker.bindPopup(() => createPopupDiv(cache));

  marker.on("popupopen", () => {
    if (marker.getPopup()) {
      marker.getPopup().setContent(createPopupDiv(cache));
    }
  });

  cacheMarkers.set(positionKey, marker);

  return cache;
}

function clearCaches() {
  cacheMarkers.forEach((marker, key) => {
    map.removeLayer(marker);
    cacheMarkers.delete(key);
  });
}

function createPopupDiv(cache: MyCache): HTMLElement {
  const popupDiv = document.createElement("div");

  const cacheTitle = document.createElement("div");
  cacheTitle.innerHTML =
    `<b>Cache [${cache.position.i},${cache.position.j}]</b>`;
  popupDiv.appendChild(cacheTitle);

  const coinSection = document.createElement("div");
  coinSection.innerHTML = `<b>Coins:</b>`;
  cache.coins.forEach((coin) => appendCoinDiv(coinSection, coin, cache));
  popupDiv.appendChild(coinSection);

  const depositSection = document.createElement("div");
  const depositTitle = document.createElement("div");
  depositTitle.innerHTML = `<b>Deposit:</b>`;
  depositSection.appendChild(depositTitle);

  const selectElement = document.createElement("select");

  playerCoins.forEach((coin, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = coin.toString();
    selectElement.appendChild(option);
  });

  const depositButton = document.createElement("button");
  depositButton.textContent = "Deposit Selected Coin";
  depositButton.onclick = () => {
    if (selectElement.selectedIndex >= 0) {
      const selectedCoin = playerCoins[selectElement.selectedIndex];
      deposit(selectedCoin, cache);
      saveGameData();
    }
  };

  depositSection.appendChild(selectElement);
  depositSection.appendChild(depositButton);
  popupDiv.appendChild(depositSection);

  return popupDiv;
}

function appendCoinDiv(parent: HTMLElement, coin: Coin, cache: MyCache): void {
  const coinDiv = document.createElement("div");
  const coinText = document.createTextNode(`${coin.toString()} `);
  const collectButton = document.createElement("button");
  collectButton.textContent = "Collect";
  collectButton.onclick = () => {
    collect(coin, cache);
    saveGameData();
    parent.innerHTML = "";
    cache.coins.forEach((updatedCoin) =>
      appendCoinDiv(parent, updatedCoin, cache)
    );
  };

  coinDiv.appendChild(coinText);
  coinDiv.appendChild(collectButton);
  parent.appendChild(coinDiv);
}

function collect(coin: Coin, cache: MyCache): void {
  if (cache.removeCoin(coin)) {
    playerCoins.push(coin);
    updateCoinStatus();
    saveGameData();

    const positionKey = `${cache.position.i},${cache.position.j}`;
    const marker = cacheMarkers.get(positionKey);
    if (marker && marker.getPopup()) {
      marker.getPopup().setContent(createPopupDiv(cache));
    }
  }
}

function deposit(coin: Coin, cache: MyCache): void {
  const index = playerCoins.findIndex(
    (c) =>
      c.serial === coin.serial && c.cell.i === coin.cell.i &&
      c.cell.j === coin.cell.j,
  );
  if (index !== -1) {
    const [removedCoin] = playerCoins.splice(index, 1);
    cache.addCoin(removedCoin);
    updateCoinStatus();
    saveGameData();

    const positionKey = `${cache.position.i},${cache.position.j}`;
    const marker = cacheMarkers.get(positionKey);
    if (marker && marker.getPopup()) {
      marker.getPopup().setContent(createPopupDiv(cache));
    }
  }
}

function resetGame() {
  localStorage.clear();
  initializeDefaultGameState();
}

function initializeDefaultGameState() {
  playerMarker.setLatLng(OAKES_CLASSROOM);
  polyline.setLatLngs([OAKES_CLASSROOM]);
  playerCoins.length = 0;
  updateCoinStatus();
  clearCaches();
  spawnNearbyCaches(OAKES_CLASSROOM);
  map.setView(OAKES_CLASSROOM, GAMEPLAY_ZOOM_LEVEL);
}

function updatePlayerPositionFromGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude } }) => {
        const newLatLng = leaflet.latLng(latitude, longitude);
        playerMarker.setLatLng(newLatLng);
        map.setView(newLatLng, GAMEPLAY_ZOOM_LEVEL);
        spawnNearbyCaches(newLatLng);
      },
      (err) => alert("Geolocation error: " + err.message),
    );
  } else {
    alert("Geolocation is not supported.");
  }
}

function loadGameData(): boolean {
  const storedData = localStorage.getItem("gameState");
  if (!storedData) {
    return false;
  }

  try {
    const gameData = JSON.parse(storedData);

    if (gameData.playerPosition) {
      const { lat, lng } = gameData.playerPosition;
      const playerLatLng = leaflet.latLng(lat, lng);
      playerMarker.setLatLng(playerLatLng);
      map.setView(playerLatLng, GAMEPLAY_ZOOM_LEVEL);
      polyline.setLatLngs([playerLatLng]);
    }

    if (gameData.playerCoins) {
      playerCoins.length = 0;
      playerCoins.push(...gameData.playerCoins.map(
        (coinData: { serial: number; cell: Cell }) =>
          new Coin(coinData.serial, coinData.cell),
      ));
      updateCoinStatus();
    }

    if (gameData.cacheStates) {
      gameData.cacheStates.forEach(
        (
          cacheData: {
            position: Cell;
            coins: { serial: number; cell: Cell }[];
          },
        ) => {
          const bounds = new CacheBounds(
            leaflet.latLng(
              cacheData.position.i * TILE_DEGREES,
              cacheData.position.j * TILE_DEGREES,
            ),
            leaflet.latLng(
              (cacheData.position.i + 1) * TILE_DEGREES,
              (cacheData.position.j + 1) * TILE_DEGREES,
            ),
          );

          const cache = new MyCache(cacheData.position, bounds);

          cache.coins = cacheData.coins.map(
            (coinData: { serial: number; cell: Cell }) =>
              new Coin(coinData.serial, coinData.cell),
          );

          cacheManager.addCache(cache);

          const marker = leaflet.marker(bounds.getCenter()).addTo(map);
          marker.bindPopup(() => createPopupDiv(cache));
          cacheMarkers.set(
            `${cacheData.position.i},${cacheData.position.j}`,
            marker,
          );
        },
      );
    }

    return true;
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!loadGameData()) {
    initializeDefaultGameState();
  }
  addControlButtons();
});

function addControlButtons() {
  const controlButtons = [
    { name: "north", text: "⬆️", move: [1, 0] as [number, number] },
    { name: "south", text: "⬇️", move: [-1, 0] as [number, number] },
    { name: "west", text: "⬅️", move: [0, -1] as [number, number] },
    { name: "east", text: "➡️", move: [0, 1] as [number, number] },
    { name: "reset", text: "🚮" },
    { name: "sensor", text: "🌐" },
  ];

  const controlPanel = document.createElement("div");
  controlPanel.id = "controlPanel";

  controlButtons.forEach(({ name, text, move }) => {
    const button = document.createElement("button");
    button.textContent = text;
    button.onclick = () => {
      switch (name) {
        case "north":
        case "south":
        case "west":
        case "east":
          movePlayer(move!);
          break;
        case "reset":
          if (confirm("Reset the game?")) resetGame();
          break;
        case "sensor":
          updatePlayerPositionFromGeolocation();
          break;
        default:
          break;
      }
    };
    controlPanel.appendChild(button);
  });

  app.appendChild(controlPanel);
}
