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
      {/* 1. Left Spacer: Increased to 60% 
         This pushes the login section further to the right side.
      */}
      <div className="hidden lg:block lg:w-[60%]" />

      {/* 2. Right Side Container: Reduced to 40% 
         The card will center itself within this smaller right-side column.
      */}
      <div className="w-full lg:w-[40%] flex items-center justify-center px-8 bg-gradient-to-l from-black/80 via-black/50 to-transparent">

        {/* 3. Card Width: Increased to 'max-w-lg' (Large) 
           This makes the physical card much wider and more commanding.
        */}
        <div className="w-full max-w-lg">

          {/* Increased Padding (p-12) for a spacious, premium feel */}
          <div className="bg-white/95 backdrop-blur-2xl p-12 rounded-[2rem] shadow-2xl border border-white/40 relative overflow-hidden">

            {/* Header */}
            <div className="text-center mb-10">
              <img
                src={rapteeLogo}
                alt="Raptee"
                className="h-20 w-auto mx-auto mb-6 object-contain"
              />
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Staff Portal</h2>
              <p className="text-gray-500 mt-2 text-base">Authenticate to access the dashboard</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider ml-1">Username</label>
                <input
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl text-base focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider ml-1">Password</label>
                <input
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl text-base focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-xl font-bold text-lg tracking-wide transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-70 flex items-center justify-center gap-3 mt-4 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    Accessing...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400 font-semibold tracking-wide">
                COMMENTS MANGER • RAPTEE ENERGY
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;