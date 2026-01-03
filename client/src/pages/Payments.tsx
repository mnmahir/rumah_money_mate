import { useState, useEffect } from 'react';
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  BanknotesIcon,
  QrCodeIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { paymentsAPI, usersAPI, deleteRequestsAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  paymentQrImage: string | null;
}

interface Payment {
  id: string;
  amount: number;
  description: string | null;
  receiptImage: string;
  date: string;
  status: 'pending' | 'confirmed' | 'rejected';
  fromUser: User;
  toUser: User;
  createdBy?: { id: string; displayName: string } | null;
}

interface Balance {
  user: User;
  paidToThem: number;
  receivedFromThem: number;
  balance: number;
  youOwe: boolean;
  theyOwe: boolean;
  amount: number;
}

export default function Payments() {
  const { user } = useAuthStore();
  const { currency } = useSettingsStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPaymentInfoModal, setShowPaymentInfoModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [selectedQrImage, setSelectedQrImage] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'balances'>('all');
  const [filter, setFilter] = useState({
    search: '',
    status: '' as '' | 'pending' | 'confirmed' | 'rejected',
    userId: '',
    startDate: '',
    endDate: '',
  });

  const [formData, setFormData] = useState({
    toUserId: '',
    fromUserId: '', // On behalf of
    amount: '',
    description: '',
    receipt: null as File | null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, usersRes, balancesRes] = await Promise.all([
        paymentsAPI.getAll(),
        usersAPI.getAll(),
        paymentsAPI.getAllBalances(),
      ]);
      setPayments(paymentsRes.data.payments);
      setAllUsers(usersRes.data);
      setBalances(balancesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.toUserId || !formData.amount || !formData.receipt) {
      toast.error('Please fill in all required fields and attach receipt');
      return;
    }

    try {
      const data = new FormData();
      data.append('toUserId', formData.toUserId);
      data.append('amount', formData.amount);
      if (formData.fromUserId) data.append('fromUserId', formData.fromUserId);
      if (formData.description) data.append('description', formData.description);
      data.append('receipt', formData.receipt);

      await paymentsAPI.create(data);
      toast.success('Payment recorded successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'confirmed' | 'rejected') => {
    try {
      await paymentsAPI.updateStatus(id, status);
      toast.success(`Payment ${status}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update payment');
    }
  };

  const resetForm = () => {
    setFormData({
      toUserId: '',
      fromUserId: '',
      amount: '',
      description: '',
      receipt: null,
    });
  };

  const handleViewReceipt = (receiptUrl: string) => {
    setSelectedReceipt(receiptUrl);
    setShowReceiptModal(true);
  };

  const handleViewQr = (qrUrl: string) => {
    setSelectedQrImage(qrUrl);
    setShowQrModal(true);
  };

  const handleShowPaymentInfo = (paymentUser: User) => {
    setSelectedUser(paymentUser);
    setShowPaymentInfoModal(true);
  };

  const handleDelete = async (payment: Payment) => {
    if (user?.isAdmin) {
      // Admin can delete directly
      if (!confirm('Are you sure you want to delete this payment?')) return;
      try {
        await paymentsAPI.delete(payment.id);
        toast.success('Payment deleted successfully');
        fetchData();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete payment');
      }
    } else {
      // Non-admin: show delete request modal
      setDeletingPayment(payment);
      setDeleteReason('');
      setShowDeleteModal(true);
    }
  };

  const handleRequestDelete = async () => {
    if (!deletingPayment) return;

    try {
      await deleteRequestsAPI.create({
        recordType: 'payment',
        recordId: deletingPayment.id,
        reason: deleteReason || undefined,
      });
      toast.success('Delete request submitted for admin approval');
      setShowDeleteModal(false);
      setDeletingPayment(null);
      setDeleteReason('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit delete request');
    }
  };

  const canDelete = (payment: Payment) =>
    payment.fromUser.id === user?.id || user?.isAdmin;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="badge badge-success">Confirmed</span>;
      case 'rejected':
        return <span className="badge badge-danger">Rejected</span>;
      default:
        return <span className="badge badge-warning">Pending</span>;
    }
  };

  // Filter payments based on search and filters
  const filteredPayments = payments.filter((payment) => {
    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchesSearch =
        payment.description?.toLowerCase().includes(searchLower) ||
        payment.fromUser.displayName.toLowerCase().includes(searchLower) ||
        payment.toUser.displayName.toLowerCase().includes(searchLower) ||
        payment.amount.toString().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filter.status && payment.status !== filter.status) return false;

    // User filter (matches either from or to user)
    if (filter.userId) {
      if (payment.fromUser.id !== filter.userId && payment.toUser.id !== filter.userId) {
        return false;
      }
    }

    // Date range filter
    if (filter.startDate) {
      const paymentDate = new Date(payment.date);
      const startDate = new Date(filter.startDate);
      if (paymentDate < startDate) return false;
    }
    if (filter.endDate) {
      const paymentDate = new Date(payment.date);
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (paymentDate > endDate) return false;
    }

    return true;
  });

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Payments</h1>
          <p className="text-white/60 mt-1">Track payments between members</p>
        </div>
        <button onClick={() => setShowModal(true)} className="glass-button flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Record Payment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'balances'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {tab === 'all' ? 'All Payments' : tab === 'pending' ? 'I Owe' : 'Owed to Me'}
          </button>
        ))}
      </div>

      {/* Pending Tab - What I Owe to Others */}
      {activeTab === 'pending' ? (
        <div className="space-y-4">
          <div className="glass-card p-4 bg-red-500/10 border-red-500/20">
            <p className="text-white/70 text-sm">
              This tab shows outstanding amounts you owe to other members. Click "Pay Now" to record a payment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.filter(b => b.youOwe && b.amount > 0).length > 0 ? (
              balances.filter(b => b.youOwe && b.amount > 0).map((balance) => (
                <div key={balance.user.id} className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center overflow-hidden">
                      {balance.user.avatarUrl ? (
                        <img
                          src={balance.user.avatarUrl}
                          alt={balance.user.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold">
                          {balance.user.displayName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{balance.user.displayName}</p>
                      <p className="text-sm text-red-400">You owe</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-400 mb-4">
                    {currency} {balance.amount.toFixed(2)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShowPaymentInfo(balance.user)}
                      className="flex-1 glass-button-secondary text-sm flex items-center justify-center gap-2"
                    >
                      <BanknotesIcon className="w-4 h-4" />
                      Bank Info
                    </button>
                    <button
                      onClick={() => {
                        // Auto-fill the payment form
                        setFormData({
                          toUserId: balance.user.id,
                          fromUserId: '',
                          amount: balance.amount.toFixed(2),
                          description: `Payment to ${balance.user.displayName}`,
                          receipt: null,
                        });
                        setShowModal(true);
                      }}
                      className="flex-1 glass-button text-sm flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Pay Now
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-white/40">
                <CheckIcon className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="text-lg">You don't owe anyone!</p>
                <p className="text-sm">All your balances are settled.</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'balances' ? (
        /* Balances Tab - What Others Owe Me */
        <div className="space-y-4">
          <div className="glass-card p-4 bg-green-500/10 border-green-500/20">
            <p className="text-white/70 text-sm">
              This tab shows amounts that other members owe you. When they pay, you can confirm the payment in "All Payments".
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.filter(b => b.theyOwe && b.amount > 0).length > 0 ? (
              balances.filter(b => b.theyOwe && b.amount > 0).map((balance) => (
                <div key={balance.user.id} className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center overflow-hidden">
                      {balance.user.avatarUrl ? (
                        <img
                          src={balance.user.avatarUrl}
                          alt={balance.user.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold">
                          {balance.user.displayName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{balance.user.displayName}</p>
                      <p className="text-sm text-green-400">Owes you</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-400 mb-4">
                    {currency} {balance.amount.toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleShowPaymentInfo(balance.user)}
                    className="w-full glass-button-secondary text-sm flex items-center justify-center gap-2"
                  >
                    <BanknotesIcon className="w-4 h-4" />
                    View Their Bank Info
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-white/40">
                <BanknotesIcon className="w-12 h-12 mx-auto mb-3 text-white/20" />
                <p className="text-lg">No one owes you</p>
                <p className="text-sm">All balances from others are settled.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Payments List */
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-card p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1 min-w-0">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={filter.search}
                  onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
                  className="glass-input pl-10"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <FunnelIcon className="w-5 h-5 text-white/40 shrink-0" />
                <select
                  value={filter.status}
                  onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value as '' | 'pending' | 'confirmed' | 'rejected' }))}
                  className="glass-select !w-auto"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  value={filter.userId}
                  onChange={(e) => setFilter((prev) => ({ ...prev, userId: e.target.value }))}
                  className="glass-select !w-auto"
                >
                  <option value="">All Members</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CalendarIcon className="w-5 h-5 text-white/40 shrink-0" />
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="glass-input !w-auto text-sm"
                />
                <span className="text-white/40">to</span>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="glass-input !w-auto text-sm"
                />
                {(filter.search || filter.status || filter.userId || filter.startDate || filter.endDate) && (
                  <button
                    onClick={() => setFilter({ search: '', status: '', userId: '', startDate: '', endDate: '' })}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payments Table */}
          <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="table-header">Date</th>
                  <th className="table-header">From</th>
                  <th className="table-header">To</th>
                  <th className="table-header">Payment Info</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Receipt</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="table-row">
                      <td className="table-cell">
                        {format(new Date(payment.date), 'MMM d, yyyy')}
                      </td>
                      <td className="table-cell">
                        <div>
                          <span>{payment.fromUser.displayName}</span>
                          {payment.createdBy && payment.createdBy.id !== payment.fromUser.id && (
                            <p className="text-xs text-white/40">
                              added by {payment.createdBy.displayName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">{payment.toUser.displayName}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {payment.toUser.bankAccountNo ? (
                            <div className="text-xs">
                              <p className="text-white/70">{payment.toUser.bankName}</p>
                              <p className="font-mono text-white/90">{payment.toUser.bankAccountNo}</p>
                            </div>
                          ) : (
                            <span className="text-white/40 text-xs">No bank info</span>
                          )}
                          {payment.toUser.paymentQrImage && (
                            <button
                              onClick={() => handleViewQr(payment.toUser.paymentQrImage!)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-purple-400 hover:text-purple-300"
                              title="View QR Code"
                            >
                              <QrCodeIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="table-cell font-semibold text-green-400">
                        {currency} {payment.amount.toFixed(2)}
                      </td>
                      <td className="table-cell">{getStatusBadge(payment.status)}</td>
                      <td className="table-cell">
                        <button
                          onClick={() => handleViewReceipt(payment.receiptImage)}
                          className="text-purple-400 hover:text-purple-300 text-sm"
                        >
                          View
                        </button>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {payment.status === 'pending' &&
                            (payment.toUser.id === user?.id || user?.isAdmin) && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(payment.id, 'confirmed')}
                                  className="p-1.5 rounded-lg hover:bg-green-500/20 text-white/60 hover:text-green-400"
                                  title="Confirm"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(payment.id, 'rejected')}
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400"
                                  title="Reject"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          {canDelete(payment) && (
                            <button
                              onClick={() => handleDelete(payment)}
                              className={`p-1.5 rounded-lg text-white/60 ${
                                user?.isAdmin 
                                  ? 'hover:bg-red-500/20 hover:text-red-400'
                                  : 'hover:bg-yellow-500/20 hover:text-yellow-400'
                              }`}
                              title={user?.isAdmin ? 'Delete' : 'Request deletion'}
                            >
                              {user?.isAdmin ? (
                                <TrashIcon className="w-4 h-4" />
                              ) : (
                                <ExclamationTriangleIcon className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-white/40">
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Payment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              On Behalf Of
            </label>
            <select
              value={formData.fromUserId}
              onChange={(e) => setFormData((prev) => ({ ...prev, fromUserId: e.target.value }))}
              className="glass-select"
            >
              <option value="">Myself</option>
              {allUsers.filter(u => u.id !== user?.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">
              Record this payment for another member
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Pay To <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.toUserId}
              onChange={(e) => setFormData((prev) => ({ ...prev, toUserId: e.target.value }))}
              className="glass-select"
            >
              <option value="">Select member</option>
              {/* When paying on behalf of someone, include "Myself" as Pay To option */}
              {formData.fromUserId && user && (
                <option value={user.id}>
                  Myself ({user.displayName})
                </option>
              )}
              {allUsers.filter(u => u.id !== user?.id && u.id !== formData.fromUserId).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>

          {formData.toUserId && (
            <div className="glass-card p-4 bg-purple-500/10 border-purple-500/20">
              <p className="text-sm text-white/70 mb-2">Payment Info</p>
              {(() => {
                const selectedUser = allUsers.find((u) => u.id === formData.toUserId);
                if (!selectedUser) return <p className="text-white/50 text-sm">User not found</p>;
                
                return (
                  <>
                    {selectedUser.bankAccountNo ? (
                      <div className="text-sm">
                        <p className="text-white">{selectedUser.bankName}</p>
                        <p className="text-white font-mono">{selectedUser.bankAccountNo}</p>
                        <p className="text-white/70">{selectedUser.bankAccountName}</p>
                      </div>
                    ) : (
                      <p className="text-white/50 text-sm">No bank info available</p>
                    )}
                    {selectedUser.paymentQrImage && (
                      <button
                        type="button"
                        onClick={() => handleShowPaymentInfo(selectedUser)}
                        className="mt-2 text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                      >
                        <QrCodeIcon className="w-4 h-4" />
                        Show QR Code
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Amount (RM) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              className="glass-input"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="glass-input"
              placeholder="What is this payment for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Receipt (Proof of Payment) <span className="text-red-400">*</span>
            </label>
            <label className="glass-input flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10">
              <PhotoIcon className="w-5 h-5 text-white/40" />
              <span className="text-white/60">
                {formData.receipt ? formData.receipt.name : 'Upload payment receipt'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, receipt: e.target.files?.[0] || null }))
                }
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="glass-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="glass-button flex-1">
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Receipt" size="lg">
        {selectedReceipt && (
          <div className="flex justify-center">
            <img src={selectedReceipt} alt="Receipt" className="max-w-full max-h-[70vh] rounded-lg" />
          </div>
        )}
      </Modal>

      {/* Payment Info Modal */}
      <Modal
        isOpen={showPaymentInfoModal}
        onClose={() => setShowPaymentInfoModal(false)}
        title="Payment Information"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white">{selectedUser.displayName}</h3>
            </div>

            {selectedUser.paymentQrImage && (
              <div className="flex justify-center">
                <img
                  src={selectedUser.paymentQrImage}
                  alt="Payment QR"
                  className="max-w-[250px] rounded-xl"
                />
              </div>
            )}

            {selectedUser.bankAccountNo && (
              <div className="glass-card p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60">Bank</span>
                  <span className="text-white">{selectedUser.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Account No</span>
                  <span className="text-white font-mono">{selectedUser.bankAccountNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Account Name</span>
                  <span className="text-white">{selectedUser.bankAccountName}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowPaymentInfoModal(false);
                setFormData((prev) => ({ ...prev, toUserId: selectedUser.id }));
                setShowModal(true);
              }}
              className="glass-button w-full"
            >
              Record Payment to {selectedUser.displayName}
            </button>
          </div>
        )}
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="Payment QR Code"
      >
        {selectedQrImage && (
          <div className="flex justify-center">
            <img
              src={selectedQrImage}
              alt="Payment QR Code"
              className="max-w-full max-h-[70vh] rounded-lg"
            />
          </div>
        )}
      </Modal>

      {/* Delete Request Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingPayment(null);
          setDeleteReason('');
        }}
        title="Request Delete Approval"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Admin approval required</p>
                <p className="text-white/60 text-sm mt-1">
                  Your delete request will be sent to admin for approval.
                </p>
              </div>
            </div>
          </div>

          {deletingPayment && (
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-white/60 text-sm">Payment to delete:</p>
              <p className="text-white font-medium">
                {deletingPayment.fromUser.displayName} → {deletingPayment.toUser.displayName}
              </p>
              <p className="text-green-400 font-bold">{currency} {deletingPayment.amount.toFixed(2)}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="glass-input min-h-[80px]"
              placeholder="Why do you want to delete this payment?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingPayment(null);
                setDeleteReason('');
              }}
              className="glass-button-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestDelete}
              className="flex-1 px-4 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors font-medium"
            >
              Submit Request
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
