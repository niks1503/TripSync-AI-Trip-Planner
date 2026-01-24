import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.join(__dirname, 'knowledge_docs');

/**
 * Loads and chunks text files from knowledge_docs
 * See: /docs/rag_pipeline.md for chunking strategy details.
 * @returns {Array} Array of document chunks { id, text, metadata }
 */
export function loadDocuments() {
    console.log(`Loading docs from ${DOCS_DIR}...`);

    if (!fs.existsSync(DOCS_DIR)) {
        console.error("Knowledge docs directory not found");
        return [];
    }

    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.txt'));
    const documents = [];

    files.forEach(file => {
        const filePath = path.join(DOCS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Simple chunking by newline for these small files
        // In pro version, use a TokenTextSplitter
        const chunks = content.split('\n').filter(line => line.trim().length > 5);

        chunks.forEach((chunk, index) => {
            documents.push({
                id: `${file}_${index}`,
                text: chunk.trim(),
                metadata: { source: file }
            });
        });
    });

    console.log(`Loaded ${documents.length} chunks from ${files.length} files.`);
    return documents;
}
