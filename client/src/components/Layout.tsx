import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  CalculatorIcon,
  UsersIcon,
  UserCircleIcon,
  TagIcon,
  ArrowDownTrayIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';
import { authAPI } from '../lib/api';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Expenses', href: '/expenses', icon: CurrencyDollarIcon },
  { name: 'Payments', href: '/payments', icon: CreditCardIcon },
  { name: 'Split Bill', href: '/split-bill', icon: CalculatorIcon },
  { name: 'Recurring', href: '/recurring', icon: ArrowPathIcon },
  { name: 'Members', href: '/members', icon: UsersIcon },
  { name: 'Categories', href: '/categories', icon: TagIcon },
  { name: 'Actions', href: '/actions', icon: ClipboardDocumentCheckIcon, adminOnly: true },
  { name: 'Export/Import', href: '/export', icon: ArrowDownTrayIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, adminOnly: true },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshToken, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          glass-card rounded-none lg:rounded-r-3xl border-r border-white/10 lg:border flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Rumah Money Mate" className="w-10 h-10 rounded-xl" />
              <div>
                <h1 className="text-lg font-bold text-white">Rumah Money Mate</h1>
                <p className="text-xs text-white/50">Your Housemates' Wallet Buddy</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            // Skip admin-only items for non-admins
            if (item.adminOnly && !user?.isAdmin) return null;
            
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircleIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName}
              </p>
              <p className="text-xs text-white/50 truncate">
                {user?.isAdmin ? 'Admin' : 'Member'}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden glass-card rounded-none border-b border-white/10 p-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">Rumah Money Mate</h1>
            <Link to="/profile" className="p-2 rounded-lg hover:bg-white/10">
              <UserCircleIcon className="w-6 h-6" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </div>

        {/* Footer credit */}
        <footer className="p-4 text-center text-white/30 text-xs">
          <p>
            Made with 💜 by Mahir Sehmi -{' '}
            <a href="https://www.linkedin.com/in/mnmahir/" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
              LinkedIn
            </a>{' '}
            |{' '}
            <a href="https://github.com/mnmahir" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
              GitHub
            </a>{' '}
            |{' '}
            <a href="https://ko-fi.com/H2H818H9M3" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
              Buy me a coffee!
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
