/**
 * Chroma Manager Service
 * Handles all ChromaDB operations for the Manage Database feature
 */

const { CloudClient } = require('chromadb');
const { Mistral } = require('@mistralai/mistralai');
const { ChromaConfig } = require('../database');
require('dotenv').config();

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const mistral = new Mistral({ apiKey: MISTRAL_API_KEY });

// ---------- HELPER: Create Chroma Client from Config ----------
function createClient(config) {
    return new CloudClient({
        apiKey: config.apiKey,
        tenant: config.tenant,
        database: config.database,
    });
}

// ---------- HELPER: Generate Embeddings ----------
async function getEmbeddings(texts) {
    try {
        const response = await mistral.embeddings.create({
            model: 'mistral-embed',
            inputs: texts,
        });
        return response.data.map((item) => item.embedding);
    } catch (error) {
        console.error('❌ Embedding Error:', error.message);
        throw error;
    }
}

// ---------- HELPER: Generate Meaningful Document ID ----------
function generateDocumentId(title) {
    // Convert title to lowercase, remove special chars, replace spaces with underscores
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 40);

    // Add timestamp for uniqueness
    const timestamp = Date.now().toString(36);
    return `${base}_${timestamp}`;
}

// ---------- LIST COLLECTIONS ----------
async function listCollections(config) {
    try {
        const client = createClient(config);
        const collections = await client.listCollections();
        return collections.map(c => ({
            name: c.name,
            metadata: c.metadata || {}
        }));
    } catch (error) {
        console.error('❌ List Collections Error:', error.message);
        throw error;
    }
}

// ---------- CREATE COLLECTION ----------
async function createCollection(config, name) {
    try {
        const client = createClient(config);
        await client.getOrCreateCollection({
            name,
            metadata: { 'hnsw:space': 'cosine', createdAt: new Date().toISOString() },
        });
        return true;
    } catch (error) {
        console.error('❌ Create Collection Error:', error.message);
        throw error;
    }
}

// ---------- DELETE COLLECTION ----------
async function deleteCollection(config, name) {
    try {
        const client = createClient(config);
        await client.deleteCollection({ name });
        return true;
    } catch (error) {
        console.error('❌ Delete Collection Error:', error.message);
        throw error;
    }
}

// ---------- HELPER: Safely parse array from metadata ----------
// Handles both pre-parsed arrays and JSON strings
function safeParseArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

// ---------- GET ALL DOCUMENTS ----------
async function getDocuments(config, collectionName) {
    try {
        const client = createClient(config);
        const collection = await client.getCollection({ name: collectionName });

        // Get all documents (Chroma returns up to 10000 by default)
        const result = await collection.get({
            include: ['documents', 'metadatas']
        });

        if (!result.ids || result.ids.length === 0) {
            return [];
        }

        // Transform to our document format
        // Use safeParseArray to handle both array and string metadata
        const documents = result.ids.map((id, index) => ({
            id,
            title: result.metadatas[index]?.title || 'Untitled',
            tags: safeParseArray(result.metadatas[index]?.tags),
            source_faq_ids: safeParseArray(result.metadatas[index]?.source_faq_ids),
            sample_questions: safeParseArray(result.metadatas[index]?.sample_questions),
            content: result.documents[index] || ''
        }));

        return documents;
    } catch (error) {
        console.error('❌ Get Documents Error:', error.message);
        throw error;
    }
}

// ---------- ADD DOCUMENT ----------
async function addDocument(config, collectionName, doc) {
    try {
        const client = createClient(config);
        const collection = await client.getCollection({ name: collectionName });

        // Generate meaningful ID from title
        const id = generateDocumentId(doc.title);

        // Generate embeddings for the content + sample questions
        const textToEmbed = [doc.content, ...(doc.sample_questions || [])].join(' ');
        const embeddings = await getEmbeddings([textToEmbed]);

        if (embeddings.length === 0) {
            throw new Error('Failed to generate embeddings');
        }

        // Prepare metadata (stringify arrays)
        const metadata = {
            title: doc.title,
            tags: JSON.stringify(doc.tags || []),
            source_faq_ids: JSON.stringify(doc.source_faq_ids || []),
            sample_questions: JSON.stringify(doc.sample_questions || []),
            addedAt: new Date().toISOString()
        };

        await collection.add({
            ids: [id],
            embeddings,
            documents: [doc.content],
            metadatas: [metadata]
        });

        return { id, ...doc };
    } catch (error) {
        console.error('❌ Add Document Error:', error.message);
        throw error;
    }
}

// ---------- UPDATE DOCUMENT ----------
async function updateDocument(config, collectionName, id, doc) {
    try {
        const client = createClient(config);
        const collection = await client.getCollection({ name: collectionName });

        // Generate new embeddings
        const textToEmbed = [doc.content, ...(doc.sample_questions || [])].join(' ');
        const embeddings = await getEmbeddings([textToEmbed]);

        if (embeddings.length === 0) {
            throw new Error('Failed to generate embeddings');
        }

        // Prepare metadata
        const metadata = {
            title: doc.title,
            tags: JSON.stringify(doc.tags || []),
            source_faq_ids: JSON.stringify(doc.source_faq_ids || []),
            sample_questions: JSON.stringify(doc.sample_questions || []),
            updatedAt: new Date().toISOString()
        };

        await collection.update({
            ids: [id],
            embeddings,
            documents: [doc.content],
            metadatas: [metadata]
        });

        return { id, ...doc };
    } catch (error) {
        console.error('❌ Update Document Error:', error.message);
        throw error;
    }
}

// ---------- DELETE DOCUMENT ----------
async function deleteDocument(config, collectionName, id) {
    try {
        const client = createClient(config);
        const collection = await client.getCollection({ name: collectionName });

        await collection.delete({
            ids: [id]
        });

        return true;
    } catch (error) {
        console.error('❌ Delete Document Error:', error.message);
        throw error;
    }
}

// ---------- GET ACTIVE CONFIG ----------
async function getActiveConfig() {
    try {
        const config = await ChromaConfig.findOne({ where: { isActive: true } });
        return config;
    } catch (error) {
        console.error('❌ Get Active Config Error:', error.message);
        return null;
    }
}

// ---------- SET ACTIVE CONFIG ----------
async function setActiveConfig(configId, collectionName) {
    try {
        // Deactivate all other configs
        await ChromaConfig.update({ isActive: false }, { where: {} });

        // Activate the selected config with collection
        await ChromaConfig.update(
            { isActive: true, activeCollection: collectionName },
            { where: { id: configId } }
        );

        return true;
    } catch (error) {
        console.error('❌ Set Active Config Error:', error.message);
        throw error;
    }
}

// ---------- TEST CONNECTION ----------
async function testConnection(config) {
    try {
        const client = createClient(config);
        await client.listCollections();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    createClient,
    listCollections,
    createCollection,
    deleteCollection,
    getDocuments,
    addDocument,
    updateDocument,
    deleteDocument,
    getActiveConfig,
    setActiveConfig,
    testConnection,
    generateDocumentId
};
