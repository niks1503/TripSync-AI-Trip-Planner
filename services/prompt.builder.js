export function buildPrompt(user, context = {}) {
  const { destination, source, budget, budgetTier, people, days, transportMode, preferences } = user;
  const places = context.places ? context.places.map(p => p.name).join(", ") : "Main attractions";
  const dining = context.dining ? context.dining.map(d => `${d.name} (${d.cuisine || 'Local'})`).join(", ") : "Local food spots";
  const hotels = context.hotels ? context.hotels.map(h => `${h.name} (${h.type})`).join(", ") : "Standard hotels";

  // Format distance info if available
  let distanceInfo = "";
  if (context.distanceInfo) {
    distanceInfo = `Distance: ${context.distanceInfo.distanceText}, Travel Time: ${context.distanceInfo.durationText}`;
  }

  return `You are a travel planning assistant. Create a detailed itinerary for a trip.

TRIP DETAILS:
- From: ${source}
- To: ${destination}
- Duration: ${days} days
- Travelers: ${people} person(s)
- Budget: ₹${budget} (${budgetTier})
- Transport: ${transportMode}
- Preferences: ${preferences}
${distanceInfo ? `- ${distanceInfo}` : ''}

CONTEXT DATA:
- Places to consider: ${places}
- Dining options: ${dining}
- Hotels: ${hotels}

OUTPUT FORMAT (IMPORTANT - respond with ONLY valid JSON, no other text):
{
  "overview": {
    "title": "Trip title",
    "totalCost": "₹XXXXX estimated",
    "vibe": "Brief description of the trip vibe",
    "highlights": ["highlight1", "highlight2", "highlight3"]
  },
  "transportation": {
    "mode": "${transportMode}",
    "details": "How to reach from ${source} to ${destination}",
    "cost": "₹XXXXX",
    "duration": "X hours"
  },
  "days": [
    {
      "day": 1,
      "title": "Day theme/title",
      "morning": {
        "activity": "What to do",
        "place": "Place name",
        "cost": "₹XXX",
        "tip": "Useful tip"
      },
      "afternoon": {
        "activity": "What to do",
        "place": "Place name",
        "cost": "₹XXX",
        "tip": "Useful tip"
      },
      "evening": {
        "activity": "What to do",
        "place": "Place name",
        "cost": "₹XXX",
        "tip": "Useful tip"
      }
    }
  ],
  "budget": {
    "transportation": "₹XXXXX",
    "accommodation": "₹XXXXX",
    "food": "₹XXXXX",
    "activities": "₹XXXXX",
    "miscellaneous": "₹XXXXX",
    "total": "₹XXXXX"
  },
  "tips": ["tip1", "tip2", "tip3", "tip4"]
}

Generate ${days} day entries in the "days" array. All costs in Indian Rupees (₹). Be specific with place names from the context. Respond with ONLY the JSON, no markdown formatting.`;
}