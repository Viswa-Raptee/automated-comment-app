import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../context/AccountContext';
import { toast } from 'react-hot-toast';
import api from '../api/api';

const MyApprovalsPage = () => {
  const { user } = useAuth();
  const { selectedAccount } = useAccounts();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      let url = `/messages?status=posted&approvedBy=${user.username}`;
      if (selectedAccount) {
        url += `&accountId=${selectedAccount.id}`;
      }
      const { data } = await api.get(url);
      setApprovals(data);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchApprovals();
  }, [user, selectedAccount]);

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        My Comments
        {selectedAccount && <span className="text-gray-400 text-lg font-normal ml-2">/ {selectedAccount.name}</span>}
      </h1>
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading history...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
          You haven't approved any messages yet.
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(msg => (
            <div key={msg.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 opacity-75 hover:opacity-100 transition-opacity">
              <div className="flex justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${msg.Account?.platform === 'instagram' ? 'bg-pink-100 text-pink-600' : 'bg-red-100 text-red-600'}`}>
                    {msg.Account?.platform}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">@{msg.authorName}</span>
                </div>
                <span className="text-xs text-gray-500">Approved: {new Date(msg.postedAt).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
                  <p className="text-xs text-gray-400 uppercase mb-1">Customer said:</p>
                  "{msg.content}"
                </div>
                <div className="bg-indigo-50 p-3 rounded text-sm text-indigo-900 border border-indigo-100">
                  <p className="text-xs text-indigo-400 uppercase mb-1">You Replied:</p>
                  "{msg.aiDraft}"
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyApprovalsPage;
