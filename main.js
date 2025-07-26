// Import Supabase client
const SUPABASE_URL = 'https://whqjayeqevtukdatjmpp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocWpheWVxZXZ0dWtkYXRqbXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NzI4ODIsImV4cCI6MjA2ODM0ODg4Mn0.r09UH3XC2sQpNWOujFH1NvvaSuyboPqzhFsneGyKmjQ';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize map
let map = L.map('map').setView([7.5731, 80.3718], 8);
let marker = null;
let selectedLatLng = null;
let isSelectingLocation = false;


// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  zoomToUserLocation();
  setupForm();

  // Destructure entries directly from loadEntries
  loadEntries().then(async ({ entries }) => {
    // Wrapper async function to handle the geolocation logic
    async function handlePosition(position) {
      const { latitude, longitude } = position.coords;

      // Analyze nearby entries
      const analysis = await analyzeNearbyEntries(latitude, longitude);
      console.log("Nearby Category Counts:", analysis.countsByCategory);
      console.log("Nearest Campaign:", analysis.nearestCampaign);
      console.log("Top Voted Entry Nearby:", analysis.topVoted);

      let tutorialEntryId = null;
      if (analysis.nearestCampaign) {
        tutorialEntryId = analysis.nearestCampaign.id;
      } else if (analysis.topVoted) {
        tutorialEntryId = analysis.topVoted.id;
      }

      for (const entry of entries) {
        const isTutorial = entry.id === tutorialEntryId;
        await addMarkerToMap(entry, isTutorial);
      }

      // Optionally start the tutorial here
      // introJs().start();
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        handlePosition(position).catch(console.error);
      },
      error => {
        console.error("Geolocation error:", error);
        // If geolocation fails, just add markers without tutorial highlight
        entries.forEach(entry => addMarkerToMap(entry, false));
      }
    );
  });
});




document.querySelector('.zoom-in-btn').addEventListener('click', () => map.zoomIn());
document.querySelector('.zoom-out-btn').addEventListener('click', () => map.zoomOut());

document.querySelector('.zoom-location-btn').addEventListener('click', () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        map.once('moveend', () => {
          L.popup({ offset: [0, -40] })
            .setLatLng([latitude, longitude])
            .setContent("You are here")
            .openOn(map);
        });

        map.setView([latitude, longitude], 17, { animate: true });
      },
      (error) => {
        alert("Unable to access your location. Make sure location services are enabled.");
        console.error(error);
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
});




// Add zoom control manually at bottom right
L.control.zoom({
  position: 'bottomright',
  zoomControl: false
}).addTo(map);

// Helper functions
function getUserId() {
  let uid = localStorage.getItem('userId');
  if (!uid) {
    uid = 'user-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('userId', uid);
  }
  return uid;
}

