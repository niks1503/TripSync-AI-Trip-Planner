# Request Lifecycle: Complete Journey of a Trip Planning Request

This document walks through the **complete lifecycle** of a single trip planning request in TripSync, from the moment a user clicks "Plan My Trip" to the moment they see their itinerary.

---

## Overview: The 7 Stages

Every request passes through **7 sequential stages**:

1. **User Input Collection** (Frontend)
2. **Request Validation** (Gatekeeper Agent)
3. **Context Gathering** (Backend Orchestrator)
4. **ML Recommendation & Clustering** (ML Agent)
5. **RAG Knowledge Retrieval** (RAG Agent)
6. **Prompt Construction** (Backend Orchestrator)
7. **LLM Narration & Streaming** (LLM Agent)

**Critical Rule**: If any stage fails, the request **stops immediately**. No stage is skipped.

---

## Stage 1: User Input Collection

### What Happens
The user fills out a form on the frontend and clicks "Plan My Trip".

### Input Fields
| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| **Source** | Text | "Pune" | Starting location |
| **Destination** | Text | "Mahabaleshwar" | Trip destination |
| **Budget** | Number | 5000 | Total budget in ₹ |
| **People** | Number | 2 | Number of travelers |
| **Days** | Number | 3 | Trip duration |
| **Preferences** | Text | "Nature, Adventure" | User interests |

### Where This Happens
- **File**: `public/app.js`
- **Function**: Form submit handler

### What Gets Sent
A JSON payload to the backend:
```json
{
  "source": "Pune",
  "destination": "Mahabaleshwar",
  "budget": "5000",
  "people": "2",
  "days": "3",
  "preferences": "Nature, Adventure"
}
```

### Output
HTTP POST request to `/api/plan-trip` endpoint.

### Who Decides What
- ✅ **User decides**: All input values
- ❌ **Frontend does NOT decide**: Validation, place selection, itinerary structure

---

## Stage 2: Request Validation (The Gatekeeper)

### What Happens
The backend **immediately** validates if the request is logically possible based on mathematical formulas.

### Where This Happens
- **File**: `services/validation/tripValidator.js`
- **Called by**: `server.js` (before any AI calls)

### Validation Checks

#### Check 1: Minimum Budget Calculation

**Formula**:
```
Min Food Cost = people × days × ₹200/meal × 3 meals
Min Stay Cost = people × days × ₹500/night
Min Travel Cost = (days × 2) × ₹300/trip × people

Total Minimum = Min Food + Min Stay + Min Travel
```

**Example**:
```
Input: budget=2000, people=5, days=2

Min Food = 5 × 2 × 200 × 3 = ₹6,000
Min Stay = 5 × 2 × 500 = ₹5,000
Min Travel = (2 × 2) × 300 × 5 = ₹6,000
Total = ₹17,000

Result: REJECTED (budget too low by ₹15,000)
```

#### Check 2: People Sanity Limit
- Maximum: 20 people (logistical complexity)
- Minimum: 1 person

#### Check 3: Days Sanity Limit
- Maximum: 30 days (academic scope)
- Minimum: 1 day

#### Check 4: Time Feasibility
- Maximum places per day: 4 (assumes 6 hours sightseeing)
- Average visit time: 1.5 hours per place

### Output (Success)
```json
{
  "isValid": true
}
```

### Output (Failure)
```json
{
  "isValid": false,
  "errors": [
    "Budget of ₹2,000 is logically impossible for 5 people for 2 days.",
    "Minimum required: ₹17,000"
  ],
  "suggestions": {
    "min_budget": 17000,
    "reduce_people_to": 1,
    "reduce_days_to": 1
  }
}
```

### Who Decides What
- ✅ **Validator decides**: Whether request is mathematically possible
- ✅ **Validator calculates**: Minimum budget, suggestions
- ❌ **Validator does NOT decide**: Which places to recommend, itinerary structure
- ❌ **Validator does NOT use**: AI, ML, or LLM (pure math only)

### Why Validation Happens First
1. **Fail Fast**: Don't waste time/money calling ML or LLM for impossible requests
2. **User Experience**: Instant feedback (validation takes <10ms)
3. **Cost Efficiency**: ML and LLM APIs cost money; validation is free

### If Validation Fails
- Request **stops immediately**
- Backend returns HTTP 400 status
- Frontend displays error modal with suggestions
- **No ML, RAG, or LLM is called**

