import { callLLM } from "./llm.service.js";
import { getPlacesByName, getCoordinates, getPlacesByLocation } from "./places.service.js";
import { getRestaurants } from "./dining.service.js";
import { getHotels } from "./hotel.service.js";
import { getDistanceInfo } from "./mappls.service.js";
import { buildPrompt } from "./prompt.builder.js";

/**
 * TripPlannerAgent - An agentic trip planning system that uses LLM
 * to decide which tools to call based on user input.
 */
export class TripPlannerAgent {
  constructor() {
    this.tools = [
      {
        name: "get_places",
        description: "Get tourist attractions and places of interest at a destination",
        parameters: {
          destination: "string - the destination city/place name"
        }
      },
      {
        name: "get_restaurants",
        description: "Get restaurants and dining options near a destination",
        parameters: {
          destination: "string - the destination city/place name"
        }
      },
      {
        name: "get_hotels",
        description: "Get hotels and accommodation options near a destination",
        parameters: {
          destination: "string - the destination city/place name"
        }
      },
      {
        name: "get_distance",
        description: "Get distance and travel time between source and destination",
        parameters: {
          source: "string - starting location",
          destination: "string - ending location"
        }
      },
      {
        name: "generate_itinerary",
        description: "Generate a complete day-by-day itinerary using gathered data",
        parameters: {
          destination: "string",
          source: "string",
          budget: "number - total budget in INR",
          people: "number - number of travelers",
          days: "number - trip duration",
          transport: "string - mode of transport",
          preferences: "string - user preferences/interests"
        }
      }
    ];
  }

  /**
   * Main entry point - process a user's trip planning request
   */
  async processRequest(userInput, context = {}) {
    try {
      console.log("[Agent] Processing request:", userInput);

      // Step 1: Analyze request and determine which tools to use
      const toolPlan = await this.planTools(userInput, context);
      console.log("[Agent] Tool plan:", JSON.stringify(toolPlan, null, 2));

      // Step 2: Execute each tool and collect results
      const toolResults = {};
      for (const toolCall of toolPlan) {
        console.log(`[Agent] Executing tool: ${toolCall.name}`);
        try {
          const result = await this.executeTool(toolCall.name, toolCall.parameters);
          toolResults[toolCall.name] = result;
        } catch (toolError) {
          console.error(`[Agent] Tool ${toolCall.name} failed:`, toolError.message);
          toolResults[toolCall.name] = { error: toolError.message };
        }
      }

      // Step 3: Generate final response 
      console.log("[Agent] Generating final response...");
      const response = await this.generateFinalResponse(userInput, context, toolResults);

      return response;
    } catch (error) {
      console.error("[Agent] Error:", error);
      throw error;
    }
  }

  /**
   * Use LLM to decide which tools to call
   */
  async planTools(userInput, context) {
    const prompt = `You are a travel planning assistant that helps plan trips. 
Analyze the user's request and decide which tools to call to gather the needed information.

USER REQUEST: "${userInput}"

CONTEXT PROVIDED:
${JSON.stringify(context, null, 2)}

AVAILABLE TOOLS:
${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Based on the user's request and context, output a JSON array of tool calls in order.
For a complete trip plan, you typically need: get_places, get_restaurants, get_hotels, get_distance, then generate_itinerary.

Use the context values for parameters when available.

OUTPUT FORMAT (respond with ONLY valid JSON, no other text):
[
  {"name": "tool_name", "parameters": {"param1": "value1"}}
]

Example for planning a trip from Mumbai to Goa:
[
  {"name": "get_places", "parameters": {"destination": "Goa"}},
  {"name": "get_restaurants", "parameters": {"destination": "Goa"}},
  {"name": "get_hotels", "parameters": {"destination": "Goa"}},
  {"name": "get_distance", "parameters": {"source": "Mumbai", "destination": "Goa"}},
  {"name": "generate_itinerary", "parameters": {"destination": "Goa", "source": "Mumbai", "budget": 25000, "people": 2, "days": 3, "transport": "car", "preferences": "beaches, nightlife"}}
]`;

    const response = await callLLM(prompt);

    // Parse JSON from response
    try {
      // Try to extract JSON from the response (in case there's wrapper text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch (parseError) {
      console.error("[Agent] Failed to parse tool plan:", parseError);
      // Fallback: return a default tool sequence based on context
      return this.getDefaultToolPlan(context);
    }
  }

