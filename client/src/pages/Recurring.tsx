import { useState, useEffect } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  CalendarIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { recurringAPI, categoriesAPI, usersAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
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
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

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
    splitEqually: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await recurringAPI.create({
        ...formData,
        amount: parseFloat(formData.amount),
        userId: formData.userId || user?.id,
      });
      toast.success('Recurring expense created');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create recurring expense');
    }
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
      splitEqually: true,
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
            onClick={() => setModalOpen(true)}
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
                        RM {item.amount.toFixed(2)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getFrequencyColor(item.frequency)}`}>
                          {getFrequencyLabel(item.frequency)}
                        </span>
                        {item.splitEqually && (
                          <span className="px-2 py-1 rounded-lg text-xs bg-green-500/20 text-green-400">
                            Split
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

      {/* Add Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Add Recurring Expense"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description *
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
                Amount (RM) *
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
                Frequency *
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="glass-input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="glass-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="glass-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Total Occurrences (for installments)
            </label>
            <input
              type="number"
              min="1"
              value={formData.totalOccurrences}
              onChange={(e) => setFormData({ ...formData, totalOccurrences: e.target.value })}
              className="glass-input"
              placeholder="e.g., 12 for 12-month installment"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="glass-input"
              >
                <option value="">No Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Assigned To
              </label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="glass-input"
              >
                <option value="">Myself</option>
                {users.filter(u => u.id !== user?.id).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split Equally Toggle */}
          <div className="p-4 bg-white/5 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.splitEqually}
                onChange={(e) => setFormData({ ...formData, splitEqually: e.target.checked })}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
              />
              <div>
                <span className="text-white font-medium">Split equally among all members</span>
                <p className="text-xs text-white/50 mt-0.5">
                  When processed, expense will be split among all active house members
                </p>
              </div>
            </label>
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
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
