import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAccounts } from '../context/AccountContext';
import { toast } from 'react-hot-toast';
import api from '../api/api';
import {
  ChevronLeft, ChevronRight, RefreshCw, Youtube, Instagram, Bell,
  Eye, Heart, MessageCircle, Share2, Clock, CheckCircle, XCircle
} from 'lucide-react';
import MessageCard from '../components/MessageCard';
import NotificationDropdown from '../components/NotificationDropdown';

// ============ MEDIA EMBED COMPONENT ============
const MediaEmbed = ({ post, platform }) => {
  const [embedLoaded, setEmbedLoaded] = useState(false);

  if (platform === 'youtube' && post.embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
        <iframe
          src={`${post.embedUrl}?autoplay=0&rel=0&modestbranding=1`}
          title={post.postTitle}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setEmbedLoaded(true)}
        />
        {!embedLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
    );
  }

  if (platform === 'instagram' && post.embedUrl) {
    // Instagram embed using blockquote + script
    return (
      <div className="relative w-full bg-white rounded-xl overflow-hidden shadow-lg">
        <blockquote
          className="instagram-media"
          data-instgrm-captioned
          data-instgrm-permalink={post.embedUrl}
          data-instgrm-version="14"
          style={{
            background: '#FFF',
            border: 0,
            borderRadius: '12px',
            margin: '0 auto',
            maxWidth: '100%',
            minWidth: '240px',
            padding: 0,
            width: '100%'
          }}
        >
          <div style={{ padding: '16px' }}>
            <a href={post.embedUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">
              View on Instagram
            </a>
          </div>
        </blockquote>
        {/* Fallback image */}
        {post.mediaUrl && (
          <img
            src={post.mediaUrl}
            alt={post.postTitle}
            className="w-full object-cover max-h-80"
          />
        )}
      </div>
    );
  }

  // Fallback - show thumbnail
  return (
    <div className="relative w-full aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-lg">
      {post.mediaUrl ? (
        <img src={post.mediaUrl} alt={post.postTitle} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          {platform === 'youtube' ? <Youtube size={48} /> : <Instagram size={48} />}
        </div>
      )}
    </div>
  );
};

// ============ STAT CARD COMPONENT ============
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
    <div className={`p-2 rounded-lg`} style={{ backgroundColor: `${color}15` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value?.toLocaleString() || 0}</p>
    </div>
  </div>
);

// ============ INSIGHTS PANEL ============
const InsightsPanel = ({ post }) => {
  if (!post) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Video Insights</h4>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Eye} label="Views" value={post.viewCount} color="#6366f1" />
        <StatCard icon={Heart} label="Likes" value={post.likeCount} color="#ef4444" />
        <StatCard icon={MessageCircle} label="Comments" value={post.commentCount} color="#10b981" />
        <StatCard icon={Share2} label="Shares" value={post.shareCount} color="#8b5cf6" />
      </div>

      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Comment Status</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <Clock size={16} className="mx-auto text-amber-500 mb-1" />
            <p className="text-lg font-bold text-amber-600">{post.pendingCount}</p>
            <p className="text-[10px] text-amber-600/70">Pending</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <CheckCircle size={16} className="mx-auto text-green-500 mb-1" />
            <p className="text-lg font-bold text-green-600">{post.approvedCount}</p>
            <p className="text-[10px] text-green-600/70">Approved</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <XCircle size={16} className="mx-auto text-red-500 mb-1" />
            <p className="text-lg font-bold text-red-600">{post.rejectedCount}</p>
            <p className="text-[10px] text-red-600/70">Rejected</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN INBOX PAGE ============
