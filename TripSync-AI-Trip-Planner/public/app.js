// TripSync - Main Application JavaScript

// Global state
let tripDays = 0;
let itinerarySlots = {}; // { "day1-morning": placeData, ... }
let currentModalPlace = null;

// Form submission handler
document.getElementById('tripForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const output = document.getElementById('output');
    const errorEl = document.getElementById('error');

    // Collect selected preferences
    const preferencesCheckboxes = document.querySelectorAll('input[name="preferences"]:checked');
    const preferences = Array.from(preferencesCheckboxes).map(cb => cb.value);

    const formData = {
        source: document.getElementById('source').value,
        destination: document.getElementById('destination').value,
        budget: document.getElementById('budget').value,
        people: parseInt(document.getElementById('people').value),
        days: parseInt(document.getElementById('days').value),
        transport: document.getElementById('transport').value,
        preferences: preferences
    };

    // Store days for itinerary builder
    tripDays = formData.days;

    // Disable button and clear previous output
    submitBtn.disabled = true;
    submitBtn.textContent = 'Planning your trip...';
    output.innerHTML = '<div class="loading-skeleton"></div><div class="loading-skeleton" style="width: 80%"></div><div class="loading-skeleton" style="width: 60%"></div>';
    errorEl.style.display = 'none';

    try {
        const response = await fetch('/api/plan-trip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();

            // Check for Structured Validation Error
            if (error.details && error.suggestions) {
                showValidationModal(error);
                throw new Error("Validation Failed"); // Stop execution but don't show generic error
            }

            throw new Error(error.message || 'Failed to plan trip');
        }

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        output.innerHTML = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // Display with typing effect
            output.innerHTML = `<div class="chat-message">${escapeHtml(fullText)}<span class="typing-cursor"></span></div>`;
            document.getElementById('outputSection').scrollTop = document.getElementById('outputSection').scrollHeight;
        }

        // Remove cursor after done
        output.innerHTML = `<div class="chat-message">${escapeHtml(fullText)}</div>`;

        // Load the map after itinerary is generated
        loadMap(formData.source, formData.destination);

        // Initialize itinerary builder
        initializeItineraryBuilder(tripDays);

    } catch (error) {
        if (error.message !== "Validation Failed") {
            errorEl.textContent = '❌ Error: ' + error.message;
            errorEl.style.display = 'block';
        }
        output.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Your personalized trip plan will appear here...</p>';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Itinerary ✨';
    }
});

// Load map with route and markers
let mapplsSdkLoaded = false;

async function loadMapplsSdk(accessToken) {
    if (mapplsSdkLoaded) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://apis.mappls.com/advancedmaps/api/${accessToken}/map_sdk?layer=vector&v=3.0`;
        script.onload = () => {
            mapplsSdkLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Mappls SDK'));
        document.head.appendChild(script);
    });
}

