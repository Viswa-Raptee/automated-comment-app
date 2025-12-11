import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import api from '../api/api';
import { Instagram, Youtube, Loader2, CheckCircle, AlertCircle, Video, MessageSquare, Clock } from 'lucide-react';

// ============ MAIN PAGE ============
const ManageAccountsPage = () => {
  const [form, setForm] = useState({ name: '', platform: 'instagram', identifier: '', accessToken: '' });
  const [accounts, setAccounts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Onboarding state
  const [onboardingAccount, setOnboardingAccount] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState('idle'); // idle, connecting, summary, processing, complete
  const [summary, setSummary] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data);
    } catch { }
  };

  useEffect(() => { fetchAccounts(); }, []);

  // Handle OAuth callback
  useEffect(() => {
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');

    if (status === 'success' && accountId) {
      // Start onboarding for the newly connected account
      startOnboarding(parseInt(accountId));
      // Clean URL
      window.history.replaceState({}, '', '/manage-accounts');
    }
  }, [searchParams]);

  // Tab close warning during processing
  useEffect(() => {
    if (onboardingStep === 'processing') {
      const handler = (e) => {
        e.preventDefault();
        e.returnValue = 'Processing is in progress. Are you sure you want to leave?';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [onboardingStep]);

  // Polling for job status
  useEffect(() => {
    if (!jobId || onboardingStep !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/jobs/${jobId}/status`);
        setProgress({ processed: data.processed, total: data.total });

        if (data.status === 'complete') {
          clearInterval(interval);
          setOnboardingStep('complete');
          toast.success('All replies generated!');
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setOnboardingStep('complete');
          toast.error('Processing failed: ' + data.error);
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, onboardingStep]);

  // Start onboarding for an account
  const startOnboarding = async (accountId) => {
    setOnboardingStep('connecting');
    setOnboardingAccount(accountId);

    try {
      const { data } = await api.post(`/accounts/${accountId}/onboard`);
      setSummary(data);
      setOnboardingStep('summary');
      fetchAccounts();
    } catch (e) {
      toast.error('Failed to connect: ' + (e.response?.data?.error || e.message));
      setOnboardingStep('idle');
      setOnboardingAccount(null);
    }
  };

  // Handle Instagram form submit
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/accounts', form);
      toast.success("Account connected!");
      setForm({ name: '', platform: 'instagram', identifier: '', accessToken: '' });
      // Start onboarding
      startOnboarding(data.id);
    } catch {
      toast.error("Failed to connect");
    }
  };

  // Handle YouTube OAuth
  const handleGoogleLogin = async () => {
    try {
      toast.loading("Starting YouTube OAuth...");
      const { data } = await axios.get('http://localhost:8000/api/youtube/oauth/url', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.dismiss();
      window.location.href = data.url;
    } catch (e) {
      toast.dismiss();
      toast.error(e.response?.data?.error || 'Failed to start OAuth');
    }
  };

  // Start batch generation
  const handleGenerateAll = async () => {
    if (!onboardingAccount) return;
    setOnboardingStep('processing');

    try {
      const { data } = await api.post(`/accounts/${onboardingAccount}/batch-generate`);
      if (data.jobId) {
        setJobId(data.jobId);
        setProgress({ processed: 0, total: data.total });
      } else {
        // No comments to process
        setOnboardingStep('complete');
      }
    } catch (e) {
      toast.error('Failed to start: ' + e.message);
      setOnboardingStep('summary');
    }
  };

  // Skip batch generation
  const handleSkip = () => {
    setOnboardingStep('idle');
    setOnboardingAccount(null);
    setSummary(null);
    toast.success('Setup complete! Comments will be processed as they come in.');
  };

  // Close onboarding
  const handleClose = () => {
    setOnboardingStep('idle');
    setOnboardingAccount(null);
    setSummary(null);
    setJobId(null);
    setProgress({ processed: 0, total: 0 });
  };

  const updateAccount = async (id, updates) => {
    setBusyId(id);
    try {
      await api.put(`/accounts/${id}`, updates);
      toast.success('Updated');
      fetchAccounts();
    } catch { toast.error('Update failed'); }
    finally { setBusyId(null); }
  };

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, accountId: null, accountName: '' });

  const openDeleteModal = (account) => {
    setDeleteModal({ open: true, accountId: account.id, accountName: account.name });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ open: false, accountId: null, accountName: '' });
  };

  const deleteAccount = async (deleteData = true) => {
    if (!deleteModal.accountId) return;
    setBusyId(deleteModal.accountId);
    closeDeleteModal();

    try {
      await api.delete(`/accounts/${deleteModal.accountId}?deleteData=${deleteData}`);
      toast.success(deleteData ? 'Account and data deleted' : 'Account disconnected (data kept)');
      setAccounts(prev => prev.filter(a => a.id !== deleteModal.accountId));
    } catch { toast.error('Delete failed'); }
    finally { setBusyId(null); }
  };

  // ============ RENDER ============
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Connect Channel</h1>

      {/* Delete Options Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-6">
              How would you like to delete <strong>{deleteModal.accountName}</strong>?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => deleteAccount(false)}
                className="w-full p-3 rounded-lg border border-gray-200 text-left hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Disconnect Only</p>
                <p className="text-xs text-gray-500">Remove account connection but keep all data for analytics</p>
              </button>
              <button
                onClick={() => deleteAccount(true)}
                className="w-full p-3 rounded-lg border border-red-200 bg-red-50 text-left hover:bg-red-100 transition-colors"
              >
                <p className="font-medium text-red-700">Delete Everything</p>
                <p className="text-xs text-red-600">Remove account and all related comments, posts, notifications</p>
              </button>
            </div>
            <button
              onClick={closeDeleteModal}
              className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {onboardingStep !== 'idle' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">

            {/* Connecting */}
            {onboardingStep === 'connecting' && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Connecting Account</h3>
                <p className="text-sm text-gray-500 mt-2">Fetching videos and comments...</p>
              </div>
            )}

            {/* Summary */}
            {onboardingStep === 'summary' && summary && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  {summary.account.platform === 'youtube' ? (
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Youtube className="w-5 h-5 text-red-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-pink-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{summary.account.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{summary.account.platform}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Video className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <p className="text-2xl font-bold text-gray-900">{summary.summary.videos}</p>
                    <p className="text-xs text-gray-500">Videos</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <MessageSquare className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <p className="text-2xl font-bold text-gray-900">{summary.summary.totalComments}</p>
                    <p className="text-xs text-gray-500">Comments</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <Clock className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                    <p className="text-2xl font-bold text-amber-600">{summary.summary.unrepliedComments}</p>
                    <p className="text-xs text-gray-500">Unreplied</p>
                  </div>
                </div>

                {summary.summary.unrepliedComments > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      You have {summary.summary.unrepliedComments} unreplied comments. Would you like to generate AI replies for them?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleGenerateAll}
                        className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                      >
                        Generate All Replies
                      </button>
                      <button
                        onClick={handleSkip}
                        className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        Skip for Now
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      All caught up! No unreplied comments to process.
                    </p>
                    <button
                      onClick={handleClose}
                      className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Processing */}
            {onboardingStep === 'processing' && (
              <div className="text-center py-4">
                <Loader2 className="w-10 h-10 mx-auto text-indigo-600 animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Replies</h3>

                <div className="bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 transition-all duration-300"
                    style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {progress.processed} of {progress.total} comments processed
                </p>

                <div className="flex items-center justify-center gap-2 text-amber-600 text-xs bg-amber-50 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  Please don't close this tab
                </div>
              </div>
            )}

            {/* Complete */}
            {onboardingStep === 'complete' && (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Done!</h3>
                <p className="text-sm text-gray-500 mb-6">
                  {progress.processed} replies generated. You can now review and approve them.
                </p>
                <button
                  onClick={handleClose}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
        {/* Platform Selection */}
        <div className="flex gap-4">
          <button
            onClick={() => setForm({ ...form, platform: 'instagram' })}
            className={`flex-1 p-4 border rounded-xl flex flex-col items-center transition-colors ${form.platform === 'instagram' ? 'border-pink-500 bg-pink-50' : 'hover:bg-gray-50'}`}
          >
            <Instagram className="mb-2 text-pink-600" />
            <span className="font-medium text-sm">Instagram</span>
          </button>
          <button
            onClick={() => setForm({ ...form, platform: 'youtube' })}
            className={`flex-1 p-4 border rounded-xl flex flex-col items-center transition-colors ${form.platform === 'youtube' ? 'border-red-500 bg-red-50' : 'hover:bg-gray-50'}`}
          >
            <Youtube className="mb-2 text-red-600" />
            <span className="font-medium text-sm">YouTube</span>
          </button>
        </div>

        {/* Platform-specific form */}
        {form.platform === 'youtube' ? (
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4 text-sm">Connect via Google to manage your YouTube channel.</p>
            <button
              onClick={handleGoogleLogin}
              className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center w-full shadow-sm text-sm"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Sign in with Google
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <input
              className="w-full p-3 border rounded-lg text-sm"
              placeholder="Account Name (e.g. Raptee Main)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className="w-full p-3 border rounded-lg text-sm"
              placeholder="Instagram Business ID"
              value={form.identifier}
              onChange={e => setForm({ ...form, identifier: e.target.value })}
              required
            />
            <textarea
              className="w-full p-3 border rounded-lg text-sm"
              rows={2}
              placeholder="Access Token"
              value={form.accessToken}
              onChange={e => setForm({ ...form, accessToken: e.target.value })}
              required
            />
            <button className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              Connect Account
            </button>
          </form>
        )}
      </div>

      {/* Connected Accounts */}
      <div className="bg-white rounded-xl shadow-sm border mt-6 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Connected Accounts</h2>
        </div>
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No accounts connected yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <input
                      className="border rounded px-2 py-1 w-full text-sm"
                      defaultValue={a.name}
                      onBlur={e => updateAccount(a.id, { name: e.target.value })}
                      disabled={busyId === a.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${a.platform === 'youtube' ? 'bg-red-50 text-red-700' : 'bg-pink-50 text-pink-700'
                      }`}>
                      {a.platform === 'youtube' ? <Youtube size={12} /> : <Instagram size={12} />}
                      {a.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      onChange={e => updateAccount(a.id, { isActive: e.target.value === 'true' })}
                      value={a.isActive ? 'true' : 'false'}
                      disabled={busyId === a.id}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDeleteModal(a)}
                      disabled={busyId === a.id}
                      className="px-3 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ManageAccountsPage;
