/**
 * Computes deterministic feature scores for a place.
 * Scores are normalized between 0 and 1.
 */

// Helper: Haversine distance in KM
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Builds a feature vector for a place.
 * 
 * @param {Object} place - Normalized place object
 * @param {Object} context - User context { userLat, userLon, budget_level (1-3), available_time_hours }
 * @returns {Object} Feature vector with individual scores
 * See: /docs/system_flow.md (Section 2B - Machine Learning Layer)
 */
export function buildFeatureVector(place, context = {}) {
    const { userLat, userLon, budget_level = 2, available_time_hours = 4 } = context;

    // 1. Distance Score (0-1)
    // Higher score = Closer. Exponential decay.
    let distance_km = 0;
    let distance_score = 0;

    if (userLat && userLon && place.lat && place.lon) {
        distance_km = calculateDistance(userLat, userLon, place.lat, place.lon);
        // Score: 1 at 0km, ~0.5 at 10km, ~0.1 at 50km
        distance_score = 1 / (1 + (distance_km / 10));
    } else {
        distance_score = 0.5; // Default neutral if no location context
    }

    // 2. Budget Score (0-1)
    // Alignment with user budget.
    // If place cost <= user budget, score is high. If place cost > user budget, penalize.
    const place_cost = place.cost || 2; // Default Moderate
    let budget_score = 0;

    if (place_cost <= budget_level) {
        budget_score = 1.0; // Perfectly within budget
    } else {
        // Penalize: 0.5 for 1 level higher, 0 for 2 levels higher
        const diff = place_cost - budget_level;
        budget_score = Math.max(0, 1 - (diff * 0.5));
    }

    // 3. Popularity Score (0-1)
    // Composite of rating (0-5) and log(reviews)
    // Rating contributes 60%, Reviews contribute 40%
    const rating = place.rating || 0;
    const reviews = place.user_ratings_total || 0;

    const normalized_rating = Math.min(Math.max(rating, 0), 5) / 5;
    // Log scale for reviews: assume 1000 reviews is max popularity (1.0)
    const normalized_reviews = Math.min(Math.log10(reviews + 1) / 3, 1);

    const popularity_score = (normalized_rating * 0.6) + (normalized_reviews * 0.4);

    // 4. Time Feasibility Score (0-1)
    // Heuristic based on category duration
    let estimated_time_hours = 1.5; // Default

    const category = (place.category || "").toLowerCase();
    if (category.includes('museum') || category.includes('zoo')) estimated_time_hours = 2.5;
    if (category.includes('park') || category.includes('beach')) estimated_time_hours = 2.0;
    if (category.includes('viewpoint')) estimated_time_hours = 0.5;
    if (category.includes('restaurant')) estimated_time_hours = 1.5;

    // If available time < estimated time, score drops sharply
    let time_feasibility_score = 1.0;
    if (available_time_hours < estimated_time_hours) {
        time_feasibility_score = available_time_hours / estimated_time_hours;
    }

    return {
        id: place.id,
        distance_score: parseFloat(distance_score.toFixed(3)),
        budget_score: parseFloat(budget_score.toFixed(3)),
        popularity_score: parseFloat(popularity_score.toFixed(3)),
        time_feasibility_score: parseFloat(time_feasibility_score.toFixed(3)),
        // Metadata for debugging help
        meta: {
            distance_km: parseFloat(distance_km.toFixed(1)),
            cost_tier: place_cost,
            estimated_duration: estimated_time_hours
        }
    };
}
