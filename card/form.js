import { supabase } from './supabaseClient.js';
import { selectedLatLng } from './map.js';
import { loadEntries } from 'js/entries.js';

export function setupForm() {
  const categorySelect = document.getElementById('category');
  const customCategoryInput = document.getElementById('customCategoryInput');
  const statusSelect = document.getElementById('status');
  const customStatusInput = document.getElementById('customStatusInput');

  categorySelect.addEventListener('change', () => {
    const value = categorySelect.value;
    customCategoryInput.style.display = value === "Other" ? "block" : "none";
    populateStatusOptions(value);
  });

  statusSelect.addEventListener('change', () => {
    customStatusInput.style.display = statusSelect.value === "Other" ? "block" : "none";
  });

  document.getElementById('selectLocationBtn').addEventListener('click', () => {
    window.isSelectingLocation = true;
    alert('Click on the map to select location.');
  });

  document.getElementById('entryForm').addEventListener('submit', handleFormSubmit);
}

function populateStatusOptions(category) {
  const statusSelect = document.getElementById('status');
  const statusOptions = {
    Garbage: ["Bad smell", "Mosquitoes", "Overflowing"],
    Drainage: ["Blocked", "Leaking", "Flooding"],
    Lighting: ["Broken", "Too Dim", "Flickering"],
    Road: ["Potholes", "Cracked", "Blocked"],
    Other: ["Other"]
  };
  const options = statusOptions[category] || ["Other"];
  statusSelect.innerHTML = options.map(o => `<option>${o}</option>`).join('');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value;
  const customCategory = document.getElementById('customCategoryInput')?.value.trim();
  const realCategory = category === "Other" ? customCategory : category;
  const status = document.getElementById('status').value;
  const customStatus = document.getElementById('customStatusInput')?.value.trim();
  const realStatus = status === "Other" ? customStatus : status;
  const description = document.getElementById('description').value.trim();

  if (!title || !realCategory || !realStatus || !selectedLatLng) return alert("All fields required");

  const newEntry = {
    id: Date.now(),
    title,
    category: realCategory,
    status: realStatus,
    description,
    lat: selectedLatLng.lat,
    lng: selectedLatLng.lng,
    campaign: null,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from('entries').insert([newEntry]);
  if (error) return alert("Failed to save entry.");

  document.getElementById('entryForm').reset();
  document.getElementById('customCategoryInput').style.display = 'none';
  document.getElementById('customStatusInput').style.display = 'none';

  loadEntries();
}
