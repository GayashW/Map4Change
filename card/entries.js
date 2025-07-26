import { supabase } from './supabaseClient.js';
import { addMarkerToMap } from './popup.js';

export async function loadEntries() {
  const { data: entries, error } = await supabase.from('entries').select('*');
  if (error) return;
  entries.forEach(entry => addMarkerToMap(entry));
}