### If Validation Passes
Proceed to Stage 3 ✅

---

## Stage 3: Context Gathering

### What Happens
The backend gathers additional context needed for intelligent recommendation.

### Where This Happens
- **File**: `server.js` (STEP 2: CONTEXT GATHERING)

### Context Items Collected

#### 3A. Destination Coordinates

**Purpose**: Calculate distance-based scores for recommendations

**Process**:
1. Check if destination exists in local `database.json`
2. If found → use stored coordinates
3. If not found → call Mappls API for coordinates
4. If API fails → use default Maharashtra coordinates (18.0, 73.0)

**Example**:
```
Destination: "Mahabaleshwar"
Found in database: lat=17.924, lon=73.658
```

#### 3B. Distance Information

**Purpose**: Show travel time/distance from source to destination

**Process**:
1. Call Mappls Directions API
2. Get estimated distance and duration
3. Store for display purposes

**Example**:
```
Source: Pune
Destination: Mahabaleshwar
Distance: 120 km
Duration: 3.5 hours
```

#### 3C. RAG Safety Query

**Purpose**: Retrieve verified safety and cultural information

**Process**:
1. Build query: `"Travel rules and safety for {destination} in Maharashtra during this season"`
2. Send to RAG engine (runs in parallel with distance lookup)
3. RAG searches vector store and returns relevant text

**Example**:
```
Query: "Travel rules for Mahabaleshwar"
RAG Output: "Heavy rainfall from June-Sept. Carry warm clothing. 
             Dress modestly for temples."
```

### Output of Context Gathering
```json
{
  "coords": { "lat": 17.924, "lon": 73.658 },
  "distanceInfo": { "distance": "120 km", "duration": "3.5 hrs" },
  "ragContext": "Heavy rainfall from June-Sept..."
}
```

### Who Decides What
- ✅ **Orchestrator decides**: What context to gather
- ✅ **Mappls API provides**: Geographic data
- ✅ **RAG provides**: Safety facts
- ❌ **Orchestrator does NOT decide**: Which places to recommend

---

## Stage 4: ML Recommendation & Clustering

### What Happens
The ML engine ranks all places in the database based on user preferences, distance, budget, and feasibility. Then clusters top places into days.

### Where This Happens
- **File**: `ml_engine/recommender.py` (Python)
- **Called by**: Node.js spawns subprocess with `run_recommendations.py`

### Input to ML Engine
```json
{
  "preferences": "Nature, Adventure",
  "user_lat": 17.924,
  "user_lon": 73.658,
  "budget": 5000,
  "days": 3
}
```

### Step 4A: Feature Engineering

For each place in the database, calculate:

#### Feature 1: Preference Score (TF-IDF Similarity)
**What**: Text similarity between user preferences and place description

**How**:
1. Combine user preferences: "Nature Adventure"
2. Get place description: "Hill station with waterfalls and trekking"
3. Convert both to TF-IDF vectors
4. Calculate cosine similarity

**Example**:
```
User: "Nature Adventure"
Place: "Sinhagad Fort - Historical trekking destination"
Similarity: 0.72 (high match)

Place: "Aga Khan Palace - Museum and monument"
Similarity: 0.23 (low match)
```

**Why TF-IDF?**
- Finds semantic meaning, not just keyword matching
- "Adventure" matches "trekking" even if exact word differs
- Downweights common words like "the", "and"

#### Feature 2: Distance Score
**What**: How far is this place from the destination?

**How**:
1. Calculate Haversine distance between destination coords and place coords
2. Convert to score: closer = higher score

**Formula**:
```
distance_km = haversine(dest_lat, dest_lon, place_lat, place_lon)
distance_score = max(0, 1 - (distance_km / 100))
```

**Example**:
```
Destination: Mahabaleshwar (17.924, 73.658)
Place: Pratapgad Fort (17.95, 73.63) → 5 km away
Distance Score: 0.95 (very close)

Place: Gateway of India (18.92, 72.83) → 150 km away
Distance Score: 0.00 (too far)
```

#### Feature 3: Budget Score
**What**: Does this place fit the user's budget tier?

**How**:
1. Categorize budget: Low (<₹3000), Medium (₹3000-₹8000), High (>₹8000)
2. Match with place's `cost_level`

**Example**:
```
User Budget: ₹5000 → Medium tier
Place: "Luxury Resort" (cost_level: High) → Score: 0.3
Place: "Venna Lake" (cost_level: Low) → Score: 1.0
```

