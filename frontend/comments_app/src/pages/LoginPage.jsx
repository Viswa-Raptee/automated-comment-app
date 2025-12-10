import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import loginBg from '../assets/login_view.png';
import rapteeLogo from '../assets/Main - Raptee Sec Black.jpg';

const LoginPage = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (await login(form.username, form.password)) {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div
      className="h-screen w-full bg-cover bg-center bg-no-repeat flex"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Left spacer - takes 55% to push card away from corner */}
      <div className="w-[55%]" />

      {/* Right side - Login card area */}
      <div className="w-[45%] flex items-center justify-start pl-8 bg-gradient-to-l from-black/60 via-black/40 to-transparent">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-white/95 backdrop-blur-lg p-8 rounded-2xl shadow-2xl">
            {/* Header with Logo */}
            <div className="text-center mb-8">
              <img
                src={rapteeLogo}
                alt="Raptee"
                className="h-14 w-auto mx-auto mb-4 object-contain"
              />
              <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Username</label>
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 mt-6">
              Raptee Comment Manager • Staff Portal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
