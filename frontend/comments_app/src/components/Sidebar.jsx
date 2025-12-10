import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Instagram, Youtube, LogOut, FileText, PlusCircle, User,
  Shield, Users, Settings, MessageSquare, LayoutDashboard,
  ChevronRight, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from '../context/AccountContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { accounts, fetchAccounts } = useAccounts();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const isActive = (path) => location.pathname === path;
  const isAccountActive = (accountId) => location.pathname === `/account/${accountId}`;

  const menuItemClass = (active) => `
    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
    ${active
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
      : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
    }
  `;

  return (
    <div className="w-64 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white h-screen flex flex-col flex-shrink-0 border-r border-gray-800/50">
      {/* Logo Header */}
      <div className="p-5 border-b border-gray-800/50">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Raptee</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Comment Manager</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* Main Navigation */}
        <div>
          <Link to="/" className={menuItemClass(isActive('/'))}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Accounts Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Layers size={12} />
            Accounts
          </p>
          <div className="space-y-1">
            {accounts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500 italic">No accounts connected</p>
            ) : (
              accounts.map(account => (
                <Link
                  key={account.id}
                  to={`/account/${account.id}`}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group
                    ${isAccountActive(account.id)
                      ? 'bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                    }
                  `}
                >
                  <div className={`
                    w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110
                    ${account.platform === 'instagram'
                      ? 'bg-gradient-to-br from-pink-500 to-purple-500'
                      : 'bg-gradient-to-br from-red-500 to-red-600'
                    }
                  `}>
                    {account.platform === 'instagram'
                      ? <Instagram size={14} className="text-white" />
                      : <Youtube size={14} className="text-white" />
                    }
                  </div>
                  <span className="flex-1 truncate">{account.name}</span>
                  <ChevronRight size={14} className={`
                    transition-transform opacity-0 group-hover:opacity-100
                    ${isAccountActive(account.id) ? 'opacity-100' : ''}
                  `} />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* User Menu */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User size={12} />
            User
          </p>
          <div className="space-y-1">
            <Link to="/my-comments" className={menuItemClass(isActive('/my-comments'))}>
              <MessageSquare size={18} />
              <span>My Comments</span>
            </Link>
            <Link to="/settings" className={menuItemClass(isActive('/settings'))}>
              <Settings size={18} />
              <span>Account Settings</span>
            </Link>
          </div>
        </div>

        {/* Admin Section */}
        {user?.role === 'admin' && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider flex items-center gap-2">
              <Shield size={12} />
              Admin
            </p>
            <div className="space-y-1">
              <Link to="/audit" className={menuItemClass(isActive('/audit'))}>
                <FileText size={18} />
                <span>Audit Logs</span>
              </Link>
              <Link to="/manage-accounts" className={menuItemClass(isActive('/manage-accounts'))}>
                <PlusCircle size={18} />
                <span>Manage Accounts</span>
              </Link>
              <Link to="/users" className={menuItemClass(isActive('/users'))}>
                <Users size={18} />
                <span>Manage Users</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold shadow-md">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-100 truncate">{user?.username}</p>
            <div className="flex items-center gap-1 text-[11px] text-gray-500 capitalize">
              {user?.role === 'admin' && <Shield size={10} className="text-amber-400" />}
              <span>{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="p-3 border-t border-gray-800/50">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
