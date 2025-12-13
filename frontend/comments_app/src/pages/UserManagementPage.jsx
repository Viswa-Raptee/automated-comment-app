import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../api/api';

const UserManagementPage = () => {
  const [formData, setFormData] = useState({ username: '', password: '', email: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [editingEmail, setEditingEmail] = useState({});

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch { }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      toast.success(`User ${formData.username} created!`);
      setFormData({ username: '', password: '', email: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id, updates) => {
    setBusyId(id);
    try {
      await api.put(`/users/${id}`, updates);
      toast.success('Updated');
      fetchUsers();
    } catch { toast.error('Update failed'); }
    finally { setBusyId(null); }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    setBusyId(id);
    try {
      await api.delete(`/users/${id}`);
      toast.success('Deleted');
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch { toast.error('Delete failed'); }
    finally { setBusyId(null); }
  };

  const handleEmailSave = (id) => {
    if (editingEmail[id] !== undefined) {
      updateUser(id, { email: editingEmail[id] });
      setEditingEmail(prev => ({ ...prev, [id]: undefined }));
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Management</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Create New Staff Account</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="For notifications" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full p-2 border rounded-lg">
              <option value="user">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition h-[42px]">
            {loading ? 'Saving...' : 'Create User'}
          </button>
        </form>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold">Existing Users</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 text-left">Username</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Created</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b">
                <td className="px-6 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      className="border rounded px-2 py-1 w-48"
                      value={editingEmail[u.id] !== undefined ? editingEmail[u.id] : (u.email || '')}
                      onChange={e => setEditingEmail(prev => ({ ...prev, [u.id]: e.target.value }))}
                      placeholder="Add email..."
                      disabled={busyId === u.id}
                    />
                    {editingEmail[u.id] !== undefined && editingEmail[u.id] !== (u.email || '') && (
                      <button
                        onClick={() => handleEmailSave(u.id)}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <select className="border rounded px-2 py-1" value={u.role} onChange={e => updateUser(u.id, { role: e.target.value })} disabled={busyId === u.id}>
                    <option value="user">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-3 text-gray-500">{new Date(u.createdAt).toLocaleString()}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => deleteUser(u.id)} disabled={busyId === u.id} className="px-3 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPage;