function formatDateTimeForTimestampWithoutTZ(localDateTime) {
  const dt = new Date(localDateTime);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:00.000`;
}

// Map initialization
function initializeMap() {
  // Add base colorful CartoDB Voyager OSM layer with zIndex 200
  const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    zIndex: 200,
    maxZoom: 20,
  }).addTo(map);


  // Add black & white overlay layer with multiply blend and opacity 0.7, zIndex 400
  const overlayLayer = L.tileLayer('https://gayashw.github.io/test-webmap/tiles/{z}/{x}/{y}.png', {
    className: 'blend-overlay',
    opacity: 0.7,
    maxZoom: 19,
    zIndex: 400,
  }).addTo(map);

  // Existing map click logic stays the same
  map.on('click', function(e) {
    if (!isSelectingLocation) return;

    selectedLatLng = e.latlng;
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    isSelectingLocation = false;
  });
}


// Form handling
function setupForm() {
  const categorySelect = document.getElementById('category');
  const customCategoryInput = document.getElementById('customCategoryInput');
  const statusSelect = document.getElementById('status');
  const customStatusInput = document.getElementById('customStatusInput');
  const resetLocationBtn = document.getElementById('resetLocationBtn');

  categorySelect.addEventListener('change', () => {
    const value = categorySelect.value;
    customCategoryInput.style.display = value === "Other" ? "block" : "none";
    populateStatusOptions(value);
  });

  statusSelect.addEventListener('change', () => {
    customStatusInput.style.display = statusSelect.value === "Other" ? "block" : "none";
  });

  document.getElementById('selectLocationBtn').addEventListener('click', () => {
    isSelectingLocation = true;
    showMapAlertPopup("Click on the map to select a location.", "#74654e");
    map.getContainer().classList.add('crosshair-cursor');
  });

  resetLocationBtn.addEventListener('click', () => {
    if (marker) {
      map.removeLayer(marker);
      marker = null;
      selectedLatLng = null;
    }
    resetLocationBtn.disabled = true;
  });

  document.getElementById('entryForm').addEventListener('submit', handleFormSubmit);
}


function populateStatusOptions(category) {
  const statusSelect = document.getElementById('status');
  statusSelect.innerHTML = '';
  document.getElementById('customStatusInput').style.display = 'none';

  const statusOptions = {
    Garbage: ["Bad smell", "Mosquitoes", "Overflowing"],
    Drainage: ["Blocked", "Leaking", "Flooding"],
    Lighting: ["Broken", "Too Dim", "Flickering"],
    Road: ["Potholes", "Cracked", "Blocked"],
    Other: ["Other"]
  };

  (statusOptions[category] || ["Other"]).forEach(status => {
    const opt = document.createElement("option");
    opt.value = status;
    opt.textContent = status;
    statusSelect.appendChild(opt);
  });

  if (category === "Other") {
    document.getElementById('customStatusInput').style.display = 'block';
  }
}

function showMapAlertPopup(message, bgColor = "#fef3c7") {
  removeMapAlertPopup();

  const popup = document.createElement('div');
  popup.className = 'map-alert-popup';
  popup.id = 'mapAlertPopup';
  popup.textContent = message;
  popup.style.backgroundColor = bgColor;

  document.body.appendChild(popup);

  // Auto-hide after 3 seconds
  setTimeout(removeMapAlertPopup, 3000);
}


function removeMapAlertPopup() {
  const existing = document.getElementById('mapAlertPopup');
  if (existing) existing.remove();
}



async function handleFormSubmit(e) {
  e.preventDefault();

  if (!selectedLatLng) {
    showMapAlertPopup("Please select a location from the map.", "#ff7575ff");
    return;
  }

  const title = document.getElementById('title').value.trim();
  const categoryValue = document.getElementById('category').value;
  const customCategory = document.getElementById('customCategoryInput')?.value.trim() || "";
  const finalCategory = categoryValue === "Other" ? customCategory : categoryValue;

  const statusValue = document.getElementById('status').value;
  const customStatus = document.getElementById('customStatusInput')?.value.trim() || "";
  const finalStatus = categoryValue === "Other" ? customStatus : statusValue;

  const description = document.getElementById('description').value.trim();

  if (!finalCategory || !finalStatus || !title) {
    alert("Please fill all required fields.");
    return;
  }

  const newEntry = {
    id: Date.now(),
    title,
    category: finalCategory,
    status: finalStatus,
    description,
    lat: selectedLatLng.lat,
    lng: selectedLatLng.lng,
    campaign: null,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from('entries').insert([newEntry]);
  if (error) {
    console.error("Error saving entry:", error);
    alert("Failed to save entry. Please try again.");
    return;
  }

  // Reset form
  document.getElementById('entryForm').reset();
  selectedLatLng = null;
  document.getElementById('customCategoryInput').style.display = 'none';
  document.getElementById('customStatusInput').style.display = 'none';
  
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }

  // Reload markers
  loadEntries();
}

// Data management
async function loadEntries() {
  // Clear existing markers except the selection marker
  map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer !== marker) {
      map.removeLayer(layer);
    }
  });

  const { data: entries, error } = await supabase.from('entries').select('*');
  if (error) {
    console.error('Error loading entries:', error);
    return;
  }

  for (const entry of entries) {
    await addMarkerToMap(entry);
  }
}

async function addMarkerToMap(entry, isTutorial = false) {
  const now = new Date();
  const campaignDate = entry.campaign ? new Date(entry.campaign) : null;
  const isCampaignEnded = campaignDate ? campaignDate < now : false;

  const iconPath = getMarkerIcon(entry.category, entry.status, isCampaignEnded);

  let marker;
  if (isTutorial) {
    // Use divIcon so we can embed data-intro for tutorial
    const iconWithHint = L.divIcon({
      className: 'custom-marker-icon',
      html: `
        <div 
          class="marker-hint" 
          data-intro="This is a reported issue near you. Click for details." 
          data-step="4"
        >
          <img src="${iconPath}" width="48" height="48" />
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      popupAnchor: [0, -48]
    });

    marker = L.marker([entry.lat, entry.lng], { icon: iconWithHint }).addTo(map);
  } else {
    const customIcon = L.icon({
      iconUrl: iconPath,
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      popupAnchor: [0, -48]
    });

    marker = L.marker([entry.lat, entry.lng], { icon: customIcon }).addTo(map);
  }

  allMarkers.push({ marker, category: entry.category });

  const userId = getUserId();
  const { data: votes } = await supabase.from('votes').select('user_id').eq('entry_id', entry.id);
  const { data: joins } = await supabase.from('joins').select('user_id').eq('entry_id', entry.id);
  const { data: downvotes } = await supabase.from('downvotes').select('user_id').eq('entry_id', entry.id);

  const hasVoted = votes?.some(v => v.user_id === userId) || false;
  const hasJoined = joins?.some(j => j.user_id === userId) || false;
  const hasDownvoted = downvotes?.some(d => d.user_id === userId) || false;

  const popupContent = generatePopupContent(
    entry,
    votes?.length || 0,
    joins?.length || 0,
    hasVoted,
    hasJoined,
    downvotes?.length || 0,
    hasDownvoted
  );

  marker.bindPopup(popupContent);

  marker.on('popupopen', () => {
    setupPopupInteractions(entry, marker);
    if (entry.campaign) startCountdown(entry, marker);
    lucide.createIcons();
  });
}



function getMarkerIcon(category, status, isEnded = false) {
  const iconNameMap = {
    Garbage: {
      "Bad smell": "garbage_smell",
      "Mosquitoes": "garbage_mosquitoes",
      "Overflowing": "garbage_overflowing"
    },
    Drainage: {
      "Blocked": "drainage_blocked",
      "Leaking": "drainage_leaking",
      "Flooding": "drainage_flooding"
    },
    Lighting: {
      "Broken": "lighting_broken",
      "Too Dim": "lighting_dim",
      "Flickering": "lighting_flickering"
    },
    Road: {
      "Potholes": "road_potholes",
      "Cracked": "road_cracked",
      "Blocked": "road_blocked"
    },
    Other: {
      "Other": "other"
    }
  };

  const iconBaseName = iconNameMap[category]?.[status] || "default";
  const folder = isEnded ? "icons/marker_ended" : "icons/marker";
  return `${folder}/${iconBaseName}_m.png`;
}



