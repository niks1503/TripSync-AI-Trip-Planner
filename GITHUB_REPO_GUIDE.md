# 📖 TripSync AI - Complete GitHub Repository Documentation

**Repository:** https://github.com/niks1503/TripSync-AI-Trip-Planner  
**Owner:** niks1503  
**License:** MIT  
**Status:** Active Development  

---

## 📌 Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Features](#features)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Installation & Setup](#installation--setup)
7. [Configuration](#configuration)
8. [API Endpoints](#api-endpoints)
9. [Testing](#testing)
10. [Performance Metrics](#performance-metrics)
11. [Troubleshooting](#troubleshooting)
12. [Architecture & Design](#architecture--design)
13. [Contributing](#contributing)
14. [License](#license)

---

## 🎯 Project Overview

**TripSync AI** is an intelligent trip planning application that leverages machine learning and Large Language Models (LLMs) to generate personalized, day-wise travel itineraries. Users input their destination, budget, group size, and travel duration, and the system creates comprehensive itineraries with accommodation, dining, and activity recommendations.

### Key Statistics
- **Language Distribution:** HTML (37.7%) | Python (32.4%) | JavaScript (19.4%) | CSS (10.5%)
- **Contributors:** 2
- **Forks:** 3
- **Commits:** 17+
- **Latest Update:** January 2026

### Problem Statement
Traditional travel planning is time-consuming and often results in generic itineraries. TripSync AI automates this process using:
- AI-powered recommendations (Groq LLM)
- Real-time place data (Geoapify, Mappls, Overpass API)
- Machine learning-based ranking
- Budget-aware optimization

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** (or yarn)
- **Python** 3.8+ (for ML engine)
- Valid API keys (see Configuration section)

### Installation & Running

```bash
# Clone the repository
git clone https://github.com/niks1503/TripSync-AI-Trip-Planner.git
cd TripSync-AI-Trip-Planner

# Install dependencies
npm install

# Create .env file (see Configuration section)
cp .env.example .env

# Start the server
npm start
```

### Access Points
| Interface | URL | Purpose |
|-----------|-----|---------|
| **Form UI** | http://localhost:3000 | Main itinerary generator form |
| **Agent Chat** | http://localhost:3000/agent | Conversational AI interface |

---

## ✨ Features

### Core Features
✅ **AI-Powered Itinerary Generation**
- Uses Groq LLM (llama-3.3-70b-versatile model)
- Context-aware prompt engineering
- Real-time streaming responses

✅ **Smart Place Ranking**
- ML-based recommendations (clustering, collaborative filtering)
- Popularity scoring
- Budget-aware filtering
- Distance optimization

✅ **Budget-Aware Planning**
- Daily budget breakdown
- Accommodation cost estimation
- Food & dining budget allocation
- Activity cost tracking
- Transportation cost optimization

✅ **Real-Time Location Services**
- Geoapify: Place discovery & reverse geocoding
- Mappls: Map data, distance calculations, routing
- Overpass API: POI (hotels, restaurants) from OpenStreetMap

✅ **Weather Integration**
- Open-Meteo API (free, no key required)
- Seasonal recommendations
- Weather-based activity suggestions

✅ **Conversational Agent Interface**
- Chat-based itinerary refinement
- Natural language queries
- Interactive recommendations

✅ **ML-Based Recommendations**
- K-means clustering of similar destinations
- Content-based and collaborative filtering
- Feature engineering (distance, category, popularity)
- Explainable AI (decision tracing)

✅ **Streaming Responses**
- Token-by-token LLM streaming
- Typing effect for better UX
- Real-time feedback to users

✅ **Professional UI**
- Glassmorphic design pattern
- Responsive layout (mobile, tablet, desktop)
- Print-friendly itinerary export
- Day-wise activity cards
- Budget visualization

---

## 🛠️ Technology Stack

### Backend
```
Runtime              Node.js (ES Modules)
Web Framework        Express.js v5.2.1
Runtime Environment  dotenv for configuration
Package Manager      npm
HTTP Client          axios
```

### Frontend
```
Markup               HTML5 (semantic, accessible)
Styling              CSS3 (glassmorphism, responsive)
JavaScript           Vanilla JS (no frameworks)
Typography           Google Fonts (Outfit, Plus Jakarta Sans)
State Management     localStorage for persistence
Design Pattern       Component-based with utilities
```

### AI/ML
```
LLM Provider         Groq API
Model                llama-3.3-70b-versatile
ML Engine            Python
Clustering           K-means, hierarchical clustering
Recommendations      Collaborative filtering, content-based
RAG (Knowledge Base) Custom vector store
```

### External APIs
```
Place Discovery      Geoapify API
Map Services         Mappls API
Weather Data         Open-Meteo API (free)
POI Data             Overpass API (free)
Optional             Google Places API
```

### Database
```
Primary              Local JSON (data/processed/database.json)
Cache                In-memory (feature rankings, vectors)
Persistence          File-based
Scale                ~95 destinations with attractions
```

### Development Tools
```
Version Control      Git
Repository Platform  GitHub
Environment Config   .env file
Logging              Console-based
Monitoring           Custom debug endpoints
```

---

## 📂 Project Structure

```
TripSync-AI-Trip-Planner/
│
├── 📄 server.js                           # Main Express server, route handlers
├── 📄 app.py                              # Alternative Python backend (if used)
├── 📄 package.json                        # Node.js dependencies
├── 📄 requirements.txt                    # Python dependencies
├── 📄 .env.example                        # Environment variables template
├── 📄 .gitignore                          # Git ignore rules
├── 📄 README.md                           # Main project documentation
│
├── 📁 public/                             # Frontend static files
│   ├── index.html                         # Main itinerary generator form
│   ├── agent.html                         # Conversational agent interface
│   ├── itinerary-display-pro.html         # Professional itinerary display
│   ├── app.js                             # Frontend form logic & API calls
│   └── styles.css                         # Global styling (CSS3)
│
├── 📁 services/                           # Backend microservices
│   ├── llm.service.js                     # Groq LLM integration & fallback
│   ├── places.service.js                  # Place discovery (Geoapify)
│   ├── prompt.builder.js                  # Context-aware prompt generation
│   ├── dining.service.js                  # Restaurant fetching (Overpass)
│   ├── hotel.service.js                   # Hotel fetching (Overpass)
│   ├── image.service.js                   # Place imagery
│   ├── mappls.service.js                  # Map & distance services (Mappls)
│   ├── localDb.service.js                 # Local database I/O
│   ├── recommendation.service.js          # ML-based ranking
│   ├── validation/
│   │   └── tripValidator.js               # Input validation & constraints
│   ├── dataProcessor/
│   │   └── normalizePlaces.js             # Data normalization utilities
│   ├── featureEngineering/
│   │   └── featureBuilder.js              # ML feature engineering
│   ├── explainability/
│   │   └── explainRank.js                 # Decision tracing & explainability
│   └── rag/                               # Retrieval-Augmented Generation
│       ├── vectorStore.js                 # Vector embeddings & similarity
│       ├── loader.js                      # Knowledge base loading
│       ├── query_rag.py                   # RAG query interface (Python)
│       └── knowledge_docs/                # Knowledge base documents
│           ├── safety.txt                 # Travel safety guidelines
│           ├── seasons.txt                # Seasonal recommendations
│           └── temple_rules.txt           # Cultural & religious guidelines
│
├── 📁 ml_engine/                          # Python ML services
│   ├── clustering.py                      # K-means & hierarchical clustering
│   ├── recommender.py                     # Recommendation algorithms
│   ├── train_models.py                    # Model training pipeline
│   ├── run_recommendations.py             # ML inference service
│   └── __pycache__/                       # Python bytecode cache
│
├── 📁 data/                               # Data storage
│   ├── raw/                               # Raw data files
│   │   ├── places.txt
│   │   ├── attractions.txt
│   │   ├── food_options.txt
│   │   ├── stay_options.txt
│   │   └── travel_options.txt
│   └── processed/
│       └── database.json                  # Processed places database (95+ destinations)
│
├── 📁 vector_store/                       # Vector embeddings & indexing
│   ├── build_index.py                     # Build vector index
│   └── embeddings.py                      # Embedding generation
│
├── 📁 static/                             # Static assets
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js
│   └── images/
│       └── logo.png
│
├── 📁 templates/                          # HTML templates (alternative structure)
│   ├── index.html
│   ├── agent.html
│   ├── itinerary-display.html
│   └── itinerary-display-pro.html
│
└── 📁 .github/                            # GitHub-specific files (optional)
    └── workflows/                         # CI/CD workflows (if present)
```

---

## 📥 Installation & Setup

### Step 1: Clone Repository
```bash
git clone https://github.com/niks1503/TripSync-AI-Trip-Planner.git
cd TripSync-AI-Trip-Planner
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```

If you encounter peer dependency issues:
```bash
npm install --legacy-peer-deps
```

### Step 3: Install Python Dependencies (Optional)
```bash
pip install -r requirements.txt
```

### Step 4: Create Environment File
```bash
# Copy template
cp .env.example .env

# Edit with your API keys
nano .env
```

### Step 5: Start Server
```bash
npm start
```

Expected output:
```
✅ All required API keys configured
🚀 Server running on http://localhost:3000
```

### Step 6: Access Application
- **Form UI:** Open http://localhost:3000 in browser
- **Agent Chat:** Visit http://localhost:3000/agent
- **Itinerary Display:** http://localhost:3000/public/itinerary-display-pro.html

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```bash
# Required: LLM Integration
GROQ_API_KEY=your_groq_api_key_here

# Required: Place Discovery
GEOAPIFY_API_KEY=your_geoapify_api_key_here

# Optional: Map Services
MAPPLS_API_KEY=your_mappls_api_key_here

# Optional: Additional Places Data
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development    # Set to 'production' for deployment
```

### Getting API Keys

#### Groq API
1. Visit https://console.groq.com
2. Create account
3. Generate API key from dashboard
4. Copy to `.env` as `GROQ_API_KEY`

#### Geoapify API
1. Visit https://www.geoapify.com
2. Sign up for free
3. Get API key from account settings
4. 250k requests/month free tier

#### Mappls API (Optional)
1. Visit https://mappls.com
2. Sign up and create project
3. Get API key
4. 1M requests/month free tier

#### Google Places API (Optional)
1. Visit https://console.cloud.google.com
2. Enable Places API
3. Create API key with restrictions
4. Copy to `.env`

---

## 🔌 API Endpoints

### Main Endpoints

#### 1. Generate Trip Itinerary
```http
POST /api/plan-trip
Content-Type: application/json

{
  "destination": "Goa",
  "source": "Pune",
  "budget": 25000,
  "people": 2,
  "days": 3,
  "transport": "bus",
  "preferences": "beaches, culture"
}
```

**Response:**
```json
{
  "destination": "Goa",
  "overview": {
    "vibe": "Beach & Culture",
    "title": "3-day Goa escape",
    "highlights": ["Beach relaxation", "Water sports", "Local cuisine"]
  },
  "days": [
    {
      "day": 1,
      "title": "Arrival & Beach Day",
      "morning": { "activity": "Check-in", "place": "Hotel", "cost": "₹2000" },
      "afternoon": { "activity": "Baga Beach", "place": "Beach", "cost": "Free" },
      "evening": { "activity": "Sunset at Anjuna", "place": "Beach", "cost": "Free" }
    }
  ],
  "budget": {
    "accommodation": "₹6000",
    "food": "₹3000",
    "activities": "₹2000",
    "transportation": "₹1500"
  },
  "tips": ["Best time: Oct-Feb", "Carry sunscreen", "Book beachfront hotels early"]
}
```

#### 2. Debug Decision Trace
```http
POST /api/debug/decision-trace
Content-Type: application/json

{
  "destination": "Goa",
  "source": "Pune",
  "budget": 25000,
  "people": 2,
  "days": 3
}
```

**Purpose:** Shows internal decision-making, ranking logic, and feature scores

#### 3. Get Database Statistics
```http
GET /api/debug/database-stats
```

**Response:**
```json
{
  "totalDestinations": 95,
  "totalAttractions": 450,
  "lastUpdated": "2026-01-29",
  "sampleDestinations": ["Goa", "Mahabaleshwar", "Lonavala"]
}
```

---

## 🧪 Testing

### Using cURL

**Test 1: Basic Itinerary Generation**
```bash
curl -X POST http://localhost:3000/api/plan-trip \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Goa",
    "source": "Pune",
    "budget": 25000,
    "people": 2,
    "days": 3,
    "transport": "bus"
  }'
```

**Test 2: Decision Trace (Debugging)**
```bash
curl -X POST http://localhost:3000/api/debug/decision-trace \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Goa",
    "source": "Pune",
    "budget": 25000,
    "people": 2,
    "days": 3
  }' | jq .
```

**Test 3: Database Stats**
```bash
curl http://localhost:3000/api/debug/database-stats | jq .
```

### Manual Testing (UI)
1. Open http://localhost:3000
2. Fill form:
   - **Destination:** "Mahabaleshwar"
   - **Source:** "Pune"
   - **Budget:** 15000
   - **People:** 2
   - **Days:** 2
3. Click "Generate Itinerary"
4. Wait for streaming response
5. Click "✨ View Beautiful Itinerary" to see professional display

### Using Postman
1. Import endpoints from `/postman/collection.json` (if available)
2. Set environment variables (API keys)
3. Run requests in order
4. Verify response structures

---

## 📊 Performance Metrics

### Response Times
| Metric | Value | Notes |
|--------|-------|-------|
| **Cold Start** | 3-6 seconds | First request after server start |
| **Warm Start** | 3-4.5 seconds | Subsequent requests (no API cache clear) |
| **API Calls** | <500ms | Individual service calls (Geoapify, Mappls) |
| **LLM Streaming** | 5ms per token | Token-by-token LLM output |
| **Local DB Lookup** | <10ms | Finding destination in local JSON |
| **ML Ranking** | 100-200ms | Computing place rankings |

### API Rate Limits

| Provider | Limit | Plan |
|----------|-------|------|
| **Groq** | 30 requests/min | Free tier |
| **Geoapify** | 250k/month | Free tier (~8k/day) |
| **Mappls** | 1M/month | Free tier (~33k/day) |
| **Open-Meteo** | Unlimited | Free (no key) |
| **Overpass** | ~10-15 req/min | Shared public instance |

### Optimization Tips
- Use caching for frequently requested destinations
- Batch API calls when possible
- Implement request throttling
- Cache Overpass POI results (24-hour TTL)
- Pre-compute ML rankings for popular destinations

---

## 🐛 Troubleshooting

### Issue 1: Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

### Issue 2: Module Not Found
```bash
# Clear npm cache and reinstall
npm cache clean --force
npm install

# Or use legacy peer deps
npm install --legacy-peer-deps
```

### Issue 3: Invalid API Key
```bash
# Verify .env file exists
cat .env

# Verify key format (should not have quotes)
GROQ_API_KEY=abc123xyz...   # ✅ Correct
GROQ_API_KEY="abc123xyz..." # ❌ Wrong (has quotes)
```

### Issue 4: LLM Returns Empty Response
```
Cause: Model deprecated or API key limit reached
Solution:
1. Check Groq API console for model availability
2. Update model name in services/llm.service.js
3. Test with: curl -X POST http://localhost:3000/api/plan-trip...
```

### Issue 5: No Hotels/Restaurants Found
```
Cause: Overpass API timeout or no OSM data for region
Solution:
1. Check coordinates are correct
2. Increase timeout: timeout: 25000 (in services)
3. Use fallback local data
4. Try larger radius: getHotels(lat, lon, 5000)
```

### Issue 6: Frontend Not Loading
```bash
# Verify server is running
curl http://localhost:3000

# Check for browser cache issues
# Ctrl+Shift+Delete (Chrome) or Cmd+Shift+Delete (Mac)

# Verify public folder exists
ls -la public/
```

### Debug Checklist
- [ ] `.env` file created with all keys
- [ ] Node.js v16+ installed (`node --version`)
- [ ] npm dependencies installed (`npm list`)
- [ ] Server starts without errors (`npm start`)
- [ ] Port 3000 is available (`lsof -ti:3000`)
- [ ] API keys are valid (test individually)
- [ ] Browser console shows no JS errors (F12)
- [ ] Network tab shows 200 responses (F12)

---

## 🏗️ Architecture & Design

### Request-Response Pipeline

```
User Input (Web Form)
    ↓
POST /api/plan-trip
    ↓
1. Validation Gate
   ├─ Check: budget, people, days constraints
   └─ Return error if invalid
    ↓
2. Load Destination Data
   ├─ Query local DB (95 destinations)
   ├─ Extract coordinates & attractions
   └─ Fetch from external API if not found
    ↓
3. Fetch POI Data (Parallel)
   ├─ getHotels(lat, lon) via Overpass API
   ├─ getRestaurants(lat, lon) via Overpass API
   └─ Combined into context
    ↓
4. Query RAG (Knowledge Base)
   ├─ Retrieve seasonal tips
   ├─ Cultural guidelines
   └─ Safety recommendations
    ↓
5. ML Ranking Engine
   ├─ Compute place similarity scores
   ├─ Apply budget constraints
   ├─ Sort by popularity
   └─ Return top-N places
    ↓
6. Build Context-Aware Prompt
   ├─ Format destination info
   ├─ Include attractions
   ├─ Add hotels/restaurants
   ├─ Apply constraints (budget, days)
   └─ Include seasonal tips
    ↓
7. Call LLM (Groq)
   ├─ Stream tokens
   ├─ Parse JSON response
   └─ Handle errors/timeouts
    ↓
8. Fallback Logic (if LLM fails)
   └─ Generate heuristic itinerary
    ↓
9. Format & Stream Response
   └─ JSON itinerary with day-wise breakdown
    ↓
Client Response
    ↓
Display Itinerary (Professional UI)
    ├─ Save to localStorage
   ├─ Render day cards
    └─ Allow print/share
```

### Technology Layers

```
┌─────────────────────────────────────┐
│      Frontend (HTML/CSS/JS)         │ ← User Interface
├─────────────────────────────────────┤
│      API Layer (Express Routes)     │ ← HTTP Endpoints
├─────────────────────────────────────┤
│   Business Logic (Services)         │ ← Core Functions
│   ├─ Places Service                 │
│   ├─ LLM Service                    │
│   ├─ Recommendation Service         │
│   └─ Validation Service             │
├─────────────────────────────────────┤
│   Data Access Layer                 │ ← Database & API Calls
│   ├─ Local DB                       │
│   ├─ External APIs                  │
│   └─ RAG Vector Store               │
├─────────────────────────────────────┤
│   ML Engine (Python)                │ ← Algorithms
│   ├─ Clustering                     │
│   └─ Recommendations                │
└─────────────────────────────────────┘
```

### Error Handling Strategy

```javascript
try {
  // Primary path: Call LLM
  const response = await callLLM(prompt);
  return response;
} catch (error) {
  if (error.status === 400) {
    // Model deprecated or API issue
    console.warn("LLM error, using fallback");
    return generateFallbackItinerary(prompt);
  } else if (error.code === 'ENOENT') {
    // Local DB missing
    console.error("Database not found");
    return { error: "Data source unavailable" };
  } else {
    // Unknown error
    console.error("Unexpected error:", error);
    return { error: "Internal server error" };
  }
}
```

---

## 🤝 Contributing

### How to Contribute

1. **Fork the Repository**
   ```bash
   # Click "Fork" on GitHub
   git clone https://github.com/YOUR_USERNAME/TripSync-AI-Trip-Planner.git
   cd TripSync-AI-Trip-Planner
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow existing code style
   - Test your changes locally
   - Update documentation

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Go to GitHub
   - Click "Compare & pull request"
   - Describe changes clearly
   - Submit PR

### Development Guidelines

- **Code Style:** Follow existing patterns (2-space indentation)
- **Variable Naming:** Use camelCase (JavaScript), snake_case (Python)
- **Documentation:** Add comments for complex logic
- **Testing:** Test new features before submitting
- **Commit Messages:** Use conventional commits (feat:, fix:, docs:)

### Issues & Suggestions

Report issues on GitHub Issues page with:
- Descriptive title
- Reproduction steps
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

---

## 📝 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 TripSync AI Development Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 👨‍💻 Author & Contributors

### Author
- **Nikhil Nikam** (niks1503)
- Email: [available on GitHub profile]
- GitHub: https://github.com/niks1503

### Contributors (2)
1. Primary Developer: Nikhil Nikam
2. Additional Contributors: See GitHub Contributors page

### Special Thanks
- **Groq Team** for LLM API
- **OpenStreetMap Community** for POI data
- **Geoapify** for geocoding services
- **Open-Meteo** for weather data

---

## 📚 Additional Resources

### Documentation Files
- **INTERVIEW_STUDY_GUIDE.md** - Technical interview preparation
- **OVERPASS_API_GUIDE.md** - Detailed Overpass API documentation
- **README.md** - Project overview (GitHub)

### External Links
- [Groq Console](https://console.groq.com)
- [Geoapify Docs](https://www.geoapify.com)
- [Mappls API](https://mappls.com)
- [Overpass API](https://overpass-api.de)
- [Open-Meteo](https://open-meteo.com)

### Deployment Guides (Recommended)
- **Heroku:** Simple Node.js deployment with free tier
- **Vercel:** Frontend deployment (Next.js-ready)
- **AWS:** Full stack deployment with scaling
- **DigitalOcean:** VPS with Docker support

---

## 🎯 Future Roadmap

### Planned Features (v2.0)
- [ ] User authentication & saved itineraries
- [ ] Real-time collaboration (share & edit)
- [ ] Mobile app (React Native)
- [ ] Advanced filtering (dietary preferences, accessibility)
- [ ] Social features (reviews, ratings)
- [ ] Booking integration (hotels, flights, activities)
- [ ] Multi-language support
- [ ] Advanced visualizations (route maps, timelines)

### Technical Improvements
- [ ] TypeScript migration
- [ ] React/Vue frontend rewrite
- [ ] PostgreSQL database
- [ ] Docker containerization
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Load testing & optimization
- [ ] Monitoring & analytics

---

## ❓ FAQ

**Q: Can I use this commercially?**
A: Yes, under MIT License. See LICENSE file for terms.

**Q: Do I need all API keys?**
A: Only `GROQ_API_KEY` and `GEOAPIFY_API_KEY` are required. Others are optional.

**Q: How accurate are the itineraries?**
A: Quality depends on local database and LLM quality. Better for popular destinations.

**Q: Can I customize the LLM model?**
A: Yes, edit `services/llm.service.js` and change the model name.

**Q: Is there a frontend framework version?**
A: Currently vanilla JS. React version planned for v2.0.

**Q: How do I scale this for production?**
A: See deployment guides and consider caching, load balancing, and database migration.

---

## 🚀 Next Steps

1. **Clone & Setup:** `git clone` and follow Quick Start
2. **Configure:** Add API keys to `.env`
3. **Test:** Try curl commands or web UI
4. **Customize:** Modify prompts, destinations, features
5. **Deploy:** Host on your preferred platform
6. **Share:** Star ⭐ the repo and contribute!

---

**Last Updated:** January 29, 2026  
**Repository:** https://github.com/niks1503/TripSync-AI-Trip-Planner  
**License:** MIT  

---

## 📞 Support

For help:
1. Check Troubleshooting section above
2. Search GitHub Issues
3. Create new Issue with details
4. Check documentation files
5. Test with debug endpoints

**Happy trip planning! ✈️🌍**
