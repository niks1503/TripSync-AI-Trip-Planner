// Calculate budget distribution across categories
function calculateBudgetDistribution(totalBudget, days, people) {
  const budget = typeof totalBudget === 'string' ? parseFloat(totalBudget) : totalBudget;
  
  if (!budget || budget <= 0 || isNaN(budget)) {
    return {
      daily: 0,
      accommodation: "Budget not specified",
      food: "Budget not specified",
      transportation: "Budget not specified",
      activities: "Budget not specified",
      miscellaneous: "Budget not specified",
      total: "₹0"
    };
  }

  // Ensure days and people are valid numbers
  const numDays = parseInt(days, 10) || 1;
  const numPeople = parseInt(people, 10) || 1;

  // Daily budget per person
  const dailyPerPerson = budget / numDays / numPeople;
  
  // Distribution percentages
  const dist = {
    accommodation: 0.40,    // 40% - Hotels/Stays
    food: 0.25,             // 25% - Restaurants/Meals
    transportation: 0.20,   // 20% - Travel
    activities: 0.10,       // 10% - Entry fees/Guides
    miscellaneous: 0.05     // 5% - Tips/Emergencies
  };

  return {
    daily: Math.round(dailyPerPerson),
    accommodation: `₹${Math.round(budget * dist.accommodation).toLocaleString('en-IN')}`,
    food: `₹${Math.round(budget * dist.food).toLocaleString('en-IN')}`,
    transportation: `₹${Math.round(budget * dist.transportation).toLocaleString('en-IN')}`,
    activities: `₹${Math.round(budget * dist.activities).toLocaleString('en-IN')}`,
    miscellaneous: `₹${Math.round(budget * dist.miscellaneous).toLocaleString('en-IN')}`,
    total: `₹${Math.round(budget).toLocaleString('en-IN')}`
  };
}