function generatePopupContent(entry, voteCount, joinCount, hasVoted, hasJoined, downvoteCount, hasDownvoted) {
  const now = new Date();
  const campaignDate = entry.campaign ? new Date(entry.campaign) : null;
  const isCampaignEnded = campaignDate ? campaignDate < now : false;

  const statusText = isCampaignEnded ? "Campaign Done" : entry.status;
  const campaignClass = isCampaignEnded ? "campaign-ended" : "";

  const voteBtnId = `vote-btn-${entry.id}`;
  const voteCountId = `vote-count-${entry.id}`;
  const downvoteBtnId = `downvote-btn-${entry.id}`;
  const downvoteCountId = `downvote-count-${entry.id}`;
  const campaignBtnId = `campaign-btn-${entry.id}`;
  const countdownId = `countdown-${entry.id}`;
  const joinBtnId = `join-btn-${entry.id}`;
  const joinCountId = `join-count-${entry.id}`;
  const groupLinkId = `group-link-${entry.id}`;

  const hasValidCampaign = entry.campaign && entry.campaign.trim() !== '' && !entry.campaign.includes('Loading');

  const formatIconName = (text) =>
    text?.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '') || 'unknown';

  const iconUrl = `icons/icons/${formatIconName(entry.category)}_${formatIconName(entry.status)}.png`;


    const countdownHtml = hasValidCampaign ? `
      <div class="countdown-wrapper">
        <div class="countdown ${isCampaignEnded ? 'ended' : ''}" id="${countdownId}" data-campaign="${entry.campaign}">
          ${isCampaignEnded ? "Campaign Ended" : "Starts in: Loading..."}
        </div>
      </div>
    ` : '';


  const campaignHtml = entry.campaign && hasValidCampaign ? `
  <div class="campaign-section">
          <div class="type-item">
            <div class="label">Campaign Date</div>
            <div>${new Date(entry.campaign).toLocaleString()}</div>
          </div>
      ${isCampaignEnded
  ? `<div class="campaign-ended-text"><em>This campaign has ended.</em></div>`
  : `
    <div class="campaign-actions">
    <button id="${joinBtnId}" class="join-btn ${hasJoined ? 'joined' : ''}">
      ${
        hasJoined 
          ? `<i data-lucide="check-circle" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;"></i> Joined (${joinCount})`
          : `Join (${joinCount})`
      }
    </button>


  ${hasJoined && entry.group_link ? `
    <a id="${groupLinkId}" class="group-link" href="${entry.group_link}" target="_blank" rel="noopener noreferrer"
      style="display: flex; align-items: center; gap: 0.4rem;">
      <i data-lucide="link-2" style="width: 18px; height: 18px;"></i>
      Join the Group Chat
    </a>
  ` : ''}

</div>

    </div>
  `}

              </div>
    ` : (
      voteCount >= 30
        ? `
          <div class="campaign-section">
            <button id="${campaignBtnId}" class="campaign-btn">Let's Make This</button>
          </div>
        `
        : ''
    );




    const voteHtml = !isCampaignEnded ? `
      <div class="vote-section" style="display: flex; gap: 20px; justify-content: center; align-items: center;">
        <div class="vote-button-group" style="text-align: center;">
          <button id="${voteBtnId}" class="vote-btn upvote-btn ${hasVoted ? 'voted' : ''}" style="display: block; margin: 0 auto; background: none; border: none; cursor: pointer;">
            <img src="${hasVoted ? 'icons/controllers/up_fill.svg' : 'icons/controllers/up_outline.svg'}" alt="Upvote" width="30" height="30" />
          </button>
          <span id="${voteCountId}" class="vote-count" style="display: block; margin-top: 0px;">${voteCount}</span>
        </div>

        <div class="vote-button-group" style="text-align: center;">
          <button id="${downvoteBtnId}" class="vote-btn downvote-btn ${hasDownvoted ? 'downvoted' : ''}" style="display: block; margin: 0 auto; background: none; border: none; cursor: pointer;">
            <img src="${hasDownvoted ? 'icons/controllers/up2_fill.svg' : 'icons/controllers/up2_outline.svg'}" alt="Downvote" width="28" height="28" />
          </button>
          <span id="${downvoteCountId}" class="downvote-count" style="display: block; margin-top: 0px;">${downvoteCount}</span>
        </div>
      </div>
    ` : '';




  return `
    <div class="custom-popup ${campaignClass}">
      ${hasValidCampaign ? countdownHtml + '<div class="countdown-shape"></div>' : ''}


      <div class="card-content">
        <div class="header">
          <div class="title">${entry.title}</div>
          <div class="description">${entry.description}</div>
        </div>
          
        <div class="type-status-row">
          <div class="type-item">
            <div class="label">Type</div>
            <div>${entry.category}</div>
          </div>
          <div class="status-item">
            <div class="label">Status</div>
            <div>${statusText}</div>
          </div>
        </div>
        <div class="icon-vote-row" >
          <img src="${iconUrl}" alt="${entry.category} icon" class="popup-icon" style="width: 50px; height: 50px;" />
          ${voteHtml}
        </div>
        ${campaignHtml}
      </div>
    </div>
  `;
  

}




// Fetch current user's upvote status for an entry
async function checkIfUserVoted(entryId) {
  const userId = getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from('votes')
    .select('id')
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    console.error('Error fetching user vote:', error);
    return false;
  }

  return data && data.length > 0;
}

// Fetch current user's downvote status for an entry
async function checkIfUserDownvoted(entryId) {
  const userId = getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from('downvotes')
    .select('id')
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    console.error('Error fetching user downvote:', error);
    return false;
  }

  return data && data.length > 0;
}


