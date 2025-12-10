const { Mistral } = require('@mistralai/mistralai');
const { CloudClient } = require('chromadb');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const CHROMA_TENANT = process.env.CHROMA_TENANT;
const CHROMA_DATABASE = process.env.CHROMA_DATABASE;
const CHROMA_COLLECTION_NAME =
  process.env.CHROMA_COLLECTION || 'raptee_t30_faq_light';

const mistral = new Mistral({ apiKey: MISTRAL_API_KEY });

const chroma = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: CHROMA_TENANT,
  database: CHROMA_DATABASE,
});

// ---------- RETRY HELPER FOR RATE LIMITS ----------
async function retryWithBackoff(fn, maxRetries = 3, baseDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimited = error.status === 429 ||
        error.message?.includes('429') ||
        error.message?.includes('rate') ||
        error.message?.includes('capacity');

      if (isRateLimited && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`⏳ Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// ---------- EMBEDDINGS USING MISTRAL ----------
async function getEmbeddings(texts) {
  try {
    return await retryWithBackoff(async () => {
      const response = await mistral.embeddings.create({
        model: 'mistral-embed',
        inputs: texts,
      });
      return response.data.map((item) => item.embedding);
    });
  } catch (error) {
    console.error('❌ Embedding Error:', error.message);
    return [];
  }
}

// ---------- CHROMA COLLECTION ----------
async function getCollection() {
  try {
    // No embeddingFunction needed because we pass vectors manually
    return await chroma.getOrCreateCollection({
      name: CHROMA_COLLECTION_NAME,
      metadata: { 'hnsw:space': 'cosine' },
    });
  } catch (error) {
    console.error('❌ Chroma Connection Error:', error.message);
    try {
      return await chroma.getCollection({
        name: CHROMA_COLLECTION_NAME,
      });
    } catch (e) {
      console.error('❌ Could not retrieve collection:', e.message);
      return null;
    }
  }
}

// ---------- MAIN ANALYZE & DRAFT ----------
async function analyzeAndDraft(text, platform) {
  if (!text) return { intent: 'No Content', reply: '', assistance_needed: false };

  let contextStr = 'No specific knowledge found in database.';

  try {
    const collection = await getCollection();
    if (collection) {
      const queryVec = await getEmbeddings([text]);

      if (queryVec.length > 0) {
        const results = await collection.query({
          queryEmbeddings: queryVec,
          nResults: 3,
        });

        if (results.documents && results.documents.length > 0) {
          const chunks = results.documents[0].map((doc, i) => {
            const meta = results.metadatas[0][i];
            const title = meta ? meta.title : 'Info';
            return `[#${i + 1}] ${title}: ${doc}`;
          });

          if (chunks.length > 0) {
            contextStr = chunks.join('\n\n');
          }
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ RAG Retrieval Failed (continuing without context):', e.message);
  }

  const prompt = `
    You are a professional customer support agent for ${platform}.
    
    KNOWLEDGE BASE CONTEXT:
    ${contextStr}
    
    USER MESSAGE:
    "${text}"
    
    INSTRUCTIONS:
    1. Identify the user's INTENT (Question, Complaint, Praise, Spam, Technical Issue).
    2. Draft a polite, helpful REPLY based *strictly* on the Context.
    3. If there is a complaint, apologize and ask the user to DM or raise a ticket.
    4. If there is a suggestion or negative opinion, say thank you for the feedback and mention you will look into it.
    5. If there is not enough context, give a general reply and set 'assistance_needed' to true.
    
    OUTPUT FORMAT (JSON ONLY):
    {
        "intent": "Category",
        "reply": "Your draft reply here...",
        "assistance_needed": boolean
    }
  `;

  try {
    const result = await retryWithBackoff(async () => {
      const chatResponse = await mistral.chat.complete({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
      });
      return chatResponse;
    });

    const content = result.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Mistral Chat Error:', error.message);
    return {
      intent: 'Error',
      reply: "I'm having trouble processing this right now.",
      assistance_needed: true,
    };
  }
}

// ---------- ADD KNOWLEDGE ----------
async function addKnowledge(content, title = 'General Info') {
  try {
    const collection = await getCollection();
    if (!collection) throw new Error('Could not connect to Chroma');

    const vectors = await getEmbeddings([content]);
    if (vectors.length === 0) throw new Error('Embedding generation failed');

    await collection.add({
      ids: [uuidv4()],
      embeddings: vectors,
      documents: [content],
      metadatas: [{ title: title, addedAt: new Date().toISOString() }],
    });

    return true;
  } catch (error) {
    console.error('❌ Failed to add knowledge:', error.message);
    return false;
  }
}

module.exports = { analyzeAndDraft, addKnowledge };
