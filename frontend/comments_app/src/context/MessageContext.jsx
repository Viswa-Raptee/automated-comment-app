import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api';

const MessageContext = createContext();

// Session storage key and expiration (30 minutes)
const CACHE_KEY = 'raptee_messages_cache';
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

export const MessageProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState(null);

    // Load from session storage on mount
    useEffect(() => {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > CACHE_EXPIRY_MS;
                if (!isExpired && data.messages) {
                    setMessages(data.messages);
                    setAccounts(data.accounts || []);
                    setLastFetch(timestamp);
                    setLoading(false);
                    return;
                }
            } catch (e) {
                console.error('Cache parse error:', e);
            }
        }
        // No valid cache, fetch fresh
        fetchAllData();
    }, []);

    // Fetch all messages
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [msgRes, accRes] = await Promise.all([
                api.get('/messages/all'),
                api.get('/accounts')
            ]);

            const newMessages = msgRes.data || [];
            const newAccounts = accRes.data || [];

            setMessages(newMessages);
            setAccounts(newAccounts);
            setLastFetch(Date.now());

            // Save to session storage
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                data: { messages: newMessages, accounts: newAccounts },
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Failed to fetch messages:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Add new messages after sync (incremental update)
    const addMessages = useCallback((newMsgs) => {
        if (!newMsgs || newMsgs.length === 0) return;

        setMessages(prev => {
            // Merge, avoiding duplicates by ID
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = newMsgs.filter(m => !existingIds.has(m.id));
            const updated = [...prev, ...uniqueNew];

            // Update cache
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                data: { messages: updated, accounts },
                timestamp: Date.now()
            }));

            return updated;
        });
        setLastFetch(Date.now());
    }, [accounts]);

    // Update a single message
    const updateMessage = useCallback((id, updates) => {
        setMessages(prev => {
            const updated = prev.map(m => m.id === id ? { ...m, ...updates } : m);
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                data: { messages: updated, accounts },
                timestamp: Date.now()
            }));
            return updated;
        });
    }, [accounts]);

    // Force refresh
    const refresh = useCallback(() => {
        sessionStorage.removeItem(CACHE_KEY);
        return fetchAllData();
    }, [fetchAllData]);

    // ========== COMPUTED HELPERS ==========

    // Get unique posts with stats
    const getUniquePostsWithStats = useCallback((accountId = null) => {
        const filtered = accountId
            ? messages.filter(m => m.accountId === parseInt(accountId))
            : messages;

        const postMap = new Map();

        filtered.forEach(msg => {
            if (!msg.postId) return;

            if (!postMap.has(msg.postId)) {
                postMap.set(msg.postId, {
                    postId: msg.postId,
                    postTitle: msg.postTitle || 'Untitled',
                    mediaUrl: msg.mediaUrl,
                    accountId: msg.accountId,
                    total: 0,
                    pending: 0,
                    approved: 0,
                    posted: 0,
                    rejected: 0
                });
            }

            const post = postMap.get(msg.postId);
            post.total++;
            if (msg.status === 'pending') post.pending++;
            if (msg.status === 'approved') post.approved++;
            if (msg.status === 'posted') post.posted++;
            if (msg.status === 'rejected') post.rejected++;
        });

        return Array.from(postMap.values()).sort((a, b) => b.pending - a.pending);
    }, [messages]);

    // Filter messages by criteria
    const filterMessages = useCallback(({ accountId, postId, status, dateRange } = {}) => {
        let filtered = [...messages];

        if (accountId) {
            filtered = filtered.filter(m => m.accountId === parseInt(accountId));
        }

        if (postId) {
            filtered = filtered.filter(m => m.postId === postId);
        }

        if (status && status !== 'all') {
            filtered = filtered.filter(m => m.status === status);
        }

        if (dateRange && dateRange !== 'all') {
            const now = new Date();
            let startDate;

            switch (dateRange) {
                case '24h':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = null;
            }

            if (startDate) {
                filtered = filtered.filter(m => new Date(m.createdAt) >= startDate);
            }
        }

        return filtered;
    }, [messages]);

    // Get stats - only count parent comments (not nested replies)
    const getStats = useCallback((filters = {}) => {
        const filtered = filterMessages(filters).filter(m => !m.parentId);  // Only parents
        return {
            total: filtered.length,
            pending: filtered.filter(m => m.status === 'pending').length,
            approved: filtered.filter(m => m.status === 'approved' || m.status === 'posted').length,
            rejected: filtered.filter(m => m.status === 'rejected').length,
            complaints: filtered.filter(m => (m.intent || '').toLowerCase() === 'complaint').length,
            questions: filtered.filter(m => (m.intent || '').toLowerCase() === 'question').length,
            assistanceNeeded: filtered.filter(m => m.assistanceNeeded === true).length
        };
    }, [filterMessages]);

    // Get intent breakdown
    const getIntentBreakdown = useCallback((filters = {}) => {
        const filtered = filterMessages(filters);
        const intentMap = {};

        filtered.forEach(m => {
            const intent = m.intent || 'General';
            intentMap[intent] = (intentMap[intent] || 0) + 1;
        });

        return Object.entries(intentMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filterMessages]);

    // Get word frequency for word cloud
    const getWordCloud = useCallback((filters = {}) => {
        const filtered = filterMessages(filters);
        const wordMap = {};
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'am']);

        filtered.forEach(m => {
            if (!m.content) return;
            const words = m.content.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w));

            words.forEach(word => {
                wordMap[word] = (wordMap[word] || 0) + 1;
            });
        });

        return Object.entries(wordMap)
            .map(([text, value]) => ({ text, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 50); // Top 50 words
    }, [filterMessages]);

    // Build threaded structure from flat messages
    const getThreadedMessages = useCallback((filters = {}) => {
        const filtered = filterMessages(filters);

        // Create a map of id -> message for quick lookup
        const messageMap = new Map();
        filtered.forEach(m => messageMap.set(m.id, { ...m, replies: [] }));

        // Organize into parent-child structure
        const parents = [];

        messageMap.forEach(msg => {
            if (msg.parentId && messageMap.has(msg.parentId)) {
                // Add as child to parent
                messageMap.get(msg.parentId).replies.push(msg);
            } else if (!msg.parentId) {
                // Top-level comment
                parents.push(msg);
            }
        });

        // Sort replies by createdAt ascending (oldest first)
        messageMap.forEach(msg => {
            msg.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });

        // Sort parents by createdAt descending (newest first)
        parents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return parents;
    }, [filterMessages]);

    return (
        <MessageContext.Provider value={{
            messages,
            accounts,
            loading,
            lastFetch,
            fetchAllData,
            addMessages,
            updateMessage,
            refresh,
            getUniquePostsWithStats,
            filterMessages,
            getStats,
            getIntentBreakdown,
            getWordCloud,
            getThreadedMessages
        }}>
            {children}
        </MessageContext.Provider>
    );
};

export const useMessages = () => {
    const context = useContext(MessageContext);
    if (!context) {
        throw new Error('useMessages must be used within a MessageProvider');
    }
    return context;
};
