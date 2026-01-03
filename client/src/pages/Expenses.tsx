import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { expensesAPI, categoriesAPI, usersAPI, deleteRequestsAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface ExpenseSplit {
  id: string;
  userId: string;
  amount: number;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  usage: number | null;
  date: string;
  receiptImage: string | null;
  notes: string | null;
  user: { id: string; displayName: string; avatarUrl: string | null };
  createdBy?: { id: string; displayName: string } | null;
  category: { id: string; name: string; icon: string; color: string } | null;
  splits?: ExpenseSplit[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Member {
  id: string;
  username: string;
  displayName: string;
}

export default function Expenses() {
  const { user } = useAuthStore();
  const { currency, waterUnit, electricityUnit } = useSettingsStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filter, setFilter] = useState({ 
    categoryId: '', 
    search: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    usage: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    categoryId: '',
    userId: '', // On behalf of
    notes: '',
    receipt: null as File | null,
    // Split options - always enabled by default
    splitType: 'equal' as 'equal' | 'percentage' | 'amount',
    splitMembers: [] as { memberId: string; percentage?: number; amount?: number }[],
  });

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchMembers();
  }, [filter.categoryId, filter.startDate, filter.endDate, pagination.page]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params: any = { page: pagination.page, limit: 20 };
      if (filter.categoryId) params.categoryId = filter.categoryId;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate) params.endDate = filter.endDate;
      
      const response = await expensesAPI.getAll(params);
      setExpenses(response.data.expenses);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await usersAPI.getAll();
      // Sort members with current user first (they will receive any rounding remainder)
      const sortedMembers = response.data.sort((a: Member, b: Member) => {
        if (a.id === user?.id) return -1;
        if (b.id === user?.id) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      setMembers(sortedMembers);
    } catch (error) {
      console.error('Failed to fetch members:', error);
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
      // Calculate others' amounts first, owner gets remainder
      let totalOthersAmount = 0;
      const othersAmounts = splitMembers.slice(1).map((m) => {
        const percentage = m.percentage || 0;
        const amount = Math.round((totalAmount * percentage / 100) * 100) / 100;
        totalOthersAmount += amount;
        return { memberId: m.memberId, amount };
      });
      
      // Owner gets the remainder to ensure exact total
      const ownerAmount = Math.round((totalAmount - totalOthersAmount) * 100) / 100;
      amounts = [
        { memberId: splitMembers[0].memberId, amount: ownerAmount },
        ...othersAmounts
      ];
    } else if (formData.splitType === 'amount') {
      // Calculate others' amounts, owner gets remainder
      let totalOthersAmount = 0;
      const othersAmounts = splitMembers.slice(1).map(m => {
        const amount = m.amount || 0;
        totalOthersAmount += amount;
        return { memberId: m.memberId, amount };
      });
      
      // Owner gets the remainder
      const ownerAmount = Math.round((totalAmount - totalOthersAmount) * 100) / 100;
      amounts = [
        { memberId: splitMembers[0].memberId, amount: Math.max(0, ownerAmount) },
        ...othersAmounts
      ];
    }
    
    return amounts;
  };

  // Calculate owner's percentage (100 minus others)
  const getOwnerPercentage = () => {
    const othersTotal = formData.splitMembers.slice(1).reduce((sum, m) => sum + (m.percentage || 0), 0);
    return Math.max(0, 100 - othersTotal);
  };

  // Calculate owner's amount (total minus others)
  const getOwnerAmount = () => {
    const totalAmount = parseFloat(formData.amount) || 0;
    const othersTotal = formData.splitMembers.slice(1).reduce((sum, m) => sum + (m.amount || 0), 0);
    return Math.max(0, Math.round((totalAmount - othersTotal) * 100) / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    // Validate split - check that others' percentages don't exceed 100%
    if (formData.splitMembers.length > 0) {
      if (formData.splitType === 'percentage') {
        const othersPercent = formData.splitMembers.slice(1).reduce((sum, m) => sum + (m.percentage || 0), 0);
        if (othersPercent > 100) {
          toast.error('Others\' percentages cannot exceed 100%');
          return;
        }
      } else if (formData.splitType === 'amount') {
        const othersAmount = formData.splitMembers.slice(1).reduce((sum, m) => sum + (m.amount || 0), 0);
        const totalAmount = parseFloat(formData.amount) || 0;
        if (othersAmount > totalAmount) {
          toast.error('Others\' amounts cannot exceed total');
          return;
        }
      }
    }

    try {
      const data = new FormData();
      data.append('description', formData.description);
      data.append('amount', formData.amount);
      data.append('date', formData.date);
      if (formData.categoryId) data.append('categoryId', formData.categoryId);
      if (formData.userId) data.append('userId', formData.userId);
      if (formData.notes) data.append('notes', formData.notes);
      if (formData.usage) data.append('usage', formData.usage);
      if (formData.receipt) data.append('receipt', formData.receipt);

      // Always add splits data (split is always enabled)
      if (formData.splitMembers.length > 0) {
        const splitAmounts = calculateSplitAmounts();
        data.append('splits', JSON.stringify(splitAmounts));
      }

      if (editingExpense) {
        await expensesAPI.update(editingExpense.id, data);
        toast.success('Expense updated successfully');
      } else {
        await expensesAPI.create(data);
        toast.success('Expense added successfully');
      }

      setShowModal(false);
      resetForm();
      fetchExpenses();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save expense');
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (user?.isAdmin) {
      // Admin can delete directly
      if (!confirm('Are you sure you want to delete this expense?')) return;
      try {
        await expensesAPI.delete(expense.id);
        toast.success('Expense deleted successfully');
        fetchExpenses();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete expense');
      }
    } else {
      // Non-admin: show delete request modal
      setDeletingExpense(expense);
      setDeleteReason('');
      setShowDeleteModal(true);
    }
  };

  const handleRequestDelete = async () => {
    if (!deletingExpense) return;

    try {
      await deleteRequestsAPI.create({
        recordType: 'expense',
        recordId: deletingExpense.id,
        reason: deleteReason || undefined,
      });
      toast.success('Delete request submitted for admin approval');
      setShowDeleteModal(false);
      setDeletingExpense(null);
      setDeleteReason('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit delete request');
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    // Load existing splits or initialize with members
    const existingSplits = expense.splits && expense.splits.length > 0
      ? expense.splits.map(s => ({
          memberId: s.userId,
          percentage: Math.round((s.amount / expense.amount) * 100),
          amount: s.amount
        }))
      : members.map((m) => ({
          memberId: m.id,
          percentage: Math.floor(100 / members.length),
          amount: Math.floor(expense.amount / members.length * 100) / 100
        }));
    
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      usage: expense.usage?.toString() || '',
      date: format(new Date(expense.date), 'yyyy-MM-dd'),
      categoryId: expense.category?.id || '',
      userId: expense.user.id,
      notes: expense.notes || '',
      receipt: null,
      splitType: 'equal',
      splitMembers: existingSplits,
    });
    setShowModal(true);
  };

  const handleViewReceipt = (receiptUrl: string) => {
    setSelectedReceipt(receiptUrl);
    setShowReceiptModal(true);
  };

  const resetForm = () => {
    // Initialize split members with all members, equal split by default
    const initialSplitMembers = members.map(m => ({
      memberId: m.id,
      percentage: Math.floor(100 / Math.max(members.length, 1)),
      amount: 0
    }));
    
    setFormData({
      description: '',
      amount: '',
      usage: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      categoryId: '',
      userId: '',
      notes: '',
      receipt: null,
      splitType: 'equal',
      splitMembers: initialSplitMembers,
    });
    setEditingExpense(null);
  };

  const filteredExpenses = expenses.filter((expense) =>
    expense.description.toLowerCase().includes(filter.search.toLowerCase())
  );

  const canEdit = (expense: Expense) =>
    expense.user.id === user?.id || user?.isAdmin;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Expenses</h1>
          <p className="text-white/60 mt-1">Track all house expenses</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="glass-button flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              className="glass-input pl-10"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FunnelIcon className="w-5 h-5 text-white/40 shrink-0" />
            <select
              value={filter.categoryId}
              onChange={(e) => {
                setFilter((prev) => ({ ...prev, categoryId: e.target.value }));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="glass-select !w-auto"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CalendarIcon className="w-5 h-5 text-white/40 shrink-0" />
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => {
                setFilter((prev) => ({ ...prev, startDate: e.target.value }));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="glass-input !w-auto text-sm"
              placeholder="From"
            />
            <span className="text-white/40">to</span>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => {
                setFilter((prev) => ({ ...prev, endDate: e.target.value }));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="glass-input !w-auto text-sm"
              placeholder="To"
            />
            {(filter.startDate || filter.endDate) && (
              <button
                onClick={() => {
                  setFilter((prev) => ({ ...prev, startDate: '', endDate: '' }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expenses List */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="table-header text-left" style={{ width: '10%' }}>Date</th>
                  <th className="table-header text-left" style={{ width: '20%' }}>Description</th>
                  <th className="table-header text-left" style={{ width: '12%' }}>Category</th>
                  <th className="table-header text-left" style={{ width: '10%' }}>Amount</th>
                  <th className="table-header text-left" style={{ width: '12%' }}>Paid By</th>
                  <th className="table-header text-left" style={{ width: '18%' }}>Split</th>
                  <th className="table-header text-center" style={{ width: '8%' }}>Receipt</th>
                  <th className="table-header text-center" style={{ width: '10%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="table-row">
                      <td className="table-cell">
                        {format(new Date(expense.date), 'MMM d, yyyy')}
                      </td>
                      <td className="table-cell font-medium truncate" title={expense.description}>{expense.description}</td>
                      <td className="table-cell">
                        {expense.category ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                            style={{
                              backgroundColor: `${expense.category.color}20`,
                              color: expense.category.color,
                            }}
                          >
                            {expense.category.icon} {expense.category.name}
                          </span>
                        ) : (
                          <span className="text-white/40">-</span>
                        )}
                      </td>
                      <td className="table-cell font-semibold text-green-400">
                        {currency} {expense.amount.toFixed(2)}
                        {expense.usage != null && expense.usage > 0 && expense.category && (
                          <p className="text-xs text-white/50 font-normal">
                            {expense.usage} {expense.category.name.toLowerCase() === 'water' ? waterUnit : electricityUnit}
                          </p>
                        )}
                      </td>
                      <td className="table-cell">
                        <div>
                          <span>{expense.user.displayName}</span>
                          {expense.createdBy && expense.createdBy.id !== expense.user.id && (
                            <p className="text-xs text-white/40">
                              added by {expense.createdBy.displayName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        {expense.splits && expense.splits.length > 0 ? (
                          <div className="text-xs space-y-0.5">
                            {expense.splits.map((split) => {
                              const member = members.find(m => m.id === split.userId);
                              return (
                                <div key={split.id} className="text-white/70">
                                  {member?.displayName || 'Unknown'}: <span className="text-yellow-400">{currency} {split.amount.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-white/40 text-xs">Not split</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {expense.receiptImage ? (
                          <button
                            onClick={() => handleViewReceipt(expense.receiptImage!)}
                            className="text-purple-400 hover:text-purple-300 text-sm"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-white/40">-</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {canEdit(expense) && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(expense)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense)}
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
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-white/40">
                      No expenses found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-sm text-white/60">
                Showing {filteredExpenses.length} of {pagination.total} expenses
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="glass-input"
              placeholder="What was this expense for?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Amount ({currency}) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                className="glass-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                className="glass-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Category
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, categoryId: e.target.value }))
              }
              className="glass-select"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Usage input for Water/Electricity */}
          {formData.categoryId && (() => {
            const selectedCategory = categories.find(c => c.id === formData.categoryId);
            const isUtility = selectedCategory && 
              ['water', 'electricity'].includes(selectedCategory.name.toLowerCase());
            if (!isUtility) return null;
            
            const unit = selectedCategory.name.toLowerCase() === 'water' ? waterUnit : electricityUnit;
            return (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Usage ({unit}) <span className="text-white/40">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.usage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, usage: e.target.value }))
                  }
                  className="glass-input"
                  placeholder={`Enter usage in ${unit}`}
                />
                <p className="text-xs text-white/40 mt-1">
                  Track your {selectedCategory.name.toLowerCase()} consumption
                </p>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              On Behalf Of
            </label>
            <select
              value={formData.userId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, userId: e.target.value }))
              }
              className="glass-select"
            >
              <option value="">Myself</option>
              {members.filter(m => m.id !== user?.id).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">
              Add this expense for another member
            </p>
          </div>

          {/* Split Expense Section - Always enabled */}
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
                  onChange={() => setFormData((prev) => ({ ...prev, splitType: 'equal' }))}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm text-white/70">Equal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'percentage'}
                  onChange={() => setFormData((prev) => ({ ...prev, splitType: 'percentage' }))}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm text-white/70">By Percentage</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'amount'}
                  onChange={() => setFormData((prev) => ({ ...prev, splitType: 'amount' }))}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm text-white/70">By Amount</span>
              </label>
            </div>

            {/* Member Split Inputs */}
            <div className="space-y-3">
              {formData.splitMembers.map((sm, idx) => {
                const member = members.find(m => m.id === sm.memberId);
                const isOwner = idx === 0;
                const totalAmount = parseFloat(formData.amount) || 0;
                
                return (
                  <div key={sm.memberId} className={`flex items-center gap-3 p-2 rounded-lg ${isOwner ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5'}`}>
                    <span className="flex-1 text-sm text-white/80">
                      {member?.displayName || 'Unknown'}
                      {isOwner && <span className="text-xs text-blue-400 ml-2">(auto-calculated)</span>}
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
                          <span className="w-28 px-2 py-1 text-sm bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-right">
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
                          <span className="w-24 px-2 py-1 text-sm bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-right">
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="glass-input min-h-[80px]"
              placeholder="Any additional notes..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Receipt (Optional)
            </label>
            <label className="glass-input flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10">
              <PhotoIcon className="w-5 h-5 text-white/40" />
              <span className="text-white/60">
                {formData.receipt ? formData.receipt.name : 'Click to upload receipt'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    receipt: e.target.files?.[0] || null,
                  }))
                }
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="glass-button-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" className="glass-button flex-1">
              {editingExpense ? 'Update' : 'Add'} Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Receipt"
        size="lg"
      >
        {selectedReceipt && (
          <div className="flex justify-center">
            <img
              src={selectedReceipt}
              alt="Receipt"
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
          setDeletingExpense(null);
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

          {deletingExpense && (
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-white/60 text-sm">Expense to delete:</p>
              <p className="text-white font-medium">{deletingExpense.description}</p>
              <p className="text-green-400 font-bold">RM {deletingExpense.amount.toFixed(2)}</p>
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
              placeholder="Why do you want to delete this expense?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingExpense(null);
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
