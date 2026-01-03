import { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  PhotoIcon,
  QrCodeIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { usersAPI, authAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'bank' | 'security'>('profile');

  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    displayName: user?.displayName || '',
    email: user?.email || '',
  });

  const [bankData, setBankData] = useState({
    bankName: user?.bankName || '',
    bankAccountNo: user?.bankAccountNo || '',
    bankAccountName: user?.bankAccountName || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Sync user data when it changes
  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        displayName: user.displayName || '',
        email: user.email || '',
      });
      setBankData({
        bankName: user.bankName || '',
        bankAccountNo: user.bankAccountNo || '',
        bankAccountName: user.bankAccountName || '',
      });
    }
  }, [user]);

  // Fetch fresh user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authAPI.getMe();
        updateUser(response.data);
      } catch (error) {
        console.error('Failed to fetch user data');
      }
    };
    fetchUser();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await usersAPI.updateProfile(profileData);
      updateUser(response.data);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBankUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await usersAPI.updateProfile(bankData);
      updateUser(response.data);
      toast.success('Bank information updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update bank info');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await usersAPI.updateProfile({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await usersAPI.uploadAvatar(file);
      updateUser({ avatarUrl: response.data.avatarUrl });
      toast.success('Avatar updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload avatar');
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await usersAPI.uploadQR(file);
      updateUser({ paymentQrImage: response.data.paymentQrImage });
      toast.success('QR code updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload QR code');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Profile Settings</h1>
        <p className="text-white/60 mt-1">Manage your account information</p>
      </div>

      {/* Profile Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircleIcon className="w-12 h-12 text-white" />
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors">
              <PhotoIcon className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.displayName}</h2>
            <p className="text-white/50">@{user?.username}</p>
            <p className="text-xs text-white/40 mt-1">ID: {user?.id}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['profile', 'bank', 'security'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Username
              </label>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, username: e.target.value }))
                }
                className="glass-input"
                placeholder="Your unique username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={profileData.displayName}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, displayName: e.target.value }))
                }
                className="glass-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="glass-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="glass-button w-full disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {/* Bank Tab */}
        {activeTab === 'bank' && (
          <div className="space-y-6">
            <form onSubmit={handleBankUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankData.bankName}
                  onChange={(e) =>
                    setBankData((prev) => ({ ...prev, bankName: e.target.value }))
                  }
                  className="glass-input"
                  placeholder="e.g., Maybank, CIMB, RHB"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={bankData.bankAccountNo}
                  onChange={(e) =>
                    setBankData((prev) => ({ ...prev, bankAccountNo: e.target.value }))
                  }
                  className="glass-input"
                  placeholder="Your bank account number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={bankData.bankAccountName}
                  onChange={(e) =>
                    setBankData((prev) => ({ ...prev, bankAccountName: e.target.value }))
                  }
                  className="glass-input"
                  placeholder="Name on bank account"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="glass-button w-full disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Bank Info'}
              </button>
            </form>

            {/* QR Code Section */}
            <div className="pt-6 border-t border-white/10">
              <h3 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
                <QrCodeIcon className="w-5 h-5" />
                Payment QR Code
              </h3>
              {user?.paymentQrImage ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={user.paymentQrImage}
                    alt="Payment QR"
                    className="max-w-[200px] rounded-xl"
                  />
                  <label className="glass-button-secondary cursor-pointer">
                    Change QR Code
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQRUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="glass-input flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 py-8">
                  <QrCodeIcon className="w-6 h-6 text-white/40" />
                  <span className="text-white/60">Upload your payment QR code</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQRUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))
                }
                className="glass-input"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                className="glass-input"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                className="glass-input"
                placeholder="Confirm new password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="glass-button w-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyIcon className="w-5 h-5" />
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
