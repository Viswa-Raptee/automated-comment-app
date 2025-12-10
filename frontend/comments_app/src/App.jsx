import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { AccountProvider } from './context/AccountContext';
import ProtectedRoute from './ProtectedRoute';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import MyApprovalsPage from './pages/MyApprovalsPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import AuditPage from './pages/AuditPage';
import ManageAccountsPage from './pages/ManageAccountsPage';
import LoginPage from './pages/LoginPage';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '12px',
                background: '#1f2937',
                color: '#fff',
              },
            }}
          />
          <div className="flex h-screen bg-gray-100 font-sans">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <div className="flex h-full w-full">
                    <Sidebar />
                    <div className="flex-1 overflow-hidden">
                      <Routes>
                        {/* Dashboard - Landing Page */}
                        <Route path="/" element={<DashboardPage />} />

                        {/* Account Inbox - View comments for specific account */}
                        <Route path="/account/:accountId" element={<InboxPage />} />

                        {/* User Menu */}
                        <Route path="/my-comments" element={<MyApprovalsPage />} />
                        <Route path="/settings" element={<AccountSettingsPage />} />

                        {/* Admin Routes */}
                        <Route path="/users" element={<UserManagementPage />} />
                        <Route path="/audit" element={<AuditPage />} />
                        <Route path="/manage-accounts" element={<ManageAccountsPage />} />

                        {/* Legacy route redirect */}
                        <Route path="/my-approvals" element={<MyApprovalsPage />} />
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

export default App;
