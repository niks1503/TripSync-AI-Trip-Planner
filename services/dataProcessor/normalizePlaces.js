/**
 * Normalizes raw place results from Geoapify.
 * - Removes duplicates based on place_id or name+lat+lon.
 * - Standardizes categories.
 * - Ensures lat, lon, cost, and ratings exist.
 * - Returns an array of normalized place objects.
 */

export function normalizePlaces(rawPlaces) {
  if (!Array.isArray(rawPlaces)) {
    console.error("normalizePlaces: Expected an array, got", typeof rawPlaces);
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const place of rawPlaces) {
    // 1. Extract Properties (handle raw GeoJSON features or already mapped objects)
    const props = place.properties || place;
    
    // 2. Identify Unique Key (Place ID or composite key)
    const id = props.place_id || `${props.name}_${props.lat}_${props.lon}`;
    
    // Remove Duplicates
    if (seen.has(id)) continue;
    
    // Skip if no name or coordinates
    if (!props.name || (props.lat === null && props.lat === undefined) || (props.lon === null && props.lon === undefined)) {
       continue;
    }
    
    seen.add(id);

    // 3. Standardize Categories
    const categories = Array.isArray(props.categories) ? props.categories : (props.category ? [props.category] : []);
    const mainCategory = mapCategory(categories);

    // 4. Normalize Object
    const normalizedPlace = {
      id: id,
      name: cleanName(props.name),
      address: props.address_line2 || props.formatted || props.address || "Address not available",
      category: mainCategory,
      originalCategories: categories,
      lat: parseFloat(props.lat),
      lon: parseFloat(props.lon),
      
      // 5. Ensure Cost and Ratings exist (Defaulting if missing)
      // Geoapify often doesn't return these, so we use defaults or preserve if present
      rating: props.rating || 4.0, // Default to a good rating
      user_ratings_total: props.user_ratings_total || 0,
      cost: props.price_level || 2, // 1: Cheap, 2: Moderate, 3: Expensive. Default to Moderate.
      
      website: props.website || null,
      phone: props.phone || null,
      
      // Keep extra data if needed
      description: props.description || null
    };

    normalized.push(normalizedPlace);
  }

  return normalized;
}

/**
 * Maps raw Geoapify categories to standardized types.
 */
function mapCategory(categories) {
  const cats = categories.map(c => c.toLowerCase());
  
  if (cats.some(c => c.includes('beach'))) return 'Beach';
  if (cats.some(c => c.includes('history') || c.includes('museum') || c.includes('fort'))) return 'Historical';
  if (cats.some(c => c.includes('religion') || c.includes('worship') || c.includes('temple') || c.includes('church'))) return 'Religious';
  if (cats.some(c => c.includes('nature') || c.includes('park') || c.includes('garden'))) return 'Nature';
  if (cats.some(c => c.includes('entertainment') || c.includes('nightlife') || c.includes('club'))) return 'Nightlife';
  if (cats.some(c => c.includes('catering') || c.includes('restaurant') || c.includes('cafe') || c.includes('food'))) return 'Dining';
  if (cats.some(c => c.includes('accommodation') || c.includes('hotel'))) return 'Accommodation';
  
  return 'Attraction'; // Default
}

/**
 * Cleans up place names (removes unnecessary formatting or codes).
 */
function cleanName(name) {
  if (!name) return "Unknown Place";
  return name.trim();
}
