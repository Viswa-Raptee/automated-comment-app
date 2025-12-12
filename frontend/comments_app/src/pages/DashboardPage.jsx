import { useState, useEffect, useMemo } from 'react';
import { useMessages } from '../context/MessageContext';
import { useAuth } from '../context/AuthContext';
import { useJob } from '../context/JobContext';
import api from '../api/api';
import { toast } from 'react-hot-toast';
import {
    RefreshCw, TrendingUp, MessageSquare, CheckCircle,
    XCircle, Clock, Filter, ChevronDown, X, AlertTriangle, HelpCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import NotificationDropdown from '../components/NotificationDropdown';

// ============ CUSTOM WORD CLOUD COMPONENT ============
const WordCloud = ({ words }) => {
    if (!words || words.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                No word data available
            </div>
        );
    }

    const maxValue = Math.max(...words.map(w => w.value));
    const minValue = Math.min(...words.map(w => w.value));

    const getSize = (value) => {
        if (maxValue === minValue) return 18;
        const normalized = (value - minValue) / (maxValue - minValue);
        return 12 + normalized * 32; // 12px to 44px
    };

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'];
    const getColor = (index) => colors[index % colors.length];

    return (
        <div className="flex flex-wrap gap-3 p-4 justify-center items-center min-h-64">
            {words.map((word, i) => (
                <span
                    key={word.text}
                    className="px-3 py-1.5 rounded-full cursor-default hover:scale-110 transition-transform duration-200"
                    style={{
                        fontSize: `${getSize(word.value)}px`,
                        color: getColor(i),
                        backgroundColor: `${getColor(i)}10`,
                        fontWeight: word.value > (maxValue * 0.6) ? 600 : 400
                    }}
                    title={`${word.text}: ${word.value} occurrences`}
                >
                    {word.text}
                </span>
            ))}
        </div>
    );
};

// Color Palette
const COLORS = {
    primary: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    cyan: '#06b6d4',
    slate: '#64748b'
};

