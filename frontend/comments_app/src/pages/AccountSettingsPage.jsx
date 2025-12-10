import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { toast } from 'react-hot-toast';
import { User, Shield, Calendar, Lock, Eye, EyeOff, Save, AlertCircle } from 'lucide-react';

const AccountSettingsPage = () => {
    const { user } = useAuth();
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // Password change state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [changingPassword, setChangingPassword] = useState(false);
    const [errors, setErrors] = useState({});

    // Fetch user info
    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const { data } = await api.get('/auth/me');
                setUserInfo(data);
            } catch (e) {
                toast.error('Failed to load user info');
            } finally {
                setLoading(false);
            }
        };
        fetchUserInfo();
    }, []);

    // Validate password form
    const validatePasswords = () => {
        const newErrors = {};

        if (!passwordData.currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }

        if (!passwordData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (passwordData.newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
        }

        if (!passwordData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your new password';
        } else if (passwordData.newPassword !== passwordData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle password change
    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (!validatePasswords()) return;

        setChangingPassword(true);
        try {
            await api.post('/auth/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            toast.success('Password changed successfully!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setErrors({});
        } catch (e) {
            const errorMsg = e.response?.data?.error || 'Failed to change password';
            toast.error(errorMsg);
            if (errorMsg.includes('incorrect')) {
                setErrors({ currentPassword: 'Current password is incorrect' });
            }
        } finally {
            setChangingPassword(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 overflow-y-auto">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your account information and security</p>
            </div>

            <div className="max-w-3xl mx-auto p-6 space-y-6">
                {/* User Information Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <User size={20} className="text-indigo-600" />
                            User Information
                        </h2>
                    </div>

                    <div className="p-6">
                        <div className="flex items-start gap-6">
                            {/* Avatar */}
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-3xl">
                                    {userInfo?.username?.charAt(0).toUpperCase()}
                                </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                                        <p className="text-lg font-semibold text-gray-900">{userInfo?.username}</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                        <div className="flex items-center gap-2">
                                            {userInfo?.role === 'admin' && <Shield size={16} className="text-indigo-600" />}
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${userInfo?.role === 'admin'
                                                    ? 'bg-indigo-100 text-indigo-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {userInfo?.role}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Member Since</label>
                                        <p className="text-gray-700 flex items-center gap-2">
                                            <Calendar size={16} className="text-gray-400" />
                                            {userInfo?.createdAt ? formatDate(userInfo.createdAt) : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Lock size={20} className="text-amber-600" />
                            Change Password
                        </h2>
                    </div>

                    <form onSubmit={handleChangePassword} className="p-6 space-y-5">
                        {/* Current Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPasswords.current ? 'text' : 'password'}
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData(d => ({ ...d, currentPassword: e.target.value }))}
                                    className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${errors.currentPassword ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                        }`}
                                    placeholder="Enter your current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.currentPassword && (
                                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle size={14} /> {errors.currentPassword}
                                </p>
                            )}
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPasswords.new ? 'text' : 'password'}
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData(d => ({ ...d, newPassword: e.target.value }))}
                                    className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${errors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                        }`}
                                    placeholder="Enter your new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.newPassword && (
                                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle size={14} /> {errors.newPassword}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPasswords.confirm ? 'text' : 'password'}
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(d => ({ ...d, confirmPassword: e.target.value }))}
                                    className={`w-full px-4 py-3 pr-12 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                        }`}
                                    placeholder="Confirm your new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle size={14} /> {errors.confirmPassword}
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {changingPassword ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Changing Password...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Change Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                        <AlertCircle size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <h4 className="font-medium text-blue-900">Security Tip</h4>
                        <p className="text-sm text-blue-700 mt-0.5">
                            Use a strong password with at least 6 characters, including letters, numbers, and special characters.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountSettingsPage;