async function loadMap(source, destination) {
    const mapSection = document.getElementById('mapSection');
    const mapContainer = document.getElementById('mapContainer');

    try {
        mapContainer.innerHTML = '<div class="map-loading">Loading map...</div>';
        mapSection.classList.add('visible');

        // Fetch map data from our API
        const response = await fetch('/api/map-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination })
        });

        if (!response.ok) {
            throw new Error('Failed to load map data');
        }

        const mapData = await response.json();

        if (mapData.error) {
            mapContainer.innerHTML = `<div class="map-loading" style="color: var(--warning);">⚠️ ${mapData.error}</div>`;
            return;
        }

        // Load Mappls SDK with the access token
        await loadMapplsSdk(mapData.accessToken);

        // Clear loading message
        mapContainer.innerHTML = '';

        // Initialize Mappls map
        const map = new mappls.Map('mapContainer', {
            center: [mapData.destination.lat, mapData.destination.lng],
            zoom: 7,
            zoomControl: true,
            hybrid: false
        });

        // Wait for map to load
        map.on('load', () => {
            // Add source marker (green)
            if (mapData.source) {
                new mappls.Marker({
                    map: map,
                    position: { lat: mapData.source.lat, lng: mapData.source.lng },
                    fitbounds: true,
                    popupHtml: `<div><b>🟢 Start:</b> ${mapData.source.name}</div>`
                });
            }

            // Add destination marker (red)
            if (mapData.destination) {
                new mappls.Marker({
                    map: map,
                    position: { lat: mapData.destination.lat, lng: mapData.destination.lng },
                    fitbounds: true,
                    popupHtml: `<div><b>🔴 Destination:</b> ${mapData.destination.name}</div>`
                });
            }

            // Add route polyline if available
            if (mapData.route && mapData.route.geometry) {
                try {
                    mappls.Polyline({
                        map: map,
                        path: mapData.route.geometry,
                        strokeColor: '#f97316',
                        strokeWeight: 4,
                        strokeOpacity: 0.8,
                        fitbounds: true
                    });
                } catch (e) {
                    console.log('Could not draw route polyline:', e);
                }
            }

            // Store markers for interaction
            const placeMarkers = [];

            // Add place markers with enhanced popups
            if (mapData.places && mapData.places.length > 0) {
                mapData.places.forEach((place, index) => {
                    // Generate a placeholder image URL based on place type
                    const imageUrl = getPlaceImage(place.type || 'POI', place.name);

                    const popupHtml = `
                        <div class="custom-popup">
                            <img src="${imageUrl}" alt="${place.name}" class="popup-image" onerror="this.style.display='none'">
                            <div class="popup-content">
                                <h4>📍 ${place.name}</h4>
                                <p>${place.address || 'Near ' + mapData.destination.name}</p>
                            </div>
                        </div>
                    `;

                    if (place.lat && place.lng) {
                        const marker = new mappls.Marker({
                            map: map,
                            position: { lat: place.lat, lng: place.lng },
                            popupHtml: popupHtml
                        });
                        placeMarkers.push({ marker, place, index });
                    }
                });
            }

            // Populate places grid with photo cards
            renderPlacesGrid(mapData.places, mapData.destination.name, map, placeMarkers);

            // Fit map to show all markers
            if (mapData.source && mapData.destination) {
                const bounds = [
                    [mapData.source.lat, mapData.source.lng],
                    [mapData.destination.lat, mapData.destination.lng]
                ];
                map.fitBounds(bounds, { padding: 50 });
            }
        });

    } catch (error) {
        console.error('Map loading error:', error);
        mapContainer.innerHTML = `<div class="map-loading" style="color: var(--danger);">⚠️ Could not load map: ${error.message}</div>`;
    }
}

