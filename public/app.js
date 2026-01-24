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

    // Budget Validation
    const minPerPersonPerDay = 1500;
    const requiredBudget = minPerPersonPerDay * formData.people * formData.days;

    if (parseInt(formData.budget) < requiredBudget) {
        errorEl.textContent = `Budget too low! For ${formData.people} people over ${formData.days} days, the minimum recommended budget is ₹${requiredBudget} (₹${minPerPersonPerDay}/person/day).`;
        errorEl.style.display = 'block';
        // Shake animation for visual feedback
        errorEl.style.animation = 'none';
        errorEl.offsetHeight; /* trigger reflow */
        errorEl.style.animation = 'shake 0.5s ease-in-out';
        return;
    }

    // Store days for itinerary builder
    tripDays = formData.days;

    // Disable button and show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Planning your trip...';

    // Initial Loading UI
    output.innerHTML = `
        <div class="loading-container">
            <h2 class="section-title" style="text-align: center; margin-bottom: 10px;">Building Your Dream Trip</h2>
            <p style="color: var(--text-muted);">AI is analyzing your preferences...</p>
            <div class="loading-steps">
                <div class="loading-step active" id="step-1">
                    <div class="step-icon">1</div>
                    <div class="step-text">Analyzing travel preferences</div>
                </div>
                <div class="loading-step" id="step-2">
                    <div class="step-icon">2</div>
                    <div class="step-text">Finding best accommodations</div>
                </div>
                <div class="loading-step" id="step-3">
                    <div class="step-icon">3</div>
                    <div class="step-text">Curating local experiences</div>
                </div>
                <div class="loading-step" id="step-4">
                    <div class="step-icon">4</div>
                    <div class="step-text">Finalizing day-wise itinerary</div>
                </div>
            </div>
        </div>
    `;

    // Helper to update steps
    const updateStep = (stepNum) => {
        const prev = document.getElementById(`step-${stepNum - 1}`);
        if (prev) {
            prev.classList.remove('active');
            prev.classList.add('completed');
            prev.querySelector('.step-icon').innerHTML = '✓';
        }

        const current = document.getElementById(`step-${stepNum}`);
        if (current) current.classList.add('active');
    };

    errorEl.style.display = 'none';

    try {
        // Simulate step 1 progress
        await new Promise(r => setTimeout(r, 1500));
        updateStep(2);

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

        // Simulate step 2 completion as data starts arriving
        updateStep(3);

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        // Keep loading UI visible while buffering initial data

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // Once we have a significant amount of data, show step 4
            if (fullText.length > 500 && !document.getElementById('step-4').classList.contains('active')) {
                updateStep(4);
            }
        }

        // Final completion
        updateStep(5); // Mark step 4 as done visually internally if needed, or just proceed
        await new Promise(r => setTimeout(r, 800)); // Small pause to show completion

        // Remove cursor after done
        // Try to parse parsing the final text as JSON for formatted display
        try {
            // Clean up the text - remove markdown code blocks if present
            let cleanText = fullText.trim();

            // Remove ```json and ``` wrapping
            if (cleanText.includes('```')) {
                cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            }

            // Find just the JSON object part (first { to last })
            const start = cleanText.indexOf('{');
            const end = cleanText.lastIndexOf('}');

            if (start !== -1 && end !== -1) {
                cleanText = cleanText.substring(start, end + 1);
                const tripData = JSON.parse(cleanText);

                // If valid JSON, render structured itinerary
                output.innerHTML = renderFormattedItinerary(tripData);

                // Initialize itinerary builder with the parsed data
                if (tripData.days && Array.isArray(tripData.days)) {
                    // Update global tripDays if available in response
                    tripDays = tripData.days.length;
                }
            } else {
                throw new Error("No JSON object found");
            }

        } catch (e) {
            console.log("Response is not valid JSON, showing plain text", e);
            console.log("Raw text:", fullText);
            // Fallback to text display with preserved whitespace
            output.innerHTML = `<div class="chat-message" style="white-space: pre-wrap;">${escapeHtml(fullText)}</div>`;
        }

        // Load the map after itinerary is generated
        loadMap(formData.source, formData.destination);

        // Initialize itinerary builder
        initializeItineraryBuilder(tripDays);

    } catch (error) {
        errorEl.textContent = '❌ Error: ' + error.message;
        errorEl.style.display = 'block';
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
            center: [mapData.destination.lng, mapData.destination.lat],
            zoom: 10,
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
                    // Check if geometry is encoded string (Google/OSRM format)
                    let path = mapData.route.geometry;
                    if (typeof path === 'string') {
                        path = decodePolyline(path);
                    }

                    // Ensure path is in [{lat, lng}] format for Mappls
                    const mapplsPath = Array.isArray(path) && Array.isArray(path[0])
                        ? path.map(p => ({ lat: p[0], lng: p[1] })) // Convert [lat, lng] to object
                        : path;

                    mappls.Polyline({
                        map: map,
                        path: mapplsPath,
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
                    [mapData.source.lng, mapData.source.lat],
                    [mapData.destination.lng, mapData.destination.lat]
                ];
                map.fitBounds(bounds, { padding: 50 });
            }
        });

    } catch (error) {
        console.error('Map loading error:', error);
        mapContainer.innerHTML = `<div class="map-loading" style="color: var(--danger);">⚠️ Could not load map: ${error.message}</div>`;
    }
}

