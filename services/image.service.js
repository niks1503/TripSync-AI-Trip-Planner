/**
 * Image Service - Fetches real photos for places using Google Places API
 */

// Simple in-memory cache to reduce API calls
const imageCache = new Map();

/**
 * Fetch image for a place using Google Places API
 * @param {string} placeName - Name of the place
 * @param {string} destination - Destination city for context
 * @returns {Promise<string|null>} - Image URL or null
 */
export async function getPlaceImageFromGoogle(placeName, destination) {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

    if (!GOOGLE_API_KEY) {
        console.log('Google API key not configured');
        return null;
    }

    const cacheKey = `google:${placeName}:${destination}`;
    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
    }

    try {
        // Search for the place using Text Search
        const searchQuery = encodeURIComponent(`${placeName} ${destination} India tourist`);
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${GOOGLE_API_KEY}`;

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.status !== 'OK' || !searchData.results || searchData.results.length === 0) {
            console.log(`No Google Places results for: ${placeName}`);
            return null;
        }

        const place = searchData.results[0];

        // Check if the place has photos
        if (!place.photos || place.photos.length === 0) {
            console.log(`No photos available for: ${placeName}`);
            return null;
        }

        // Get the photo URL using the photo_reference
        const photoReference = place.photos[0].photo_reference;
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;

        // Cache and return the photo URL
        imageCache.set(cacheKey, photoUrl);
        console.log(`✓ Found Google image for: ${placeName}`);
        return photoUrl;

    } catch (error) {
        console.error('Error fetching Google Places image:', error.message);
        return null;
    }
}

/**
 * Fetch images for multiple places in parallel
 * @param {Array<{name: string}>} places - Array of place objects
 * @param {string} destination - Destination city
 * @returns {Promise<Object>} - Object mapping place names to image URLs
 */
export async function getPlaceImages(places, destination) {
    const imagePromises = places.map(async (place) => {
        const imageUrl = await getPlaceImageFromGoogle(place.name, destination);
        return { name: place.name, imageUrl };
    });

    const results = await Promise.all(imagePromises);

    // Convert to object for easy lookup
    const imageMap = {};
    results.forEach(({ name, imageUrl }) => {
        imageMap[name] = imageUrl;
    });

    return imageMap;
}
