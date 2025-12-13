const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// --- IMPORTS ---
const { sequelize, User, Account, Post, Message, Notification, Template } = require('./database');
const { authenticate, isAdmin } = require('./middleware/auth');
const { syncAccount, postInstagramReply, postYouTubeReply, updateYouTubeComment, updateInstagramReply, loadClientSecrets, notifyAllUsersForIntent } = require('./services/platforms');

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

        console.log("✅ OAuth Success! Redirecting with accountId:", acc.id);
        // Redirect with accountId so frontend can trigger onboarding
        res.redirect(`http://localhost:8080/manage-accounts?status=success&accountId=${acc.id}`);
    } catch (e) {
        console.error("OAuth Callback Error:", e.response?.data || e.message);
        res.redirect(`http://localhost:8080/manage-accounts?status=error&message=${encodeURIComponent(e.message)}`);
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
        const accountId = req.params.id;
        const deleteData = req.query.deleteData !== 'false'; // default true

        if (deleteData) {
            // Delete all related records (full delete)
            await Notification.destroy({ where: { accountId } });
            await Message.destroy({ where: { accountId } });
            await Post.destroy({ where: { accountId } });
        }

        await Account.destroy({ where: { id: accountId } });
        res.json({ success: true, dataDeleted: deleteData });
    } catch (e) {
        console.error('Delete account error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 3B. ACCOUNT ONBOARDING (New Accounts)
// ==========================================

const batchProcessor = require('./services/batchProcessor');
const { analyzeAndDraft } = require('./services/rag');

// Onboard account - sync and return summary (NO AI generation)
app.post('/api/accounts/:id/onboard', authenticate, async (req, res) => {
    try {
        const account = await Account.findByPk(req.params.id);
        if (!account) return res.status(404).json({ error: 'Account not found' });

        // Sync the account to fetch videos and comments (skip AI generation)
        const newCount = await syncAccount(account, { skipAiGeneration: true });

        // Get summary stats - ONLY count parent comments (exclude nested replies)
        const [videoCount, totalComments, pendingCount, approvedCount] = await Promise.all([
            Post.count({ where: { accountId: account.id } }),
            Message.count({ where: { accountId: account.id, parentId: null } }),  // Only parents
            Message.count({ where: { accountId: account.id, status: 'pending', parentId: null } }),  // Unreplied parents
            Message.count({ where: { accountId: account.id, status: 'posted', parentId: null } })   // Replied parents
        ]);

        // Get post date range
        const posts = await Post.findAll({
            where: { accountId: account.id },
            attributes: ['publishedAt'],
            order: [['publishedAt', 'ASC']]
        });

        const earliestPost = posts[0]?.publishedAt;
        const latestPost = posts[posts.length - 1]?.publishedAt;

        res.json({
            success: true,
            account: {
                id: account.id,
                name: account.name,
                platform: account.platform
            },
            summary: {
                videos: videoCount,
                totalComments,
                unrepliedComments: pendingCount,
                approvedComments: approvedCount,
                newComments: newCount,
                earliestPost,
                latestPost
            }
        });
    } catch (e) {
        console.error('Onboard error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Batch generate replies for past comments (with optional date range)
app.post('/api/accounts/:id/batch-generate', authenticate, async (req, res) => {
    try {
        const account = await Account.findByPk(req.params.id);
        if (!account) return res.status(404).json({ error: 'Account not found' });

        const { startDate, endDate } = req.body;

        // Get posts within date range (if specified)
        let postIds = null;
        if (startDate || endDate) {
            const postWhere = { accountId: account.id };
            if (startDate) postWhere.publishedAt = { ...(postWhere.publishedAt || {}), [require('sequelize').Op.gte]: new Date(startDate) };
            if (endDate) postWhere.publishedAt = { ...(postWhere.publishedAt || {}), [require('sequelize').Op.lte]: new Date(endDate) };

            const posts = await Post.findAll({ where: postWhere, attributes: ['postId'] });
            postIds = posts.map(p => p.postId);
        }

        // Get all PARENT comments without AI drafts (optionally filtered by post date)
        // Only generate AI for parent comments, not nested replies
        const messageWhere = {
            accountId: account.id,
            aiDraft: null,
            parentId: null  // Only parent comments, not replies
        };
        if (postIds !== null) {
            messageWhere.postId = { [require('sequelize').Op.in]: postIds };
        }

        const pendingComments = await Message.findAll({
            where: messageWhere,
            order: [['createdAt', 'ASC']]
        });

        if (pendingComments.length === 0) {
            return res.json({ success: true, message: 'No comments to process', jobId: null });
        }

        // Create a job
        const jobId = batchProcessor.createJob(account.id, pendingComments.length);

        // Start batch processing asynchronously (don't await)
        batchProcessor.processBatch(jobId, pendingComments, async (comment) => {
            const result = await analyzeAndDraft(comment.content, comment.platform || 'youtube');
            await comment.update({
                intent: result.intent,
                aiDraft: result.reply
            });

            // Send notification for complaints and questions
            await notifyAllUsersForIntent(comment, result.intent, account.id, comment.postId);
        });

        res.json({
            success: true,
            jobId,
            total: pendingComments.length,
            accountName: account.name,
            message: 'Batch processing started'
        });
    } catch (e) {
        console.error('Batch generate error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get job status
app.get('/api/jobs/:jobId/status', authenticate, async (req, res) => {
    const job = batchProcessor.getJobStatus(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
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

// NEW: Get Summary of Posts with Stats (for Media Carousel)
app.get('/api/posts-summary', authenticate, async (req, res) => {
    const { accountId } = req.query;
    try {
        // Get all posts for this account with pending count
        const posts = await Post.findAll({
            where: { accountId },
            order: [['lastSyncedAt', 'DESC']]
        });

        // Get pending counts for each post
        const postsWithCounts = await Promise.all(posts.map(async (post) => {
            const pendingCount = await Message.count({
                where: { accountId, postId: post.postId, status: 'pending' }
            });
            const approvedCount = await Message.count({
                where: { accountId, postId: post.postId, status: 'posted' }
            });
            const rejectedCount = await Message.count({
                where: { accountId, postId: post.postId, status: 'rejected' }
            });

            return {
                id: post.id,
                postId: post.postId,
                postTitle: post.postTitle,
                mediaUrl: post.mediaUrl,
                embedUrl: post.embedUrl,
                platform: post.platform,
                viewCount: post.viewCount,
                likeCount: post.likeCount,
                commentCount: post.commentCount,
                shareCount: post.shareCount,
                publishedAt: post.publishedAt,
                pendingCount,
                approvedCount,
                rejectedCount
            };
        }));

        // Sort by pending count descending
        postsWithCounts.sort((a, b) => b.pendingCount - a.pendingCount);

        res.json(postsWithCounts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get ALL Messages (for client-side caching)
app.get('/api/messages/all', authenticate, async (req, res) => {
    try {
        const msgs = await Message.findAll({
            order: [['createdAt', 'DESC']],
            include: { model: Account, attributes: ['id', 'name', 'platform'] }
        });
        res.json(msgs);
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

// Get threaded messages (grouped by threadId with nested structure)
app.get('/api/messages/threaded', authenticate, async (req, res) => {
    try {
        const { postId, accountId } = req.query;
        const where = { parentId: null };  // Only get top-level comments

        if (postId) where.postId = postId;
        if (accountId) where.accountId = accountId;

        const parentMessages = await Message.findAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [
                { model: Account, attributes: ['name', 'platform'] },
                {
                    model: Message,
                    as: 'replies',
                    order: [['createdAt', 'ASC']],
                    include: [
                        {
                            model: Message,
                            as: 'replies',  // Nested replies (for multi-level)
                            order: [['createdAt', 'ASC']]
                        }
                    ]
                }
            ]
        });

        res.json(parentMessages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get ALL messages across all accounts (for unified comment view)
app.get('/api/messages/all', authenticate, async (req, res) => {
    try {
        const { platform, status, dateRange } = req.query;
        const where = {};

        if (platform) where.platform = platform;
        if (status && status !== 'all') where.status = status;

        // Date range filter
        if (dateRange && dateRange !== 'all') {
            const now = new Date();
            let since;
            if (dateRange === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
            else if (dateRange === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
            else if (dateRange === '30d') since = new Date(now - 30 * 24 * 60 * 60 * 1000);
            if (since) where.createdAt = { [require('sequelize').Op.gte]: since };
        }

        const messages = await Message.findAll({
            where,
            order: [['createdAt', 'DESC']],
            include: { model: Account, attributes: ['name', 'platform', 'identifier'] }
        });

        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generate AI reply on-demand for a specific message
app.post('/api/messages/:id/generate-reply', authenticate, async (req, res) => {
    try {
        const msg = await Message.findByPk(req.params.id, { include: Account });
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        if (msg.aiDraft) {
            return res.json({ success: true, message: msg, note: 'AI draft already exists' });
        }

        const { analyzeAndDraft } = require('./services/rag');
        const ai = await analyzeAndDraft(msg.content, msg.platform);

        msg.intent = ai.intent;
        msg.aiDraft = ai.reply;
        await msg.save();

        console.log(`🤖 Generated AI reply for message ${msg.id}`);
        res.json({ success: true, message: msg });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Reply to a specific comment (creates a new message and posts to platform)
app.post('/api/messages/:id/reply', authenticate, async (req, res) => {
    const { replyText } = req.body;
    if (!replyText) return res.status(400).json({ error: 'Reply text is required' });

    try {
        const parentMsg = await Message.findByPk(req.params.id, { include: Account });
        if (!parentMsg) return res.status(404).json({ error: 'Message not found' });

        let replyId = null;

        // Post reply to platform
        if (parentMsg.Account.platform === 'youtube') {
            // Reply to the specific comment (use comment ID, not thread ID)
            const commentId = parentMsg.externalId.startsWith('Ug')
                ? parentMsg.externalId.split('.')[0]  // Extract comment ID from thread ID
                : parentMsg.externalId;
            replyId = await postYouTubeReply(commentId, replyText, parentMsg.Account);
        } else if (parentMsg.Account.platform === 'instagram') {
            replyId = await postInstagramReply(parentMsg.externalId, replyText, parentMsg.Account);
        }

        // Create reply message in database
        const replyMsg = await Message.create({
            platform: parentMsg.platform,
            accountId: parentMsg.accountId,
            externalId: replyId || `reply_${Date.now()}`,
            threadId: parentMsg.threadId,
            parentId: parentMsg.id,
            postId: parentMsg.postId,
            postTitle: parentMsg.postTitle,
            mediaUrl: parentMsg.mediaUrl,
            authorName: req.user.username,
            content: replyText,
            status: 'posted',
            approvedBy: req.user.username,
            postedAt: new Date(),
            replyExternalId: replyId
        });

        console.log(`💬 Reply posted by ${req.user.username} to message ${parentMsg.id}`);
        res.json({ success: true, reply: replyMsg });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Approve & Reply - Creates a child "Our Reply" message
app.post('/api/messages/:id/approve', authenticate, async (req, res) => {
    const { replyText } = req.body;

    try {
        const msg = await Message.findByPk(req.params.id, { include: Account });
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        const finalReply = replyText || msg.aiDraft;
        let replyId = null;

        // Execute Platform Reply
        if (msg.Account.platform === 'youtube') {
            replyId = await postYouTubeReply(msg.externalId, finalReply, msg.Account);
        } else if (msg.Account.platform === 'instagram') {
            replyId = await postInstagramReply(msg.externalId, finalReply, msg.Account);
        }

        // Mark parent as posted (has been replied to)
        msg.status = 'posted';
        msg.aiDraft = finalReply;
        msg.approvedBy = req.user.username;
        msg.postedAt = new Date();
        await msg.save();

        // Create child "Our Reply" message
        const ourReply = await Message.create({
            platform: msg.platform,
            accountId: msg.accountId,
            externalId: replyId || `reply-${Date.now()}`,
            threadId: msg.threadId || msg.externalId,
            parentId: msg.id,  // Link to parent
            postId: msg.postId,
            postTitle: msg.postTitle,
            mediaUrl: msg.mediaUrl,
            authorName: msg.Account.name,  // Channel/account name
            authorId: msg.Account.identifier || '',
            content: finalReply,
            intent: null,
            aiDraft: null,
            status: 'posted',
            approvedBy: 'Channel Owner',  // Mark as our reply
            postedAt: new Date(),
            createdAt: new Date()
        });

        res.json({ success: true, ourReply });
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

// ==========================================
// 8. COMMENT ACTIONS
// ==========================================

// Toggle Important
app.put('/api/messages/:id/important', authenticate, async (req, res) => {
    try {
        const msg = await Message.findByPk(req.params.id);
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        msg.isImportant = !msg.isImportant;
        msg.markedImportantBy = msg.isImportant ? req.user.username : null;
        await msg.save();

        res.json({ success: true, isImportant: msg.isImportant, markedImportantBy: msg.markedImportantBy });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Assign to User
app.put('/api/messages/:id/assign', authenticate, async (req, res) => {
    const { assignedTo } = req.body;
    try {
        const msg = await Message.findByPk(req.params.id, { include: Account });
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        msg.assignedTo = assignedTo;
        msg.assignedBy = req.user.username;
        await msg.save();

        // Create notification for assigned user
        if (assignedTo) {
            const targetUser = await User.findOne({ where: { username: assignedTo } });
            if (targetUser) {
                await Notification.create({
                    userId: targetUser.id,
                    type: 'assignment',
                    messageId: msg.id,
                    accountId: msg.accountId,
                    postId: msg.postId,
                    content: `You were assigned a comment by @${req.user.username}: "${msg.content.substring(0, 50)}..."`,
                    fromUser: req.user.username
                });
            }
        }

        res.json({ success: true, assignedTo: msg.assignedTo, assignedBy: msg.assignedBy });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add Notes
app.put('/api/messages/:id/notes', authenticate, async (req, res) => {
    const { notes } = req.body;
    try {
        const msg = await Message.findByPk(req.params.id);
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        msg.notes = notes;
        msg.notesAddedBy = req.user.username;
        await msg.save();

        res.json({ success: true, notes: msg.notes, notesAddedBy: msg.notesAddedBy });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all users for assignment dropdown
app.get('/api/users/list', authenticate, async (req, res) => {
    try {
        const users = await User.findAll({ attributes: ['id', 'username', 'role'] });
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Edit posted reply (update aiDraft and audit)
app.put('/api/messages/:id/edit-reply', authenticate, async (req, res) => {
    const { replyText } = req.body;
    try {
        const msg = await Message.findByPk(req.params.id, { include: Account });
        if (!msg) return res.status(404).json({ error: 'Message not found' });
        if (msg.status !== 'posted') return res.status(400).json({ error: 'Can only edit posted messages' });

        const previousReply = msg.content || msg.aiDraft;

        // Determine which ID to use for platform update
        // For "Our Reply" child cards (created from approve), externalId IS the reply ID
        // For legacy parent cards, replyExternalId has the reply ID
        const replyIdForPlatform = msg.parentId ? msg.externalId : msg.replyExternalId;

        // Update on platform
        if (msg.Account.platform === 'youtube') {
            if (replyIdForPlatform) {
                await updateYouTubeComment(replyIdForPlatform, replyText, msg.Account);
            } else {
                console.log('⚠️ No reply ID stored, updating locally only');
            }
        } else if (msg.Account.platform === 'instagram') {
            // Instagram: delete and repost
            if (replyIdForPlatform) {
                const parentCommentId = msg.parentId ?
                    (await Message.findByPk(msg.parentId))?.externalId : msg.externalId;
                const newId = await updateInstagramReply(replyIdForPlatform, parentCommentId, replyText, msg.Account);
                msg.externalId = newId;  // Update with new ID
            } else {
                console.log('⚠️ No reply ID stored, updating locally only');
            }
        }

        // Update both content and aiDraft to cover all cases
        msg.content = replyText;
        msg.aiDraft = replyText;
        msg.editedBy = req.user.username;
        msg.editedAt = new Date();
        await msg.save();

        console.log(`📝 Reply edited by ${req.user.username}: "${previousReply}" -> "${replyText}"`);

        res.json({ success: true, message: msg });
    } catch (e) {
        console.error('Edit reply error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Reject/Dismiss a message
app.put('/api/messages/:id/reject', authenticate, async (req, res) => {
    try {
        const msg = await Message.findByPk(req.params.id);
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        msg.status = 'rejected';
        msg.approvedBy = req.user.username; // Track who rejected
        await msg.save();

        res.json({ success: true, message: msg });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 9. NOTIFICATIONS
// ==========================================

// Get user notifications
app.get('/api/notifications', authenticate, async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']],
            limit: 50,
            include: [{ model: Message, attributes: ['id', 'content', 'authorName', 'postId', 'accountId'] }]
        });
        res.json(notifications);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get unread count
app.get('/api/notifications/unread-count', authenticate, async (req, res) => {
    try {
        const count = await Notification.count({
            where: { userId: req.user.id, isRead: false }
        });
        res.json({ count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Mark as read
app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
    try {
        await Notification.update(
            { isRead: true },
            { where: { id: req.params.id, userId: req.user.id } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Mark all as read
app.put('/api/notifications/read-all', authenticate, async (req, res) => {
    try {
        await Notification.update(
            { isRead: true },
            { where: { userId: req.user.id } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete notification
app.delete('/api/notifications/:id', authenticate, async (req, res) => {
    try {
        await Notification.destroy({
            where: { id: req.params.id, userId: req.user.id }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Clear all notifications
app.delete('/api/notifications/clear-all', authenticate, async (req, res) => {
    try {
        await Notification.destroy({
            where: { userId: req.user.id }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 10. CHROMA DATABASE MANAGEMENT (Admin)
// ==========================================

const chromaManager = require('./services/chromaManager');
const { ChromaConfig } = require('./database');

// Get all saved Chroma configs
app.get('/api/admin/chroma/configs', authenticate, isAdmin, async (req, res) => {
    try {
        const configs = await ChromaConfig.findAll({
            attributes: ['id', 'name', 'tenant', 'database', 'isActive', 'activeCollection', 'createdAt']
        });
        res.json(configs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add new Chroma config
app.post('/api/admin/chroma/configs', authenticate, isAdmin, async (req, res) => {
    try {
        const { name, apiKey, tenant, database } = req.body;

        // Test connection first
        const testResult = await chromaManager.testConnection({ apiKey, tenant, database });
        if (!testResult.success) {
            return res.status(400).json({ error: `Connection failed: ${testResult.error}` });
        }

        const config = await ChromaConfig.create({ name, apiKey, tenant, database });
        res.json({
            success: true,
            id: config.id,
            message: 'Database configuration saved successfully'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Chroma config
app.delete('/api/admin/chroma/configs/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.id);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        await config.destroy();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get collections for a config
app.get('/api/admin/chroma/collections/:configId', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        const collections = await chromaManager.listCollections(config);
        res.json(collections);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create collection
app.post('/api/admin/chroma/collections/:configId', authenticate, isAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        await chromaManager.createCollection(config, name);
        res.json({ success: true, message: `Collection '${name}' created` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete collection
app.delete('/api/admin/chroma/collections/:configId/:name', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        await chromaManager.deleteCollection(config, req.params.name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get documents in collection
app.get('/api/admin/chroma/documents/:configId/:collection', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        const documents = await chromaManager.getDocuments(config, req.params.collection);
        res.json(documents);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add document
app.post('/api/admin/chroma/documents/:configId/:collection', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        const doc = await chromaManager.addDocument(config, req.params.collection, req.body);
        res.json({ success: true, document: doc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update document
app.put('/api/admin/chroma/documents/:configId/:collection/:docId', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        const doc = await chromaManager.updateDocument(config, req.params.collection, req.params.docId, req.body);
        res.json({ success: true, document: doc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete document
app.delete('/api/admin/chroma/documents/:configId/:collection/:docId', authenticate, isAdmin, async (req, res) => {
    try {
        const config = await ChromaConfig.findByPk(req.params.configId);
        if (!config) return res.status(404).json({ error: 'Config not found' });

        await chromaManager.deleteDocument(config, req.params.collection, req.params.docId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Activate config and collection
app.post('/api/admin/chroma/activate/:configId/:collection', authenticate, isAdmin, async (req, res) => {
    try {
        await chromaManager.setActiveConfig(req.params.configId, req.params.collection);
        res.json({ success: true, message: 'Database and collection activated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get active config
app.get('/api/admin/chroma/active', authenticate, async (req, res) => {
    try {
        const config = await chromaManager.getActiveConfig();
        if (!config) {
            return res.json({ active: false, config: null });
        }
        res.json({
            active: true,
            config: {
                id: config.id,
                name: config.name,
                tenant: config.tenant,
                database: config.database,
                activeCollection: config.activeCollection
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// TEMPLATE MANAGEMENT (for slash-commands)
// ==========================================

// Get all templates
app.get('/api/templates', authenticate, async (req, res) => {
    try {
        const templates = await Template.findAll({ order: [['title', 'ASC']] });
        res.json(templates);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create template
app.post('/api/templates', authenticate, async (req, res) => {
    const { title, key, content } = req.body;

    if (!title || !key || !content) {
        return res.status(400).json({ error: 'Title, key, and content are required' });
    }

    // Clean key - remove leading slash if present, lowercase
    const cleanKey = key.replace(/^\//, '').toLowerCase().trim();

    try {
        const template = await Template.create({
            title,
            key: cleanKey,
            content,
            createdBy: req.user.username
        });
        res.json(template);
    } catch (e) {
        if (e.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Template key already exists' });
        }
        res.status(500).json({ error: e.message });
    }
});

// Update template
app.put('/api/templates/:id', authenticate, async (req, res) => {
    const { title, key, content } = req.body;

    try {
        const template = await Template.findByPk(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        if (title) template.title = title;
        if (key) template.key = key.replace(/^\//, '').toLowerCase().trim();
        if (content) template.content = content;
        template.updatedBy = req.user.username;

        await template.save();
        res.json(template);
    } catch (e) {
        if (e.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Template key already exists' });
        }
        res.status(500).json({ error: e.message });
    }
});

// Delete template
app.delete('/api/templates/:id', authenticate, async (req, res) => {
    try {
        const template = await Template.findByPk(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        await template.destroy();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));