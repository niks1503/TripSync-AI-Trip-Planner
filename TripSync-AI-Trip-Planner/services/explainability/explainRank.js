/**
 * Generates structured explanations for ranking scores.
 * @returns {Object} { explanation: String, primary_factor: String, details: Object }
 */
export function explainRanking(features, weights = { distance: 0.4, popularity: 0.3, budget: 0.2, time: 0.1 }) {
    if (!features) return { explanation: "No data available.", primary_factor: "None", details: {} };

    const explanations = [];

    // Analyze contributions
    const contributions = {
        Distance: (features.distance_score || 0) * weights.distance,
        Popularity: (features.popularity_score || 0) * weights.popularity,
        Budget: (features.budget_score || 0) * weights.budget,
        Time: (features.time_feasibility_score || 0) * weights.time
    };

    // Sort contributions desceding
    const sortedFactors = Object.entries(contributions).sort((a, b) => b[1] - a[1]);
    const topFactor = sortedFactors[0];
    let primaryReason = "Balanced Scores";

    if (topFactor[1] > 0.15) {
        switch (topFactor[0]) {
            case 'Distance':
                explanations.push("It is geographically convenient for your route.");
                primaryReason = "Proximity";
                break;
            case 'Popularity':
                explanations.push("It is highly rated and popular among travelers.");
                primaryReason = "Popularity";
                break;
            case 'Budget':
                explanations.push("It fits perfectly within your specified budget.");
                primaryReason = "Cost Efficiency";
                break;
            case 'Time':
                explanations.push("You have ample time to explore this.");
                primaryReason = "Time Constraints";
                break;
        }
    }

    // Secondary Factors
    if (features.budget_score < 0.5) explanations.push("Note: It might be slightly above your preferred budget.");
    if (features.distance_score < 0.3) explanations.push("Note: It is a bit of a detour.");

    return {
        explanation: explanations.join(" ") || "Ranked based on a balanced mix of factors.",
        primary_factor: primaryReason,
        details: contributions
    };
}
