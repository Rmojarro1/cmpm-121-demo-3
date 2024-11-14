import leaflet, { LatLng, Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

class CellFactory {
  private static cellCache: Map<string, Cell> = new Map();

  static getCellFromLatLng(lat: number, lng: number): Cell {
    const i = Math.floor((lat - 0) / TILE_DEGREES);
    const j = Math.floor((lng - 0) / TILE_DEGREES);
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

interface ControlButton {
  name: string;
  text: string;
}

interface Cell {
  i: number;
  j: number;
}

interface Memento<T> {
  toMemento(): T;
  fromMemento(memento: T): void;
}

class Cache implements Memento<string> {
  coins: Coin[] = [];
  position: Cell;
  bounds: leaflet.LatLngBounds;

  constructor(position: Cell, bounds: leaflet.LatLngBounds) {
    this.position = position;
    this.bounds = bounds;
  }

  positionToString(): string {
    return `${this.position.i},${this.position.j}`;
  }

  toMemento(): string {
    const mementoData = {
      coins: this.coins.map((coin) => ({
        cell: coin.cell,
        serial: coin.serial,
      })),
      position: this.position,
    };
    return JSON.stringify(mementoData);
  }

  fromMemento(memento: string): void {
    const mementoData = JSON.parse(memento);
    this.position = mementoData.position;
    this.coins = mementoData.coins.map((
      coinData: { cell: Cell; serial: number },
    ) => ({
      cell: coinData.cell,
      serial: coinData.serial,
      toString() {
        return `${this.cell.i}:${this.cell.j}#${this.serial}`;
      },
    }));
  }
}

interface Coin {
  cell: Cell;
  serial: number;
  toString(): string;
}

const cacheMarkers: Map<string, leaflet.Marker> = new Map();

const app: HTMLDivElement = document.querySelector("#app")!;

const controlButtons: ControlButton[] = [
  { name: "sensor", text: "🌐" },
  { name: "north", text: "⬆️" },
  { name: "south", text: "⬇️" },
  { name: "west", text: "⬅️" },
  { name: "east", text: "➡️" },
  { name: "reset", text: "🚮" },
];
addControlButtons(controlButtons);

const statusPanel: HTMLDivElement = document.createElement("div");
statusPanel.id = "statusPanel";
app.appendChild(statusPanel);

const mapElement: HTMLDivElement = document.createElement("div");
mapElement.id = "map";
app.appendChild(mapElement);

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
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

const playerMarker = leaflet.marker(OAKES_CLASSROOM, { icon: redIcon });
playerMarker.bindTooltip("You");
playerMarker.addTo(map);

let playerCoins: Coin[] = [];
statusPanel.innerHTML = "No coins collected";

const cacheMementos: Map<string, string> = new Map();
spawnNearbyCaches(OAKES_CLASSROOM);

const polyCoordinates = [[OAKES_CLASSROOM.lat, OAKES_CLASSROOM.lng]];
const polyLine = leaflet.polyline(polyCoordinates, { color: "blue" }).addTo(
  map,
);

function movePlayer(direction: Int16Array) {
  const currentPos: leaflet.LatLng = playerMarker.getLatLng();
  const newPos: LatLng = leaflet.latLng(
    currentPos.lat + TILE_DEGREES * direction[0],
    currentPos.lng + TILE_DEGREES * direction[1],
  );
  playerMarker.setLatLng(newPos);
  polyLine.setLatLngs([...polyLine.getLatLngs(), newPos]);
  map.setView(newPos, GAMEPLAY_ZOOM_LEVEL);

  clearCaches();
  spawnNearbyCaches(newPos);
}

function clearCaches() {
  map.eachLayer((layer: Layer) => {
    if (layer instanceof leaflet.Marker) {
      const markerLayer = layer as leaflet.Marker & { cache?: Cache };
      if (markerLayer.cache) {
        const cache = markerLayer.cache;
        cacheMementos.set(cache.positionToString(), cache.toMemento());
        map.removeLayer(layer);
      }
    }
  });
}

interface CacheState {
  coins: { cell: Cell; serial: number }[];
}

interface GameData {
  playerPosition: { lat: number; lng: number };
  collectedCoins: { cell: Cell; serial: number }[];
  cacheStates: Record<string, CacheState>;
}

const gameData: GameData = {
  playerPosition: { lat: OAKES_CLASSROOM.lat, lng: OAKES_CLASSROOM.lng },
  collectedCoins: [],
  cacheStates: {},
};

function saveGameData() {
  gameData.playerPosition = {
    lat: playerMarker.getLatLng().lat,
    lng: playerMarker.getLatLng().lng,
  };

  gameData.collectedCoins = playerCoins.map((coin) => ({
    cell: coin.cell,
    serial: coin.serial,
  }));
  gameData.cacheStates = {};

  map.eachLayer((layer: Layer) => {
    if (layer instanceof leaflet.Marker) {
      const markerLayer = layer as leaflet.Marker & { cache?: Cache };
      if (markerLayer.cache) {
        const cache = markerLayer.cache;
        gameData.cacheStates[cache.positionToString()] = {
          coins: cache.coins.map((coin: Coin) => ({
            cell: coin.cell,
            serial: coin.serial,
          })),
        };
      }
    }
  });
  localStorage.setItem("gameState", JSON.stringify(gameData));
}

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("keydown", (event) => {
    if (event.key === "s" || event.key === "S") {
      saveGameData();
    }

    if (event.key === "l" || event.key === "L") {
      loadGameData();
    }

    if (event.key === "i" || event.key === "I") {
      console.log(
        "Current player inventory: ",
        playerCoins.map((coin) => coin.toString()),
      );
    }
  });
});

function loadGameData() {
  const storedDataString = localStorage.getItem("gameState");
  if (storedDataString) {
    try {
      const storedData: GameData = JSON.parse(storedDataString);

      if (storedData.playerPosition) {
        const { lat, lng } = storedData.playerPosition;
        const playerLatLng = leaflet.latLng(lat, lng);
        playerMarker.setLatLng(playerLatLng);
        map.setView(playerLatLng, GAMEPLAY_ZOOM_LEVEL);
        polyLine.setLatLngs([]);
        polyLine.setLatLngs([[lat, lng]]);
      }

      if (storedData.collectedCoins) {
        playerCoins = storedData.collectedCoins.map((coinData): Coin => ({
          cell: coinData.cell,
          serial: coinData.serial,
          toString() {
            return `${this.cell.i}:${this.cell.j}#${this.serial}`;
          },
        }));
      }

      if (storedData.cacheStates) {
        for (const key in storedData.cacheStates) {
          if (
            Object.prototype.hasOwnProperty.call(storedData.cacheStates, key)
          ) {
            const cacheData = storedData.cacheStates[key];
            const [i, j] = key.split(",").map(Number);
            const cache = spawnCache(i, j);
            cache.coins = cacheData.coins.map((coinData): Coin => ({
              cell: coinData.cell,
              serial: coinData.serial,
              toString() {
                return `${this.cell.i}:${this.cell.j}#${this.serial}`;
              },
            }));
          }
        }
      }
    } catch {
      initializeDefaultGameState();
    }
  } else {
    initializeDefaultGameState();
  }
}

function initializeDefaultGameState() {
  console.log("Initializing default game state.");
  gameData.playerPosition = {
    lat: OAKES_CLASSROOM.lat,
    lng: OAKES_CLASSROOM.lng,
  };
  playerMarker.setLatLng(gameData.playerPosition);
  map.setView(gameData.playerPosition, GAMEPLAY_ZOOM_LEVEL);

  playerCoins = [];
  gameData.collectedCoins = [];

  gameData.cacheStates = {};

  clearCaches();
  spawnNearbyCaches(OAKES_CLASSROOM);

  statusPanel.innerHTML = "No coins collected";
}

function updatePlayerPositionFromGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const playerLatLng = leaflet.latLng(latitude, longitude);
        playerMarker.setLatLng(playerLatLng);
        map.setView(playerLatLng, GAMEPLAY_ZOOM_LEVEL);
        clearCaches();
        spawnNearbyCaches(playerLatLng);
      },
      (error) => {
        alert("Geolocation error: " + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

function spawnNearbyCaches(center: leaflet.LatLng) {
  const centerCell = CellFactory.getCellFromLatLng(center.lat, center.lng);

  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const gridI = centerCell.i + i;
      const gridJ = centerCell.j + j;

      if (luck([gridI, gridJ].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(gridI, gridJ);
      }
    }
  }
}

function spawnCache(i: number, j: number): Cache {
  const cell = CellFactory.getCell(i, j);
  const positionKey = `${i},${j}`;
  const lat = i * TILE_DEGREES;
  const lng = j * TILE_DEGREES;
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  const cacheMarker = leaflet.marker(bounds.getCenter());
  cacheMarker.addTo(map);

  const cache = new Cache(cell, bounds);

  const memento = cacheMementos.get(positionKey);
  if (memento) {
    cache.fromMemento(memento);
  } else {
    const initialCoins = 1 +
      Math.floor(luck([i, j, "initialValue"].toString()) * 3);
    for (let serial = 0; serial < initialCoins; serial++) {
      const coin: Coin = {
        cell: cell,
        serial: serial,
        toString() {
          return `${this.cell.i}:${this.cell.j}#${this.serial}`;
        },
      };
      cache.coins.push(coin);
    }
  }

  cacheMarkers.set(positionKey, cacheMarker);

  cacheMarker.bindPopup(() => createPopupDiv(cache, cell));

  return cache;
}

function createPopupDiv(cache: Cache, cell: Cell): HTMLElement {
  const popupDivId = `popup-${cache.position.i}-${cache.position.j}`;
  let popupDiv = document.getElementById(popupDivId) as HTMLElement;

  if (!popupDiv) {
    popupDiv = document.createElement("div");
    popupDiv.id = popupDivId;

    const cacheTitle = document.createElement("div");
    cacheTitle.innerHTML = `<b>Cache [${cell.i},${cell.j}]</b>`;
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
        updatePopup(popupDiv, cache, cell);
        cacheMementos.set(`${cell.i},${cell.j}`, cache.toMemento());
      }
    };

    depositSection.appendChild(selectElement);
    depositSection.appendChild(depositButton);
    popupDiv.appendChild(depositSection);
  }

  return popupDiv;
}