// ============ STATS CARD COMPONENT ============
const StatsCard = ({ title, count, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900">{count?.toLocaleString() || 0}</h3>
                {trend && (
                    <p className={`text-xs mt-2 flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
                        {Math.abs(trend)}% from last period
                    </p>
                )}
            </div>
            <div
                className="p-3 rounded-xl group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon size={24} style={{ color }} />
            </div>
        </div>
    </div>
);

// ============ FILTER BAR COMPONENT ============
const FilterBar = ({ filters, setFilters, accounts, posts }) => {
    const datePresets = [
        { label: 'Last 24 Hours', value: '24h' },
        { label: 'Last 7 Days', value: '7d' },
        { label: 'Last 30 Days', value: '30d' },
        { label: 'All Time', value: 'all' }
    ];

    const clearFilters = () => {
        setFilters({
            accountId: '',
            postId: '',
            dateRange: 'all'
        });
    };

    const hasActiveFilters = filters.accountId || filters.postId || filters.dateRange !== 'all';

    // Filter posts based on selected account
    const filteredPosts = useMemo(() => {
        if (!filters.accountId) return posts;
        return posts.filter(p => p.accountId === parseInt(filters.accountId));
    }, [posts, filters.accountId]);

    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    <span className="text-xs text-gray-400 ml-2">• Instant filtering</span>
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                    >
                        <X size={14} /> Clear All
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Account Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Account</label>
                    <div className="relative">
                        <select
                            value={filters.accountId}
                            onChange={(e) => {
                                setFilters(f => ({ ...f, accountId: e.target.value, postId: '' }));
                            }}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        >
                            <option value="">All Accounts</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.platform === 'youtube' ? '▶️' : '📷'} {acc.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Post/Video Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Video / Post</label>
                    <div className="relative">
                        <select
                            value={filters.postId}
                            onChange={(e) => setFilters(f => ({ ...f, postId: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        >
                            <option value="">All Videos/Posts</option>
                            {filteredPosts.map(post => (
                                <option key={post.postId} value={post.postId}>
                                    {post.postTitle?.substring(0, 40) || post.postId}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Date Range */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Date Range</label>
                    <div className="relative">
                        <select
                            value={filters.dateRange}
                            onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        >
                            {datePresets.map(preset => (
                                <option key={preset.value} value={preset.value}>{preset.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};



// ============ MAIN DASHBOARD PAGE ============
const DashboardPage = () => {
    const {
        messages,
        accounts,
        loading,
        addMessages,
        refresh,
        getUniquePostsWithStats,
        getStats,
        getIntentBreakdown,
        getWordCloud
    } = useMessages();
    const { user } = useAuth();
    const { isSyncDisabled, isSyncing, performSync } = useJob();

    const [filters, setFilters] = useState({
        accountId: '',
        postId: '',
        dateRange: 'all'
    });

    // Get posts for filter dropdown
    const posts = useMemo(() => getUniquePostsWithStats(filters.accountId || null), [getUniquePostsWithStats, filters.accountId]);

    // Compute stats from local data (instant!)
    const stats = useMemo(() => getStats({
        accountId: filters.accountId,
        postId: filters.postId,
        dateRange: filters.dateRange
    }), [getStats, filters]);

    // Compute intents from local data
    const intents = useMemo(() => getIntentBreakdown({
        accountId: filters.accountId,
        postId: filters.postId,
        dateRange: filters.dateRange
    }), [getIntentBreakdown, filters]);

    // Compute word cloud from local data
    const wordCloudData = useMemo(() => getWordCloud({
        accountId: filters.accountId,
        postId: filters.postId,
        dateRange: filters.dateRange
    }), [getWordCloud, filters]);

    // Manual sync - uses centralized sync from JobContext
    const handleManualSync = async () => {
        try {
            await performSync();
            // Refresh all data after sync
            await refresh();
        } catch (e) {
            // Error already handled in performSync
        }
    };

    // Status Chart Data
    const statusChartData = useMemo(() => [
        { name: 'Approved', value: stats.approved, fill: COLORS.success },
        { name: 'Pending', value: stats.pending, fill: COLORS.warning },
        { name: 'Rejected', value: stats.rejected, fill: COLORS.danger }
    ], [stats]);

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-xs text-gray-500">Analytics Overview • Real-time filtering</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Notification Dropdown */}
                    <NotificationDropdown />

                    {/* Sync Button */}
                    <button
                        onClick={handleManualSync}
                        disabled={isSyncDisabled}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Syncing...' : 'Sync All'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-6">
                    <StatsCard
                        title="Total Comments"
                        count={stats.total}
                        icon={MessageSquare}
                        color={COLORS.primary}
                    />
                    <StatsCard
                        title="Approved"
                        count={stats.approved}
                        icon={CheckCircle}
                        color={COLORS.success}
                    />
                    <StatsCard
                        title="Pending"
                        count={stats.pending}
                        icon={Clock}
                        color={COLORS.warning}
                    />
                    <StatsCard
                        title="Rejected"
                        count={stats.rejected}
                        icon={XCircle}
                        color={COLORS.danger}
                    />
                    <StatsCard
                        title="Complaints"
                        count={stats.complaints}
                        icon={AlertTriangle}
                        color={COLORS.pink}
                    />
                    <StatsCard
                        title="Questions"
                        count={stats.questions}
                        icon={HelpCircle}
                        color={COLORS.cyan}
                    />
                </div>

                {/* Filter Bar */}
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    accounts={accounts}
                    posts={posts}
                />

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Intent Distribution Bar Chart */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Distribution</h3>
                        {loading ? (
                            <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
                        ) : intents.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={intents} layout="vertical" margin={{ left: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tick={{ fill: '#374151', fontSize: 12 }}
                                        width={80}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: 12,
                                            border: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Bar dataKey="value" fill={COLORS.primary} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Status Pie Chart */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h3>
                        {loading ? (
                            <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
                        ) : stats.total === 0 ? (
                            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={statusChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {statusChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: 12,
                                            border: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        formatter={(value) => <span className="text-gray-600 text-sm">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Word Cloud Section */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Comment Keywords</h3>
                    {loading ? (
                        <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
                    ) : wordCloudData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-gray-400">No word data available</div>
                    ) : (
                        <WordCloud words={wordCloudData} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
