import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Instagram, Youtube, LogOut, Inbox, FileText, PlusCircle, RefreshCw, User, ChevronDown, Shield, Users, CheckCircle, Play, ArrowLeft, X, Move } from 'lucide-react';

// ============ API SETUP ============
const api = axios.create({
  baseURL: 'http://localhost:8000/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ AUTH CONTEXT ============
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) setUser(JSON.parse(savedUser));
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      const userData = { username, role: data.role };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      toast.success('Welcome back!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// ============ ACCOUNT CONTEXT ============
const AccountContext = createContext();

const AccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data);
      if (selectedAccount) {
        const found = data.find(a => a.id === selectedAccount.id);
        setSelectedAccount(found || null);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const selectAccount = (account) => setSelectedAccount(account);

  return (
    <AccountContext.Provider value={{ accounts, selectedAccount, selectAccount, fetchAccounts, loading }}>
      {children}
    </AccountContext.Provider>
  );
};

const useAccounts = () => useContext(AccountContext);

// ============ SIDEBAR ============
const Sidebar = () => {
  const { user, logout } = useAuth();
  const { accounts, selectedAccount, selectAccount, fetchAccounts } = useAccounts();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => { fetchAccounts(); }, []);

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold">{user?.username}</p>
            <div className="flex items-center text-xs text-gray-400 capitalize">
              {user?.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
              {user?.role}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-700">
        <label className="text-xs text-gray-400 uppercase mb-2 block">Active Channel</label>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 flex items-center justify-between transition-colors border border-gray-700"
          >
            {selectedAccount ? (
              <div className="flex items-center space-x-2 overflow-hidden">
                {selectedAccount.platform === 'instagram' ? <Instagram size={16} /> : <Youtube size={16} />}
                <span className="text-sm truncate">{selectedAccount.name}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">Select account...</span>
            )}
            <ChevronDown size={16} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-700 max-h-60 overflow-y-auto">
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => { selectAccount(account); setDropdownOpen(false); }}
                  className="w-full p-3 flex items-center space-x-2 hover:bg-gray-700 text-left"
                >
                  {account.platform === 'instagram' ? <Instagram size={16} className="text-pink-400"/> : <Youtube size={16} className="text-red-500"/>}
                  <span className="text-sm">{account.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link to="/" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white">
          <Inbox size={20} /> <span>Inbox</span>
        </Link>
        <Link to="/my-approvals" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white">
          <CheckCircle size={20} /> <span>My Approvals</span>
        </Link>
        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            </div>
            <Link to="/audit" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white">
              <FileText size={20} /> <span>Audit Logs</span>
            </Link>
            <Link to="/users" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white">
              <Users size={20} /> <span>Manage Users</span>
            </Link>
            <Link to="/add-account" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white">
              <PlusCircle size={20} /> <span>Add Account</span>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button onClick={logout} className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-red-900/30 text-red-400">
          <LogOut size={20} /> <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

// ============ NEW: DRAGGABLE VIDEO WINDOW COMPONENT ============
const PipWindow = ({ post, onClose, platform }) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: window.innerHeight - 250 });
  const [isDragging, setIsDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 }); // Relative position of mouse inside header

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag if clicking close button
    e.preventDefault();
    setIsDragging(true);
    setRel({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - rel.x,
      y: e.clientY - rel.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global event listeners for smooth dragging even if mouse leaves div
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      className="fixed w-80 bg-black rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-700"
      style={{ left: position.x, top: position.y }}
    >
      {/* Draggable Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="flex justify-between items-center p-2 bg-gray-900 text-white cursor-move select-none"
      >
         <div className="flex items-center gap-2 overflow-hidden">
            <Move size={12} className="text-gray-500" />
            <span className="text-xs font-medium truncate flex-1">{post.postTitle}</span>
         </div>
         <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
           <X size={14} />
         </button>
      </div>

      {/* Video Content */}
      <div className="aspect-video bg-black flex items-center justify-center relative">
         {platform === 'youtube' ? (
           // YouTube Iframe
           <iframe 
             width="100%" 
             height="100%" 
             src={`https://www.youtube.com/embed/${post.postId}?autoplay=1`} 
             title="YouTube video player" 
             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
             allowFullScreen
           ></iframe>
         ) : (
           // Instagram / Standard Video
           post.mediaUrl && !post.mediaUrl.includes('placeholder') ? (
             <video 
               src={post.mediaUrl} 
               controls 
               autoPlay 
               className="w-full h-full object-contain"
             />
           ) : (
              <div className="flex flex-col items-center text-gray-500">
                  <Play size={32} />
                  <span className="mt-2 text-xs">Video Unavailable</span>
              </div>
           )
         )}
      </div>
    </div>
  );
};


