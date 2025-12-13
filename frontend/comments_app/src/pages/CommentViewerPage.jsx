import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { MessageSquare, Send, User, Clock, CheckCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:8000/api';

export default function CommentViewerPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [reply, setReply] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function validateAndLoad() {
            try {
                const response = await axios.get(`${API_URL}/magic-link/${token}`);

                // Auto-authenticate
                localStorage.setItem('token', response.data.authToken);
                localStorage.setItem('user', JSON.stringify(response.data.user));

                setData(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load comment');
                setLoading(false);
            }
        }

        validateAndLoad();
    }, [token]);

    const handleSubmitReply = async () => {
        if (!reply.trim()) return;

        setSubmitting(true);
        try {
            const authToken = localStorage.getItem('token');

            // Post the reply
            await axios.post(
                `${API_URL}/messages/${data.message.id}/reply`,
                { replyText: reply },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            // Mark magic link as completed
            await axios.post(
                `${API_URL}/magic-link/${data.magicLinkId}/complete`,
                {},
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            toast.success('Reply posted successfully!');
            setReply('');

            // Refresh the thread
            const response = await axios.get(`${API_URL}/magic-link/${token}`);
            setData(response.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to post reply');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading comment...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Error</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const { message, thread, user } = data;
    const parentComment = thread[0];
    const replies = thread.slice(1);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-6 h-6 text-white" />
                                <h1 className="text-xl font-bold text-white">Assigned Comment</h1>
                            </div>
                            <div className="flex items-center gap-2 text-white/80 text-sm">
                                <User size={14} />
                                <span>Logged in as {user.username}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                            <span className="font-medium text-indigo-600">{message.Account?.platform?.toUpperCase()}</span>
                            <span>•</span>
                            <span>{message.Account?.name}</span>
                        </div>
                        {message.postTitle && (
                            <p className="text-sm text-gray-600 mb-2">
                                Post: <span className="font-medium">{message.postTitle}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Parent Comment */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-sm">
                                {parentComment.authorName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900">{parentComment.authorName || 'Unknown'}</span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(parentComment.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-gray-700 text-sm leading-relaxed">{parentComment.content}</p>

                                {parentComment.intent && (
                                    <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full ${parentComment.intent === 'Complaint' ? 'bg-red-100 text-red-700' :
                                            parentComment.intent === 'Question' ? 'bg-blue-100 text-blue-700' :
                                                parentComment.intent === 'Praise' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-700'
                                        }`}>
                                        {parentComment.intent}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Replies */}
                {replies.length > 0 && (
                    <div className="ml-8 space-y-3 mb-4">
                        {replies.map((r, i) => (
                            <div key={r.id || i} className="bg-white rounded-xl shadow border-l-4 border-indigo-400 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                        {r.authorName?.[0]?.toUpperCase() || 'R'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-800 text-sm">{r.authorName || 'Reply'}</span>
                                            {r.status === 'posted' && (
                                                <CheckCircle size={12} className="text-green-500" />
                                            )}
                                            <span className="text-xs text-gray-400">
                                                {new Date(r.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-sm">{r.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Reply Box */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-6">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Send size={16} className="text-indigo-600" />
                            Your Reply
                        </h3>
                        <textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Type your reply here..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            rows={4}
                        />
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleSubmitReply}
                                disabled={!reply.trim() || submitting}
                                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Posting...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Post Reply
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Back to Dashboard */}
                <div className="text-center mt-6">
                    <button
                        onClick={() => navigate('/')}
                        className="text-gray-500 hover:text-indigo-600 text-sm flex items-center gap-1 mx-auto"
                    >
                        <ArrowLeft size={14} />
                        Go to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
