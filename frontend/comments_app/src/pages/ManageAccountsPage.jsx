import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import api from '../api/api';
import { Instagram, Youtube } from 'lucide-react';

const ManageAccountsPage = () => {
  const [form, setForm] = useState({ name: '', platform: 'instagram', identifier: '', accessToken: '' });
  const [accounts, setAccounts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data);
    } catch {}
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts', form);
      toast.success("Account Connected!");
      setForm({ name: '', platform: 'instagram', identifier: '', accessToken: '' });
      fetchAccounts();
    } catch { toast.error("Failed to connect"); }
  };

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

  const updateAccount = async (id, updates) => {
    setBusyId(id);
    try {
      await api.put(`/accounts/${id}`, updates);
      toast.success('Updated');
      fetchAccounts();
    } catch { toast.error('Update failed'); }
    finally { setBusyId(null); }
  };

  const deleteAccount = async (id) => {
    if (!confirm('Delete this account?')) return;
    setBusyId(id);
    try {
      await api.delete(`/accounts/${id}`);
      toast.success('Deleted');
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch { toast.error('Delete failed'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Connect Channel</h1>
      <div className="bg-white p-8 rounded-xl shadow-sm border space-y-6">
        <div className="flex gap-4">
          <button onClick={() => setForm({...form, platform: 'instagram'})} className={`flex-1 p-4 border rounded-xl flex flex-col items-center ${form.platform === 'instagram' ? 'border-pink-500 bg-pink-50' : ''}`}>
            <Instagram className="mb-2 text-pink-600" /> <span className="font-semibold">Instagram</span>
          </button>
          <button onClick={() => setForm({...form, platform: 'youtube'})} className={`flex-1 p-4 border rounded-xl flex flex-col items-center ${form.platform === 'youtube' ? 'border-red-500 bg-red-50' : ''}`}>
            <Youtube className="mb-2 text-red-600" /> <span className="font-semibold">YouTube</span>
          </button>
        </div>
        {form.platform === 'youtube' ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Authenticate securely via Google to manage your channel.</p>
            <button onClick={handleGoogleLogin} className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center w-full shadow-sm">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <input className="w-full p-2 border rounded" placeholder="Account Name (e.g. Raptee Main)" onChange={e => setForm({...form, name: e.target.value})} required />
            <input className="w-full p-2 border rounded" placeholder="Instagram Business ID (1784...)" onChange={e => setForm({...form, identifier: e.target.value})} required />
            <textarea className="w-full p-2 border rounded" rows={3} placeholder="Access Token" onChange={e => setForm({...form, accessToken: e.target.value})} required />
            <button className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">Connect</button>
          </form>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold">Connected Accounts</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Platform</th>
                <th className="px-6 py-3 text-left">Identifier</th>
                <th className="px-6 py-3 text-left">Active</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <input className="border rounded px-2 py-1 w-full min-w-[120px]" defaultValue={a.name} onBlur={e => updateAccount(a.id, { name: e.target.value })} disabled={busyId===a.id} />
                  </td>
                  <td className="px-6 py-3 capitalize">{a.platform}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-[150px] truncate" title={a.identifier}>{a.identifier}</td>
                  <td className="px-6 py-3">
                    <select className="border rounded px-2 py-1" onChange={e => updateAccount(a.id, { isActive: e.target.value === 'true' })} value={a.isActive ? 'true' : 'false'} disabled={busyId===a.id}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => deleteAccount(a.id)} disabled={busyId===a.id} className="px-3 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageAccountsPage;
