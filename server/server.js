const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// --- IMPORTS ---
const { sequelize, User, Account, Message } = require('./database');
const { authenticate, isAdmin } = require('./middleware/auth');
const { syncAccount, postInstagramReply, postYouTubeReply, loadClientSecrets } = require('./services/platforms');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// ==========================================
// 1. AUTHENTICATION
// ==========================================

app.post('/api/auth/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword, role });
        res.json({ success: true, user: user.username });
    } catch (e) {
        res.status(400).json({ error: 'Username taken' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, role: user.role });
});

// ==========================================
// 2. YOUTUBE OAUTH (Handshake)
// ==========================================

app.get('/api/youtube/oauth/url', authenticate, async (req, res) => {
    // 1. Load secrets
    let { clientId, clientSecret, redirectUri } = loadClientSecrets();

    // 2. CRITICAL FIX: Fallback if redirectUri is undefined
    if (!redirectUri) {
        redirectUri = 'http://localhost:8000/api/youtube/oauth/callback';
    }

    // 3. Create Client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // 4. Generate URL
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/youtube.force-ssl',
            'https://www.googleapis.com/auth/youtube.readonly'
        ]
    });

    console.log("Generated OAuth URL with Redirect URI:", redirectUri); // Debug log
    res.json({ url });
});

app.get('/api/youtube/oauth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
        // 1. Load Secrets
        let { clientId, clientSecret, redirectUri } = loadClientSecrets();

        // 2. CRITICAL FIX: Force the Redirect URI to match the generation route
        // If this doesn't match EXACTLY what was used in /url, Google rejects the code.
        if (!redirectUri) {
            redirectUri = 'http://localhost:8000/api/youtube/oauth/callback';
        }

        console.log("Exchanging code with Redirect URI:", redirectUri); // Debug Log

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

        // 3. Exchange Code for Tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // 4. Fetch Channel Info
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        const info = await youtube.channels.list({ mine: true, part: 'snippet' });
        const channel = info.data.items?.[0];

        if (!channel) throw new Error("No channel found");

        // 5. Save to Database
        const [acc] = await Account.findOrCreate({
            where: { platform: 'youtube', identifier: channel.id },
            defaults: {
                platform: 'youtube',
                name: channel.snippet.title,
                accessToken: tokens.access_token,
                secondaryToken: tokens.refresh_token || ''
            }
        });

        // Always update tokens
        acc.accessToken = tokens.access_token;
        if (tokens.refresh_token) acc.secondaryToken = tokens.refresh_token;
        acc.name = channel.snippet.title;
        await acc.save();

        console.log("✅ OAuth Success! Redirecting...");
        res.redirect('http://localhost:8080'); // Redirect to your running React App
    } catch (e) {
        console.error("OAuth Callback Error:", e.response?.data || e.message);
        res.status(500).send(`Authentication failed: ${e.message}`);
    }
});

// ==========================================
// 3. ACCOUNTS
// ==========================================