// This function is called to refresh or initially show the popup
async function refreshMarkerPopup(entry, marker) {
  // Fetch latest state for this entry and user
  const voteCount = await getVoteCount(entry.id);
  const downvoteCount = await getDownvoteCount(entry.id);
  const joinCount = await getJoinCount(entry.id);

  const hasVoted = await checkIfUserVoted(entry.id);
  const hasDownvoted = await checkIfUserDownvoted(entry.id);
  const hasJoined = await checkIfUserJoined(entry.id);

  // Log when popup opens
  console.log(`Popup opened for entry ${entry.id}: hasVoted=${hasVoted}, hasDownvoted=${hasDownvoted}`);

  // Generate the popup content HTML
  const popupContent = generatePopupContent(
    entry,
    voteCount,
    joinCount,
    hasVoted,
    hasJoined,
    downvoteCount,
    hasDownvoted
  );

  // Show popup
  marker.bindPopup(popupContent).openPopup();
  lucide.createIcons();

  // Setup interactions
  await setupPopupInteractions(entry, marker, hasVoted, hasDownvoted);
  
}

async function openPopupForEntry(entry, marker) {
  const hasVoted = await checkIfUserVoted(entry.id);
  const hasDownvoted = await checkIfUserDownvoted(entry.id);

  console.log(`Popup opened for entry ${entry.id}: hasVoted=${hasVoted}, hasDownvoted=${hasDownvoted}`);

  const popupContent = generatePopupContent(
    entry,
    entry.voteCount,
    entry.joinCount,
    hasVoted,
    entry.hasJoined,
    entry.downvoteCount,
    hasDownvoted
  );

  marker.bindPopup(popupContent).openPopup();

  await setupPopupInteractions(entry, marker, hasVoted, hasDownvoted);
}


// Your existing setupPopupInteractions with updated logic for toggling votes
async function setupPopupInteractions(entry, marker, hasVoted, hasDownvoted) {
  const voteBtn = document.getElementById(`vote-btn-${entry.id}`);
  const downvoteBtn = document.getElementById(`downvote-btn-${entry.id}`);
  const campaignBtn = document.getElementById(`campaign-btn-${entry.id}`);
  const joinBtn = document.getElementById(`join-btn-${entry.id}`);

  function showLoading(...buttons) {
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<img src="icons/controllers/spinner.svg" width="24" height="24" alt="Loading..." />';
      }
    });
  }


if (voteBtn) {
  voteBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasVoted) {
      showLoading(voteBtn);
      await toggleVote(entry.id);
      hasVoted = false;
    } else {
      if (hasDownvoted) {
        showLoading(voteBtn, downvoteBtn);
        await toggleDownvote(entry.id);
        hasDownvoted = false;
        await toggleVote(entry.id);
        hasVoted = true;
      } else {
        showLoading(voteBtn);
        await toggleVote(entry.id);
        hasVoted = true;
      }
    }

    refreshMarkerPopup(entry, marker);
  };

if (downvoteBtn) {
  downvoteBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasDownvoted) {
      showLoading(downvoteBtn);
      await toggleDownvote(entry.id);
      hasDownvoted = false;
    } else {
      if (hasVoted) {
        showLoading(downvoteBtn, voteBtn);
        await toggleVote(entry.id);
        hasVoted = false;
        await toggleDownvote(entry.id);
        hasDownvoted = true;
      } else {
        showLoading(downvoteBtn);
        await toggleDownvote(entry.id);
        hasDownvoted = true;
      }
    }

    await checkAndRemoveEntryIfNeeded(entry, marker);
    refreshMarkerPopup(entry, marker);
  };

}
  if (campaignBtn) {
    campaignBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      marker.closePopup();
      showCampaignForm(entry, marker);
    };
  }

  if (joinBtn) {
    joinBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      joinBtn.disabled = true;
      joinBtn.innerHTML = `<span class="spinner"></span> Updating...`;

      await toggleJoin(entry.id);
      refreshMarkerPopup(entry, marker);
      openPopupForEntry(entry, marker);

      // Delay icon creation slightly to ensure content is rendered
      setTimeout(() => {
        lucide.createIcons();
      }, 1);
    };
  }

}
}


// Replace this with your actual user ID retrieval logic
function getCurrentUserId() {
  // For example, from localStorage:
  // return localStorage.getItem('userId');

  // Or hardcoded for testing:
  return 'user-123';
}

async function checkIfUserVoted(entryId) {
  const userId = getCurrentUserId();
  const votes = await getVotes(entryId); // e.g. [{ userId: "abc" }]
  console.log("Votes array:", votes);
  console.log("User ID:", userId);
  return votes.some(vote => vote.userId === userId);
}

async function checkIfUserDownvoted(entryId) {
  const userId = getCurrentUserId();
  const downvotes = await getDownvotes(entryId); // e.g. [{ userId: "abc" }]
  console.log("Downvotes array:", downvotes);
  console.log("User ID:", userId);
  return downvotes.some(vote => vote.userId === userId);
}



