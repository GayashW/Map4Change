import { getUserId } from './user.js';
import { toggleVote, toggleJoin } from './votesJoins.js';
import { showCampaignForm, startCountdown } from './campaign.js';

export async function addMarkerToMap(entry) {
  const marker = L.marker([entry.lat, entry.lng]).addTo(map);
  let votes = [], joins = [];

  try {
    const voteData = await supabase.from('votes').select('user_id').eq('entry_id', entry.id);
    votes = voteData.data || [];
    const joinData = await supabase.from('joins').select('user_id').eq('entry_id', entry.id);
    joins = joinData.data || [];
  } catch (e) {
    console.warn(e);
  }

  marker.bindPopup(generatePopup(entry, votes, joins));
  marker.on('popupopen', () => {
    setupPopupInteractions(entry, marker);
    if (entry.campaign) startCountdown(entry, marker);
  });
}
