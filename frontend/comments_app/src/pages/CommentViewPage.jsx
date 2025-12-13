import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    MessageSquare, Filter, ChevronDown, Search, X, CheckCircle,
    Instagram, Youtube, RefreshCw, Plus, FileText, Trash2, Edit2
} from 'lucide-react';
import api from '../api/api';
import MessageCard from '../components/MessageCard';

const CommentViewPage = () => {
    const navigate = useNavigate();

    // Data states
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]);

    // Platform filter: 'all', 'youtube', 'instagram'
    const [platform, setPlatform] = useState('all');

    // Comprehensive filters
    const [filters, setFilters] = useState({
        status: 'all',
        intent: 'all',         // 'all', 'Question', 'Praise', 'Complaint', 'Assistance Needed'
        commenter: '',
        dateRange: 'all',
        hasReplies: false,
        pendingThreads: false,
        assignedToMe: false
    });

    // Template panel
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [templateForm, setTemplateForm] = useState({ title: '', key: '', content: '' });

    // Fetch messages from all accounts
    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            // Build query params
            const params = new URLSearchParams();
            if (platform !== 'all') params.append('platform', platform);
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.dateRange !== 'all') params.append('dateRange', filters.dateRange);

            const { data } = await api.get(`/messages/all?${params.toString()}`);

            // Build threaded structure
            const messageMap = new Map();
            const parents = [];

            data.forEach(msg => {
                msg.replies = [];
                messageMap.set(msg.id, msg);
            });

            data.forEach(msg => {
                if (msg.parentId && messageMap.has(msg.parentId)) {
                    messageMap.get(msg.parentId).replies.push(msg);
                } else if (!msg.parentId) {
                    parents.push(msg);
                }
            });

            // Sort replies
            messageMap.forEach(msg => {
                msg.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            });

            // Apply client-side filters
            let filteredParents = parents;

            // Filter by commenter name
            if (filters.commenter) {
                const search = filters.commenter.toLowerCase();
                filteredParents = filteredParents.filter(p =>
                    p.authorName?.toLowerCase().includes(search)
                );
            }

            // Has replies filter
            if (filters.hasReplies) {
                filteredParents = filteredParents.filter(p => p.replies && p.replies.length > 0);
            }

            // Pending threads filter
            if (filters.pendingThreads) {
                filteredParents = filteredParents.filter(p =>
                    p.replies && p.replies.some(r => r.status === 'pending' && r.intent === 'Pending Thread')
                );
            }

            // Assigned to me filter
            if (filters.assignedToMe) {
                const userJson = localStorage.getItem('user');
                const currentUser = userJson ? JSON.parse(userJson)?.username : null;
                if (!currentUser) {
                    filteredParents = [];
                } else {
                    filteredParents = filteredParents.filter(p =>
                        p.assignedTo === currentUser ||
                        (p.replies && p.replies.some(r => r.assignedTo === currentUser))
                    );
                }
            }

            // Filter: intent - filter by comment intent
            if (filters.intent && filters.intent !== 'all') {
                filteredParents = filteredParents.filter(p => {
                    const normalizedIntent = (p.intent || '').toLowerCase();
                    const filterIntent = filters.intent.toLowerCase();
                    // Handle "Assistance Needed" matching assistanceNeeded flag
                    if (filterIntent === 'assistance needed') {
                        return p.assistanceNeeded === true;
                    }
                    return normalizedIntent.includes(filterIntent);
                });
            }

            setMessages(filteredParents);
        } catch (e) {
            console.error('Failed to fetch messages:', e);
            toast.error('Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [platform, filters]);

    // Fetch templates
    const fetchTemplates = async () => {
        try {
            const { data } = await api.get('/templates');
            setTemplates(data);
        } catch (e) {
            console.error('Failed to fetch templates:', e);
        }
    };

    useEffect(() => {
        fetchMessages();
        fetchTemplates();
    }, [fetchMessages]);

    // Message handlers
    const handleApprove = async (msgId, replyText) => {
        try {
            await api.post(`/messages/${msgId}/approve`, { replyText });
            toast.success('Reply posted!');
            fetchMessages();
            return true;
        } catch (e) {
            toast.error('Failed to post reply');
            return false;
        }
    };

    // Template handlers
    const handleSaveTemplate = async () => {
        if (!templateForm.title || !templateForm.key || !templateForm.content) {
            toast.error('All fields are required');
            return;
        }

        try {
            if (editingTemplate) {
                await api.put(`/templates/${editingTemplate.id}`, templateForm);
                toast.success('Template updated');
            } else {
                await api.post('/templates', templateForm);
                toast.success('Template created');
            }
            setShowTemplateForm(false);
            setEditingTemplate(null);
            setTemplateForm({ title: '', key: '', content: '' });
            fetchTemplates();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to save template');
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!confirm('Delete this template?')) return;
        try {
            await api.delete(`/templates/${id}`);
            toast.success('Template deleted');
            fetchTemplates();
        } catch (e) {
            toast.error('Failed to delete template');
        }
    };

    const hasActiveFilters = filters.status !== 'all' || filters.intent !== 'all' || filters.commenter ||
        filters.dateRange !== 'all' || filters.hasReplies || filters.pendingThreads ||
        filters.assignedToMe;

    return (
        <div className="flex-1 h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-gray-100">
            <div className="flex h-full">
                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">All Comments</h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    View and manage comments from all connected accounts
                                </p>
                            </div>

                            {/* Platform Toggle */}
                            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setPlatform('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${platform === 'all'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setPlatform('youtube')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${platform === 'youtube'
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-red-500'
                                        }`}
                                >
                                    <Youtube size={16} />
                                    YouTube
                                </button>
                                <button
                                    onClick={() => setPlatform('instagram')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${platform === 'instagram'
                                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-pink-500'
                                        }`}
                                >
                                    <Instagram size={16} />
                                    Instagram
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-4xl mx-auto">
                            {/* Filter Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900">
                                    Comments
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({messages.length})
                                    </span>
                                </h3>
                                {hasActiveFilters && (
                                    <button
                                        onClick={() => setFilters({ status: 'all', intent: 'all', commenter: '', dateRange: 'all', hasReplies: false, pendingThreads: false, assignedToMe: false })}
                                        className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
                                    >
                                        <X size={12} /> Clear Filters
                                    </button>
                                )}
                            </div>

                            {/* Filter Bar */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <Filter size={14} className="text-indigo-600" />
                                    <span className="text-xs font-medium text-gray-600">Filters</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Status Filter */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                                        <select
                                            value={filters.status}
                                            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="all">All Status</option>
                                            <option value="pending">Pending</option>
                                            <option value="posted">Posted</option>
                                        </select>
                                    </div>

                                    {/* Intent Filter */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Intent</label>
                                        <select
                                            value={filters.intent}
                                            onChange={(e) => setFilters(f => ({ ...f, intent: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="all">All Intent</option>
                                            <option value="Question">Question</option>
                                            <option value="Praise">Praise</option>
                                            <option value="Complaint">Complaint</option>
                                            <option value="Assistance Needed">Assistance Needed</option>
                                        </select>
                                    </div>

                                    {/* Search */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={filters.commenter}
                                                onChange={(e) => setFilters(f => ({ ...f, commenter: e.target.value }))}
                                                placeholder="Search by name..."
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Date Range */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Timeline</label>
                                        <select
                                            value={filters.dateRange}
                                            onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="all">All Time</option>
                                            <option value="24h">Last 24 Hours</option>
                                            <option value="7d">Last 7 Days</option>
                                            <option value="30d">Last 30 Days</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Toggle Filters */}
                                <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.hasReplies}
                                            onChange={(e) => setFilters(f => ({ ...f, hasReplies: e.target.checked }))}
                                            className="w-4 h-4 text-indigo-600 rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">Has Replies</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.pendingThreads}
                                            onChange={(e) => setFilters(f => ({ ...f, pendingThreads: e.target.checked }))}
                                            className="w-4 h-4 text-orange-600 rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">Pending Threads</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.assignedToMe}
                                            onChange={(e) => setFilters(f => ({ ...f, assignedToMe: e.target.checked }))}
                                            className="w-4 h-4 text-green-600 rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700">Assigned to Me</span>
                                    </label>
                                </div>
                            </div>

                            {/* Messages List */}
                            {loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <RefreshCw className="animate-spin text-indigo-600" size={32} />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={32} className="text-green-500" />
                                    </div>
                                    <p className="text-gray-600 font-medium">No comments found</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {hasActiveFilters ? 'Try adjusting your filters' : 'Connect accounts to see comments'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map(msg => (
                                        <MessageCard
                                            key={msg.id}
                                            msg={msg}
                                            onApprove={handleApprove}
                                            onRefresh={fetchMessages}
                                            isPosted={msg.status === 'posted'}
                                            replies={msg.replies || []}
                                            templates={templates}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Template Panel - Right Side */}
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" />
                                Templates
                            </h3>
                            <button
                                onClick={() => {
                                    setShowTemplateForm(true);
                                    setEditingTemplate(null);
                                    setTemplateForm({ title: '', key: '', content: '' });
                                }}
                                className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Type "/" in reply box to use</p>
                    </div>

                    {/* Template Form */}
                    {showTemplateForm && (
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <input
                                type="text"
                                value={templateForm.title}
                                onChange={(e) => setTemplateForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Title (e.g., Greeting)"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2"
                            />
                            <div className="flex items-center gap-1 mb-2">
                                <span className="text-gray-500">/</span>
                                <input
                                    type="text"
                                    value={templateForm.key}
                                    onChange={(e) => setTemplateForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                                    placeholder="key"
                                    className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg"
                                />
                            </div>
                            <textarea
                                value={templateForm.content}
                                onChange={(e) => setTemplateForm(f => ({ ...f, content: e.target.value }))}
                                placeholder="Template content..."
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 h-24 resize-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowTemplateForm(false)}
                                    className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    {editingTemplate ? 'Update' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Template List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {templates.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No templates yet</p>
                        ) : (
                            templates.map(template => (
                                <div key={template.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors group">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 text-sm">{template.title}</span>
                                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                                    /{template.key}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                {template.content}
                                            </p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingTemplate(template);
                                                    setTemplateForm({ title: template.title, key: template.key, content: template.content });
                                                    setShowTemplateForm(true);
                                                }}
                                                className="p-1 text-gray-400 hover:text-indigo-600"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(template.id)}
                                                className="p-1 text-gray-400 hover:text-red-600"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommentViewPage;