function appendCoinDiv(parent: HTMLElement, coin: Coin, cache: Cache) {
  const coinDiv = document.createElement("div");
  const coinText = document.createTextNode(`${coin.toString()} `);
  const collectButton = document.createElement("button");
  collectButton.textContent = "Collect";
  collectButton.onclick = () => {
    collect(coin, cache);
    updatePopup(parent, cache, coin.cell);
    cacheMementos.set(`${coin.cell.i},${coin.cell.j}`, cache.toMemento());
  };

  coinDiv.appendChild(coinText);
  coinDiv.appendChild(collectButton);
  parent.appendChild(coinDiv);
}

function updatePopup(popupDiv: HTMLElement, cache: Cache, cell: Cell) {
  popupDiv.innerHTML = "";

  const cacheTitle = document.createElement("div");
  cacheTitle.innerHTML = `<b>Cache [${cell.i},${cell.j}]</b>`;
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
      updatePopup(popupDiv, cache, cell);
      cacheMementos.set(`${cell.i},${cell.j}`, cache.toMemento());
    }
  };

  depositSection.appendChild(selectElement);
  depositSection.appendChild(depositButton);
  popupDiv.appendChild(depositSection);
}

function collect(coin: Coin, cache: Cache): void {
  const coinIndex = cache.coins.findIndex((c) =>
    c.serial === coin.serial && c.cell.i === coin.cell.i &&
    c.cell.j === coin.cell.j
  );

  if (coinIndex >= 0) {
    playerCoins.push(coin);
    cache.coins.splice(coinIndex, 1);
    cacheMementos.set(cache.positionToString(), cache.toMemento());
    updateCoinStatus();

    const popupElement = document.getElementById(
      `popup-${cache.position.i}-${cache.position.j}`,
    );
    if (popupElement) {
      updatePopup(popupElement, cache, coin.cell);
    } else {
      console.warn(
        "The popup element was not found for cache;attempting to create.",
      );
      updatePopup(createPopupDiv(cache, coin.cell), cache, coin.cell);
    }
  } else {
    console.warn(
      `Coin to be collected wasn't found in the cache: ${coin.toString()}`,
    );
  }
}

