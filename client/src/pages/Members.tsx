import { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  EnvelopeIcon,
  BanknotesIcon,
  TrashIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { usersAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  paymentQrImage: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface UserStats {
  totalExpenses: number;
  totalPaymentsMade: number;
  totalPaymentsReceived: number;
  expenseCount: number;
  userTotalDebt: number;
  debtToCurrentUser: number;
  currentUserDebt: number;
}

export default function Members() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<{ [key: string]: UserStats }>({});
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | 'all' | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      setUsers(response.data);

      // Fetch stats for each user
      const statsPromises = response.data.map((u: User) =>
        usersAPI.getStats(u.id).then((res) => ({ id: u.id, stats: res.data }))
      );
      const statsResults = await Promise.all(statsPromises);
      const statsMap: { [key: string]: UserStats } = {};
      statsResults.forEach((r) => {
        statsMap[r.id] = r.stats;
      });
      setStats(statsMap);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    if (!confirm(`Are you sure you want to ${currentIsAdmin ? 'remove admin' : 'grant admin'} privileges?`)) {
      return;
    }

    try {
      await usersAPI.setAdmin(userId, !currentIsAdmin);
      toast.success(`Admin status updated`);
      fetchMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update admin status');
    }
  };

  const handleDeleteUser = async (userId: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete ${displayName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await usersAPI.delete(userId);
      toast.success(`${displayName} has been deleted`);
      fetchMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      if (resetTarget === 'all') {
        await usersAPI.resetAllPasswords(newPassword);
        toast.success('All passwords have been reset');
      } else if (resetTarget && typeof resetTarget === 'object') {
        await usersAPI.resetPassword(resetTarget.id, newPassword);
        toast.success(`Password reset for ${resetTarget.name}`);
      }
      setShowResetModal(false);
      setResetTarget(null);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    }
  };

  const openResetModal = (target: { id: string; name: string } | 'all') => {
    setResetTarget(target);
    setNewPassword('');
    setShowResetModal(true);
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Members</h1>
          <p className="text-white/60 mt-1">View all house members and their activity</p>
        </div>
        {currentUser?.isAdmin && (
          <button
            onClick={() => openResetModal('all')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors"
          >
            <KeyIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Reset All Passwords</span>
          </button>
        )}
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((member) => (
          <div key={member.id} className="glass-card p-5 space-y-4">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center overflow-hidden">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {member.displayName[0]}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">{member.displayName}</h3>
                  {member.isAdmin && (
                    <span className="badge badge-info">Admin</span>
                  )}
                </div>
                <p className="text-sm text-white/50 truncate">@{member.username}</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <EnvelopeIcon className="w-4 h-4" />
                <span className="truncate">{member.email}</span>
              </div>
              {member.bankAccountNo && (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <BanknotesIcon className="w-4 h-4" />
                  <span className="truncate">
                    {member.bankName} - {member.bankAccountNo}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            {stats[member.id] && (
              <div className="grid grid-cols-2 gap-3">
                {member.id === currentUser?.id ? (
                  // My own card - show my total debt
                  <>
                    <div className="col-span-2 glass-card p-3 bg-white/5">
                      <p className="text-xs text-white/50">My Total Debt</p>
                      <p className={`text-lg font-semibold ${
                        stats[member.id].userTotalDebt > 0 
                          ? 'text-red-400' 
                          : 'text-green-400'
                      }`}>
                        RM {stats[member.id].userTotalDebt.toFixed(2)}
                        {stats[member.id].userTotalDebt === 0 && (
                          <span className="text-xs ml-2">✓ Settled</span>
                        )}
                      </p>
                    </div>
                  </>
                ) : (
                  // Other member's card - show debt relationship
                  <>
                    <div className="glass-card p-3 bg-white/5">
                      <p className="text-xs text-white/50">Owes You</p>
                      <p className={`text-lg font-semibold ${
                        stats[member.id].debtToCurrentUser > 0 
                          ? 'text-red-400' 
                          : 'text-green-400'
                      }`}>
                        RM {stats[member.id].debtToCurrentUser.toFixed(2)}
                        {stats[member.id].debtToCurrentUser === 0 && (
                          <span className="text-xs ml-1">✓</span>
                        )}
                      </p>
                    </div>
                    <div className="glass-card p-3 bg-white/5">
                      <p className="text-xs text-white/50">You Owe</p>
                      <p className={`text-lg font-semibold ${
                        stats[member.id].currentUserDebt > 0 
                          ? 'text-red-400' 
                          : 'text-green-400'
                      }`}>
                        RM {stats[member.id].currentUserDebt.toFixed(2)}
                        {stats[member.id].currentUserDebt === 0 && (
                          <span className="text-xs ml-1">✓</span>
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* QR Code */}
            {member.paymentQrImage && (
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-white/50 mb-2">Payment QR</p>
                <img
                  src={member.paymentQrImage}
                  alt="Payment QR"
                  className="w-full max-w-[150px] mx-auto rounded-lg"
                />
              </div>
            )}

            {/* Member Since */}
            <p className="text-xs text-white/40">
              Member since {format(new Date(member.createdAt), 'MMM d, yyyy')}
            </p>

            {/* Admin Actions */}
            {currentUser?.isAdmin && member.id !== currentUser.id && (
              <div className="space-y-2">
                <button
                  onClick={() => handleToggleAdmin(member.id, member.isAdmin)}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-colors ${
                    member.isAdmin
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  }`}
                >
                  {member.isAdmin ? (
                    <>
                      <ShieldExclamationIcon className="w-4 h-4" />
                      Remove Admin
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="w-4 h-4" />
                      Make Admin
                    </>
                  )}
                </button>
                <button
                  onClick={() => openResetModal({ id: member.id, name: member.displayName })}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-colors bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
                >
                  <KeyIcon className="w-4 h-4" />
                  Reset Password
                </button>
                <button
                  onClick={() => handleDeleteUser(member.id, member.displayName)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-colors bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                >
                  <TrashIcon className="w-4 h-4" />
                  Delete User
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reset Password Modal */}
      {showResetModal && resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 max-w-md w-full space-y-4">
            <h3 className="text-xl font-semibold text-white">
              {resetTarget === 'all' 
                ? 'Reset All Passwords' 
                : `Reset Password for ${resetTarget.name}`
              }
            </h3>
            
            {resetTarget === 'all' && (
              <p className="text-amber-400 text-sm">
                ⚠️ This will reset passwords for ALL users. Everyone will need to log in again with the new password.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetTarget(null);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
