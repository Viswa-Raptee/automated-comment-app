import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccounts } from '../context/AccountContext';
import { toast } from 'react-hot-toast';
import api from '../api/api';
import {
    RefreshCw, Youtube, Instagram, Eye, Heart, MessageSquare,
    Share2, AlertCircle, CheckCircle2, Play, BarChart3
} from 'lucide-react';
import NotificationDropdown from '../components/NotificationDropdown';

// ============ PROFESSIONAL VIDEO CARD ============
const VideoCard = ({ post, platform, onClick }) => {
    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-indigo-500/30 transition-all duration-300 group flex flex-col h-full"
        >
            {/* Media Thumbnail Section */}
            <div className="relative aspect-video bg-gray-100 overflow-hidden">
                {post.mediaUrl ? (
                    <img
                        src={post.mediaUrl}
                        alt={post.postTitle}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        {platform === 'youtube' ? <Youtube size={40} /> : <Instagram size={40} />}
                    </div>
                )}

                {/* Overlay Gradient on Hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play size={20} className="text-indigo-600 ml-1" fill="currentColor" />
                    </div>
                </div>

                {/* Status Badge (Only show if action needed) */}
                {post.pendingCount > 0 && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/95 backdrop-blur shadow-sm px-2.5 py-1 rounded-full border border-orange-100">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        <span className="text-xs font-semibold text-orange-700">{post.pendingCount} Pending</span>
                    </div>
                )}

                {/* Platform Icon */}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur p-1.5 rounded-lg shadow-sm border border-gray-100">
                    {platform === 'youtube' ? 
                        <Youtube size={14} className="text-red-600" /> : 
                        <Instagram size={14} className="text-pink-600" />
                    }
                </div>
            </div>

            {/* Content Section */}
            <div className="p-5 flex flex-col flex-1">
                {/* Title */}
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-4 group-hover:text-indigo-600 transition-colors min-h-[2.5em]">
                    {post.postTitle || 'Untitled Post'}
                </h3>

                {/* Divider */}
                <div className="h-px bg-gray-50 mb-4" />

                {/* Stats Grid - Clean & Minimal */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    <StatItem icon={Eye} value={post.viewCount} label="Views" />
                    <StatItem icon={Heart} value={post.likeCount} label="Likes" />
                    <StatItem icon={MessageSquare} value={post.commentCount} label="Comments" />
                    <StatItem icon={Share2} value={post.shareCount} label="Shares" />
                </div>

                {/* Action Footer */}
                <div className="mt-auto bg-gray-50 rounded-lg p-3 flex justify-between items-center border border-gray-100">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">Performance</span>
                    </div>
                    
                    {post.pendingCount > 0 ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                            Review Now <ArrowRightIcon />
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                            <CheckCircle2 size={12} /> All Clear
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper Sub-component for Stats
const StatItem = ({ icon: Icon, value, label }) => (
    <div className="flex flex-col items-center">
        <Icon size={14} className="text-gray-400 mb-1" />
        <span className="text-xs font-bold text-gray-700">
            {value ? Number(value).toLocaleString([], { notation: "compact", maximumFractionDigits: 1 }) : 0}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
    </div>
);

const ArrowRightIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
);

// ============ MAIN PAGE ============
const AccountPreviewPage = () => {
    const { accountId } = useParams();
    const navigate = useNavigate();
    const { accounts, fetchAccounts } = useAccounts();
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => { fetchAccounts(); }, []);

    useEffect(() => {
        if (accountId && accounts.length > 0) {
            const acc = accounts.find(a => a.id === parseInt(accountId));
            if (acc) setSelectedAccount(acc);
        }
    }, [accountId, accounts]);

    const fetchPosts = useCallback(async () => {
        if (!selectedAccount) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/posts-summary?accountId=${selectedAccount.id}`);
            setPosts(data);
        } catch (e) {
            toast.error("Could not load posts");
        } finally {
            setLoading(false);
        }
    }, [selectedAccount]);

    useEffect(() => { if (selectedAccount) fetchPosts(); }, [selectedAccount, fetchPosts]);

    const handleSync = async () => {
        if (!selectedAccount) return;
        setSyncing(true);
        try {
            await api.post(`/sync/${selectedAccount.id}`);
            toast.success("Synced successfully");
            await fetchPosts();
        } catch (e) {
            toast.error("Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    if (!selectedAccount || loading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50/50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-gray-500">Loading Account...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${
                            selectedAccount.platform === 'instagram' ? 'bg-pink-50 border-pink-100' : 'bg-red-50 border-red-100'
                        }`}>
                            {selectedAccount.platform === 'youtube' ? 
                                <Youtube size={24} className="text-red-600" /> : 
                                <Instagram size={24} className="text-pink-600" />
                            }
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{selectedAccount.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="capitalize">{selectedAccount.platform}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>{posts.length} Posts</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationDropdown />
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync Data'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {posts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle size={24} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Posts Found</h3>
                        <p className="text-gray-500 text-sm mt-1 mb-6">We couldn't find any media for this account. Try syncing to fetch the latest data.</p>
                        <button onClick={handleSync} className="text-indigo-600 font-medium text-sm hover:underline">Sync Now</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {posts.map((post, index) => (
                            <VideoCard
                                key={post.postId}
                                post={post}
                                platform={selectedAccount.platform}
                                onClick={() => navigate(`/account/${accountId}/inbox?postIndex=${index}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountPreviewPage;