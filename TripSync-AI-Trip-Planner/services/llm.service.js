import axios from "axios";

export async function callLLM(prompt) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Trip Planner"
        }
      }
    );

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error("Invalid response format from OpenRouter");
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error("LLM API Key Invalid or Expired. Using fallback generator.");
      return generateFallbackItinerary(prompt);
    }

    if (error.response) {
      console.error("LLM API Error:", error.response.status, error.response.data);
      // Fallback for other errors too
      return generateFallbackItinerary(prompt);
    } else {
      console.error("LLM Request Error:", error.message);
      return generateFallbackItinerary(prompt);
    }
  }
}

function generateFallbackItinerary(prompt) {
  // Extract details from prompt using simple regex
  const destinationMatch = prompt.match(/Destination: (.*?)\n/);
  const destination = destinationMatch ? destinationMatch[1] : "your destination";

  const daysMatch = prompt.match(/Duration: (\d+) days/);
  const days = daysMatch ? parseInt(daysMatch[1]) : 3;

  const budgetMatch = prompt.match(/Budget Limit: (.*?)\n/);
  const budget = budgetMatch ? budgetMatch[1] : "your budget";

  let itinerary = `NOTE: This is an automatically generated backup itinerary because the AI service is currently unavailable.\n\n`;
  itinerary += `TRIP OVERVIEW\n`;
  itinerary += `A fantastic ${days}-day trip to ${destination} with a budget of ${budget}. This plan covers the main highlights and experiences.\n\n`;

  itinerary += `TRANSPORTATION\n`;
  itinerary += `Travel to ${destination} via your preferred mode. Verified distance is approximately calculated based on standard routes.\n\n`;

  itinerary += `DAY-BY-DAY ITINERARY\n\n`;

  for (let i = 1; i <= days; i++) {
    itinerary += `DAY ${i}: Exploring ${destination} - Day ${i}\n`;
    itinerary += `- Morning: Visit popular local landmarks and historical sites. Start early to avoid crowds.\n`;
    itinerary += `- Afternoon: Enjoy local cuisine at a top-rated restaurant. Explore markets or museums.\n`;
    itinerary += `- Evening: Relax at a scenic spot or enjoy the local nightlife. Dinner at a recommended local eatery.\n\n`;
  }

  itinerary += `BUDGET BREAKDOWN\n`;
  itinerary += `- Accommodation: 40%\n`;
  itinerary += `- Food: 25%\n`;
  itinerary += `- Transportation: 20%\n`;
  itinerary += `- Activities & Misc: 15%\n\n`;

  itinerary += `TRAVEL TIPS\n`;
  itinerary += `- Carry local currency (INR) for small vendors.\n`;
  itinerary += `- Stay hydrated and wear comfortable walking shoes.\n`;
  itinerary += `- Check local weather before heading out.\n`;

  return itinerary;
}