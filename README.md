# ✈️ Trip Planner AI - AI-Powered Travel Itinerary Generator

A smart trip planning application that uses machine learning and LLM integration to create personalized travel itineraries.

## 🚀 Quick Start

```bash
npm install
npm start
```

**Access:**
- Form UI: http://localhost:3000
- Agent Chat: http://localhost:3000/agent

## ✨ Features

- 🤖 AI-powered itinerary generation (Groq LLM)
- 🗺️ Smart place ranking and recommendations
- 💰 Budget-aware trip planning
- 📍 Real-time location services (Geoapify, Mappls)
- 🌤️ Weather integration (Open-Meteo)
- 💬 Conversational agent interface
- 📊 ML-based recommendations
- ⚡ Streaming responses with typing effect

## 📋 Configuration

Create `.env` file:
```bash
GEOAPIFY_API_KEY=your_key
GROQ_API_KEY=your_key
MAPPLS_API_KEY=your_key (optional)
GOOGLE_PLACES_API_KEY=your_key (optional)
PORT=3000
NODE_ENV=development
```

## 📚 Documentation

- **BUG_FIX_REPORT.md** - All issues that were fixed
- **VALIDATION_GUIDE.md** - Complete testing & verification procedures

## 🛠️ Technology Stack

- **Backend:** Node.js + Express
- **LLM:** Groq API (Mixtral-8x7b-32768)
- **APIs:** Geoapify, Mappls, Open-Meteo, Overpass
- **Frontend:** HTML5 + CSS3 + Vanilla JS
- **Database:** Local JSON
- **ML:** Python (clustering, recommendations)

## 📂 Project Structure

```
Trip-Planner/
├── server.js                    # Main Express server
├── services/                    # Backend services
│   ├── llm.service.js          # LLM integration
│   ├── places.service.js       # Places API
│   ├── prompt.builder.js       # Prompt generation
│   └── ...other services
├── public/                      # Frontend files
│   ├── index.html              # Form UI
│   ├── agent.html              # Chat interface
│   └── styles.css              # Styling
├── data/                        # Data files
│   └── processed/database.json  # Places database
└── ml_engine/                   # Python ML services
```

## 🧪 Testing

**Test main endpoint:**
```bash
curl -X POST http://localhost:3000/api/plan-trip \
  -H "Content-Type: application/json" \
  -d '{"destination":"Goa","source":"Pune","budget":"25000","people":2,"days":3,"transport":"bus"}'
```

**Test debug endpoint:**
```bash
curl -X POST http://localhost:3000/api/debug/decision-trace \
  -H "Content-Type: application/json" \
  -d '{"destination":"Goa","source":"Pune","budget":"25000","people":2,"days":3}' | jq .
```

## ✅ All Issues Fixed

7 critical issues were identified and fixed:
1. ✅ Boolean logic error in data processing
2. ✅ API key configuration errors
3. ✅ Wrong LLM provider integration
4. ✅ Missing environment validation
5. ✅ Missing agent route
6. ✅ Missing agent UI
7. ✅ Geoapify API configuration

See **BUG_FIX_REPORT.md** for detailed information.

## 📊 Performance

- **Cold Start:** 3-6 seconds
- **Warm Start:** 3-4.5 seconds
- **API Calls:** < 500ms
- **Streaming:** 5ms per chunk

## 🔐 Rate Limits

- Groq: 30 requests/min (free)
- Geoapify: 250k/month (free)
- Mappls: 1M/month (free)
- Open-Meteo: Unlimited (free)

## 🐛 Troubleshooting

See **VALIDATION_GUIDE.md** for detailed troubleshooting steps.

**Quick fixes:**
```bash
# Port already in use
lsof -ti:3000 | xargs kill -9

# Module not found
npm install --legacy-peer-deps

# Invalid API key
# Regenerate from provider and update .env
```

## 📝 License

MIT

## 👨‍💻 Author

TripSync AI Development Team

A smart itinerary generator that creates day-wise trip plans using LLM and real-time places data.

## Prerequisites

- Node.js installed
- valid `.env` file with `OPENAI_API_KEY` (OpenRouter) and `PLACES_API_KEY` (Geoapify).

## Installation

```bash
npm install
```

## Running the Project

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and visit:
   `http://localhost:3000`

3. Enter your destination, budget, number of people, and days to generate an itinerary.

## Architecture

- **Backend**: Node.js + Express
- **Frontend**: HTML/CSS/JS
- **Services**:
  - `llm.service.js`: Connects to OpenRouter (GPT-4o-mini)
  - `places.service.js`: Fetches real places from Geoapify
