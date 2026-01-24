# TripSync AI - Advanced Intelligent Trip Planner

**TripSync AI** is a next-generation travel planning system that leverages **Hybrid Intelligence** (Deterministic Algorithms + Generative AI) to create safe, personalized, and biologically feasible itineraries.

Unlike standard "GPT Wrappers" that hallucinate places, TripSync uses a **Multi-Agent Architecture** grounded in real-world data.



---

## 📖 Table of Contents
1. [Problem Statement](#-problem-statement)
2. [System Architecture](#-system-architecture)
3. [Intelligence Layers](#-intelligence-layers)
    - [Data Pipeline](#1-data-pipeline)
    - [Machine Learning Engine](#2-machine-learning-engine)
    - [RAG Knowledge Base](#3-rag-knowledge-base)
4. [Agent Reasoning](#-agent-reasoning)
5. [Installation & Setup](#-installation--setup)
6. [Scalability & Future Scope](#-scalability--future-scope)

---

## 🎯 Problem Statement
Generating travel itineraries with pure LLMs (e.g., ChatGPT) has three critical flaws:
1.  **Hallucination**: Suggesting non-existent hotels or "flying cars".
2.  **Lack of Context**: Ignoring "Closed for Renovation" or "Temple Dress Codes".
3.  **Inefficiency**: Re-calculating distances via tokens is slow and expensive.

**TripSync Solves This By:** Separating *Planning* (Math/Data) from *Narration* (LLM).

---

## 🏗 System Architecture
The system follows a linear request lifecycle managed by `server.js`.

```ascii
[USER] -> [API GATEWAY] -> [CACHE CHECK]
               |
               v
      [INTELLIGENCE LAYER]
      +-> 1. Ingest Data (Graph DB)
      +-> 2. ML Ranking (Feature Engineering)
      +-> 3. RAG Retrieval (Vector Search)
               |
               v
      [PROMPT BUILDER] -> [LLM NARRATOR] -> [USER STREAM]
```

*See [docs/system_flow.md](docs/system_flow.md) for the detailed diagram.*

---

## 🧠 Intelligence Layers

### 1. Data Pipeline
*   **Source**: Curated CSVs (`places.txt`, `spots.txt`) representing the "World Model".
*   **Logic**: `data_pipeline/ingestor.js` builds an in-memory Graph of Places → Spots → Food/Stay.
*   *See [docs/datasets.md](docs/datasets.md).*

### 2. Machine Learning Engine
*   **Role**: Content Ranking & Filtering.
*   **Algorithm**: Weighted Sum Model (Deterministic).
    *   `Distance Score` (40%): Haversine proximity.
    *   `Popularity Score` (30%): Log-normalized reviews.
    *   `Budget Score` (20%): Price tier matching.
*   *See [docs/ml_models.md](docs/ml_models.md).*

### 3. RAG Knowledge Base
*   **Role**: Safety & Cultural Grounding.
*   **Technology**: OpenAI Embeddings + Cosine Similarity.
*   **Content**: `temple_rules.txt`, `safety.txt`, `seasons.txt`.
*   **Why**: Prevents the LLM from suggesting shorts at a temple or beach trips during monsoon.
*   *See [docs/rag_pipeline.md](docs/rag_pipeline.md).*

---

## 🤖 Agent Reasoning
We use a **Multi-Agent Pattern** where specialized code blocks act as agents:

1.  **Ranking Agent**: "I have selected these 15 places because they fit the budget and are nearby."
2.  **Knowledge Agent**: "I found 3 critical rules: remove shoes, no photography."
3.  **Explanation Agent**: "This place is ranked #1 because of its high popularity."
4.  **Narrator Agent (LLM)**: "Welcome to your trip! We start at..."

*See [docs/agent_reasoning.md](docs/agent_reasoning.md) and [docs/design_decisions.md](docs/design_decisions.md).*

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16+)
- Python 3.10+ (for ML scripts)
- `.env` file with `OPENAI_API_KEY` and `GOOGLE_API_KEY`.

### Steps
1.  **Install Dependencies**:
    ```bash
    npm install
    pip install pandas scikit-learn sentence-transformers
    ```

2.  **Ingest Data**:
    ```bash
    node data_pipeline/ingestor.js
    ```

3.  **Start Server**:
    ```bash
    npm start
    ```

4.  **Debug Mode**:
    View the internal decision logic at `POST /api/debug/decision-trace`.

---

## 📈 Scalability & Future Scope

### Current Scalability
- **Caching**: `storage/ranking_cache.json` provides O(1) response for common queries.
- **In-Memory**: Small dataset (~1MB) allows sub-millisecond graph traversals.

### Future Scope
1.  **India-Wide Scale**: Replace in-memory JSON with **Neo4j** (Graph DB) and **Elasticsearch** (Vector Search).
2.  **Real-Time Traffic**: Integrate Google Routes API for live travel times.
3.  **User Personalization**: Add Collaborative Filtering once we have 10k+ user logs.

---

**built with ❤️ for Advanced Intelligent Systems.**