async function checkAndRemoveEntryIfNeeded(entry, marker) {
  // Get counts from separate tables
  const { data: votesData, error: votesError } = await supabase
    .from('votes')
    .select('id', { count: 'exact' })
    .eq('entry_id', entry.id);

  const { data: downvotesData, error: downvotesError } = await supabase
    .from('downvotes')
    .select('id', { count: 'exact' })
    .eq('entry_id', entry.id);

  if (votesError || downvotesError) {
    console.error('Error fetching vote counts:', votesError || downvotesError);
    return;
  }

  const upvotesCount = votesData.length;
  const downvotesCount = downvotesData.length;

  console.log(`Upvotes: ${upvotesCount}, Downvotes: ${downvotesCount}`);

  if (downvotesCount - upvotesCount >= 20) {
    // Delete entry
    const { error: deleteError } = await supabase
      .from('entries')
      .delete()
      .eq('id', entry.id);

    if (deleteError) {
      console.error('Error deleting entry:', deleteError);
    } else {
      alert('This entry has been removed due to excessive downvotes.');
      marker.closePopup();
      // Optionally remove marker from map or refresh UI here
    }
  }
}


async function refreshMarkerPopup(entry, marker) {
  // Get fresh data
  const { data: freshEntry } = await supabase
    .from('entries')
    .select('*')
    .eq('id', entry.id)
    .single();
  if (!freshEntry) return;

  const userId = getUserId();

  // ✅ Fetch votes
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id')
    .eq('entry_id', entry.id);
  const hasVoted = votes?.some(v => v.user_id === userId) || false;

  // ✅ Fetch joins
  const { data: joins } = await supabase
    .from('joins')
    .select('user_id')
    .eq('entry_id', entry.id);
  const hasJoined = joins?.some(j => j.user_id === userId) || false;

  // ✅ Fetch downvotes (this was missing)
  const { data: downvotes } = await supabase
    .from('downvotes')
    .select('user_id')
    .eq('entry_id', entry.id);
  const downvoteCount = downvotes?.length || 0;
  const hasDownvoted = downvotes?.some(d => d.user_id === userId) || false;

  // ✅ Debug log
  console.log('Popup Counts:', {
    voteCount: votes?.length || 0,
    downvoteCount,
    joinCount: joins?.length || 0,
    hasVoted,
    hasDownvoted
  });

  const popupContent = generatePopupContent(
    freshEntry,
    votes?.length || 0,
    joins?.length || 0,
    hasVoted,
    hasJoined,
    downvoteCount,
    hasDownvoted
  );

  marker.setPopupContent(popupContent);

  // Reattach event listeners
  setTimeout(() => setupPopupInteractions(freshEntry, marker), 0);

  // Restart countdown if needed
  if (freshEntry.campaign) {
    startCountdown(freshEntry, marker);
  }
}


// Vote/Join management
async function toggleVote(entryId) {
  const userId = getUserId();
  const { data } = await supabase.from('votes').select('*').eq('entry_id', entryId).eq('user_id', userId);
  
  if (data?.length) {
    await supabase.from('votes').delete().eq('entry_id', entryId).eq('user_id', userId);
  } else {
    await supabase.from('votes').insert([{ entry_id: entryId, user_id: userId }]);
  }
}

async function toggleDownvote(entryId) {
  const userId = getUserId();
  console.log('toggleDownvote called for entryId:', entryId, 'userId:', userId);

  // Check if user has already downvoted this entry
  const { data, error } = await supabase
    .from('downvotes')
    .select('*')
    .eq('entry_id', entryId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error checking downvotes:', error);
    return;
  }
  console.log('Existing downvotes by user:', data);

  if (data?.length) {
    // User already downvoted — remove downvote
    const { error: delError } = await supabase
      .from('downvotes')
      .delete()
      .eq('entry_id', entryId)
      .eq('user_id', userId);

    if (delError) {
      console.error('Error deleting downvote:', delError);
    } else {
      console.log('Downvote removed');
    }
  } else {
    // User has not downvoted yet — insert downvote
    const { error: insertError } = await supabase
      .from('downvotes')
      .insert([{ entry_id: entryId, user_id: userId }]);

    if (insertError) {
      console.error('Error inserting downvote:', insertError);
    } else {
      console.log('Downvote inserted');
    }
  }
}



async function toggleJoin(entryId) {
  const userId = getUserId();
  const { data } = await supabase.from('joins').select('*').eq('entry_id', entryId).eq('user_id', userId);
  
  if (data?.length) {
    await supabase.from('joins').delete().eq('entry_id', entryId).eq('user_id', userId);
  } else {
    await supabase.from('joins').insert([{ entry_id: entryId, user_id: userId }]);
  }
}

// Campaign functions
function showCampaignForm(entry, marker) {
  const formId = `campaign-form-${entry.id}`;
  const dateId = `campaign-date-${entry.id}`;
  const cancelId = `cancel-campaign-${entry.id}`;
  const groupLinkId = `group-link-${entry.id}`;

  // Create popup container
  const popup = L.DomUtil.create('div');
  popup.innerHTML = `
    <form id="${formId}" class="campaign-form">
      <label for="${dateId}">Schedule Campaign Date & Time:</label><br/>
      <input type="datetime-local" id="${dateId}" required/><br/>

      <label for="${groupLinkId}">Optional Group Link (WhatsApp/Telegram):</label><br/>
      <input type="url" id="${groupLinkId}" placeholder="https://t.me/..." /><br/>

      <div class="form-buttons">
        <button type="submit">Schedule</button>
        <button type="button" id="${cancelId}">Cancel</button>
      </div>
    </form>
  `;

  // Delay opening to allow the popup to attach properly
  setTimeout(() => {
    marker.bindPopup(popup, { closeOnClick: false, autoClose: false }).openPopup();

    const form = document.getElementById(formId);
    const dateInput = document.getElementById(dateId);
    const groupLinkInput = document.getElementById(groupLinkId);
    const cancelBtn = document.getElementById(cancelId);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const campaignDate = dateInput.value;
      const groupLink = groupLinkInput?.value?.trim() || "";

      if (!campaignDate) {
        alert("Please select a date and time");
        return;
      }

      // Optional validation
      if (groupLink &&
          !groupLink.startsWith("https://t.me/") &&
          !groupLink.startsWith("https://chat.whatsapp.com/")) {
        alert("Please enter a valid Telegram or WhatsApp group link.");
        return;
      }

      const formattedDate = formatDateTimeForTimestampWithoutTZ(campaignDate);

      const { data, error } = await supabase
        .from('entries')
        .update({
          campaign: formattedDate,
          group_link: groupLink || null
        })
        .eq('id', entry.id);

      if (error) {
        console.error("Error updating campaign:", error);
        alert("Failed to schedule campaign: " + error.message);
        return;
      }

      refreshMarkerPopup({ ...entry, campaign: formattedDate, group_link: groupLink }, marker);
    };

    cancelBtn.onclick = (e) => {
      e.preventDefault();
      marker.closePopup();
      refreshMarkerPopup(entry, marker);
    };
  }, 50);
}



