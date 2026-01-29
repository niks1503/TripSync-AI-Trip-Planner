def calculate_budget_distribution(total_budget, days, people):
    try:
        budget = float(total_budget)
    except (ValueError, TypeError):
        return {k: "Budget not specified" for k in ["daily", "accommodation", "food", "transportation", "activities", "miscellaneous"]}

    num_days = int(days) if days else 1
    num_people = int(people) if people else 1

    daily_per_person = budget / num_days / num_people
    
    dist = {
        "accommodation": 0.40,
        "food": 0.25,
        "transportation": 0.20,
        "activities": 0.10,
        "miscellaneous": 0.05
    }

    def fmt(val):
        return f"₹{round(val):,}"

    return {
        "daily": round(daily_per_person),
        "accommodation": fmt(budget * dist["accommodation"]),
        "food": fmt(budget * dist["food"]),
        "transportation": fmt(budget * dist["transportation"]),
        "activities": fmt(budget * dist["activities"]),
        "miscellaneous": fmt(budget * dist["miscellaneous"]),
        "total": fmt(budget)
    }

def build_prompt(user, context=None):
    if context is None:
        context = {}
        
    destination = user.get("destination")
    source = user.get("source")
    budget = user.get("budget")
    people = user.get("people")
    days = user.get("days")
    transport_mode = user.get("transportMode")
    preferences = user.get("preferences", "General sightseeing")

    budget_dist = calculate_budget_distribution(budget, days, people)

    # Format Places List
    places_list = "No specific places found."
    
    # Handle Day Plan or Flat List (Generic Logic)
    if context.get("places"):
        # improving rendering logic - assuming list of dicts
        places_details = []
        for i, p in enumerate(context["places"]):
            # Check multiple possible name fields from database
            name = p.get("spot_name") or p.get("place_name") or p.get("name") or "Unknown"
            score = p.get("score", p.get("ml_score", 0))
            desc = p.get("description", "")
            places_details.append(f"{i+1}. {name} - {desc}")
        places_list = "\n".join(places_details)

    rag_info = f"\nIMPORTANT ADVISORY:\n{context.get('ragContext')}\n" if context.get("ragContext") else ""
    
    distance_info = ""
    if context.get("distanceInfo"):
        di = context["distanceInfo"]
        distance_info = f"\nLOGISTICS:\n- Route: {source} -> {destination}\n- Distance: {di.get('distanceText')}\n- Drive Time: {di.get('durationText')}\n"

    # Strict JSON Schema Prompt
    return f"""
SYSTEM INSTRUCTIONS:
You are an expert Travel Planner. Generate a detailed, practical JSON itinerary.

TRIP DETAILS:
- Trip: {source} to {destination}
- Duration: {days} days
- Travelers: {people} people
- Budget: ₹{budget}
- Transport Mode: {transport_mode}
- Travel Preferences: {preferences}

KEY REQUIREMENTS:
- You MUST generate an itinerary for EXACTLY {days} days. NOT less, NOT more.
- PRIORITIZE activities that match the user's preferences: {preferences}
- Use only place names from the lists below where possible
- Include realistic costs (never ₹0)
- Provide specific, actionable activities
- Follow the exact JSON schema provided
- **CRITICAL**: Do NOT use generic names like "Local Restaurant", "Local Hotel", "Nice Cafe", "Street Food".
- **REQUIRED**: Provide REAL, SPECIFIC names for every "place" field (e.g., "Saravana Bhavan", "Hotel Taj", "Blue Tokai Cafe").
- If the specific name is not in the context, use your internal knowledge to suggest a high-rated, real place in that city.

IMPORTANT: Only return valid JSON. No explanations, markdown, or extra text.

CONTEXT:
{distance_info}
{rag_info}

AVAILABLE PLACES:
{places_list}

BUDGET BREAKDOWN:
{budget_dist.get("accommodation")} for accommodation
{budget_dist.get("food")} for food
{budget_dist.get("transportation")} for transport
{budget_dist.get("activities")} for activities

=== START REQUIRED JSON OUTPUT BELOW THIS LINE ===
RESPOND WITH ONLY THE JSON, NO OTHER TEXT.

{{
  "overview": {{
    "title": "Exciting Trip to [Destination]",
    "vibe": "Energetic / Relaxed / Cultural",
    "trip_distance_info": "e.g. Distance from Source: 250km (approx 5h drive)",
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
  }},
  "transportation": {{
    "mode": "Flight / Train / etc",
    "cost": "Estimated cost"
  }},
  "budget": {{
    "accommodation": "₹Amount",
    "food": "₹Amount",
    "transportation": "₹Amount",
    "activities": "₹Amount",
    "miscellaneous": "₹Amount",
    "total": "₹Amount"
  }},
  "days": [
    {{
      "day": 1,
      "title": "Theme of the Day",
      "morning": {{ 
        "activity": "Activity Name", 
        "cost": "₹500", 
        "place": "Place Name", 
        "tip": "Useful tip" 
      }},
      "lunch": {{
        "activity": "Lunch at [Recommended Place]",
        "cost": "₹400",
        "place": "Exact Restaurant Name",
        "tip": "Dish recommendation"
      }},
      "afternoon": {{ 
        "activity": "Activity Name", 
        "cost": "₹800", 
        "place": "Place Name", 
        "tip": "Tip" 
      }},
      "evening": {{ 
        "activity": "Activity Name", 
        "cost": "₹300", 
        "place": "Place Name", 
        "tip": "Tip" 
      }},
      "dinner": {{
        "activity": "Dinner at [Recommended Place]",
        "cost": "₹600",
        "place": "Exact Restaurant Name",
        "tip": "Cuisine style"
      }},
      "accommodation": {{
        "activity": "Overnight Stay",
        "cost": "₹2500",
        "place": "Exact Hotel/Resort Name",
        "tip": "Room type"
      }}
    }}
  ],
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}}
"""
