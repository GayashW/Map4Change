import { initializeMap, zoomToUserLocation } from 'js\map.js';
import { setupForm } from "js\form.js";
import { loadEntries } from 'entries.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  zoomToUserLocation();
  setupForm();
  loadEntries();
});
