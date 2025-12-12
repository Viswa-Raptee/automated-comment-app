const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Message, Post, Notification, User } = require('../database');
const { analyzeAndDraft } = require('./rag');

// --- AUTH HELPERS ---
function loadClientSecrets() {
    try {
        const p = path.join(__dirname, '..', 'client_secrets.json');
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            const cfg = JSON.parse(raw);
            const web = cfg.web || {};
            return {
                clientId: web.client_id || process.env.YT_CLIENT_ID,
                clientSecret: web.client_secret || process.env.YT_CLIENT_SECRET,
                redirectUri: web.redirect_uris?.[0] || process.env.YT_REDIRECT_URI
            };
        }
    } catch (e) { }

    return {
        clientId: process.env.YT_CLIENT_ID,
        clientSecret: process.env.YT_CLIENT_SECRET,
        redirectUri: process.env.YT_REDIRECT_URI
    };
}

function getOAuthClientWithRefresh(refreshToken) {
    const { clientId, clientSecret } = loadClientSecrets();
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
}


// --- YOUTUBE DATA API ---
async function postYouTubeReply(commentId, text, account) {
    const oauth2Client = getOAuthClientWithRefresh(account.secondaryToken);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
        const response = await youtube.comments.insert({
            part: 'snippet',
            requestBody: {
                snippet: { parentId: commentId, textOriginal: text }
            }
        });
        // Return the new reply comment ID
        return response.data?.id || true;
    } catch (e) {
        console.error("YT Reply Error:", e.message);
        throw new Error("Failed to reply on YouTube");
    }
}

// Update an existing YouTube comment
async function updateYouTubeComment(commentId, newText, account) {
    const oauth2Client = getOAuthClientWithRefresh(account.secondaryToken);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
        // Per YouTube API docs: need to provide full comment resource with id and snippet.textOriginal
        const response = await youtube.comments.update({
            part: 'snippet',
            requestBody: {
                id: commentId,
                snippet: {
                    textOriginal: newText
                }
            }
        });
        console.log('✅ YouTube comment updated:', commentId);
        return response.data?.id || true;
    } catch (e) {
        console.error("YT Update Error:", e.response?.data || e.message);
        throw new Error("Failed to update YouTube comment: " + (e.response?.data?.error?.message || e.message));
    }
}

// Delete a YouTube comment
async function deleteYouTubeComment(commentId, account) {
    const oauth2Client = getOAuthClientWithRefresh(account.secondaryToken);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
        await youtube.comments.delete({ id: commentId });
        return true;
    } catch (e) {
        console.error("YT Delete Error:", e.message);
        throw new Error("Failed to delete YouTube comment");
    }
}

// --- INSTAGRAM GRAPH API ---
async function postInstagramReply(commentId, text, account) {
    const url = `https://graph.facebook.com/v19.0/${commentId}/replies`;
    try {
        const response = await axios.post(url, {
            message: text,
            access_token: account.accessToken
        });
        // Return the new comment ID for tracking
        return response.data?.id || true;
    } catch (e) {
        console.error("IG Reply Error:", e.response?.data || e.message);
        throw new Error("Failed to reply on Instagram");
    }
}

// Delete an Instagram comment
async function deleteInstagramComment(commentId, account) {
    const url = `https://graph.facebook.com/v19.0/${commentId}`;
    try {
        await axios.delete(url, {
            params: { access_token: account.accessToken }
        });
        return true;
    } catch (e) {
        console.error("IG Delete Error:", e.response?.data || e.message);
        throw new Error("Failed to delete Instagram comment");
    }
}

// Update Instagram reply (delete old + post new)
async function updateInstagramReply(oldCommentId, parentCommentId, newText, account) {
    try {
        // Delete the old reply
        await deleteInstagramComment(oldCommentId, account);
        // Post new reply
        const newId = await postInstagramReply(parentCommentId, newText, account);
        return newId;
    } catch (e) {
        console.error("IG Update Error:", e.message);
        throw new Error("Failed to update Instagram reply");
    }
}

// --- AUTO-NOTIFICATION HELPER ---
async function notifyAllUsersForIntent(message, intent, accountId, postId) {
    const normalizedIntent = (intent || '').toLowerCase();
    if (normalizedIntent !== 'complaint' && normalizedIntent !== 'question') {
        return;
    }

    try {
        const allUsers = await User.findAll({ attributes: ['id', 'username'] });
        const notificationType = normalizedIntent === 'complaint' ? 'complaint' : 'question';

        for (const user of allUsers) {
            await Notification.create({
                userId: user.id,
                type: notificationType,
                messageId: message.id,
                accountId: accountId,
                postId: postId,
                content: `New ${notificationType}: "${message.content.substring(0, 60)}..."`,
                fromUser: 'System'
            });
        }
    } catch (err) {
        console.error('Auto-notification failed:', err.message);
    }
}