// ============ USER MANAGEMENT PAGE ============
const UserManagementPage = () => {
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch {}
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      toast.success(`User ${formData.username} created!`);
      setFormData({ username: '', password: '', role: 'user' });
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Management</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Create New Staff Account</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2 border rounded-lg">
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
                  <select className="border rounded px-2 py-1" value={u.role} onChange={e => updateUser(u.id, { role: e.target.value })} disabled={busyId===u.id}>
                    <option value="user">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-3 text-gray-500">{new Date(u.createdAt).toLocaleString()}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => deleteUser(u.id)} disabled={busyId===u.id} className="px-3 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============ INBOX PAGE (Refactored) ============
const InboxPage = () => {
  const { selectedAccount } = useAccounts();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [activePost, setActivePost] = useState(null); // The video currently selected
  const [pipMedia, setPipMedia] = useState(null); // The video in PiP
  
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  // Initial Load
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

  if (!selectedAccount) return <div className="flex h-full items-center justify-center text-gray-400">Select an account from the sidebar.</div>;

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-white flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          {viewMode === 'detail' && (
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {viewMode === 'list' ? 'Active Conversations' : activePost?.postTitle}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
               {selectedAccount.name} 
               {selectedAccount.platform === 'youtube' ? <Youtube size={14} className="text-red-500"/> : <Instagram size={14} className="text-pink-500"/>}
            </p>
          </div>
        </div>
        <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition">
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync Messages"}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : viewMode === 'list' ? (
          // ============ LIST VIEW ============
          posts.length === 0 ? (
             <div className="text-center py-20 text-gray-500">No pending comments found.</div>
          ) : (
            <div className="grid gap-4">
              {posts.map(post => (
                <div 
                  key={post.postId} 
                  onClick={() => openPost(post)}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition cursor-pointer flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail / Icon */}
                    <div className="relative w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
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
                          className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-black/50"
                          title="Watch in Picture-in-Picture"
                        >
                          <Play size={20} className="text-white fill-current" />
                        </button>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 line-clamp-1 text-lg">{post.postTitle || 'Untitled Post'}</h3>
                      <p className="text-sm text-gray-500">ID: {post.postId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                      {post.pendingCount} Pending
                    </span>
                    <ChevronDown className="text-gray-300 -rotate-90 group-hover:translate-x-1 transition" />
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

const MessageCard = ({ msg, onApprove }) => {
  const [draft, setDraft] = useState(msg.aiDraft || "");
  const [sending, setSending] = useState(false);

  // 🔹 Intent → color mapping
  const normalizedIntent = (msg.intent || "").trim().toLowerCase();

  const intentClasses =
    normalizedIntent === "spam"
      ? "bg-red-100 text-red-600"
      : normalizedIntent === "complaint"
      ? "bg-amber-100 text-amber-700"
      : normalizedIntent === "praise"
      ? "bg-emerald-100 text-emerald-700"
      : normalizedIntent === "technical issue"
      ? "bg-blue-100 text-blue-700"
      : normalizedIntent === "question"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-gray-100 text-gray-600";

  const intentLabel = msg.intent || "General";

  const handleClick = async () => {
    if (sending) return; // Prevent double click
    setSending(true);

    const success = await onApprove(msg.id, draft);

    if (!success) {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
              {msg.authorName?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">@{msg.authorName}</h3>
              <p className="text-xs text-gray-500">
                {new Date(msg.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* 🔹 Intent badge with dynamic color */}
          <span
            className={`px-2 py-1 rounded text-xs font-bold uppercase ${intentClasses}`}
          >
            {intentLabel}
          </span>
        </div>

        <p className="text-gray-800 text-sm mb-4 bg-gray-50 p-3 rounded-lg">
          "{msg.content}"
        </p>

        <textarea
          className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Draft reply..."
          disabled={sending}
        />
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t flex justify-end gap-3">
        <button
          disabled={sending}
          className="text-sm text-gray-600 hover:text-red-600 px-3 py-2 font-medium"
        >
          Dismiss
        </button>
        <button
          onClick={handleClick}
          disabled={sending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
        >
          {sending && <RefreshCw className="animate-spin" size={14} />}
          {sending ? "Sending..." : "Approve & Send"}
        </button>
      </div>
    </div>
  );
};

// ============ MY APPROVALS PAGE ============
const MyApprovalsPage = () => {
  const { user } = useAuth();
  const { selectedAccount } = useAccounts();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      // Fetch messages that are 'posted' AND approved by the current user
      let url = `/messages?status=posted&approvedBy=${user.username}`;
      // Optional: Filter by account if one is selected in sidebar, otherwise show all my approvals
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
        My Approvals 
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

// ============ LOGIN PAGE ============
const LoginPage = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (await login(form.username, form.password)) navigate('/');
  };

  return (
    <div className="h-screen w-full bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Staff Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full p-3 border rounded-lg" placeholder="Username" onChange={e => setForm({...form, username: e.target.value})} />
          <input className="w-full p-3 border rounded-lg" type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
          <button className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">Sign In</button>
        </form>
      </div>
    </div>
  );
};

// ============ ACCOUNTS MANAGEMENT PAGE ==========
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

// ============ AUDIT PAGE ==========
const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/audit');
      setLogs(data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Logs</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold">Recent Actions</h2></div>
        {loading ? (
          <div className="p-6 text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left">Approver</th>
                <th className="px-6 py-3 text-left">Message</th>
                <th className="px-6 py-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b">
                  <td className="px-6 py-3 font-medium text-gray-900">{l.approvedBy}</td>
                  <td className="px-6 py-3 text-gray-800">{l.aiDraft || 'No content'}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {l.postedAt ? new Date(l.postedAt).toLocaleString() : 'N/A'}
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

// ============ ROUTER ============
const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <Toaster />
          <div className="flex h-screen bg-gray-100 font-sans">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              
              {/* PROTECTED ROUTES */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <div className="flex h-full w-full">
                    <Sidebar />
                    <div className="flex-1 overflow-auto">
                      <Routes>
                        <Route path="/" element={<InboxPage />} />
                        <Route path="/my-approvals" element={<MyApprovalsPage />} />
                        <Route path="/users" element={<UserManagementPage />} />
                        <Route path="/audit" element={<AuditPage />} />
                        <Route path="/add-account" element={<ManageAccountsPage />} />
                      </Routes>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};
export default App;