// Generate beautiful gradient placeholder images with icons (no external dependencies)
function getPlaceImage(type, name, destinationName = '') {
    // Color gradients based on place type
    const gradients = {
        'POI': ['#667eea', '#764ba2'],
        'WATERFALL': ['#11998e', '#38ef7d'],
        'TEMPLE': ['#f12711', '#f5af19'],
        'BEACH': ['#00c6ff', '#0072ff'],
        'PARK': ['#56ab2f', '#a8e063'],
        'MUSEUM': ['#8e2de2', '#4a00e0'],
        'FORT': ['#c94b4b', '#4b134f'],
        'GARDEN': ['#11998e', '#38ef7d'],
        'LAKE': ['#1488cc', '#2b32b2'],
        'MOUNTAIN': ['#536976', '#292e49'],
        'CHURCH': ['#a770ef', '#cf8bf3'],
        'MONUMENT': ['#f46b45', '#eea849']
    };

    // Emoji icons for each type
    const icons = {
        'POI': '📍',
        'WATERFALL': '💧',
        'TEMPLE': '🛕',
        'BEACH': '🏖️',
        'PARK': '🌳',
        'MUSEUM': '🏛️',
        'FORT': '🏰',
        'GARDEN': '🌺',
        'LAKE': '🌊',
        'MOUNTAIN': '⛰️',
        'CHURCH': '⛪',
        'MONUMENT': '🗿'
    };

    const [color1, color2] = gradients[type] || ['#667eea', '#764ba2'];
    const icon = icons[type] || '📍';

    // Create SVG with gradient background and icon
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#grad)"/>
            <text x="200" y="160" font-size="64" text-anchor="middle" dominant-baseline="middle">${icon}</text>
        </svg>
    `;

    // Convert to data URL
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Render places grid with photo cards (draggable)
function renderPlacesGrid(places, destinationName, map, placeMarkers) {
    const placesGrid = document.getElementById('placesGrid');

    if (!places || places.length === 0) {
        placesGrid.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No places found nearby</p>';
        return;
    }

    // Render with placeholder images and draggable attribute
    placesGrid.innerHTML = places.map((place, index) => {
        const placeholderUrl = getPlaceImage(place.type || 'POI', place.name);
        return `
            <div class="place-card" 
                 data-index="${index}" 
                 data-name="${escapeHtml(place.name)}"
                 draggable="true"
                 onclick="openPlaceModal(${index})"
                 ondragstart="handleDragStart(event, ${index})"
                 ondragend="handleDragEnd(event)">
                <img src="${placeholderUrl}" alt="${place.name}" loading="lazy" class="place-img">
                <div class="place-card-content">
                    <h4>${place.name}</h4>
                    <p>${place.address || 'Near ' + destinationName}</p>
                </div>
            </div>
        `;
    }).join('');

    // Store map and markers globally for click handling
    window.tripMap = map;
    window.placeMarkers = placeMarkers;
    window.placesData = places;
    window.destinationName = destinationName;

    // Fetch real images asynchronously
    fetchPlaceImages(places, destinationName);
}

// Fetch real images for places from the API
async function fetchPlaceImages(places, destination) {
    try {
        const response = await fetch('/api/place-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                places: places.map(p => ({ name: p.name })),
                destination
            })
        });

        if (!response.ok) {
            console.log('Could not fetch place images, using placeholders');
            return;
        }

        const data = await response.json();
        const imageMap = data.images || {};

        // Store image map globally for modal use
        window.placeImages = imageMap;

        // Update each place card with the real image
        Object.entries(imageMap).forEach(([placeName, imageUrl]) => {
            if (imageUrl) {
                const card = document.querySelector(`.place-card[data-name="${escapeHtml(placeName)}"]`);
                if (card) {
                    const img = card.querySelector('.place-img');
                    if (img) {
                        // Create a new image to preload
                        const newImg = new Image();
                        newImg.onload = () => {
                            img.style.transition = 'opacity 0.3s ease';
                            img.style.opacity = '0';
                            setTimeout(() => {
                                img.src = imageUrl;
                                img.style.opacity = '1';
                            }, 150);
                        };
                        newImg.onerror = () => {
                            console.log(`Failed to load image for ${placeName}`);
                        };
                        newImg.src = imageUrl;
                    }
                }
            }
        });

        console.log(`Updated ${Object.keys(imageMap).filter(k => imageMap[k]).length} place images`);
    } catch (error) {
        console.error('Error fetching place images:', error);
    }
}

// =====================
// Place Details Modal
// =====================
function openPlaceModal(index) {
    const place = window.placesData[index];
    if (!place) return;

    currentModalPlace = { ...place, index };

    // Get image (real or placeholder)
    const imageUrl = (window.placeImages && window.placeImages[place.name])
        || getPlaceImage(place.type || 'POI', place.name);

    // Update modal content
    document.getElementById('modalImage').src = imageUrl;
    document.getElementById('modalTitle').textContent = place.name;
    document.getElementById('modalAddressText').textContent = place.address || `Near ${window.destinationName}`;

    // Generate day buttons
    const actionsContainer = document.getElementById('modalActions');
    const timeSlots = ['Morning', 'Afternoon', 'Evening'];
    let buttonsHtml = '';

    for (let day = 1; day <= tripDays; day++) {
        timeSlots.forEach(slot => {
            buttonsHtml += `<button class="day-btn" onclick="addToSlot(${day}, '${slot.toLowerCase()}')">${slot} Day ${day}</button>`;
        });
    }
    actionsContainer.innerHTML = buttonsHtml;

    // Show modal
    document.getElementById('placeModal').classList.add('active');
}

function closePlaceModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('placeModal').classList.remove('active');
    currentModalPlace = null;
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePlaceModal();
    }
});

// =====================
// Itinerary Builder
// =====================
function initializeItineraryBuilder(days) {
    const builder = document.getElementById('itineraryBuilder');
    const container = document.getElementById('daysContainer');

    // Reset slots
    itinerarySlots = {};

    // Generate day columns
    let html = '';
    const timeSlots = ['morning', 'afternoon', 'evening'];
    const timeLabels = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌙 Evening' };

    for (let day = 1; day <= days; day++) {
        html += `
            <div class="day-column">
                <div class="day-header">Day ${day}</div>
                ${timeSlots.map(slot => `
                    <div class="time-slot" 
                         id="slot-day${day}-${slot}"
                         data-day="${day}" 
                         data-slot="${slot}"
                         ondragover="handleDragOver(event)"
                         ondragleave="handleDragLeave(event)"
                         ondrop="handleDrop(event, ${day}, '${slot}')">
                        <div class="time-slot-header">${timeLabels[slot]}</div>
                        <div class="time-slot-content">
                            <div class="time-slot-empty">Drop a place here</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
    builder.classList.add('visible');
}

// Add place to slot from modal
function addToSlot(day, slot) {
    if (!currentModalPlace) return;

    const slotKey = `day${day}-${slot}`;
    addPlaceToSlot(slotKey, currentModalPlace);
    closePlaceModal();
}

// Add place to a specific slot
function addPlaceToSlot(slotKey, place) {
    const slotElement = document.getElementById(`slot-${slotKey}`);
    if (!slotElement) return;

    // Get image
    const imageUrl = (window.placeImages && window.placeImages[place.name])
        || getPlaceImage(place.type || 'POI', place.name);

    // Update slot content
    const content = slotElement.querySelector('.time-slot-content');
    content.innerHTML = `
        <div class="slot-place" data-place-index="${place.index}">
            <img src="${imageUrl}" alt="${place.name}">
            <div class="slot-place-info">
                <div class="slot-place-name">${place.name}</div>
                <div class="slot-place-address">${place.address || 'Near ' + window.destinationName}</div>
            </div>
            <button class="slot-remove" onclick="removeFromSlot('${slotKey}')" title="Remove">✕</button>
        </div>
    `;

    // Store in itinerary slots (for swap functionality)
    itinerarySlots[slotKey] = { ...place, imageUrl };
}

// Remove place from slot
function removeFromSlot(slotKey) {
    const slotElement = document.getElementById(`slot-${slotKey}`);
    if (!slotElement) return;

    // Reset slot content
    const content = slotElement.querySelector('.time-slot-content');
    content.innerHTML = '<div class="time-slot-empty">Drop a place here</div>';

    // Remove from stored slots
    delete itinerarySlots[slotKey];
}

// =====================
// Drag and Drop
// =====================
let draggedPlaceIndex = null;
let draggedFromSlot = null;

function handleDragStart(event, index) {
    draggedPlaceIndex = index;
    draggedFromSlot = null;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index);
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedPlaceIndex = null;
    draggedFromSlot = null;

    // Remove all drag-over states
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('drag-over');
    });
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event, day, slot) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const slotKey = `day${day}-${slot}`;

    if (draggedPlaceIndex !== null) {
        const place = window.placesData[draggedPlaceIndex];
        if (place) {
            // Check if slot is occupied - swap if so
            const existingPlace = itinerarySlots[slotKey];
            if (existingPlace && draggedFromSlot) {
                // Swap: put existing place in the source slot
                addPlaceToSlot(draggedFromSlot, existingPlace);
            }

            // Add dragged place to this slot
            addPlaceToSlot(slotKey, { ...place, index: draggedPlaceIndex });
        }
    }

    draggedPlaceIndex = null;
    draggedFromSlot = null;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// =====================
// Validation Modal Logic
// =====================
function showValidationModal(errorData) {
    // Create Modal HTML if not exists
    if (!document.getElementById('validationModal')) {
        const modalHtml = `
            <div id="validationModal" class="error-modal">
                <div class="error-modal-content">
                    <h3>⚠️ Trip Not Possible</h3>
                    
                    <div class="error-details">
                        <strong>Logistical Issues Found:</strong>
                        <ul id="valErrorList"></ul>
                    </div>

                    <div class="suggestion-box">
                        <strong>💡 AI Suggestions:</strong>
                        <p id="valSuggestionText"></p>
                    </div>

                    <button class="error-close-btn" onclick="closeValidationModal()">Okay, I'll Fix It</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Populate Data
    const errorList = document.getElementById('valErrorList');
    errorList.innerHTML = errorData.details.map(msg => `<li>${msg}</li>`).join('');

    const suggestionText = document.getElementById('valSuggestionText');
    let suggestions = [];
    if (errorData.suggestions.min_budget) {
        suggestions.push(`Calculated Minimum Budget: <b>₹${errorData.suggestions.min_budget}</b>`);
    }
    if (errorData.suggestions.reduce_days_to !== undefined && errorData.suggestions.reduce_days_to < errorData.suggestions.days) {
        suggestions.push(`Or reduce trip duration to <b>${errorData.suggestions.reduce_days_to} days</b>`);
    }
    suggestionText.innerHTML = suggestions.join('<br>') || "Please adjust your parameters.";

    // Show Modal
    document.getElementById('validationModal').classList.add('visible');
}

function closeValidationModal() {
    const modal = document.getElementById('validationModal');
    if (modal) {
        modal.classList.remove('visible');
    }
}

