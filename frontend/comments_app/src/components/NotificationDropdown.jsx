import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, HelpCircle, UserPlus } from 'lucide-react';
import api from '../api/api';

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            const [notifRes, countRes] = await Promise.all([
                api.get('/notifications'),
                api.get('/notifications/unread-count')
            ]);
            setNotifications(notifRes.data);
            setUnreadCount(countRes.data.count);
        } catch (e) {
            console.error('Failed to fetch notifications');
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = async (notif) => {
        // Mark as read
        if (!notif.isRead) {
            await api.put(`/notifications/${notif.id}/read`);
            setUnreadCount(prev => Math.max(0, prev - 1));
            setNotifications(prev => prev.map(n =>
                n.id === notif.id ? { ...n, isRead: true } : n
            ));
        }

        // Navigate to the account/post
        if (notif.accountId) {
            navigate(`/account/${notif.accountId}`);
        }
        setIsOpen(false);
    };

    const handleMarkAllRead = async () => {
        setLoading(true);
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error('Failed to mark all as read');
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        setLoading(true);
        try {
            await api.delete('/notifications/clear-all');
            setNotifications([]);
            setUnreadCount(0);
        } catch (e) {
            console.error('Failed to clear notifications');
        } finally {
            setLoading(false);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'complaint': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'question': return <HelpCircle size={16} className="text-indigo-500" />;
            case 'assignment': return <UserPlus size={16} className="text-blue-500" />;
            default: return <Bell size={16} className="text-gray-500" />;
        }
    };

    const getNotificationBg = (type, isRead) => {
        if (isRead) return 'bg-gray-50';
        switch (type) {
            case 'complaint': return 'bg-amber-50';
            case 'question': return 'bg-indigo-50';
            case 'assignment': return 'bg-blue-50';
            default: return 'bg-white';
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
            >
                <Bell size={20} className="text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleMarkAllRead}
                                disabled={loading || unreadCount === 0}
                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                title="Mark all as read"
                            >
                                <CheckCheck size={16} className="text-gray-500" />
                            </button>
                            <button
                                onClick={handleClearAll}
                                disabled={loading || notifications.length === 0}
                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                title="Clear all"
                            >
                                <Trash2 size={16} className="text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center text-gray-400">
                                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <button
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors flex items-start gap-3 border-b border-gray-100 ${getNotificationBg(notif.type, notif.isRead)}`}
                                >
                                    <div className="mt-0.5">
                                        {getNotificationIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${notif.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                            {notif.content}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-gray-400">
                                                {new Date(notif.createdAt).toLocaleString()}
                                            </span>
                                            {notif.fromUser && (
                                                <span className="text-xs text-gray-500">from @{notif.fromUser}</span>
                                            )}
                                        </div>
                                    </div>
                                    {!notif.isRead && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