function deposit(coin: Coin, cache: Cache): void {
  const coinIndex = playerCoins.findIndex((c) =>
    c.serial === coin.serial && c.cell.i === coin.cell.i &&
    c.cell.j === coin.cell.j
  );
  if (coinIndex >= 0) {
    playerCoins.splice(coinIndex, 1);
    cache.coins.push(coin);
    cacheMementos.set(cache.positionToString(), cache.toMemento());
    updateCoinStatus();

    const marker = cacheMarkers.get(`${cache.position.i},${cache.position.j}`);
    if (marker && marker.getPopup()) {
      marker.getPopup().setContent(createPopupDiv(cache, coin.cell)).openOn(
        map,
      );
    }
  } else {
    console.warn(
      `Coin to be deposited wasn't found in player's inventory: ${coin.toString()}`,
    );
  }
}

function focusOnCache(cell: Cell) {
  const cachePosition = leaflet.latLng(
    cell.i * TILE_DEGREES,
    cell.j * TILE_DEGREES,
  );
  clearCaches();
  spawnCache(cell.i, cell.j);
  map.setView(cachePosition, GAMEPLAY_ZOOM_LEVEL);
  console.log(`Focusing on cache at [${cell.i}, ${cell.j}]`);

  const marker = cacheMarkers.get(`${cell.i},${cell.j}`);
  if (marker) {
    marker.openPopup();
  }
}

