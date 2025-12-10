import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../api/api'; // Ensure this matches your axios export
import {
  MessageSquare, Send, User, Clock, CheckCircle2,
  Youtube, Instagram, Filter
} from 'lucide-react';

const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, instagram, youtube

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch only 'posted' messages for the audit log
      const { data } = await api.get('/messages?status=posted');
      setLogs(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load audit history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  // Filter logs locally based on platform
  const filteredLogs = logs.filter(log =>
    filter === 'all' ? true : log.Account?.platform === filter
  );

  // Intent Color Helper
  const getIntentClasses = (intent) => {
    const i = (intent || '').trim().toLowerCase();
    if (i.includes('spam')) return 'bg-red-100 text-red-700 border-red-200';
    if (i.includes('complaint')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (i.includes('praise')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (i.includes('question')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  // Helper to format handle (avoid @@username)
  const formatHandle = (name) => name.startsWith('@') ? name : `@${name}`;

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto bg-gray-50/50">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="text-green-600" /> Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            History of all replies sent by your team.
          </p>
        </div>

        {/* Platform Filter */}
        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {['all', 'instagram', 'youtube'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === f
                  ? 'bg-gray-100 text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {f === 'all' ? 'All' : <span className="capitalize">{f}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Activity Feed</h2>
          </div>
          <span className="text-xs font-medium text-gray-400">
            Showing {filteredLogs.length} entries
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
            <p>Loading history...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={32} className="opacity-20" />
            </div>
            <p className="text-lg font-medium text-gray-600">No logs found</p>
            <p className="text-sm">Replies sent by your team will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50/80 transition-colors group">
                <div className="flex gap-4">

                  {/* Left: Platform Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${log.Account?.platform === 'youtube'
                        ? 'bg-red-50 border-red-100 text-red-600'
                        : 'bg-pink-50 border-pink-100 text-pink-600'
                      }`}>
                      {log.Account?.platform === 'youtube' ? <Youtube size={20} /> : <Instagram size={20} />}
                    </div>
                  </div>

                  {/* Middle: Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">
                          {formatHandle(log.authorName || 'Unknown')}
                        </span>
                        {log.intent && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getIntentClasses(log.intent)}`}>
                            {log.intent}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12} />
                        {log.postedAt ? new Date(log.postedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}
                      </div>
                    </div>

                    {/* User Comment */}
                    <div className="mb-3 text-sm text-gray-600 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      "{log.content}"
                    </div>

                    {/* Staff Reply */}
                    <div className="relative pl-4 border-l-2 border-indigo-200">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User size={10} className="text-indigo-600" />
                        </div>
                        <span className="text-xs font-bold text-indigo-900">
                          {log.approvedBy || 'System'}
                        </span>
                        <span className="text-xs text-gray-400">replied:</span>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {log.aiDraft}
                      </p>

                      {/* Edit Badge - Show if message was edited */}
                      {log.editedBy && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 w-fit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Edited by <strong>@{log.editedBy}</strong> on {new Date(log.editedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditPage;