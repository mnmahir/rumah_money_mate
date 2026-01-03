import { useState, useEffect } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  CalendarIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { recurringAPI, categoriesAPI, usersAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  startDate: string;
  endDate: string | null;
  totalOccurrences: number | null;
  occurrencesCreated: number;
  nextDueDate: string;
  isActive: boolean;
  splitEqually: boolean;
  splitType: string;
  splitConfig: string | null;
  categoryId: string | null;
  notes: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface User {
  id: string;
  username: string;
  displayName: string;
}

export default function Recurring() {
  const { user } = useAuthStore();
  const { currency } = useSettingsStore();
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    frequency: 'monthly',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    totalOccurrences: '',
    categoryId: '',
    notes: '',
    userId: '',
    // Split options
    splitType: 'equal' as 'equal' | 'percentage' | 'amount',
    splitMembers: [] as { memberId: string; percentage?: number; amount?: number }[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize split members when users are loaded
  useEffect(() => {
    if (users.length > 0 && formData.splitMembers.length === 0 && !editingRecurring) {
      // Sort users with current user first
      const sortedUsers = [...users].sort((a, b) => {
        if (a.id === user?.id) return -1;
        if (b.id === user?.id) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      
      setFormData((prev) => ({
        ...prev,
        splitMembers: sortedUsers.map((u) => ({
          memberId: u.id,
          percentage: 100 / sortedUsers.length,
          amount: 0,
        })),
      }));
    }
  }, [users, user?.id, editingRecurring]);

  const fetchData = async () => {
    try {
      const [recurringRes, categoriesRes, usersRes] = await Promise.all([
        recurringAPI.getAll(),
        categoriesAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setRecurring(recurringRes.data);
      setCategories(categoriesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Smart rounding for split amounts - owner (first member) gets the remainder
  const calculateSplitAmounts = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const splitMembers = formData.splitMembers;
    
    if (splitMembers.length === 0) return [];
    
    let amounts: { memberId: string; amount: number }[] = [];
    
    if (formData.splitType === 'equal') {
      const perPerson = totalAmount / splitMembers.length;
      const roundedPerPerson = Math.floor(perPerson * 100) / 100;
      const totalOthers = roundedPerPerson * (splitMembers.length - 1);
      const ownerAmount = Math.round((totalAmount - totalOthers) * 100) / 100;
      
      amounts = splitMembers.map((m, index) => ({
        memberId: m.memberId,
        amount: index === 0 ? ownerAmount : roundedPerPerson
      }));
    } else if (formData.splitType === 'percentage') {
      let totalOthersAmount = 0;
      const othersAmounts = splitMembers.slice(1).map((m) => {
        const percentage = m.percentage || 0;
        const amount = Math.round((totalAmount * percentage / 100) * 100) / 100;
        totalOthersAmount += amount;
        return { memberId: m.memberId, amount };
      });
      
      const ownerAmount = Math.round((totalAmount - totalOthersAmount) * 100) / 100;
      amounts = [
        { memberId: splitMembers[0].memberId, amount: ownerAmount },
        ...othersAmounts
      ];
    } else if (formData.splitType === 'amount') {
      let totalOthersAmount = 0;
      const othersAmounts = splitMembers.slice(1).map(m => {
        const amount = m.amount || 0;
        totalOthersAmount += amount;
        return { memberId: m.memberId, amount };
      });
      
      const ownerAmount = Math.round((totalAmount - totalOthersAmount) * 100) / 100;
      amounts = [
        { memberId: splitMembers[0].memberId, amount: Math.max(0, ownerAmount) },
        ...othersAmounts
      ];
    }
    
    return amounts;
  };

  // Get owner's percentage based on others' percentages
  const getOwnerPercentage = () => {
    const othersPercentage = formData.splitMembers.slice(1).reduce((sum, m) => sum + (m.percentage || 0), 0);
    return Math.max(0, 100 - othersPercentage);
  };

  // Get owner's amount based on others' amounts
  const getOwnerAmount = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const othersAmount = formData.splitMembers.slice(1).reduce((sum, m) => sum + (m.amount || 0), 0);
    return Math.max(0, totalAmount - othersAmount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Always use custom split config
      const splitConfig = formData.splitMembers;
      
      const payload = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        totalOccurrences: formData.totalOccurrences || null,
        categoryId: formData.categoryId || null,
        notes: formData.notes || null,
        userId: formData.userId || user?.id,
        splitEqually: false, // Always false since we're using custom splits
        splitType: formData.splitType,
        splitConfig,
      };
      
      if (editingRecurring) {
        await recurringAPI.update(editingRecurring.id, payload);
        toast.success('Recurring expense updated');
      } else {
        await recurringAPI.create(payload);
        toast.success('Recurring expense created');
      }
      
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save recurring expense');
    }
  };

  const handleEdit = (item: RecurringExpense) => {
    // Sort users with owner first
    const sortedUsers = [...users].sort((a, b) => {
      if (a.id === item.user.id) return -1;
      if (b.id === item.user.id) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    
    // Parse split config if exists
    let splitMembers: { memberId: string; percentage?: number; amount?: number }[] = [];
    if (item.splitConfig) {
      try {
        splitMembers = JSON.parse(item.splitConfig);
      } catch {
        // Default to all users if config is invalid
        splitMembers = sortedUsers.map((u) => ({
          memberId: u.id,
          percentage: 100 / sortedUsers.length,
          amount: 0,
        }));
      }
    } else {
      splitMembers = sortedUsers.map((u) => ({
        memberId: u.id,
        percentage: 100 / sortedUsers.length,
        amount: 0,
      }));
    }
    
    setEditingRecurring(item);
    setFormData({
      description: item.description,
      amount: item.amount.toString(),
      frequency: item.frequency,
      startDate: format(new Date(item.startDate), 'yyyy-MM-dd'),
      endDate: item.endDate ? format(new Date(item.endDate), 'yyyy-MM-dd') : '',
      totalOccurrences: item.totalOccurrences?.toString() || '',
      categoryId: item.categoryId || '',
      notes: item.notes || '',
      userId: item.user.id === user?.id ? '' : item.user.id,
      splitType: (item.splitType as 'equal' | 'percentage' | 'amount') || 'equal',
      splitMembers,
    });
    setModalOpen(true);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this recurring expense? Existing records will not be affected.')) return;
    
    try {
      await recurringAPI.cancel(id);
      toast.success('Recurring expense cancelled');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await recurringAPI.reactivate(id);
      toast.success('Recurring expense reactivated');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reactivate');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring expense? This cannot be undone.')) return;
    
    try {
      await recurringAPI.delete(id);
      toast.success('Recurring expense deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete');
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const response = await recurringAPI.process();
      toast.success(response.data.message);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process');
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setEditingRecurring(null);
    
    // Sort users with current user first
    const sortedUsers = [...users].sort((a, b) => {
      if (a.id === user?.id) return -1;
      if (b.id === user?.id) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    
    setFormData({
      description: '',
      amount: '',
      frequency: 'monthly',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      totalOccurrences: '',
      categoryId: '',
      notes: '',
      userId: '',
      splitType: 'equal',
      splitMembers: sortedUsers.map((u) => ({
        memberId: u.id,
        percentage: 100 / sortedUsers.length,
        amount: 0,
      })),
    });
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return freq;
    }
  };

  const getFrequencyColor = (freq: string) => {
    switch (freq) {
      case 'daily': return 'bg-red-500/20 text-red-400';
      case 'weekly': return 'bg-orange-500/20 text-orange-400';
      case 'monthly': return 'bg-blue-500/20 text-blue-400';
      case 'yearly': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Recurring Expenses</h1>
          <p className="text-white/60 mt-1">Manage automatic recurring expenses like rent and installments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleProcess}
            disabled={processing}
            className="glass-button-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-5 h-5 ${processing ? 'animate-spin' : ''}`} />
            Process Due
          </button>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="glass-button flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Recurring
          </button>
        </div>
      </div>

      {/* Recurring List */}
      <div className="grid gap-4">
        {recurring.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ArrowPathIcon className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">No recurring expenses set up yet</p>
            <p className="text-white/40 text-sm mt-1">
              Create recurring expenses for rent, utilities, or installments
            </p>
          </div>
        ) : (
          recurring.map((item) => {
            const category = categories.find(c => c.id === item.categoryId);
            const canEdit = item.user.id === user?.id || user?.isAdmin;
            return (
              <div
                key={item.id}
                className={`glass-card p-4 ${!item.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${item.isActive ? 'bg-purple-500/20' : 'bg-gray-500/20'}`}>
                      <ArrowPathIcon className={`w-6 h-6 ${item.isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{item.description}</h3>
                      <p className="text-2xl font-bold text-white mt-1">
                        {currency} {item.amount.toFixed(2)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getFrequencyColor(item.frequency)}`}>
                          {getFrequencyLabel(item.frequency)}
                        </span>
                        {item.splitConfig && (
                          <span className="px-2 py-1 rounded-lg text-xs bg-blue-500/20 text-blue-400">
                            {item.splitType === 'equal' ? 'Split Equal' : item.splitType === 'percentage' ? 'Split %' : 'Split Amount'}
                          </span>
                        )}
                        {category && (
                          <span className="px-2 py-1 rounded-lg text-xs bg-white/10 text-white/70">
                            {category.icon} {category.name}
                          </span>
                        )}
                        <span className="text-xs text-white/50">
                          by {item.user.displayName}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="w-4 h-4 text-white/50" />
                      <span className="text-white/70">
                        Next: {format(new Date(item.nextDueDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {item.totalOccurrences && (
                      <p className="text-xs text-white/50">
                        {item.occurrencesCreated} / {item.totalOccurrences} occurrences
                      </p>
                    )}
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      )}
                      {item.isActive ? (
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                          title="Pause"
                        >
                          <PauseIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(item.id)}
                          className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                          title="Resume"
                        >
                          <PlayIcon className="w-4 h-4" />
                        </button>
                      )}
                      {user?.isAdmin && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingRecurring ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="glass-input"
              placeholder="e.g., House Rent, Water Heater Installment"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Amount ({currency}) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="glass-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="glass-select"
              >
                <option value="">No Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurring Settings Section */}
          <div className="border border-purple-500/30 rounded-lg p-4 space-y-4 bg-purple-500/5">
            <div className="flex items-center gap-2 text-purple-400">
              <ArrowPathIcon className="w-5 h-5" />
              <span className="font-medium">Recurring Settings</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Frequency <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="glass-select"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Start Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  End Date <span className="text-white/40">(optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Total Occurrences <span className="text-white/40">(optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.totalOccurrences}
                  onChange={(e) => setFormData({ ...formData, totalOccurrences: e.target.value })}
                  className="glass-input"
                  placeholder="e.g., 12 for 12-month"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              On Behalf Of
            </label>
            <select
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              className="glass-select"
            >
              <option value="">Myself</option>
              {users.filter(u => u.id !== user?.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">
              Add this recurring expense for another member
            </p>
          </div>

          {/* Split Expense Section */}
          <div className="border border-white/10 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">Split Among Members</span>
              <span className="text-xs text-white/40">{formData.splitMembers.length} members</span>
            </div>

            {/* Split Type Selection */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'equal'}
                  onChange={() => setFormData({ ...formData, splitType: 'equal' })}
                  className="w-4 h-4 text-purple-500"
                />
                <span className="text-sm text-white/70">Equal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'percentage'}
                  onChange={() => setFormData({ ...formData, splitType: 'percentage' })}
                  className="w-4 h-4 text-purple-500"
                />
                <span className="text-sm text-white/70">By Percentage</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'amount'}
                  onChange={() => setFormData({ ...formData, splitType: 'amount' })}
                  className="w-4 h-4 text-purple-500"
                />
                <span className="text-sm text-white/70">By Amount</span>
              </label>
            </div>

            {/* Member Split Inputs */}
            <div className="space-y-3">
              {formData.splitMembers.map((sm, idx) => {
                const member = users.find(m => m.id === sm.memberId);
                const isOwner = idx === 0;
                const totalAmount = parseFloat(formData.amount) || 0;
                
                return (
                  <div key={sm.memberId} className={`flex items-center gap-3 p-2 rounded-lg ${isOwner ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-white/5'}`}>
                    <span className="flex-1 text-sm text-white/80">
                      {member?.displayName || 'Unknown'}
                      {isOwner && <span className="text-xs text-purple-400 ml-2">(auto-calculated)</span>}
                    </span>
                    
                    {formData.splitType === 'equal' && (
                      <span className="text-sm text-white/70">
                        {currency} {isOwner 
                          ? (totalAmount - Math.floor(totalAmount / formData.splitMembers.length * 100) / 100 * (formData.splitMembers.length - 1)).toFixed(2)
                          : (Math.floor(totalAmount / formData.splitMembers.length * 100) / 100).toFixed(2)
                        }
                      </span>
                    )}
                    
                    {formData.splitType === 'percentage' && (
                      <div className="flex items-center gap-1">
                        {isOwner ? (
                          <span className="w-28 px-2 py-1 text-sm bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-right">
                            {getOwnerPercentage().toFixed(7).replace(/\.?0+$/, '')}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.0000001"
                            value={sm.percentage || 0}
                            onChange={(e) => {
                              const newPercentage = parseFloat(e.target.value) || 0;
                              setFormData((prev) => ({
                                ...prev,
                                splitMembers: prev.splitMembers.map((s, i) =>
                                  i === idx ? { ...s, percentage: newPercentage } : s
                                )
                              }));
                            }}
                            className="w-28 px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white text-right"
                          />
                        )}
                        <span className="text-sm text-white/50">%</span>
                      </div>
                    )}
                    
                    {formData.splitType === 'amount' && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-white/50">{currency}</span>
                        {isOwner ? (
                          <span className="w-24 px-2 py-1 text-sm bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-right">
                            {getOwnerAmount().toFixed(2)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={sm.amount || 0}
                            onChange={(e) => {
                              const newAmount = parseFloat(e.target.value) || 0;
                              setFormData((prev) => ({
                                ...prev,
                                splitMembers: prev.splitMembers.map((s, i) =>
                                  i === idx ? { ...s, amount: newAmount } : s
                                )
                              }));
                            }}
                            className="w-24 px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white text-right"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Split Summary */}
            {parseFloat(formData.amount) > 0 && (
              <div className="pt-2 border-t border-white/10">
                <div className="text-xs space-y-1">
                  {(() => {
                    const amounts = calculateSplitAmounts();
                    const totalSplit = amounts.reduce((sum, a) => sum + a.amount, 0);
                    const originalTotal = parseFloat(formData.amount) || 0;
                    const isValid = Math.abs(totalSplit - originalTotal) < 0.01;
                    return (
                      <div className="flex justify-between">
                        <span className="text-white/50">Total:</span>
                        <span className={isValid ? 'text-green-400' : 'text-red-400'}>
                          {currency} {totalSplit.toFixed(2)} {isValid ? '✓' : `/ ${currency} ${originalTotal.toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="glass-input resize-none"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              className="flex-1 glass-button-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 glass-button">
              {editingRecurring ? 'Update' : 'Create'} Recurring
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