#### Feature 4: Time Feasibility Score
**What**: Can user realistically visit this place?

**How**:
```
estimated_visit_time = 1.5 hours (average)
available_time_per_day = 6 hours
if estimated_visit_time <= available_time_per_day:
    score = 1.0
else:
    score = 0.5
```

#### Feature 5: Diversity Penalty
**What**: Avoid recommending 5 forts in a row

**How**:
- If previous 2 recommended places were same category, reduce score by 20%

**Example**:
```
Already recommended: Fort, Fort
Next candidate: Another Fort → Diversity Penalty = -0.2
Next candidate: Waterfall → No Penalty
```

### Step 4B: Composite Score Calculation

**Formula**:
```
Final Score = (Preference × 0.40) + 
              (Distance × 0.30) + 
              (Budget × 0.20) + 
              (Time × 0.10)
```

**Why these weights?**
- **Preference 40%**: User's interests are most important
- **Distance 30%**: Geographic logic is critical
- **Budget 20%**: Must be affordable
- **Time 10%**: Feasibility check

**Example**:
```
Place: "Pratapgad Fort"
  Preference: 0.85
  Distance: 0.95
  Budget: 1.0
  Time: 1.0
  
Final Score = (0.85 × 0.40) + (0.95 × 0.30) + (1.0 × 0.20) + (1.0 × 0.10)
            = 0.34 + 0.285 + 0.20 + 0.10
            = 0.925 (Excellent match!)
```

### Step 4C: Ranking
Sort all places by final score, descending. Take top 15.

### Step 4D: Geographic Clustering (Day-Wise Planning)

**What**: Group top 15 places into geographic clusters (one cluster per day)

**How**: K-Means clustering on latitude/longitude

**Process**:
1. Extract coordinates of top 15 places
2. Run K-Means with k = number of days
3. Each cluster represents one day's itinerary

**Example**:
```
Top 15 Places (after ranking):
  1. Pratapgad Fort (17.95, 73.63)
  2. Venna Lake (17.92, 73.65)
  3. Arthur's Seat (17.94, 73.67)
  4. Elephant's Head (17.91, 73.64)
  5. Lingmala Falls (17.88, 73.66)
  ... (10 more)

K-Means Clustering (k=3 days):
  Cluster 1 (Day 1): Places 1, 2, 4 (Northern area)
  Cluster 2 (Day 2): Places 3, 5, 7 (Western area)
  Cluster 3 (Day 3): Places 6, 8, 9 (Southern area)
```

**Why K-Means?**
- Ensures places visited on the same day are geographically close
- Minimizes travel time between stops
- LLMs cannot do this reliably (they group randomly)

### Output from ML Engine
```json
{
  "recommendations": [
    {
      "place_id": "P123",
      "name": "Pratapgad Fort",
      "ml_score": 0.925,
      "scores": {
        "preference": 0.85,
        "distance": 0.95,
        "budget": 1.0,
        "time": 1.0
      }
    },
    ...
  ],
  "itinerary": {
    "1": ["P123", "P124", "P128"],
    "2": ["P130", "P132"],
    "3": ["P140"]
  }
}
```

### Who Decides What
- ✅ **ML decides**: Which places match user preferences
- ✅ **ML decides**: How to score each place
- ✅ **ML decides**: How to group places into days
- ❌ **ML does NOT decide**: What text to show user
- ❌ **ML does NOT decide**: Budget validity (already validated)

### Why ML, Not LLM?
- **Deterministic**: Same input → same output (reproducible)
- **Explainable**: Every score has a formula
- **Fast**: Runs in ~500ms for 500 places
- **Math-based**: Geographic clustering uses proven algorithms
- **No Hallucinations**: Cannot invent places

---

## Stage 5: RAG Knowledge Retrieval

