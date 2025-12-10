import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAccounts } from '../context/AccountContext';
import { toast } from 'react-hot-toast';
import api from '../api/api';
import { ArrowLeft, RefreshCw, Play, Youtube, Instagram, ChevronDown, Bell, CheckCircle } from 'lucide-react';
import PipWindow from '../components/PipWindow';
import MessageCard from '../components/MessageCard';

const InboxPage = () => {
  const { accountId } = useParams();
  const { accounts, fetchAccounts } = useAccounts();
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [activePost, setActivePost] = useState(null); // The video currently selected
  const [pipMedia, setPipMedia] = useState(null); // The video in PiP

  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch accounts and set selected based on URL param
  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (accountId && accounts.length > 0) {
      const account = accounts.find(a => a.id === parseInt(accountId));
      if (account) {
        setSelectedAccount(account);
      }
    }
  }, [accountId, accounts]);

  // 1. Fetch Post Summary (List View)
  const fetchPosts = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/posts-summary?accountId=${selectedAccount.id}`);
      setPosts(data);
    } catch { toast.error("Could not load posts"); }
    finally { setLoading(false); }
  };

  // 2. Fetch Messages for a specific Post (Detail View)
  const fetchPostMessages = async (postId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/messages?accountId=${selectedAccount.id}&status=pending&postId=${postId}`);
      setMessages(data);
    } catch { toast.error("Could not load comments"); }
    finally { setLoading(false); }
  };

  // Initial Load when account changes
  useEffect(() => {
    setViewMode('list');
    setActivePost(null);
    if (selectedAccount) fetchPosts();
  }, [selectedAccount]);

  const handleSync = async () => {
    if (!selectedAccount) return;
    setSyncing(true);
    try {
      await api.post(`/sync/${selectedAccount.id}`);
      toast.success("Synced!");
      // Refresh the list and re-order
      fetchPosts();
      // If we are inside a post, refresh that too
      if (activePost) fetchPostMessages(activePost.postId);
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  };

  const handleApprove = async (id, text) => {
    try {
      await api.post(`/messages/${id}/approve`, { replyText: text });
      toast.success("Reply Sent!");
      setMessages(prev => prev.filter(m => m.id !== id));

      // Update the count in the post list locally
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.postId === activePost.postId) {
          return { ...p, pendingCount: p.pendingCount - 1 };
        }
        return p;
      }).filter(p => p.pendingCount > 0)); // Remove post from list if count is 0

      // If no messages left, go back to list
      if (messages.length <= 1) {
        setViewMode('list');
        setActivePost(null);
      }
      return true;
    } catch { return false; }
  };

  // Open Detail View
  const openPost = (post) => {
    setActivePost(post);
    setViewMode('detail');
    fetchPostMessages(post.postId);
  };

  // Open PiP
  const openPiP = (e, post) => {
    e.stopPropagation(); // Don't trigger the row click
    setPipMedia(post);
  };

  if (!selectedAccount) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
          <Instagram size={32} className="text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-600">Loading account...</p>
        <p className="text-sm text-gray-400 mt-1">Please wait while we fetch your data</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          {viewMode === 'detail' && (
            <button
              onClick={() => setViewMode('list')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center shadow-md
              ${selectedAccount.platform === 'instagram'
                ? 'bg-gradient-to-br from-pink-500 to-purple-600'
                : 'bg-gradient-to-br from-red-500 to-red-600'
              }
            `}>
              {selectedAccount.platform === 'youtube'
                ? <Youtube size={20} className="text-white" />
                : <Instagram size={20} className="text-white" />
              }
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {viewMode === 'list' ? selectedAccount.name : activePost?.postTitle}
              </h1>
              <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                {viewMode === 'list'
                  ? `${selectedAccount.platform} • Active Conversations`
                  : `Viewing comments`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Button */}
          <button className="relative p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : viewMode === 'list' ? (
          // ============ LIST VIEW ============
          posts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <p className="text-gray-600 font-medium">No pending comments</p>
              <p className="text-sm text-gray-400 mt-1">All caught up! Great work.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {posts.map(post => (
                <div
                  key={post.postId}
                  onClick={() => openPost(post)}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail / Icon */}
                    <div className="relative w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {post.mediaUrl && !post.mediaUrl.includes('placeholder') ? (
                        <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {selectedAccount.platform === 'youtube' ? <Youtube /> : <Instagram />}
                        </div>
                      )}
                      {/* Overlay Icon for PiP */}
                      <button
                        onClick={(e) => openPiP(e, post)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                        title="Watch in Picture-in-Picture"
                      >
                        <Play size={20} className="text-white fill-current" />
                      </button>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 line-clamp-1 text-lg group-hover:text-indigo-600 transition-colors">
                        {post.postTitle || 'Untitled Post'}
                      </h3>
                      <p className="text-sm text-gray-400 font-mono">ID: {post.postId?.substring(0, 20)}...</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                      {post.pendingCount} Pending
                    </span>
                    <ChevronDown className="text-gray-300 -rotate-90 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // ============ DETAIL VIEW (Comment List) ============
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map(msg => <MessageCard key={msg.id} msg={msg} onApprove={handleApprove} />)}
          </div>
        )}
      </div>

      {/* ============ PiP MODAL (DRAGGABLE) ============ */}
      {pipMedia && (
        <PipWindow
          post={pipMedia}
          onClose={() => setPipMedia(null)}
          platform={selectedAccount.platform}
        />
      )}
    </div>
  );
};

export default InboxPage;
