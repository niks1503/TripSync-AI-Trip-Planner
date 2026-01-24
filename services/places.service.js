

export const getPlacesByLocation = async (lat, lon, radius = 5000, category = "tourism") => {
  try {
    const GEOAPIFY_API_KEY = process.env.PLACES_API_KEY;

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
    const GEOAPIFY_API_KEY = process.env.PLACES_API_KEY;
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&apiKey=${GEOAPIFY_API_KEY}`;

    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoData.features || geoData.features.length === 0) {
      return null;
    }

    return {
      lat: geoData.features[0].properties.lat,
      lon: geoData.features[0].properties.lon
    };
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

    // Now get places around this location
    return await getPlacesByLocation(lat, lon);
  } catch (error) {
    console.error("Error fetching places by name:", error);
    return [];
  }
};