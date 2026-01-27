import axios from "axios";

export async function callLLM(prompt) {
  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY not configured in .env");
      return generateFallbackItinerary(prompt);
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",  
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      },
      {
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error("Invalid response format from Groq API");
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error("❌ LLM API Key Invalid or Expired. Using fallback generator.");
      return generateFallbackItinerary(prompt);
    }

    if (error.response) {
      console.error("❌ LLM API Error:", error.response.status, error.response.data);
      return generateFallbackItinerary(prompt);
    } else {
      console.error("❌ LLM Request Error:", error.message);
      return generateFallbackItinerary(prompt);
    }
  }
}


function generateFallbackItinerary(prompt) {
  // Extract details
  // Matches "Trip: Source to Destination" OR "Destination: Name"
  const destinationMatch = prompt.match(/Trip: .*? to (.*?)$/m) || prompt.match(/Destination: (.*?)$/m);
  const destination = destinationMatch ? destinationMatch[1].trim() : "your destination";

  const daysMatch = prompt.match(/Duration: (\d+) days/);
  const days = daysMatch ? parseInt(daysMatch[1]) : 3;

  const budgetMatch = prompt.match(/Budget Limit: (.*?)\n/);
  const budget = budgetMatch ? budgetMatch[1] : "your budget";

  // Scrape Real Candidates from Prompt
  const candidateMatches = [...prompt.matchAll(/^\d+\.\s*(.*?)\s*\(/gm)].map(m => m[1]);
  const candidates = candidateMatches.length > 0 ? candidateMatches : [`${destination} Landmark`, `${destination} City Center`, `${destination} Museum`];

  // Scrape Hotels
  const hotelMatches = [...prompt.matchAll(/^- (.*?) \(Approx/gm)].map(m => m[1]);
  const hotels = hotelMatches.length > 0 ? hotelMatches : [`${destination} Grand Hotel`, `${destination} Stay Inn`];

  // Scrape Restaurants
  const restaurantMatches = [...prompt.matchAll(/^- (.*?) \(/gm)].filter(m => !m[1].includes("Approx")).map(m => m[1]);
  const restaurants = restaurantMatches.length > 0 ? restaurantMatches : [`${destination} Local Eatery`, `Famous ${destination} Cafe`];

  // Construct JSON object strictly matching schema
  const fallbackJson = {
    overview: {
      title: `Explore ${destination}`,
      vibe: "Adventure & Culture",
      highlights: candidates.slice(0, 3)
    },
    transportation: {
      mode: "Personal Preference",
      cost: "Variable"
    },
    budget: {
      accommodation: "40%",
      food: "25%",
      transportation: "20%",
      activities: "15%",
      miscellaneous: "Variable",
      total: budget
    },
    days: [],
    tips: [
      "Carry local currency",
      "Stay hydrated",
      "Check weather before heading out"
    ]
  };

  // Varied activities for fallback
  const morningActivities = ["Heritage Walk", "Local Museum Visit", "Nature Park Stroll", "Temple Visit", "City Landmark Tour"];
  const afternoonActivities = ["Traditional Thali Lunch", "Street Food Exploration", "Shopping at Local Bazaar", "Art Gallery Visit", "Relax at Cafe"];
  const eveningActivities = ["Sunset Point", "Cultural Dance Show", "Night Market", "River/Lake Side Walk", "Fine Dining Experience"];

  for (let i = 1; i <= days; i++) {
    const daySpot = candidates[(i - 1) % candidates.length];
    const dayHotel = hotels[(i - 1) % hotels.length];
    const dayFood = restaurants[(i - 1) % restaurants.length];

    fallbackJson.days.push({
      day: i,
      title: `Exploring ${destination} - Day ${i}`,
      morning: {
        activity: `Visit ${daySpot}`,
        cost: "₹500",
        place: daySpot,
        tip: "Go early to avoid crowds"
      },
      lunch: {
        activity: afternoonActivities[(i - 1) % afternoonActivities.length],
        cost: "₹800",
        place: dayFood,
        tip: "Try the signature dish"
      },
      afternoon: {
        activity: "Leisure & Shopping",
        cost: "₹1000",
        place: "Main Bazaar",
        tip: "Bargain for best prices"
      },
      evening: {
        activity: eveningActivities[(i - 1) % eveningActivities.length],
        cost: "₹200",
        place: "Scenic Viewpoint",
        tip: "Perfect for photos"
      },
      dinner: {
        activity: "Dinner & Vibes",
        cost: "₹1200",
        place: restaurants[(i) % restaurants.length], // Alternate restaurant
        tip: "Reservation recommended"
      },
      accommodation: {
        activity: "Overnight Stay",
        cost: "₹3000",
        place: dayHotel,
        tip: "Central location"
      }
    });
  }

  return JSON.stringify(fallbackJson, null, 2);
}