function updateCoinStatus() {
  let coinDetails = "<h3>Collected Coins</h3><ul>";
  playerCoins.forEach((coin, index) => {
    coinDetails += `<li>Coin: ${coin.cell.i}:${coin.cell.j} #${coin.serial}`;
    coinDetails += ` <button id="home-cache-${index}">Home Cache</button></li>`;
  });
  coinDetails += "</ul>";
  statusPanel.innerHTML = coinDetails;

  playerCoins.forEach((coin, index) => {
    document.getElementById(`home-cache-${index}`)?.addEventListener(
      "click",
      () => {
        focusOnCache(coin.cell);
      },
    );
  });
}

function addControlButtons(buttons: ControlButton[]) {
  const controlPanel = document.createElement("div");
  controlPanel.id = "controlPanel";

  buttons.forEach((button) => {
    const btn = document.createElement("button");
    btn.id = button.name;
    btn.title = button.name;
    btn.textContent = button.text;

    btn.addEventListener("click", () => {
      switch (button.name) {
        case "reset":
          if (confirm("Are you sure you want to reset the game state?")) {
            resetGame();
          }
          break;

        case "sensor":
          updatePlayerPositionFromGeolocation();
          break;

        case "north":
          movePlayer(new Int16Array([1, 0]));
          break;

        case "south":
          movePlayer(new Int16Array([-1, 0]));
          break;

        case "east":
          movePlayer(new Int16Array([0, 1]));
          break;

        case "west":
          movePlayer(new Int16Array([0, -1]));
          break;
      }
    });

    controlPanel.appendChild(btn);
  });

  app.appendChild(controlPanel);
}

function resetGame() {
  localStorage.removeItem("gameState");
  initializeDefaultGameState();
  alert("Game state reset.");
}
