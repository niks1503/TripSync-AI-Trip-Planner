import axios from 'axios';
import { loadDocuments } from './loader.js';

// Simple in-memory storage
let vectorIndex = [];

// Compute Cosine Similarity
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magA * magB);
}

// Generate Embedding using OpenAI
async function getEmbedding(text) {
    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/embeddings',
            {
                model: 'openai/text-embedding-3-small',
                input: text
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data.data[0].embedding;
    } catch (error) {
        console.error("Embedding Error (using random fallback):", error.message);
        // Fallback for demo so app doesn't crash if API fails
        return Array(1536).fill(0).map(() => Math.random());
    }
}

// Initialize Store
// See: /docs/rag_pipeline.md - Section 4 (Retrieval Flow)
export async function initializeVectorStore() {
    const docs = loadDocuments();
    vectorIndex = [];

    console.log("Vectorizing knowledge base...");

    // Process sequentially to avoid rate limits
    for (const doc of docs) {
        const embedding = await getEmbedding(doc.text);
        vectorIndex.push({
            ...doc,
            embedding
        });
    }

    console.log(`Vector Store Ready with ${vectorIndex.length} vectors.`);
}

// Ensure store is only built once
let isInitialized = false;
export async function getVectorStore() {
    if (!isInitialized) {
        await initializeVectorStore();
        isInitialized = true;
    }
    return {
        similaritySearch: async (query, k = 3) => {
            const queryEmbedding = await getEmbedding(query);

            // Calculate scores
            const results = vectorIndex.map(doc => ({
                ...doc,
                score: cosineSimilarity(queryEmbedding, doc.embedding)
            }));

            // Sort Descending
            results.sort((a, b) => b.score - a.score);

            // Return top k
            return results.slice(0, k);
        }
    };
}
