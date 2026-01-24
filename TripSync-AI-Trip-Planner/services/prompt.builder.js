export function buildPrompt(user, context = {}) {
  const { destination, source, budget, budgetTier, people, days, transportMode, preferences } = user;

  // Format Ranked Places with Scores and Deep Details (Food/Stay)
  // Format Ranked Places: Check if we have ML-generated Day Plan or fallback to linear list
  let placesList = "No specific places found.";

  if (context.dayPlan && Object.keys(context.dayPlan).length > 0) {
    // Strategy A: Day-Wise Grouping (Advenced ML)
    placesList = Object.entries(context.dayPlan).map(([dayNum, places]) => {
      const dayHeader = `\n--- DAY ${dayNum} Recommended Cluster ---`;
      const dayContent = places.map((p, i) => {
        // Safe access to numerical score if present
        const val = p.ml_score || p.score || 0;
        const scoreStr = `(Score: ${typeof val === 'number' ? val.toFixed(2) : val})`;

        let details = `${i + 1}. ${p.place_name || p.name} ${scoreStr} - ${p.description || p.category}`;

        // Add Nested Details (Food/Stay)
        if (p.attractions && p.attractions.length > 0) {
          p.attractions.forEach(spot => {
            details += `\n   - [Spot] ${spot.spot_name}: ${spot.description}`;
            if (spot.dining && spot.dining.length > 0) {
              const foodOptions = spot.dining.map(f => `${f.food_place_name} (₹${f.price_per_person})`).join(", ");
              details += `\n     * Verified Food: ${foodOptions}`;
            }
            if (spot.accommodation && spot.accommodation.length > 0) {
              const stayOptions = spot.accommodation.map(s => `${s.stay_name} (₹${s.price_per_night})`).join(", ");
              details += `\n     * Verified Stay: ${stayOptions}`;
            }
          });
        }
        return details;
      }).join("\n");
      return `${dayHeader}\n${dayContent}`;
    }).join("\n\n");

  } else if (context.places && context.places.length > 0) {
    // Strategy B: Linear List (Fallback)
    placesList = context.places.map((p, i) => {
      const score = p.score ? `(Relevance Score: ${p.score.toFixed(2)})` : "";
      const cost = p.budget_range ? `[Cost: ${p.budget_range}]` : "";

      let details = `${i + 1}. ${p.place_name || p.name} ${cost} ${score} - ${p.description || p.category}`;

      // 1. Add Specific Attractions (Spots)
      if (p.attractions && p.attractions.length > 0) {
        p.attractions.forEach(spot => {
          details += `\n   - [Spot] ${spot.spot_name}: ${spot.description}`;

          // 2. Add Dining Options for this Spot
          if (spot.dining && spot.dining.length > 0) {
            const foodOptions = spot.dining.map(f => `${f.food_place_name} (₹${f.price_per_person})`).join(", ");
            details += `\n     * Verified Food Options: ${foodOptions}`;
          }

          // 3. Add Stay Options for this Spot
          if (spot.accommodation && spot.accommodation.length > 0) {
            const stayOptions = spot.accommodation.map(s => `${s.stay_name} (₹${s.price_per_night})`).join(", ");
            details += `\n     * Verified Stays: ${stayOptions}`;
          }
        });
      }

      return details;
    }).join("\n");
  }

  // RAG Context
  const ragInfo = context.ragContext ? `
IMPORTANT ADVISORY (from Knowledge Base):
${context.ragContext}
` : "";

  // Distance Info
  let distanceInfo = "";
  if (context.distanceInfo) {
    distanceInfo = `
LOGISTICS:
- Route: ${source} -> ${destination}
- Distance: ${context.distanceInfo.distanceText}
- Drive Time: ${context.distanceInfo.durationText}
`;
  }

  return `
SYSTEM:
You are an expert Travel Narrator and Logic Solver.
Your goal is NOT to search for new places, but to **weave a narrative itinerary** using the PRE-RANKED list provided below.

RULES:
1. **Strict Adherence**: Use the provided "Top Ranked Candidates" list. Do not hallucinate places not listed.
2. **Specific Recommendations**: When suggesting Lunch/Dinner or Accommodation, you **MUST** use the exact names from "Verified Food Options" or "Verified Stays" provided in the list. Do NOT say "a local restaurant" or "budget hotel". Name the specific place.
3. **Constraint Resolution**: Check the "IMPORTANT ADVISORY". If a temple rule says "No shorts", ensure the itinerary mentions dressing appropriately on that day.
4. **Budget Alignment**: The user budget is ₹${budget} (${budgetTier}). Ensure recommended activities fit this.
5. **Formatted Narrative**: Explain *why* these places fit the ${preferences} vibe.

CONTEXT:
${distanceInfo}
${ragInfo}

TOP RANKED CANDIDATES (Use these):
${placesList}

USER REQUEST:
- Trip: ${source} to ${destination}
- Duration: ${days} days
- People: ${people}
- Preference: ${preferences}
- Mode: ${transportMode}

OUTPUT:
Generate a rich, engaging itinerary. Start with a "Trip Summary" explaining how the selected places match the preferences and safety guidelines.
`;
}