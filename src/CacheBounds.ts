import * as leaflet from "leaflet";

export class CacheBounds {
  bounds: leaflet.LatLngBounds;

  constructor(topLeft: leaflet.LatLng, bottomRight: leaflet.LatLng) {
    this.bounds = leaflet.latLngBounds(topLeft, bottomRight);
  }

  containsPoint(latLng: leaflet.LatLng): boolean {
    return this.bounds.contains(latLng);
  }

  getCenter(): leaflet.LatLng {
    return this.bounds.getCenter();
  }
}
