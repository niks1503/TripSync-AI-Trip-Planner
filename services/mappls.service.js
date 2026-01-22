import axios from "axios";

// Token cache
let cachedToken = null;
let tokenExpiry = null;

/**
 * Get OAuth2 access token from Mappls API
 * Token is cached for 23 hours (expires in 24h)
 */
export async function getAccessToken() {
    // Return cached token if still valid
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const response = await axios.post(
            "https://outpost.mappls.com/api/security/oauth/token",
            new URLSearchParams({
                grant_type: "client_credentials",
                client_id: process.env.MAPPLS_CLIENT_ID,
                client_secret: process.env.MAPPLS_CLIENT_SECRET
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        cachedToken = response.data.access_token;
        // Cache for 23 hours (token expires in 24h)
        tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

        console.log("Mappls token generated successfully");
        return cachedToken;
    } catch (error) {
        console.error("Error getting Mappls access token:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with Mappls");
    }
}

/**
 * Geocode a location name to coordinates using Geoapify API
 * (Mappls geocode doesn't return lat/lng directly, so we use Geoapify)
 */
export async function geocode(location) {
    try {
        const GEOAPIFY_API_KEY = process.env.PLACES_API_KEY;
        const response = await axios.get(
            `https://api.geoapify.com/v1/geocode/search`,
            {
                params: {
                    text: location,
                    apiKey: GEOAPIFY_API_KEY,
                    limit: 1
                }
            }
        );

        if (response.data.features && response.data.features.length > 0) {
            const feature = response.data.features[0];
            return {
                lat: feature.properties.lat,
                lng: feature.properties.lon,
                name: feature.properties.formatted || location
            };
        }

        throw new Error("Geoapify returned no results");
    } catch (error) {
        console.log(`Geoapify failed for ${location}, trying Nominatim fallback...`);
        try {
            // Fallback to Nominatim (OpenStreetMap)
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/search`,
                {
                    params: {
                        q: location,
                        format: 'json',
                        limit: 1
                    },
                    headers: {
                        'User-Agent': 'TripPlannerApp/1.0'
                    }
                }
            );

            if (response.data && response.data.length > 0) {
                const feature = response.data[0];
                return {
                    lat: parseFloat(feature.lat),
                    lng: parseFloat(feature.lon),
                    name: feature.display_name || location
                };
            }
        } catch (nominatimError) {
            console.error("Nominatim fallback also failed:", nominatimError.message);
        }

        console.error("Geocoding failed for:", location, error.message);
        return null; // Both failed
    }
}

/**
 * Get route between source and destination
 * Returns polyline coordinates for map display
 */
export async function getRoute(sourceCoords, destCoords) {
    try {
        const token = await getAccessToken();

        // Mappls Directions API
        const response = await axios.get(
            `https://apis.mappls.com/advancedmaps/v1/${token}/route_adv/driving/${sourceCoords.lng},${sourceCoords.lat};${destCoords.lng},${destCoords.lat}`,
            {
                params: {
                    geometries: "polyline",
                    overview: "full",
                    steps: true
                }
            }
        );

        if (response.data.routes && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            return {
                distance: route.distance, // in meters
                duration: route.duration, // in seconds
                geometry: route.geometry, // encoded polyline
                steps: route.legs?.[0]?.steps || []
            };
        }

        return null;
    } catch (error) {
        console.error("Error getting route:", error.response?.data || error.message);
        return null;
    }
}

/**
 * Get formatted distance and duration between two locations
 */
export async function getDistanceInfo(source, destination) {
    try {
        const [sourceCoords, destCoords] = await Promise.all([
            geocode(source),
            geocode(destination)
        ]);

        if (!sourceCoords || !destCoords) {
            return null;
        }

        const route = await getRoute(sourceCoords, destCoords);

        if (!route) {
            return null;
        }

        // Format distance (meters to km)
        const distanceKm = (route.distance / 1000).toFixed(1);

        // Format duration (seconds to hours and minutes)
        const hours = Math.floor(route.duration / 3600);
        const minutes = Math.floor((route.duration % 3600) / 60);
        const durationStr = hours > 0
            ? `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`
            : `${minutes} minutes`;

        return {
            distanceKm: parseFloat(distanceKm),
            distanceText: `${distanceKm} km`,
            durationSeconds: route.duration,
            durationText: durationStr,
            source: sourceCoords,
            destination: destCoords
        };
    } catch (error) {
        console.error("Error getting distance info:", error);
        return null;
    }
}

/**
 * Search for places/attractions near a location
 */
export async function searchPlaces(lat, lng, query = "tourist attraction", radius = 10000) {
    try {
        const token = await getAccessToken();

        const response = await axios.get(
            `https://atlas.mappls.com/api/places/nearby/json`,
            {
                params: {
                    keywords: query,
                    refLocation: `${lat},${lng}`,
                    radius: radius,
                    page: 1
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (response.data.suggestedLocations) {
            return response.data.suggestedLocations.map(place => ({
                name: place.placeName,
                address: place.placeAddress,
                lat: parseFloat(place.latitude),
                lng: parseFloat(place.longitude),
                type: place.type,
                eLoc: place.eLoc
            }));
        }

        return [];
    } catch (error) {
        console.error("Error searching places:", error.response?.data || error.message);
        return [];
    }
}

/**
 * Get complete map data for a trip
 */
export async function getMapData(source, destination) {
    try {
        // Geocode source and destination
        const [sourceCoords, destCoords] = await Promise.all([
            geocode(source),
            geocode(destination)
        ]);

        if (!sourceCoords || !destCoords) {
            return {
                error: "Could not geocode source or destination",
                source: sourceCoords,
                destination: destCoords
            };
        }

        // Get route and nearby places in parallel
        const [route, places] = await Promise.all([
            getRoute(sourceCoords, destCoords),
            searchPlaces(destCoords.lat, destCoords.lng)
        ]);

        return {
            source: sourceCoords,
            destination: destCoords,
            route: route,
            places: places.slice(0, 10) // Limit to 10 places
        };
    } catch (error) {
        console.error("Error getting map data:", error);
        return { error: error.message };
    }
}