export function buildPrompt(user, context = {}) {
  const { destination, source, budget, budgetTier, people, days, transportMode, preferences } = user;

  // Calculate budget breakdown
  const budgetDist = calculateBudgetDistribution(budget, days, people);

  // Local helpers (kept inside module for portability)
  const formatDining = (dining) => {
    const items = Array.isArray(dining) ? dining : [dining];
    if (!items || items.length === 0) return "";
    const foodOptions = items
      .filter(Boolean)
      .map(f => `${f.food_place_name || f.name || "Food Option"} (₹${f.price_per_person || f.price || "?"})`)
      .join(", ");
    return foodOptions ? `\n     * Verified Food: ${foodOptions}` : "";
  };

  const formatStay = (accommodation) => {
    const items = Array.isArray(accommodation) ? accommodation : [accommodation];
    if (!items || items.length === 0) return "";
    const stayOptions = items
      .filter(Boolean)
      .map(s => `${s.stay_name || s.name || "Stay Option"} (₹${s.price_per_night || s.price || "?"})`)
      .join(", ");
    return stayOptions ? `\n     * Verified Stay: ${stayOptions}` : "";
  };

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
        const name = p.place_name || p.name || p.spot_name || "Unknown Spot";

        let details = `${i + 1}. ${name} ${scoreStr} - ${p.description || p.category}`;

        // Handle Flattened Attraction Details (Dining/Stay)
        if (p.dining || p.accommodation) {
          if (p.dining) {
            const items = Array.isArray(p.dining) ? p.dining : [p.dining];
            if (items.length > 0) {
              const foodOptions = items.map(f => `${f.food_place_name || f.name} (₹${f.price_per_person || '?'})`).join(", ");
              details += `\n     * Verified Food: ${foodOptions}`;
            }
          }
          if (p.accommodation) {
            const items = Array.isArray(p.accommodation) ? p.accommodation : [p.accommodation];
            if (items.length > 0) {
              const stayOptions = items.map(s => `${s.stay_name || s.name} (₹${s.price_per_night || '?'})`).join(", ");
              details += `\n     * Verified Stay: ${stayOptions}`;
            }
          }
        }
        // Legacy/Fallback for Hierarchical Data
        else if (p.attractions && p.attractions.length > 0) {
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
      const score = p.score ? `(Relevance Score: ${Number(p.score).toFixed(2)})` : "";
      const cost = p.budget_range ? `[Cost: ${p.budget_range}]` : "";
      const name = p.place_name || p.name || p.spot_name || "Unknown Place";
      const desc = p.description || p.category || "";

      let details = `${i + 1}. ${name} ${cost} ${score} - ${desc}`;

      // CASE 1: Hierarchical (Destination -> Attractions)
      if (p.attractions && p.attractions.length > 0) {
        p.attractions.forEach(spot => {
          details += `\n   - [Spot] ${spot.spot_name}: ${spot.description}`;
          if (spot.dining) details += formatDining(spot.dining);
          if (spot.accommodation) details += formatStay(spot.accommodation);
        });
      }
      // CASE 2: Flattened Attraction (Directly has dining/stay)
      else if (p.dining || p.accommodation) {
        if (p.dining) {
          const items = Array.isArray(p.dining) ? p.dining : [p.dining];
          if (items.length > 0) {
            const foodOptions = items.map(f => `${f.food_place_name || f.name} (₹${f.price_per_person || '?'})`).join(", ");
            details += `\n   * Verified Food: ${foodOptions}`;
          }
        }
        if (p.accommodation) {
          const items = Array.isArray(p.accommodation) ? p.accommodation : [p.accommodation];
          if (items.length > 0) {
            const stayOptions = items.map(s => `${s.stay_name || s.name} (₹${s.price_per_night || '?'})`).join(", ");
            details += `\n   * Verified Stay: ${stayOptions}`;
          }
        }
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
SYSTEM INSTRUCTIONS:
You are an expert Travel Planner. Generate a detailed, practical itinerary in FORMATTED TEXT (not JSON).

KEY REQUIREMENTS:
- Use only place names from the lists below
- Include realistic costs (never ₹0)
- Provide specific, actionable activities
- Format as a clear, readable markdown guide with emojis, sections, and details
- Include budget breakdown table
- Include day-by-day activities with times (Morning, Afternoon, Evening, Night)
- Include food recommendations
- Include transport tips and final tips

OUTPUT FORMAT (example structure to follow):
- Start with a brief intro
- Include 💰 Budget Breakdown as a clear table
- For each day: 📍 Day X – Theme
  - Morning: bullet points with costs
  - Afternoon: bullet points with costs
  - Evening/Night: bullet points with costs
  - Stay recommendation
  - Day spend estimate
- Include 🍽 Food recommendations
- Include 🏨 Stay suggestions
- Include 🛵 Transport tips  
- Include ✅ Final tips

Use these emojis: 💰 📍 🍽 🏨 🛵 ⸻ ✅ 🔹 🛏 💸

Make it practical, budget-conscious, and fun!

CONTEXT:
${distanceInfo}
${ragInfo}

AVAILABLE PLACES:
${placesList}

VERIFIED HOTELS:
${context.hotels && context.hotels.length > 0
      ? context.hotels.slice(0, 10).map(h => `- ${h.name || "Hotel"} (${h.city ? `City: ${h.city}` : "Various"}, Phone: ${h.phone || "N/A"}, Website: ${h.website || "N/A"})`).join("\n")
      : "No verified hotels found. Suggest generic options based on destination."}

VERIFIED RESTAURANTS:
${context.restaurants && context.restaurants.length > 0
      ? context.restaurants.slice(0, 15).map(r => `- ${r.name || "Restaurant"} (Cuisine: ${r.cuisine || "Local"}, Address: ${r.address || "Various"})`).join("\n")
      : "No verified restaurants found. Suggest generic options based on destination."}

BUDGET BREAKDOWN:
${budgetDist.accommodation} for accommodation
${budgetDist.food} for food
${budgetDist.transportation} for transport
${budgetDist.activities} for activities
${budgetDist.miscellaneous} for miscellaneous

=== START REQUIRED JSON OUTPUT BELOW THIS LINE ===
RESPOND WITH ONLY THE JSON, NO OTHER TEXT.

{
  "overview": {
    "title": "Exciting Trip to [Destination]",
    "vibe": "Energetic / Relaxed / Cultural",
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
  },
  "transportation": {
    "mode": "Flight / Train / etc",
    "cost": "Estimated cost"
  },
  "budget": {
    "accommodation": "₹Amount",
    "food": "₹Amount",
    "transportation": "₹Amount",
    "activities": "₹Amount",
    "miscellaneous": "₹Amount",
    "total": "₹Amount"
  },
  "days": [
    {
      "day": 1,
      "title": "Theme of the Day",
      "morning": { 
        "activity": "Activity Name", 
        "cost": "₹500", 
        "place": "Place Name", 
        "tip": "Useful tip (entry fees or transport)" 
      },
      "lunch": {
        "activity": "Lunch at [Recommended Place]",
        "cost": "₹400",
        "place": "Exact Restaurant Name",
        "tip": "Dish recommendation (₹200-600 per person)"
      },
      "afternoon": { 
        "activity": "Activity Name", 
        "cost": "₹800", 
        "place": "Place Name", 
        "tip": "Tip (entry/activity fees)" 
      },
      "evening": { 
        "activity": "Activity Name", 
        "cost": "₹300", 
        "place": "Place Name", 
        "tip": "Tip (transport/snacks)" 
      },
      "dinner": {
        "activity": "Dinner at [Recommended Place]",
        "cost": "₹600",
        "place": "Exact Restaurant Name",
        "tip": "Cuisine style (₹300-800 per person)"
      },
      "accommodation": {
        "activity": "Overnight Stay",
        "cost": "₹2500",
        "place": "Exact Hotel/Resort Name",
        "tip": "Room type or amenity to check (budget/mid-range)"
      }
    }
  ],
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}`;
}
