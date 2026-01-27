import { geocode, searchPlaces } from "./mappls.service.js";

export const getPlacesByLocation = async (lat, lon, radius = 5000, category = "tourism") => {
  try {
    const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || process.env.PLACES_API_KEY;
    
    if (!GEOAPIFY_API_KEY) {
      console.error("❌ GEOAPIFY_API_KEY not configured in .env");
      return [];
    }

    // Calculate bounding box from center point and radius
    const latOffset = radius / 111000; // 1 degree latitude ≈ 111 km
    const lonOffset = (radius / 111000) / Math.cos((lat * Math.PI) / 180);

    const minLat = lat - latOffset;
    const maxLat = lat + latOffset;
    const minLon = lon - lonOffset;
    const maxLon = lon + lonOffset;

    const filter = `rect:${minLon},${minLat},${maxLon},${maxLat}`;

    const url = `https://api.geoapify.com/v2/places?categories=${category}&filter=${filter}&limit=20&apiKey=${GEOAPIFY_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features) {
      return data.features.map(place => ({
        name: place.properties.name,
        address: place.properties.address_line2,
        category: place.properties.category,
        type: place.properties.place_type,
        lat: place.properties.lat,
        lon: place.properties.lon,
        website: place.properties.website,
        phone: place.properties.phone
      }));
    }

    return [];
  } catch (error) {
    console.error("Error fetching places:", error);
    return [];
  }
};

export const getCoordinates = async (destination) => {
  try {
    // Use the robust geocoding from Mappls service (Geoapify + Nominatim fallback)
    const result = await geocode(destination);

    if (result) {
      return {
        lat: result.lat,
        lon: result.lng // Mappls service returns 'lng', we use 'lon'
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching coordinates:", error);
    return null;
  }
};

export const getPlacesByName = async (destination) => {
  try {
    const coords = await getCoordinates(destination);

    if (!coords) {
      return [];
    }

    const { lat, lon } = coords;

    // Now get places around this location using partial robustness
    // 1. Try Geoapify (default)
    const places = await getPlacesByLocation(lat, lon);

    if (places && places.length > 0) {
      return places;
    }

    // 2. Fallback to Mappls Search
    console.log(`Places: Geoapify returned 0 results for ${destination}. Trying Mappls fallback...`);
    const mapplsPlaces = await searchPlaces(lat, lon);

    if (mapplsPlaces && mapplsPlaces.length > 0) {
      return mapplsPlaces.map(p => ({
        name: p.name,
        address: p.address,
        category: p.type || "tourist_attraction",
        lat: p.lat,
        lon: p.lng,
        type: "tourism"
      }));
    }

    return [];
  } catch (error) {
    console.error("Error fetching places by name:", error);
    return [];
  }
};