// --- SYNC LOGIC (Fetching Data for Master-Detail View) ---
async function syncAccount(account, options = {}) {
    const { skipAiGeneration = false } = options;
    let newCount = 0;

    // 1. YOUTUBE SYNC
    if (account.platform === 'youtube') {
        try {
            const oauth2Client = getOAuthClientWithRefresh(account.secondaryToken);
            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

            // Get Uploads Playlist
            const channels = await youtube.channels.list({ mine: true, part: 'contentDetails' });
            const uploadsId = channels.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

            if (uploadsId) {
                // Fetch recent videos from uploads
                const plist = await youtube.playlistItems.list({
                    playlistId: uploadsId,
                    part: 'snippet',
                    maxResults: 10
                });

                const videoIds = [];
                const videoDataMap = {};

                for (const item of plist.data.items || []) {
                    const videoId = item.snippet?.resourceId?.videoId;
                    if (!videoId) continue;

                    videoIds.push(videoId);
                    videoDataMap[videoId] = {
                        title: item.snippet?.title,
                        thumb: item.snippet?.thumbnails?.medium?.url,
                        publishedAt: item.snippet?.publishedAt
                    };
                }

                // Fetch video statistics in batch
                if (videoIds.length > 0) {
                    try {
                        const statsResponse = await youtube.videos.list({
                            part: 'statistics,snippet',
                            id: videoIds.join(',')
                        });

                        for (const video of statsResponse.data.items || []) {
                            const videoId = video.id;
                            const stats = video.statistics || {};
                            const embedUrl = `https://www.youtube.com/embed/${videoId}`;

                            // Create or Update Post record
                            const [post, created] = await Post.findOrCreate({
                                where: { postId: videoId },
                                defaults: {
                                    accountId: account.id,
                                    platform: 'youtube',
                                    postId: videoId,
                                    postTitle: videoDataMap[videoId]?.title || video.snippet?.title,
                                    mediaUrl: videoDataMap[videoId]?.thumb || video.snippet?.thumbnails?.medium?.url,
                                    embedUrl: embedUrl,
                                    viewCount: parseInt(stats.viewCount) || 0,
                                    likeCount: parseInt(stats.likeCount) || 0,
                                    commentCount: parseInt(stats.commentCount) || 0,
                                    shareCount: 0, // YouTube doesn't expose shares
                                    publishedAt: videoDataMap[videoId]?.publishedAt,
                                    lastSyncedAt: new Date()
                                }
                            });

                            if (!created) {
                                // Update existing post stats
                                await post.update({
                                    postTitle: videoDataMap[videoId]?.title || post.postTitle,
                                    viewCount: parseInt(stats.viewCount) || post.viewCount,
                                    likeCount: parseInt(stats.likeCount) || post.likeCount,
                                    commentCount: parseInt(stats.commentCount) || post.commentCount,
                                    lastSyncedAt: new Date()
                                });
                            }
                        }
                    } catch (statsErr) {
                        console.error('YT Stats Fetch Error:', statsErr.message);
                    }
                }

                // Fetch comments for each video
                for (const videoId of videoIds) {
                    const videoData = videoDataMap[videoId];

                    try {
                        const threads = await youtube.commentThreads.list({
                            part: 'snippet,replies',
                            videoId,
                            maxResults: 20,
                            textFormat: 'plainText'
                        });

                        for (const th of threads.data.items || []) {
                            const sn = th.snippet.topLevelComment.snippet;
                            const externalId = th.id;
                            const replyCount = th.snippet.totalReplyCount || 0;

                            const exists = await Message.findOne({ where: { externalId } });
                            if (!exists) {
                                let intent = null;
                                let aiDraft = null;

                                // Skip AI generation for already-replied comments
                                const isAlreadyReplied = replyCount > 0;

                                if (!skipAiGeneration && !isAlreadyReplied) {
                                    const ai = await analyzeAndDraft(sn.textDisplay, 'youtube');
                                    intent = ai.intent;
                                    aiDraft = ai.reply;
                                }

                                // Clean up author name (YouTube sometimes includes @ prefix)
                                let cleanAuthorName = sn.authorDisplayName || '';
                                if (cleanAuthorName.startsWith('@')) {
                                    cleanAuthorName = cleanAuthorName.substring(1);
                                }

                                const commentDate = sn.publishedAt ? new Date(sn.publishedAt) : new Date();

                                const newMsg = await Message.create({
                                    platform: 'youtube',
                                    accountId: account.id,
                                    externalId,
                                    postId: videoId,
                                    postTitle: videoData?.title,
                                    mediaUrl: videoData?.thumb,
                                    authorName: cleanAuthorName,
                                    authorId: sn.authorChannelId?.value || '',
                                    content: sn.textDisplay,
                                    intent,
                                    aiDraft,
                                    status: isAlreadyReplied ? 'posted' : 'pending',
                                    createdAt: commentDate,
                                    // For already-replied, set approval info
                                    approvedBy: isAlreadyReplied ? 'Synced' : null,
                                    postedAt: isAlreadyReplied ? commentDate : null
                                });

                                // Auto-notify for complaints/questions (only if AI ran and not replied)
                                if (intent && !isAlreadyReplied) {
                                    await notifyAllUsersForIntent(newMsg, intent, account.id, videoId);
                                }
                                newCount++;
                            }
                        }
                    } catch (commentErr) {
                        console.error(`YT Comments Error for ${videoId}:`, commentErr.message);
                    }
                }
            }
        } catch (e) {
            console.error('YT Sync Failed:', e.message);
        }
    }

    // 2. INSTAGRAM SYNC
    if (account.platform === 'instagram') {
        // Fetch media with insights
        const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp,comments{id,text,username,timestamp}';
        const url = `https://graph.facebook.com/v19.0/${account.identifier}/media?fields=${fields}&access_token=${account.accessToken}`;

        try {
            const resp = await axios.get(url);
            const mediaList = resp.data.data || [];

            for (const media of mediaList) {
                const mediaImage = media.thumbnail_url || media.media_url;
                const postTitle = media.caption ? media.caption.substring(0, 50) + "..." : "Instagram Post";
                const embedUrl = media.permalink; // Instagram embed uses permalink

                // Create or Update Post record
                const [post, created] = await Post.findOrCreate({
                    where: { postId: media.id },
                    defaults: {
                        accountId: account.id,
                        platform: 'instagram',
                        postId: media.id,
                        postTitle: postTitle,
                        mediaUrl: mediaImage,
                        embedUrl: embedUrl,
                        viewCount: 0, // Instagram doesn't expose views for all content
                        likeCount: parseInt(media.like_count) || 0,
                        commentCount: parseInt(media.comments_count) || 0,
                        shareCount: 0,
                        publishedAt: media.timestamp,
                        lastSyncedAt: new Date()
                    }
                });

                if (!created) {
                    await post.update({
                        likeCount: parseInt(media.like_count) || post.likeCount,
                        commentCount: parseInt(media.comments_count) || post.commentCount,
                        lastSyncedAt: new Date()
                    });
                }

                // Process comments
                if (media.comments) {
                    for (const c of media.comments.data) {
                        const exists = await Message.findOne({ where: { externalId: c.id } });
                        if (!exists) {
                            let intent = null;
                            let aiDraft = null;

                            if (!skipAiGeneration) {
                                const ai = await analyzeAndDraft(c.text, 'instagram');
                                intent = ai.intent;
                                aiDraft = ai.reply;
                            }

                            const newMsg = await Message.create({
                                platform: 'instagram',
                                accountId: account.id,
                                externalId: c.id,
                                postId: media.id,
                                postTitle: postTitle,
                                mediaUrl: mediaImage,
                                authorName: c.username,
                                content: c.text,
                                intent,
                                aiDraft,
                                status: 'pending',
                                createdAt: c.timestamp ? new Date(c.timestamp) : new Date()
                            });

                            // Auto-notify for complaints/questions (only if AI ran)
                            if (intent) {
                                await notifyAllUsersForIntent(newMsg, intent, account.id, media.id);
                            }
                            newCount++;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("IG Sync Failed:", e.message);
        }
    }

    return newCount;
}

module.exports = {
    postInstagramReply,
    postYouTubeReply,
    updateYouTubeComment,
    deleteYouTubeComment,
    deleteInstagramComment,
    updateInstagramReply,
    syncAccount,
    loadClientSecrets,
    notifyAllUsersForIntent
};