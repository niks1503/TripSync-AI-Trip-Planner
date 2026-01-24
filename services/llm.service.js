import axios from "axios";

export async function callLLM(prompt) {
  try {
    const baseURL = process.env.LLM_API_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
    const model = process.env.LLM_MODEL || "meta-llama/llama-3.3-70b-instruct";
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

    console.log(`[LLM Service] Using provider: ${baseURL} with model: ${model}`);

    const response = await axios.post(
      baseURL,
      {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a travel planning assistant. You MUST respond with ONLY valid JSON. No markdown, no explanatory text, no code blocks. Just the raw JSON object starting with { and ending with }."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        // Some Colab/Local endpoints might require max_tokens or stream
        max_tokens: 4096
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Trip Planner",
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.data) {
      throw new Error("Invalid response format from LLM Provider");
    }

    // Support OpenAI format (choices[0].message.content)
    if (response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }

    // Support Ollama native format (message.content)
    if (response.data.message && response.data.message.content) {
      return response.data.message.content;
    }

    throw new Error("Unknown response format from LLM");
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