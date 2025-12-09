const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Message } = require('../database'); // Ensure correct path to database
const { analyzeAndDraft } = require('./rag');

// --- AUTH HELPERS ---
function loadClientSecrets() {
    try {
        // adjust path as needed depending on where you run server.js
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
    } catch (e) {}
    
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

// --- INSTAGRAM GRAPH API ---
async function postInstagramReply(commentId, text, account) {
    const url = `https://graph.facebook.com/v19.0/${commentId}/replies`;
    try {
        await axios.post(url, {
            message: text,
            access_token: account.accessToken
        });
        return true;
    } catch (e) {
        console.error("IG Reply Error:", e.response?.data || e.message);
        throw new Error("Failed to reply on Instagram");
    }
}

// --- YOUTUBE DATA API ---
async function postYouTubeReply(commentId, text, account) {
    const oauth2Client = getOAuthClientWithRefresh(account.secondaryToken);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
        await youtube.comments.insert({
            part: 'snippet',
            requestBody: {
                snippet: { parentId: commentId, textOriginal: text }
            }
        });
        return true;
    } catch (e) {
        console.error("YT Reply Error:", e.message);
        throw new Error("Failed to reply on YouTube");
    }
}

// --- SYNC LOGIC (Fetching Data for Master-Detail View) ---
async function syncAccount(account) {
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

                for (const item of plist.data.items || []) {
                    const videoId = item.snippet?.resourceId?.videoId;
                    const videoTitle = item.snippet?.title; // <--- CAPTURED FOR UI
                    const thumb = item.snippet?.thumbnails?.medium?.url; // <--- CAPTURED FOR UI
                    
                    if (!videoId) continue;

                    // Fetch threads for this video
                    const threads = await youtube.commentThreads.list({ 
                        part: 'snippet', 
                        videoId, 
                        maxResults: 20, 
                        textFormat: 'plainText' 
                    });

                    for (const th of threads.data.items || []) {
                        const sn = th.snippet.topLevelComment.snippet;
                        const externalId = th.id;

                        // Check if message exists
                        const exists = await Message.findOne({ where: { externalId } });
                        if (!exists) {
                            const ai = await analyzeAndDraft(sn.textDisplay, 'youtube');
                            
                            await Message.create({
                                platform: 'youtube',
                                accountId: account.id,
                                externalId,
                                
                                // Grouping Fields
                                postId: videoId,
                                postTitle: videoTitle, 
                                mediaUrl: thumb,

                                authorName: sn.authorDisplayName,
                                authorId: sn.authorChannelId?.value || '',
                                content: sn.textDisplay,
                                intent: ai.intent,
                                aiDraft: ai.reply,
                                status: 'pending'
                            });
                            newCount++;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('YT Sync Failed:', e.message);
        }
    }
    
    // 2. INSTAGRAM SYNC
    if (account.platform === 'instagram') {
        // Updated URL to fetch Caption and Media URL for the UI
        const fields = 'caption,media_url,thumbnail_url,comments{id,text,username,timestamp}';
        const url = `https://graph.facebook.com/v19.0/${account.identifier}/media?fields=${fields}&access_token=${account.accessToken}`;
        
        try {
            const resp = await axios.get(url);
            const mediaList = resp.data.data || [];
            
            for (const media of mediaList) {
                // Determine Media URL (Video has thumbnail_url, Image has media_url)
                const mediaImage = media.thumbnail_url || media.media_url;
                const postTitle = media.caption ? media.caption.substring(0, 50) + "..." : "Instagram Post";

                if (media.comments) {
                    for (const c of media.comments.data) {
                        const exists = await Message.findOne({ where: { externalId: c.id } });
                        if (!exists) {
                            const ai = await analyzeAndDraft(c.text, 'instagram');
                            
                            await Message.create({
                                platform: 'instagram',
                                accountId: account.id,
                                externalId: c.id,
                                
                                // Grouping Fields
                                postId: media.id,
                                postTitle: postTitle,
                                mediaUrl: mediaImage,

                                authorName: c.username,
                                content: c.text,
                                intent: ai.intent,
                                aiDraft: ai.reply,
                                status: 'pending'
                            });
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
    syncAccount,
    loadClientSecrets // Exported for server.js to use in OAuth handshake
};