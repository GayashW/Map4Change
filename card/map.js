import { loadEntries } from 'js/entries.js';

export let map = L.map('map').setView([7.5731, 80.3718], 8);
let marker = null;
export let selectedLatLng = null;
export let isSelectingLocation = false;

export function initializeMap() {
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM © CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  L.tileLayer('https://gayashw.github.io/test-webmap/tiles/{z}/{x}/{y}.png', {
    className: 'blend-overlay', opacity: 0.7, maxZoom: 19
  }).addTo(map);

  map.on('click', function(e) {
    if (!isSelectingLocation) return;
    selectedLatLng = e.latlng;
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    isSelectingLocation = false;
  });
}

export function zoomToUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    map.setView([pos.coords.latitude, pos.coords.longitude], 15);
  });
}