const InboxPage = () => {
  const { accountId } = useParams();
  const { accounts, fetchAccounts } = useAccounts();
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [posts, setPosts] = useState([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const currentPost = posts[currentPostIndex] || null;

  // Fetch accounts
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Set selected account from URL param
  useEffect(() => {
    if (accountId && accounts.length > 0) {
      const account = accounts.find(a => a.id === parseInt(accountId));
      if (account) {
        setSelectedAccount(account);
      }
    }
  }, [accountId, accounts]);

  // Fetch posts when account changes
  const fetchPosts = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/posts-summary?accountId=${selectedAccount.id}`);
      setPosts(data);
      setCurrentPostIndex(0);
    } catch (e) {
      toast.error("Could not load posts");
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedAccount) {
      fetchPosts();
    }
  }, [selectedAccount, fetchPosts]);

  // Fetch messages when current post changes
  const fetchMessages = useCallback(async () => {
    if (!selectedAccount || !currentPost) {
      setMessages([]);
      return;
    }
    try {
      const { data } = await api.get(`/messages?accountId=${selectedAccount.id}&status=pending&postId=${currentPost.postId}`);
      setMessages(data);
    } catch (e) {
      console.error("Could not load comments:", e);
    }
  }, [selectedAccount, currentPost]);

  useEffect(() => {
    fetchMessages();
  }, [currentPost, fetchMessages]);

  // Navigation handlers with smooth transition
  const goToPrev = () => {
    if (currentPostIndex > 0 && !transitioning) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentPostIndex(i => i - 1);
        setTransitioning(false);
      }, 150);
    }
  };

  const goToNext = () => {
    if (currentPostIndex < posts.length - 1 && !transitioning) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentPostIndex(i => i + 1);
        setTransitioning(false);
      }, 150);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPostIndex, posts.length, transitioning]);

  // Sync handler
  const handleSync = async () => {
    if (!selectedAccount) return;
    setSyncing(true);
    try {
      await api.post(`/sync/${selectedAccount.id}`);
      toast.success("Synced!");
      await fetchPosts();
    } catch (e) {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Approve handler
  const handleApprove = async (id, text) => {
    try {
      await api.post(`/messages/${id}/approve`, { replyText: text });
      toast.success("Reply Sent!");
      setMessages(prev => prev.filter(m => m.id !== id));

      // Update post pending count
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.postId === currentPost.postId) {
          return { ...p, pendingCount: Math.max(0, p.pendingCount - 1), approvedCount: p.approvedCount + 1 };
        }
        return p;
      }));

      return true;
    } catch (e) {
      return false;
    }
  };

  // Loading state
  if (!selectedAccount || loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading account...</p>
        </div>
      </div>
    );
  }

  // No posts state
  if (posts.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${selectedAccount.platform === 'instagram'
              ? 'bg-gradient-to-br from-pink-500 to-purple-600'
              : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
              {selectedAccount.platform === 'youtube' ? <Youtube size={20} className="text-white" /> : <Instagram size={20} className="text-white" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{selectedAccount.name}</h1>
              <p className="text-xs text-gray-500 capitalize">{selectedAccount.platform}</p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {selectedAccount.platform === 'youtube' ? <Youtube size={40} className="text-gray-400" /> : <Instagram size={40} className="text-gray-400" />}
            </div>
            <p className="text-lg font-medium text-gray-600">No posts found</p>
            <p className="text-sm text-gray-400 mt-1">Click Sync to fetch latest content</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${selectedAccount.platform === 'instagram'
            ? 'bg-gradient-to-br from-pink-500 to-purple-600'
            : 'bg-gradient-to-br from-red-500 to-red-600'
            }`}>
            {selectedAccount.platform === 'youtube' ? <Youtube size={20} className="text-white" /> : <Instagram size={20} className="text-white" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedAccount.name}</h1>
            <p className="text-xs text-gray-500">
              Video {currentPostIndex + 1} of {posts.length}
            </p>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={goToPrev}
              disabled={currentPostIndex === 0 || transitioning}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <button
              onClick={goToNext}
              disabled={currentPostIndex >= posts.length - 1 || transitioning}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Media Sidebar */}
        <div className={`w-96 bg-white border-r border-gray-200 flex flex-col overflow-y-auto transition-opacity duration-150 ${transitioning ? 'opacity-50' : 'opacity-100'}`}>
          <div className="p-5 space-y-5">
            {/* Video Title */}
            <div>
              <h2 className="font-bold text-gray-900 text-lg line-clamp-2">{currentPost?.postTitle || 'Untitled'}</h2>
              {currentPost?.publishedAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Published: {new Date(currentPost.publishedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Media Embed */}
            <MediaEmbed post={currentPost} platform={selectedAccount.platform} />

            {/* Insights */}
            <InsightsPanel post={currentPost} />
          </div>
        </div>

        {/* Comments Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Comments Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                Pending Comments
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({messages.length})
                </span>
              </h3>
            </div>

            {/* Comments List */}
            {messages.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <p className="text-gray-600 font-medium">No pending comments</p>
                <p className="text-sm text-gray-400 mt-1">All caught up for this post!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <MessageCard key={msg.id} msg={msg} onApprove={handleApprove} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;
