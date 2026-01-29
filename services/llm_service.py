import os
import json
from groq import Groq
import logging

logger = logging.getLogger(__name__)

def call_llm(prompt):
    try:
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        
        if not GROQ_API_KEY:
            logger.error("❌ GROQ_API_KEY not configured in .env")
            return generate_fallback_itinerary(prompt)

        client = Groq(api_key=GROQ_API_KEY)

        response = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=6000,
        )

        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"❌ LLM Request Error: {str(e)}")
        return generate_fallback_itinerary(prompt)

def generate_fallback_itinerary(prompt):
    # Basic fallback extraction logic matching the JS version
    import re
    
    # Extract destination
    dest_match = re.search(r"Trip: .*? to (.*?)$", prompt, re.MULTILINE) or \
                 re.search(r"Destination: (.*?)$", prompt, re.MULTILINE)
    destination = dest_match.group(1).strip() if dest_match else "your destination"

    # Extract days
    days_match = re.search(r"Duration: (\d+) days", prompt)
    days = int(days_match.group(1)) if days_match else 3

    # Extract budget
    budget_match = re.search(r"Budget Limit: (.*?)\n", prompt)
    budget = budget_match.group(1) if budget_match else "your budget"

    fallback_json = {
        "overview": {
            "title": f"Explore {destination}",
            "vibe": "Adventure & Culture",
            "highlights": [f"{destination} Generic Highlight 1", f"{destination} Generic Highlight 2"]
        },
        "transportation": {
            "mode": "Personal Preference",
            "cost": "Variable"
        },
        "budget": {
            "total": budget
        },
        "days": [],
        "tips": ["Carry local currency", "Check weather"]
    }

    for i in range(1, days + 1):
        fallback_json["days"].append({
            "day": i,
            "title": f"Exploring {destination} - Day {i}",
            "morning": { "activity": "Local Sightseeing", "cost": "₹500", "place": f"{destination} center", "tip": "Start early" },
            "lunch": { "activity": "Local Lunch", "cost": "₹400", "place": "Local Restaurant", "tip": "Try Thali" },
            "afternoon": { "activity": "Relax/Shopping", "cost": "₹800", "place": "Market", "tip": "Bargain" },
            "evening": { "activity": "Sunset view", "cost": "₹200", "place": "Viewpoint", "tip": "Photos" },
            "dinner": { "activity": "Dinner", "cost": "₹600", "place": "Nice Restaurant", "tip": "Enjoy" },
            "accommodation": { "activity": "Stay", "cost": "₹3000", "place": "Hotel", "tip": "Rest" }
        })

    return json.dumps(fallback_json, indent=2)