function startCountdown(entry, marker) {
  const countdownId = `countdown-${entry.id}`;
  const countdownEl = document.getElementById(countdownId);
  if (!countdownEl) return;

  // Find the shape element that is immediately after the countdown div
  const shapeEl = countdownEl.parentElement?.nextElementSibling;

  const campaignDate = new Date(entry.campaign);
  if (isNaN(campaignDate.getTime())) {
    countdownEl.textContent = "Invalid date";
    return;
  }

  let interval;

  function update() {
    const now = new Date();

    const campaignDateOnly = new Date(campaignDate.getFullYear(), campaignDate.getMonth(), campaignDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const isSameDay = campaignDateOnly.getTime() === nowDateOnly.getTime();
    const isPast = campaignDateOnly < nowDateOnly;

    if (isPast) {
      countdownEl.textContent = "Campaign ended";
      if (shapeEl) shapeEl.classList.add('countdown-ended');  // ✅ add class
      clearInterval(interval);
      return;
    }

    if (isSameDay) {
      countdownEl.textContent = "Campaign started!";
      if (shapeEl) shapeEl.classList.add('countdown-ended');  // ✅ add class
      clearInterval(interval);
      return;
    }

    const diff = campaignDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  update();
  interval = setInterval(update, 1000);
  marker.on('popupclose', () => clearInterval(interval));
}




function getColorByCategory(category) {
  const colors = {
    Garbage: '#FF6347',   // tomato red
    Drainage: '#1E90FF',  // dodger blue
    Lighting: '#FFD700',  // gold
    Road: '#134b13ff',      // lime green
    Other: '#808080'      // gray
  };
  return colors[category] || '#000000';  // fallback black
}

function getIconLetter(category) {
  return category && category.length > 0 ? category.charAt(0).toUpperCase() : '?';
}

//Zoom to user location
function zoomToUserLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      map.setView([latitude, longitude], 17);

      // Use a custom PNG icon
      const userIcon = L.icon({
        iconUrl: 'icons/marker/user.png', // 🔁 Update with your icon path
        iconSize: [48, 48],       // width, height
        iconAnchor: [24, 48],     // point of the icon which will correspond to marker's location
        popupAnchor: [0, -48]     // point from which the popup should open relative to the iconAnchor
      });

      // Place marker with icon
      const userMarker = L.marker([latitude, longitude], { icon: userIcon })
        .addTo(map)
        .bindPopup("You are here")
        .openPopup();
    },
    error => {
      console.error("Geolocation error:", error);
      alert("Unable to retrieve your location.");
    }
  );
}


// S T A T I C S

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


// A N A L Y T I C S

async function analyzeNearbyEntries(userLat, userLng, searchRadius = 5) {
  const { data: allEntries, error } = await supabase.from('entries').select('*');
  if (error || !allEntries) {
    console.error("Failed to fetch entries:", error);
    return { nearbyEntries: [] };
  }

  // Step 1: Filter entries by distance
  const nearbyEntries = allEntries
    .map(entry => ({
      ...entry,
      distanceKm: getDistanceKm(userLat, userLng, entry.lat, entry.lng)
    }))
    .filter(entry => entry.distanceKm <= searchRadius);

  const entryIds = nearbyEntries.map(e => e.id);
  if (entryIds.length === 0) return { nearbyEntries };

  // Step 2: Fetch votes and joins
  const [{ data: votes }, { data: joins }] = await Promise.all([
    supabase.from('votes').select('entry_id').in('entry_id', entryIds),
    supabase.from('joins').select('entry_id').in('entry_id', entryIds)
  ]);

  // Step 3: Count votes and joins per entry
  const voteCountMap = {};
  const joinCountMap = {};

  (votes || []).forEach(vote => {
    voteCountMap[vote.entry_id] = (voteCountMap[vote.entry_id] || 0) + 1;
  });

  (joins || []).forEach(join => {
    joinCountMap[join.entry_id] = (joinCountMap[join.entry_id] || 0) + 1;
  });

  // Step 4: Add counts to each entry
  nearbyEntries.forEach(entry => {
    entry.votes = voteCountMap[entry.id] || 0;
    entry.joins = joinCountMap[entry.id] || 0;
  });

  return { nearbyEntries };
}