  /**
   * Fallback tool plan when LLM parsing fails
   */
  getDefaultToolPlan(context) {
    const { destination, source, budget, people, days, transport, preferences } = context;

    if (!destination) {
      return [];
    }

    return [
      { name: "get_places", parameters: { destination } },
      { name: "get_restaurants", parameters: { destination } },
      { name: "get_hotels", parameters: { destination } },
      { name: "get_distance", parameters: { source: source || "Mumbai", destination } },
      {
        name: "generate_itinerary",
        parameters: {
          destination,
          source: source || "Mumbai",
          budget: budget || 25000,
          people: people || 2,
          days: days || 3,
          transport: transport || "any",
          preferences: preferences || "sightseeing"
        }
      }
    ];
  }

  /**
   * Execute a specific tool
   */
  async executeTool(toolName, parameters) {
    switch (toolName) {
      case "get_places": {
        const places = await getPlacesByName(parameters.destination);
        return { places, count: places.length };
      }

      case "get_restaurants": {
        const coords = await getCoordinates(parameters.destination);
        if (!coords) {
          return { restaurants: [], error: "Could not geocode destination" };
        }
        const restaurants = await getRestaurants(coords.lat, coords.lon);
        return { restaurants, count: restaurants.length };
      }

      case "get_hotels": {
        const coords = await getCoordinates(parameters.destination);
        if (!coords) {
          return { hotels: [], error: "Could not geocode destination" };
        }
        const hotels = await getHotels(coords.lat, coords.lon);
        return { hotels, count: hotels.length };
      }

      case "get_distance": {
        const distanceInfo = await getDistanceInfo(parameters.source, parameters.destination);
        return distanceInfo || { error: "Could not calculate distance" };
      }

      case "generate_itinerary": {
        // This is handled in generateFinalResponse
        return { status: "will_generate" };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Generate the final itinerary response using all gathered data
   */
  async generateFinalResponse(userInput, context, toolResults) {
    // Extract data from tool results
    const places = toolResults.get_places?.places || [];
    const restaurants = toolResults.get_restaurants?.restaurants || [];
    const hotels = toolResults.get_hotels?.hotels || [];
    const distanceInfo = toolResults.get_distance || null;

    // Determine budget tier
    const totalBudget = parseInt(context.budget) || 25000;
    let budgetTier = "Medium";
    if (totalBudget < 20000) budgetTier = "Low";
    else if (totalBudget > 30000) budgetTier = "High";

    // Map transport mode
    const transportModes = {
      any: "Best available option",
      flight: "Flight",
      train: "Train",
      bus: "Bus",
      car: "Car / Self-Drive",
      bike: "Bike / Motorcycle"
    };
    const transportMode = transportModes[context.transport] || transportModes.any;

    // Build the prompt using existing prompt builder
    const prompt = buildPrompt(
      {
        destination: context.destination,
        source: context.source,
        budget: totalBudget,
        budgetTier,
        people: context.people || 2,
        days: context.days || 3,
        transportMode,
        preferences: context.preferences || "General sightseeing"
      },
      {
        places,
        dining: restaurants,
        hotels,
        distanceInfo
      }
    );

    // Generate itinerary
    const itinerary = await callLLM(prompt);
    return itinerary;
  }
}

/**
 * Helper function to create and use the agent
 */
export async function planTripWithAgent(tripDetails) {
  const agent = new TripPlannerAgent();

  const userInput = `Plan a ${tripDetails.days}-day trip from ${tripDetails.source} to ${tripDetails.destination} for ${tripDetails.people} people with a budget of ₹${tripDetails.budget}`;

  return await agent.processRequest(userInput, tripDetails);
}