// Decode Google/OSRM encoded polyline string
function decodePolyline(str, precision) {
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision || 5);

    // Coordinates have variable length when encoded, so just keep
    // track of whether we've hit the end of the string. In each
    // loop iteration, a single coordinate is decoded.
    while (index < str.length) {

        // Reset shift, result, and byte
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
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
    if (!text) return text;
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderFormattedItinerary(data) {
    if (!data.overview || !data.days) return `<div class="chat-message">${escapeHtml(JSON.stringify(data, null, 2))}</div>`;

    return `
        <div class="itinerary-container">
            <!-- Overview Card -->
            <div class="overview-card">
                <div class="overview-header">
                    <h2 class="overview-title">${escapeHtml(data.overview.title)}</h2>
                    <div class="overview-vibe">"${escapeHtml(data.overview.vibe)}"</div>
                    <div class="highlights-container">
                        ${data.overview.highlights.map(h => `<span class="highlight-tag">✨ ${escapeHtml(h)}</span>`).join('')}
                    </div>
                </div>
                <div class="transport-details" style="justify-content: center; gap: 20px;">
                    <div>
                        <strong>🚆 Transport:</strong> ${escapeHtml(data.transportation.mode)}
                    </div>
                    <div>
                        <strong>💰 Estimated:</strong> ${escapeHtml(data.transportation.cost)}
                    </div>
                </div>
            </div>

            <!-- Day by Day -->
            <div class="days-container" style="display: block; overflow: visible;">
                <h3 class="section-title">📅 Day-by-Day Itinerary</h3>
                ${data.days.map((day, index) => renderDayCard(day, index)).join('')}
            </div>

            <!-- Budget Breakdown -->
            <div class="budget-card">
                <h3 class="section-title">💰 Budget Breakdown</h3>
                <div class="budget-grid">
                    <div class="budget-item">
                        <div class="budget-icon">🏨</div>
                        <div class="budget-category">Accommodation</div>
                        <div class="budget-amount">${escapeHtml(data.budget.accommodation)}</div>
                    </div>
                    <div class="budget-item">
                        <div class="budget-icon">🍽️</div>
                        <div class="budget-category">Food & Dining</div>
                        <div class="budget-amount">${escapeHtml(data.budget.food)}</div>
                    </div>
                    <div class="budget-item">
                        <div class="budget-icon">🚆</div>
                        <div class="budget-category">Transport</div>
                        <div class="budget-amount">${escapeHtml(data.budget.transportation)}</div>
                    </div>
                    <div class="budget-item">
                        <div class="budget-icon">🎟️</div>
                        <div class="budget-category">Activities</div>
                        <div class="budget-amount">${escapeHtml(data.budget.activities)}</div>
                    </div>
                    <div class="budget-item">
                        <div class="budget-icon">🛍️</div>
                        <div class="budget-category">Misc</div>
                        <div class="budget-amount">${escapeHtml(data.budget.miscellaneous)}</div>
                    </div>
                    <div class="budget-item budget-total">
                        <div class="budget-category">Total Estimated Cost</div>
                        <div class="budget-amount">${escapeHtml(data.budget.total)}</div>
                    </div>
                </div>
            </div>

            <!-- Tips -->
            <div class="tips-card">
                <h3 class="section-title">💡 Pro Tips</h3>
                <div class="tips-grid">
                    ${data.tips.map(tip => `
                        <div class="tip-card-item">
                            <div class="tip-icon">✨</div>
                            <div class="tip-content">${escapeHtml(tip)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderDayCard(day, index) {
    const isFirstDay = index === 0;
    return `
        <div class="day-card ${isFirstDay ? 'active' : ''}" id="day-card-${index}">
            <div class="day-header" onclick="toggleDay(${index})">
                <span class="day-title">
                    <span style="background: var(--accent); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px;">${day.day}</span>
                    ${escapeHtml(day.title)}
                </span>
                <div class="day-toggle-icon">▼</div>
            </div>
            
            <div class="day-content">
                <div class="timeline-container">
                    ${renderTimeBlock(day.morning, 'Morning', 'morning')}
                    ${renderTimeBlock(day.afternoon, 'Afternoon', 'afternoon')}
                    ${renderTimeBlock(day.evening, 'Evening', 'evening')}
                </div>
            </div>
        </div>
    `;
}

function renderTimeBlock(activity, label, className) {
    if (!activity) return '';
    return `
        <div class="time-block ${className}">
            <div class="timeline-dot"></div>
            <div class="time-label">${label}</div>
            
            <div class="activity-header">
                <div class="activity-title">${escapeHtml(activity.activity)}</div>
                <div class="activity-cost-badge">${escapeHtml(activity.cost)}</div>
            </div>
            
            <div class="activity-meta">
                <div class="meta-item">📍 ${escapeHtml(activity.place)}</div>
            </div>
            
            <div class="activity-tip-box">
                <strong>💡 Tip:</strong> ${escapeHtml(activity.tip)}
            </div>
        </div>
    `;
}

// Toggle day accordion
function toggleDay(index) {
    const card = document.getElementById(`day-card-${index}`);
    if (card) {
        card.classList.toggle('active');
    }
}
window.toggleDay = toggleDay;



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