function sortEntries(entries, criteria = 'distance', direction = 'asc') {
  return [...entries].sort((a, b) => {
    let valA, valB;
    switch(criteria) {
      case 'distance':
        valA = a.distanceKm;
        valB = b.distanceKm;
        break;
      case 'campaignDate':
        valA = a.campaign ? new Date(a.campaign).getTime() : 0;
        valB = b.campaign ? new Date(b.campaign).getTime() : 0;
        break;
      case 'votes':
        valA = Number(a.votes) || 0;
        valB = Number(b.votes) || 0;
        break;
      case 'joins':
        valA = Number(a.joins) || 0;
        valB = Number(b.joins) || 0;
        break;
      default:
        valA = 0; valB = 0;
    }
    return direction === 'asc' ? valA - valB : valB - valA;
  });
}


// Globals for rendering distance inside render function
let userLatGlobal = null;
let userLngGlobal = null;

function renderNearbyEntriesList(entries) {
  const container = document.getElementById('resultsList');
  const chartContainer = document.getElementById('categoryChartContainer');

  if (!entries.length) {
    container.innerHTML = '';
    container.style.display = 'none'; // hide when empty
    if (chartContainer) chartContainer.style.display = 'none';
    return;
  }

  container.style.display = 'block'; // show when there are entries
  container.innerHTML = ''; // clear previous content

  console.log('Entries:', entries);
  console.log('resultsList element:', container);
  console.log('categoryChartContainer element:', chartContainer);

  // Show the chart container only if resultsList is visible and has entries
  if (chartContainer) chartContainer.style.display = 'block';

  // Utility to safely generate icon file name
  const formatIconName = (text) =>
    text?.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '') || 'unknown';

  entries.forEach(e => {
    const campaignDate = e.campaign ? new Date(e.campaign).toLocaleString() : 'N/A';
    const dist = e.distanceKm?.toFixed(2) ?? '0.00';
    const iconUrl = `icons/icons/${formatIconName(e.category)}_${formatIconName(e.status)}.png`;

    container.insertAdjacentHTML('beforeend', `
      <div class="entry-card">
        <div class="entry-header">
          <img src="${iconUrl}" alt="${e.category}" class="entry-icon" />
          <div class="entry-text">
            <div class="entry-title">${e.title || 'Untitled'}</div>
            <div class="entry-type-status-row">
              <div class="entry-category">${e.category || 'N/A'}</div>
              <div class="entry-status">${e.status || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="entry-details">
          <div class="entry-row"><span class="label">Distance:</span> ${dist} km</div>
          <div class="entry-row"><span class="label">Campaign Date:</span> ${campaignDate}</div>

          <div class="entry-stats-row" style="display: flex; justify-content: space-between; align-items: center;">
            <button class="get-directions-btn" onclick="getDirections(${e.lat}, ${e.lng})" style="width: 100px; height: 40px;">
              Directions
            </button>

            <div style="display: flex; gap: 10px;">
              <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                <div class="entry-stat">
                  <div style="display: flex; flex-direction: column; align-items: center; width: 60px; gap: 8px;">
                    <img src="icons/controllers/up_fill.svg" alt="Votes" class="entry-stat-icon" />
                    <div class="entry-stat-number" style="text-align: center;">${e.votes ?? 0} Voted</div>
                  </div>
                </div>

                <div class="entry-stat">
                  <div style="display: flex; flex-direction: column; align-items: center; width: 60px; gap: 8px;">
                    <img src="icons/controllers/joined.svg" alt="Joins" class="entry-stat-icon" />
                    <div class="entry-stat-number" style="text-align: center;">${e.joins ?? 0} Joined</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
  });
}






let searchRadiusCircle;  // global variable to keep track of existing circle

document.getElementById('searchSortBtn').addEventListener('click', async () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async position => {
    userLatGlobal = position.coords.latitude;
    userLngGlobal = position.coords.longitude;

    const radiusMeters = Number(document.getElementById('searchRadius').value) || 1000;
    const criteria = document.getElementById('sortCriteria').value || 'distance';
    const direction = document.getElementById('sortDirection').value || 'asc';

    const analysis = await analyzeNearbyEntries(userLatGlobal, userLngGlobal, radiusMeters / 1000);

    if (!analysis.nearbyEntries.length) {
      document.getElementById('resultsList').innerHTML = '<p>No nearby entries found.</p>';
      return;
    }

    // Remove existing circle if present
    if (searchRadiusCircle) {
      map.removeLayer(searchRadiusCircle);
    }

    // Add circle with radius (in meters)
    searchRadiusCircle = L.circle([userLatGlobal, userLngGlobal], {
      radius: radiusMeters,  // convert km to meters
      color: '#405c78',
      fillColor: '#aaddff98',
      fillOpacity: 0.3,
      weight: 2,
    }).addTo(map);

    // Optionally zoom map to fit the circle
    map.fitBounds(searchRadiusCircle.getBounds());

    // Sort and render entries
    const sorted = sortEntries(analysis.nearbyEntries, criteria, direction);
    renderNearbyEntriesList(sorted);

    // Aggregate counts by category for chart
    const categoryCounts = getCategoryCounts(analysis.nearbyEntries);
    console.log('Nearby Category Counts:', categoryCounts);

    // Render the category chart with aggregated data
    renderCategoryChart(categoryCounts, analysis.nearbyEntries.length > 0);

  }, () => {
    alert('Allow location access.');
  });
});



// C H A R T

// Given an array of entries with a category property
function getCategoryCounts(entries) {
  const counts = {};
  entries.forEach(entry => {
    const cat = entry.category || 'Unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  return Object.entries(counts).map(([category, count]) => ({ category, count }));
}


let categoryChartInstance = null;


function renderCategoryChart(categoriesData, hasNearbyEntries = true) {
  const chartWrapper = document.getElementById('categoryChartContainer');
  const chartContainer = document.getElementById('categoryChart');
  const searchContainer = document.getElementById('search-sort-container');

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  // If no categories OR no nearby entries, hide the chart section
  if (!categoriesData || categoriesData.length === 0 || !hasNearbyEntries) {
    chartWrapper.style.display = 'none';
    return;
  }

  chartWrapper.style.display = 'block';
  searchContainer.style.bottom = '10px'; // Reset search container position

  const labels = categoriesData.map(item => item.category);
  const counts = categoriesData.map(item => item.count);

  const options = {
    chart: {
      type: 'bar',
      height: 200,
      fontFamily: 'Montserrat, sans-serif',
      toolbar: { show: false },
    },
    series: [{
      name: 'Entries',
      data: counts,
    }],
    xaxis: {
      categories: labels,
      labels: {
        style: {
          colors: '#333',
          fontSize: '12px',
        }
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#333',
          fontSize: '12px',
        },
      },
      min: 0,
      tickAmount: Math.max(...counts),
    },
    title: {
      text: 'Entries by Category',
      align: 'center',
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#222',
      }
    },
    plotOptions: {
      bar: {
        columnWidth: '50%',
      }
    },
    colors: ['#405c78'],
    legend: { show: false },
    dataLabels: { enabled: false },
  };

  categoryChartInstance = new ApexCharts(chartContainer, options);
  categoryChartInstance.render();
}




map.on('click', (e) => {
  map.closePopup();
  if (!isSelectingLocation) return;

  selectedLatLng = e.latlng;

  removeMapAlertPopup();
  map.getContainer().classList.remove('crosshair-cursor');

  if (marker) {
    map.removeLayer(marker);
  }

  // Use the same PNG icon as in zoomToUserLocation
  const userIcon = L.icon({
    iconUrl: 'icons/marker/add.png', // 👈 your PNG file path
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48]
  });

  marker = L.marker(selectedLatLng, { icon: userIcon }).addTo(map);

  isSelectingLocation = false;

  const resetLocationBtn = document.getElementById('resetLocationBtn');
    if (resetLocationBtn) {
      resetLocationBtn.disabled = false;
    }

});

let routeLayer;


async function getDirections(destLat, destLng) {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async position => {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    const apiKey = '5b3ce3597851110001cf624839053cd92947495491b25793c37972ec'; // Replace this!
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordinates: [
            [userLng, userLat],   // from
            [destLng, destLat]    // to
          ]
        })
      });

      if (!response.ok) throw new Error('Failed to fetch route');

      const data = await response.json();
      const route = data.features[0];



      // Fit map to route
      const coords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [350, 350] });

      // Remove existing route
      if (routeLayer) {
        map.removeLayer(routeLayer);
      }

      // Draw route
      routeLayer = L.geoJSON(route, {
        style: {
          color: '#405c78',
          weight: 5,
          opacity: 0.8
        }
      }).addTo(map);

      // Add markers
      //L.marker([userLat, userLng]).addTo(map).bindPopup("You").openPopup();
      //L.marker([destLat, destLng]).addTo(map).bindPopup("Destination");

    } catch (err) {
      console.error(err);
      alert('Could not get route.');
    }
  }, () => {
    alert('Location access denied.');
  });
}


const categories = ["Garbage", "Drainage", "Lighting", "Road", "Other"];
const categoryVisibility = {};
const allMarkers = [];

categories.forEach(cat => categoryVisibility[cat] = true);

const legendContainer = document.getElementById("legendItems");

categories.forEach(category => {
  const icon = document.createElement("img");
  icon.src = `icons/legend/${category.toLowerCase()}.png`; // Change path as needed
  icon.alt = category;
  icon.title = category;
  icon.className = "legend-icon active"; // active = fully visible

  icon.addEventListener("click", () => {
    // Toggle state
    categoryVisibility[category] = !categoryVisibility[category];

    // Toggle class for visual feedback
    icon.classList.toggle("active", categoryVisibility[category]);
    icon.classList.toggle("inactive", !categoryVisibility[category]);

    updateMarkerVisibility();
  });

  legendContainer.appendChild(icon);
});



function updateMarkerVisibility() {
  allMarkers.forEach(markerObj => {
    const { marker, category } = markerObj;
    if (categoryVisibility[category]) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });
}


document.getElementById('startTutorialBtn').addEventListener('click', () => {
  introJs().start();
});

// Run tutorial automatically only if not shown before
if (!localStorage.getItem('tutorialShown')) {
  introJs()
    .onbeforechange(() => {
      document.body.classList.add('tutorial-active');
    })
    .onexit(() => {
      document.body.classList.remove('tutorial-active');
      // Mark tutorial as shown when user exits
      localStorage.setItem('tutorialShown', 'true');
    })
    .start();
}


 function startPopupTutorialWithNearbyEntry(entries, markers, map) {
  if (localStorage.getItem('popupTutorialShown')) return;

  if (!Array.isArray(entries) || entries.length === 0) return;

  localStorage.setItem('popupTutorialShown', 'true');

  const firstEntry = entries[0];
  const marker = markers[firstEntry.id];

  if (!marker) return;

  map.setView([firstEntry.lat, firstEntry.lng], 16);
  marker.openPopup();

  setTimeout(() => {
    const popupContent = document.querySelector('.leaflet-popup-content');
    if (popupContent) {
      popupContent.setAttribute('data-intro', 'This is a detailed report. It shows information about a nearby issue.');
      popupContent.setAttribute('data-step', '2');

      introJs().start();
    }
  }, 500); // wait a bit for popup to render
}