app.post('/api/accounts', authenticate, isAdmin, async (req, res) => {
    try {
        const acc = await Account.create(req.body);
        res.json({ success: true, id: acc.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/accounts', authenticate, async (req, res) => {
    const accounts = await Account.findAll({ attributes: ['id', 'name', 'platform', 'identifier', 'isActive'] });
    res.json(accounts);
});

app.put('/api/accounts/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Account.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/accounts/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await Account.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 4. MESSAGES & SYNC (Master-Detail Core)
// ==========================================

app.post('/api/sync/:accountId', authenticate, async (req, res) => {
    try {
        const account = await Account.findByPk(req.params.accountId);
        if (!account) return res.status(404).json({ error: 'Account not found' });

        // Calls the logic from services/platforms.js
        const count = await syncAccount(account);

        res.json({ message: `Synced ${count} new messages` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// NEW: Get Summary of Posts (Groups messages by Post ID for the Sidebar)
app.get('/api/posts-summary', authenticate, async (req, res) => {
    const { accountId } = req.query;
    try {
        // Group by postId and count pending messages
        // Note: SQLite supports this basic grouping. For Postgres/MySQL, ensure strict grouping.
        const posts = await Message.findAll({
            where: { accountId, status: 'pending' },
            attributes: [
                'postId',
                'postTitle',
                'mediaUrl',
                [sequelize.fn('COUNT', sequelize.col('id')), 'pendingCount']
            ],
            group: ['postId', 'postTitle', 'mediaUrl'],
            order: [[sequelize.literal('pendingCount'), 'DESC']]
        });
        res.json(posts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Messages (Filtered by Post ID for Detail View)
app.get('/api/messages', authenticate, async (req, res) => {
    const { accountId, status, approvedBy, postId } = req.query;
    const where = {};

    if (accountId) where.accountId = accountId;
    if (status) where.status = status;
    if (approvedBy) where.approvedBy = approvedBy;
    if (postId) where.postId = postId; // Filter by Video/Post

    const msgs = await Message.findAll({
        where,
        order: [[status === 'posted' ? 'postedAt' : 'createdAt', 'DESC']],
        include: { model: Account, attributes: ['name', 'platform'] }
    });
    res.json(msgs);
});

// Approve & Reply
app.post('/api/messages/:id/approve', authenticate, async (req, res) => {
    const { replyText } = req.body;

    try {
        const msg = await Message.findByPk(req.params.id, { include: Account });
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        const finalReply = replyText || msg.aiDraft;

        // Execute Platform Reply
        if (msg.Account.platform === 'youtube') {
            await postYouTubeReply(msg.externalId, finalReply, msg.Account);
        } else if (msg.Account.platform === 'instagram') {
            await postInstagramReply(msg.externalId, finalReply, msg.Account);
        }

        // Update DB
        msg.status = 'posted';
        msg.aiDraft = finalReply;
        msg.approvedBy = req.user.username;
        msg.postedAt = new Date();
        await msg.save();

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 5. ADMIN AUDIT & USER MGMT
// ==========================================

app.get('/api/admin/audit', authenticate, isAdmin, async (req, res) => {
    const logs = await Message.findAll({
        where: { status: 'posted' },
        order: [['postedAt', 'DESC']],
        attributes: ['id', 'aiDraft', 'approvedBy', 'postedAt'],
        include: { model: Account, attributes: ['name', 'platform'] }
    });
    res.json(logs);
});

app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const users = await User.findAll({ attributes: ['id', 'username', 'role', 'createdAt'] });
    res.json(users);
});

app.put('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await User.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    await User.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

// ==========================================
// 6. ANALYTICS ENDPOINTS
// ==========================================

// Get Stats (Total, Approved, Pending, Rejected)
app.get('/api/analytics/stats', authenticate, async (req, res) => {
    const { accountId, postId, startDate, endDate } = req.query;

    try {
        const where = {};
        if (accountId) where.accountId = accountId;
        if (postId) where.postId = postId;
        if (startDate || endDate) {
            const { Op } = require('sequelize');
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const total = await Message.count({ where });
        const approved = await Message.count({ where: { ...where, status: 'approved' } });
        const pending = await Message.count({ where: { ...where, status: 'pending' } });
        const rejected = await Message.count({ where: { ...where, status: 'rejected' } });
        const posted = await Message.count({ where: { ...where, status: 'posted' } });

        res.json({ total, approved: approved + posted, pending, rejected });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Intent Distribution for Charts
app.get('/api/analytics/intents', authenticate, async (req, res) => {
    const { accountId, postId, startDate, endDate } = req.query;

    try {
        const where = {};
        if (accountId) where.accountId = accountId;
        if (postId) where.postId = postId;
        if (startDate || endDate) {
            const { Op } = require('sequelize');
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const intents = await Message.findAll({
            where,
            attributes: ['intent', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['intent'],
            order: [[sequelize.literal('count'), 'DESC']]
        });

        res.json(intents);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Word Cloud Data from Comment Content
app.get('/api/analytics/wordcloud', authenticate, async (req, res) => {
    const { accountId, postId, startDate, endDate } = req.query;

    try {
        const where = {};
        if (accountId) where.accountId = accountId;
        if (postId) where.postId = postId;
        if (startDate || endDate) {
            const { Op } = require('sequelize');
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const messages = await Message.findAll({
            where,
            attributes: ['content'],
            limit: 500
        });

        // Extract words and count frequency
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'this', 'that', 'i', 'you', 'he', 'she', 'we', 'they', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'with', 'as', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'your', 'my', 'me', 'him', 'her', 'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'these', 'those', 'am', 'been', 'being', 'if', 'any', 'both', 'dont', "don't", 'like', 'get', 'got', 'really', 'much', 'one', 'two']);

        const wordCount = {};
        messages.forEach(m => {
            if (!m.content) return;
            const words = m.content.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w));

            words.forEach(word => {
                wordCount[word] = (wordCount[word] || 0) + 1;
            });
        });

        // Convert to array and sort by frequency
        const wordCloud = Object.entries(wordCount)
            .map(([text, value]) => ({ text, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 50); // Top 50 words

        res.json(wordCloud);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Video/Post List for Filters
app.get('/api/analytics/posts', authenticate, async (req, res) => {
    const { accountId } = req.query;

    try {
        const where = {};
        if (accountId) where.accountId = accountId;

        const posts = await Message.findAll({
            where,
            attributes: ['postId', 'postTitle', 'accountId'],
            group: ['postId', 'postTitle', 'accountId'],
            order: [['postTitle', 'ASC']]
        });

        res.json(posts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sync All Active Accounts (Auto-sync on Dashboard Load)
app.post('/api/sync-all', authenticate, async (req, res) => {
    try {
        const accounts = await Account.findAll({ where: { isActive: true } });
        let totalSynced = 0;

        for (const account of accounts) {
            try {
                const count = await syncAccount(account);
                totalSynced += count;
            } catch (e) {
                console.error(`Sync failed for account ${account.id}:`, e.message);
            }
        }

        res.json({ message: `Synced ${totalSynced} new messages across ${accounts.length} accounts` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 7. USER SETTINGS
// ==========================================

// Get Current User Info
app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'role', 'createdAt']
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Change Password
app.post('/api/auth/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));