### What Happens
(This actually happens in parallel with ML in Stage 3, but conceptually it's a separate agent)

### Where This Happens
- **File**: `services/rag/queryRag.js`
- **Vector Store**: `services/rag/vectorStore.js`

### Process

#### Step 1: Query Construction
Backend builds a query based on destination:
```
Query: "Travel rules and safety for Mahabaleshwar in Maharashtra during this season"
```

#### Step 2: Query Embedding
Convert query text to vector using OpenAI Embeddings API:
```
Input: "Travel rules and safety for Mahabaleshwar"
Output: [0.023, -0.145, 0.789, ...] (1536-dimensional vector)
```

#### Step 3: Similarity Search
Compare query vector with all document vectors in the knowledge base:
```
Knowledge Base:
  Doc 1: "Safety tips for Maharashtra..." → Similarity: 0.87
  Doc 2: "Best time to visit..." → Similarity: 0.72
  Doc 3: "Temple rules..." → Similarity: 0.45
```

#### Step 4: Retrieve Top-K
Return top 3 most similar documents:
```
RAG Output:
"Heavy rainfall from June-Sept. Carry warm clothing. 
 Temples require modest dress (covered shoulders and knees).
 Remove footwear before entering temple premises."
```

### Input
```json
{
  "query": "Travel rules and safety for Mahabaleshwar"
}
```

### Output
```json
{
  "answer": "Heavy rainfall from June-Sept. Carry warm clothing...",
  "sources": ["safety.txt", "temple_rules.txt"]
}
```

### Who Decides What
- ✅ **RAG decides**: Which documents are most relevant
- ✅ **RAG provides**: Verified facts from official sources
- ❌ **RAG does NOT decide**: Which places to recommend
- ❌ **RAG does NOT generate**: New information (retrieval only)

### Why RAG, Not LLM Memory?
- **Source Attribution**: Know exactly where facts come from
- **No Hallucinations**: Cannot invent safety rules
- **Updatable**: Just edit text files to update knowledge
- **Efficient**: Pre-computed vectors, instant retrieval

---

## Stage 6: Prompt Construction

### What Happens
The backend combines ML recommendations, RAG facts, and user input into a single "mega-prompt" for the LLM.

### Where This Happens
- **File**: `services/prompt.builder.js`
- **Called by**: `server.js`

### Input to Prompt Builder
```json
{
  "user": { "source": "Pune", "destination": "Mahabaleshwar", ... },
  "rankedPlaces": [ { "name": "Pratapgad Fort", ... }, ... ],
  "mlItinerary": { "1": [...], "2": [...], "3": [...] },
  "ragContext": "Heavy rainfall from June-Sept...",
  "distanceInfo": "120 km, 3.5 hours"
}
```

### Prompt Structure

```
SYSTEM CONTEXT:
You are a travel expert creating itineraries for Maharashtra.

USER REQUEST:
Source: Pune
Destination: Mahabaleshwar
Budget: ₹5,000
People: 2
Days: 3
Preferences: Nature, Adventure

TOP RANKED CANDIDATES (ML-SELECTED):
Day 1:
  - Pratapgad Fort (Score: 0.925)
  - Venna Lake (Score: 0.887)
  
Day 2:
  - Arthur's Seat (Score: 0.864)
  
Day 3:
  - Lingmala Falls (Score: 0.841)

VERIFIED SAFETY INFORMATION (RAG):
Heavy rainfall from June-Sept. Carry warm clothing.
Temples require modest dress.

STRICT CONSTRAINTS:
1. You MUST ONLY recommend places from the list above
2. You MUST keep the day-wise grouping shown
3. You MUST NOT suggest additional places
4. You MUST NOT recalculate budget
5. Format output as markdown

TASK:
Generate a detailed day-wise itinerary in markdown format.
```

### Output
A 500-1000 word prompt sent to the LLM.

### Who Decides What
- ✅ **Prompt Builder decides**: How to format the constraints
- ✅ **Prompt Builder decides**: What information to include
- ❌ **Prompt Builder does NOT decide**: Which places to recommend (ML decided)
- ❌ **Prompt Builder does NOT decide**: Budget validity (Validator decided)

---

## Stage 7: LLM Narration & Streaming

### What Happens
The LLM converts the structured data into a natural language travel story and streams it token-by-token to the frontend.

### Where This Happens
- **File**: `services/llm.service.js`
- **API**: OpenRouter (proxies to GPT-4o-mini)

### Input
The mega-prompt from Stage 6.

### Process
1. Send prompt to OpenRouter API with streaming enabled
2. Receive tokens one-by-one
3. Forward each token to frontend via Server-Sent Events (SSE)

### Output (Streamed Markdown)
```markdown
# Your 3-Day Mahabaleshwar Adventure

## Day 1: Historical Exploration & Lake Serenity

### Morning: Pratapgad Fort
Begin your journey at the majestic **Pratapgad Fort**, a 17th-century 
fortress perched atop the Sahyadri mountains. Built by Chhatrapati 
Shivaji Maharaj, this fort offers panoramic views of the valleys below.

**Estimated Time**: 2-3 hours  
**Why ML Recommended**: Perfect match for your "Adventure" interest 
(Score: 0.925)

### Afternoon: Venna Lake
After exploring the fort, head to the tranquil **Venna Lake**. Enjoy 
boating or simply relax by the waterside with local street food.

...
```

### Who Decides What
- ✅ **LLM decides**: How to phrase the narrative
- ✅ **LLM decides**: Adding transitions ("After exploring...")
- ✅ **LLM decides**: Markdown formatting (headers, bold, lists)
- ❌ **LLM does NOT decide**: Which places to include (ML decided)
- ❌ **LLM does NOT decide**: Day-wise grouping (ML decided)
- ❌ **LLM does NOT decide**: Safety facts (RAG decided)

### Constraints Enforced
The prompt explicitly forbids:
- Adding places not in the ML list
- Changing day assignments
- Making budget calculations
- Inventing safety information

**If LLM tries to break rules**: The prompt is designed to prevent this, but if it happens, the frontend displays what's streamed (this is extremely rare with properly constrained prompts).

---

## Stage 8: Frontend Display

### What Happens
The frontend receives streamed tokens and displays them in real-time.

### Where This Happens
- **File**: `public/app.js`

### Process
1. Receive Server-Sent Events (SSE) from backend
2. Append each token to the output div
3. Parse markdown and render as HTML
4. Show loading animation during streaming

### Final Display
User sees:
- Day-by-day itinerary
- Place names and descriptions
- Estimated times
- Safety tips
- Interactive map (Mappls SDK)

---

## Complete Timeline

| Stage | Component | Time | Cost |
|-------|-----------|------|------|
| 1. Input Collection | Frontend | 0ms (user action) | Free |
| 2. Validation | Validator | ~10ms | Free |
| 3. Context Gathering | Backend + RAG | ~500ms | $0.0001 (embedding) |
| 4. ML Recommendation | Python ML | ~800ms | Free |
| 5. RAG Retrieval | RAG Engine | ~200ms | $0.0001 (embedding) |
| 6. Prompt Construction | Backend | ~50ms | Free |
| 7. LLM Narration | GPT-4o-mini | ~2000ms | $0.0015 (1000 tokens) |
| **Total** | | **~3.5 seconds** | **~$0.002** |

---

## Error Handling at Each Stage

| Stage | Possible Error | System Response |
|-------|---------------|-----------------|
| 1 | Missing fields | Frontend validation error |
| 2 | Budget too low | Return 400 + suggestions modal |
| 3 | Coords not found | Use default Maharashtra coords |
| 4 | ML crashes | Fall back to heuristic scoring |
| 5 | RAG fails | Continue without safety info |
| 6 | N/A | (Pure formatting, cannot fail) |
| 7 | LLM API down | Show error, suggest retry |

---

## Key Decision Boundaries

### What Each Component is ALLOWED to Decide

| Component | Allowed Decisions |
|-----------|------------------|
| **Validator** | Budget feasibility, people/days limits |
| **ML** | Place ranking, scoring, day-wise grouping |
| **RAG** | Which documents are relevant |
| **LLM** | Natural language phrasing, markdown formatting |
| **User** | All input parameters |

### What Each Component is FORBIDDEN to Decide

| Component | Forbidden Decisions |
|-----------|-------------------|
| **Validator** | Which places to recommend |
| **ML** | What text to show user |
| **RAG** | Which places to visit |
| **LLM** | Which places to include, budget calculations, day grouping, safety facts |
| **Frontend** | Budget validation, place selection |

---

## Summary: The Chain of Trust

```
User → Validator → ML → RAG → LLM → User
       ↑           ↑     ↑     ↑
       Math        ML    Facts Narrative
       (0% AI)     (50%  (0%   (100% AI,
                   AI)   AI)   0% freedom)
```

Each stage has a **specific role** and **specific boundaries**. The system works because:
1. **Validation** ensures logical feasibility (math)
2. **ML** ensures geographic and preference logic (deterministic AI)
3. **RAG** ensures factual accuracy (retrieval)
4. **LLM** ensures readability (constrained generation)

No single component has full control—**safety through separation of concerns**.
