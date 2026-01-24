# TripSync - Project Documentation
> Interview Reference Guide

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (HTML/CSS/JS)               │
├─────────────────────────────────────────────────────────┤
│                  Express.js Server (server.js)           │
├─────────────────────────────────────────────────────────┤
│                   TripPlannerAgent                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ LLM Service │  │Tool Executor│  │Prompt Builder│     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│                    External APIs                         │
│  Geoapify │ Overpass │ Mappls │ Google Places │ OpenRouter│
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 Agentic AI Implementation

**File:** `services/agent.service.js`

### How It Works
1. **User Request** → Agent receives trip planning request
2. **Tool Planning** → LLM analyzes request and returns JSON array of tools to call
3. **Tool Execution** → Agent executes each tool sequentially
4. **Response Generation** → LLM synthesizes tool results into final itinerary

### Key Methods
- `planTools()` - LLM decides which tools to call
- `executeTool()` - Routes to appropriate service
- `generateFinalResponse()` - Creates structured itinerary

### Tools Available
| Tool | Service | Purpose |
|------|---------|---------|
| `get_places` | places.service.js | Tourist attractions via Geoapify |
| `get_restaurants` | dining.service.js | Restaurants via Overpass API |
| `get_hotels` | hotel.service.js | Accommodations via Overpass API |
| `get_distance` | mappls.service.js | Route distance/duration via Mappls |

---

## 🔌 API Integrations

### 1. Geoapify (Places & Geocoding)
- **Service:** `places.service.js`
- **Used for:** Geocoding locations, finding tourist attractions
- **Key functions:** `getCoordinates()`, `getPlacesByLocation()`

### 2. Overpass API (OpenStreetMap)
- **Services:** `dining.service.js`, `hotel.service.js`
- **Used for:** Restaurants, hotels near coordinates
- **Query format:** OSM Overpass QL

### 3. Mappls (MapMyIndia)
- **Service:** `mappls.service.js`
- **Used for:** Route calculation, distance/duration, map display
- **Auth:** OAuth2 token with 24h expiry (cached)

### 4. Google Places API
- **Service:** `image.service.js`
- **Used for:** Place photos for UI cards

### 5. OpenRouter (LLM)
- **Service:** `llm.service.js`
- **Model:** `meta-llama/llama-3.3-70b-instruct`
- **Used for:** Tool planning, itinerary generation

---

## 🎨 Frontend Features

### Structured Itinerary Display
- JSON response from LLM parsed into styled cards
- Sections: Overview, Transportation, Day-by-Day, Budget, Tips
- Glassmorphism design with smooth animations

### Interactive Map
- Mappls SDK integration
- Route polyline display
- Marker popups for attractions

### Drag & Drop Itinerary Builder
- Place cards can be dragged to time slots
- Modal for adding places to specific days

---

## 📁 Project Structure

```
Trip-Planner/
├── server.js              # Express server, API routes
├── services/
│   ├── agent.service.js   # Agentic AI orchestrator
│   ├── llm.service.js     # OpenRouter LLM calls
│   ├── prompt.builder.js  # Prompt engineering
│   ├── places.service.js  # Geoapify integration
│   ├── dining.service.js  # Overpass restaurants
│   ├── hotel.service.js   # Overpass hotels
│   ├── mappls.service.js  # MapMyIndia integration
│   └── image.service.js   # Google Places photos
├── public/
│   ├── index.html         # Main UI
│   ├── app.js             # Frontend logic
│   └── styles.css         # Styling
└── test-apis.js           # API health check script
```

---

## 💡 Key Technical Decisions

1. **Agentic vs Fixed Pipeline**
   - Agent lets LLM decide tools dynamically
   - More flexible but adds latency

2. **Structured JSON Output**
   - Prompt engineered for JSON response
   - Frontend parses and renders styled cards

3. **Streaming Response**
   - Chunked transfer encoding for typing effect
   - Better UX during long generation

4. **Token Caching**
   - Mappls OAuth token cached for 23 hours
   - Reduces API calls

---

## 🧪 Testing

Run API health check:
```bash
node test-apis.js
```

Tests all integrations: Environment, Geoapify, Mappls, Overpass, Google Places, OpenRouter.
