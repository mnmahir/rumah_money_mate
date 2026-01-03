import { useState, useEffect, useRef } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  CheckCircleIcon,
  UsersIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { splitBillsAPI, usersAPI, categoriesAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CalculatedItem {
  userId: string;
  subtotal: number;
  tax: number;
  service: number;
  total: number;
  user?: User;
}

export default function SplitBill() {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQuickSplitModal, setShowQuickSplitModal] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [calculatedResult, setCalculatedResult] = useState<{
    subtotal: number;
    taxAmount: number;
    serviceCharge: number;
    total: number;
    userBreakdown: CalculatedItem[];
  } | null>(null);

  // Tax/service input mode: 'amount' or 'percent'
  const [taxMode, setTaxMode] = useState<'amount' | 'percent'>('amount');
  const [serviceMode, setServiceMode] = useState<'amount' | 'percent'>('amount');

  const [formData, setFormData] = useState({
    title: '',
    categoryId: '',
    paidByUserId: '',  // Will be set to current user on mount
    taxAmount: '',
    taxPercent: '',
    serviceCharge: '',
    servicePercent: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    items: [] as { description: string; amount: string; quantity: string; userId: string }[],
  });

  // Quick split form
  const [quickSplitData, setQuickSplitData] = useState({
    description: '',
    totalAmount: '',
    categoryId: '',
    paidByUserId: '',  // Will be set to current user on mount
    taxAmount: '',
    taxPercent: '',
    serviceCharge: '',
    servicePercent: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    userIds: [] as string[],
  });
  const [quickTaxMode, setQuickTaxMode] = useState<'amount' | 'percent'>('amount');
  const [quickServiceMode, setQuickServiceMode] = useState<'amount' | 'percent'>('amount');

  // Receipt files
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [quickReceiptFile, setQuickReceiptFile] = useState<File | null>(null);
  const [quickReceiptPreview, setQuickReceiptPreview] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const quickReceiptInputRef = useRef<HTMLInputElement>(null);

  // Get current user
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  // Set default paidByUserId to current user when users are loaded
  useEffect(() => {
    if (currentUser && users.length > 0) {
      if (!formData.paidByUserId) {
        setFormData(prev => ({ ...prev, paidByUserId: currentUser.id }));
      }
      if (!quickSplitData.paidByUserId) {
        setQuickSplitData(prev => ({ ...prev, paidByUserId: currentUser.id }));
      }
    }
  }, [currentUser, users]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, catsRes] = await Promise.all([
        usersAPI.getAll(),
        categoriesAPI.getAll(),
      ]);
      setUsers(usersRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', amount: '', quantity: '1', userId: '' }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleCalculate = async () => {
    if (formData.items.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    const validItems = formData.items.filter(
      (item) => item.description && item.amount && item.userId
    );

    if (validItems.length === 0) {
      toast.error('Fill in all item details');
      return;
    }

    try {
      const payload: any = {
        items: validItems.map((item) => ({
          description: item.description,
          amount: parseFloat(item.amount),
          quantity: parseInt(item.quantity) || 1,
          userId: item.userId,
        })),
      };

      // Add tax based on mode
      if (taxMode === 'percent' && formData.taxPercent) {
        payload.taxPercent = parseFloat(formData.taxPercent);
      } else if (formData.taxAmount) {
        payload.taxAmount = parseFloat(formData.taxAmount);
      }

      // Add service based on mode
      if (serviceMode === 'percent' && formData.servicePercent) {
        payload.servicePercent = parseFloat(formData.servicePercent);
      } else if (formData.serviceCharge) {
        payload.serviceCharge = parseFloat(formData.serviceCharge);
      }

      const response = await splitBillsAPI.calculate(payload);
      setCalculatedResult(response.data);
      setShowCalculation(true);
    } catch (error) {
      toast.error('Failed to calculate');
    }
  };

  const handleCreateExpenses = async () => {
    if (!formData.title || !calculatedResult) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const validItems = formData.items.filter(
        (item) => item.description && item.amount && item.userId
      );

      // Generate itemized notes from items
      const itemizedNotes = validItems.map((item) => {
        const user = users.find(u => u.id === item.userId);
        const qty = parseInt(item.quantity) || 1;
        const total = parseFloat(item.amount) * qty;
        return `• ${item.description} x${qty} @ ${parseFloat(item.amount).toFixed(2)} = ${total.toFixed(2)} (${user?.displayName || 'Unknown'})`;
      }).join('\n');

      const finalNotes = formData.notes 
        ? `${formData.notes}\n\n--- Items ---\n${itemizedNotes}`
        : `--- Items ---\n${itemizedNotes}`;

      // Build FormData for file upload support
      const formDataPayload = new FormData();
      formDataPayload.append('title', formData.title);
      formDataPayload.append('date', formData.date);
      formDataPayload.append('items', JSON.stringify(validItems.map((item) => ({
        description: item.description,
        amount: parseFloat(item.amount),
        quantity: parseInt(item.quantity) || 1,
        userId: item.userId,
      }))));
      formDataPayload.append('notes', finalNotes);

      if (formData.categoryId) formDataPayload.append('categoryId', formData.categoryId);
      if (formData.paidByUserId) formDataPayload.append('paidByUserId', formData.paidByUserId);

      // Add tax based on mode
      if (taxMode === 'percent' && formData.taxPercent) {
        formDataPayload.append('taxPercent', formData.taxPercent);
      } else if (formData.taxAmount) {
        formDataPayload.append('taxAmount', formData.taxAmount);
      }

      // Add service based on mode
      if (serviceMode === 'percent' && formData.servicePercent) {
        formDataPayload.append('servicePercent', formData.servicePercent);
      } else if (formData.serviceCharge) {
        formDataPayload.append('serviceCharge', formData.serviceCharge);
      }

      // Add receipt if present
      if (receiptFile) {
        formDataPayload.append('receipt', receiptFile);
      }

      await splitBillsAPI.createExpenses(formDataPayload);
      toast.success('Expenses created successfully!');
      setShowModal(false);
      setShowCalculation(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create expenses');
    }
  };

  const handleQuickSplit = async () => {
    if (!quickSplitData.description || !quickSplitData.totalAmount || quickSplitData.userIds.length === 0) {
      toast.error('Please fill in all required fields and select at least one member');
      return;
    }

    try {
      // Build FormData for file upload support
      const formDataPayload = new FormData();
      formDataPayload.append('description', quickSplitData.description);
      formDataPayload.append('totalAmount', quickSplitData.totalAmount);
      formDataPayload.append('date', quickSplitData.date);
      formDataPayload.append('userIds', JSON.stringify(quickSplitData.userIds));

      if (quickSplitData.categoryId) formDataPayload.append('categoryId', quickSplitData.categoryId);
      if (quickSplitData.paidByUserId) formDataPayload.append('paidByUserId', quickSplitData.paidByUserId);
      if (quickSplitData.notes) formDataPayload.append('notes', quickSplitData.notes);

      // Add tax based on mode
      if (quickTaxMode === 'percent' && quickSplitData.taxPercent) {
        formDataPayload.append('taxPercent', quickSplitData.taxPercent);
      } else if (quickSplitData.taxAmount) {
        formDataPayload.append('taxAmount', quickSplitData.taxAmount);
      }

      // Add service based on mode
      if (quickServiceMode === 'percent' && quickSplitData.servicePercent) {
        formDataPayload.append('servicePercent', quickSplitData.servicePercent);
      } else if (quickSplitData.serviceCharge) {
        formDataPayload.append('serviceCharge', quickSplitData.serviceCharge);
      }

      // Add receipt if present
      if (quickReceiptFile) {
        formDataPayload.append('receipt', quickReceiptFile);
      }

      await splitBillsAPI.quickSplit(formDataPayload);
      toast.success('Bill split equally! Expenses created for each member.');
      setShowQuickSplitModal(false);
      resetQuickSplitForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to split bill');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setQuickSplitData((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter((id) => id !== userId)
        : [...prev.userIds, userId],
    }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      categoryId: '',
      paidByUserId: currentUser?.id || '',
      taxAmount: '',
      taxPercent: '',
      serviceCharge: '',
      servicePercent: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      items: [],
    });
    setCalculatedResult(null);
    setTaxMode('amount');
    setServiceMode('amount');
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const resetQuickSplitForm = () => {
    setQuickSplitData({
      description: '',
      totalAmount: '',
      categoryId: '',
      paidByUserId: currentUser?.id || '',
      taxAmount: '',
      taxPercent: '',
      serviceCharge: '',
      servicePercent: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      userIds: [],
    });
    setQuickTaxMode('amount');
    setQuickServiceMode('amount');
    setQuickReceiptFile(null);
    setQuickReceiptPreview(null);
  };

  // Handle receipt file selection
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>, isQuickSplit: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isQuickSplit) {
        setQuickReceiptFile(file);
        setQuickReceiptPreview(URL.createObjectURL(file));
      } else {
        setReceiptFile(file);
        setReceiptPreview(URL.createObjectURL(file));
      }
    }
  };

  const removeReceipt = (isQuickSplit: boolean = false) => {
    if (isQuickSplit) {
      setQuickReceiptFile(null);
      setQuickReceiptPreview(null);
      if (quickReceiptInputRef.current) quickReceiptInputRef.current.value = '';
    } else {
      setReceiptFile(null);
      setReceiptPreview(null);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Split Bill</h1>
          <p className="text-white/60 mt-1">Calculate and split bills among members</p>
        </div>
      </div>

      {/* Clickable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => {
            resetQuickSplitForm();
            setShowQuickSplitModal(true);
          }}
          className="glass-card-hover p-6 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <UsersIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">Quick Split</h3>
              <p className="text-sm text-white/60">
                Split a total amount equally among selected members. Great for shared meals, utilities, or any expense that's divided evenly.
              </p>
            </div>
          </div>
        </button>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="glass-card-hover p-6 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <CalculatorIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">Itemized Split</h3>
              <p className="text-sm text-white/60">
                Add individual items and assign them to members. Tax and service charges are proportionally split. Perfect for restaurant bills.
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Quick Split Modal */}
      <Modal
        isOpen={showQuickSplitModal}
        onClose={() => {
          setShowQuickSplitModal(false);
          resetQuickSplitForm();
        }}
        title="Quick Split"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={quickSplitData.description}
              onChange={(e) => setQuickSplitData((prev) => ({ ...prev, description: e.target.value }))}
              className="glass-input"
              placeholder="e.g., Monthly Electricity Bill"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Total Amount (RM) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={quickSplitData.totalAmount}
                onChange={(e) => setQuickSplitData((prev) => ({ ...prev, totalAmount: e.target.value }))}
                className="glass-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Date</label>
              <input
                type="date"
                value={quickSplitData.date}
                onChange={(e) => setQuickSplitData((prev) => ({ ...prev, date: e.target.value }))}
                className="glass-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Category</label>
            <select
              value={quickSplitData.categoryId}
              onChange={(e) => setQuickSplitData((prev) => ({ ...prev, categoryId: e.target.value }))}
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

          {/* Paid By */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Paid By</label>
            <select
              value={quickSplitData.paidByUserId}
              onChange={(e) => setQuickSplitData((prev) => ({ ...prev, paidByUserId: e.target.value }))}
              className="glass-select"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} {u.id === currentUser?.id ? '(Me)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">Who paid for this bill?</p>
          </div>

          {/* Tax with percentage toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">Tax</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setQuickTaxMode('amount')}
                  className={`px-2 py-1 text-xs rounded-lg ${
                    quickTaxMode === 'amount' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                  }`}
                >
                  RM
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTaxMode('percent')}
                  className={`px-2 py-1 text-xs rounded-lg ${
                    quickTaxMode === 'percent' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              value={quickTaxMode === 'amount' ? quickSplitData.taxAmount : quickSplitData.taxPercent}
              onChange={(e) => setQuickSplitData((prev) => ({
                ...prev,
                [quickTaxMode === 'amount' ? 'taxAmount' : 'taxPercent']: e.target.value,
              }))}
              className="glass-input"
              placeholder={quickTaxMode === 'amount' ? '0.00' : '0'}
            />
          </div>

          {/* Service with percentage toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">Service Charge</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setQuickServiceMode('amount')}
                  className={`px-2 py-1 text-xs rounded-lg ${
                    quickServiceMode === 'amount' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                  }`}
                >
                  RM
                </button>
                <button
                  type="button"
                  onClick={() => setQuickServiceMode('percent')}
                  className={`px-2 py-1 text-xs rounded-lg ${
                    quickServiceMode === 'percent' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              value={quickServiceMode === 'amount' ? quickSplitData.serviceCharge : quickSplitData.servicePercent}
              onChange={(e) => setQuickSplitData((prev) => ({
                ...prev,
                [quickServiceMode === 'amount' ? 'serviceCharge' : 'servicePercent']: e.target.value,
              }))}
              className="glass-input"
              placeholder={quickServiceMode === 'amount' ? '0.00' : '0'}
            />
          </div>

          {/* Member selection */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Split Among <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUserSelection(u.id)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    quickSplitData.userIds.includes(u.id)
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-sm">
                      {u.displayName[0]}
                    </div>
                    <span className="text-white text-sm">{u.displayName}</span>
                  </div>
                </button>
              ))}
            </div>
            {quickSplitData.userIds.length > 0 && quickSplitData.totalAmount && (
              <p className="text-sm text-white/50 mt-2">
                Each person pays: RM {(parseFloat(quickSplitData.totalAmount) / quickSplitData.userIds.length).toFixed(2)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Notes</label>
            <textarea
              value={quickSplitData.notes}
              onChange={(e) => setQuickSplitData((prev) => ({ ...prev, notes: e.target.value }))}
              className="glass-input"
              rows={2}
              placeholder="Add any additional notes..."
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Receipt Image</label>
            <input
              type="file"
              ref={quickReceiptInputRef}
              accept="image/*"
              onChange={(e) => handleReceiptChange(e, true)}
              className="hidden"
            />
            {quickReceiptPreview ? (
              <div className="relative">
                <img
                  src={quickReceiptPreview}
                  alt="Receipt preview"
                  className="w-full h-40 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => removeReceipt(true)}
                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600"
                >
                  <XMarkIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => quickReceiptInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl hover:border-white/40 transition-colors"
              >
                <PhotoIcon className="w-8 h-8 mx-auto text-white/40" />
                <p className="text-sm text-white/40 mt-2">Click to upload receipt</p>
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowQuickSplitModal(false);
                resetQuickSplitForm();
              }}
              className="glass-button-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleQuickSplit}
              className="glass-button flex-1"
            >
              Split & Create Expenses
            </button>
          </div>
        </div>
      </Modal>

      {/* Itemized Split Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title="Itemized Split Bill"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="glass-input"
              placeholder="e.g., Dinner at Restaurant XYZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="glass-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
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

          {/* Paid By */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Paid By</label>
            <select
              value={formData.paidByUserId}
              onChange={(e) => setFormData((prev) => ({ ...prev, paidByUserId: e.target.value }))}
              className="glass-select"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} {u.id === currentUser?.id ? '(Me)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40 mt-1">Who paid for this bill?</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tax with percentage toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white/70">Tax</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTaxMode('amount')}
                    className={`px-2 py-1 text-xs rounded-lg ${
                      taxMode === 'amount' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                    }`}
                  >
                    RM
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('percent')}
                    className={`px-2 py-1 text-xs rounded-lg ${
                      taxMode === 'percent' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                value={taxMode === 'amount' ? formData.taxAmount : formData.taxPercent}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  [taxMode === 'amount' ? 'taxAmount' : 'taxPercent']: e.target.value,
                }))}
                className="glass-input"
                placeholder={taxMode === 'amount' ? '0.00' : '0'}
              />
            </div>

            {/* Service with percentage toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white/70">Service Charge</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setServiceMode('amount')}
                    className={`px-2 py-1 text-xs rounded-lg ${
                      serviceMode === 'amount' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                    }`}
                  >
                    RM
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceMode('percent')}
                    className={`px-2 py-1 text-xs rounded-lg ${
                      serviceMode === 'percent' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/60'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                value={serviceMode === 'amount' ? formData.serviceCharge : formData.servicePercent}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  [serviceMode === 'amount' ? 'serviceCharge' : 'servicePercent']: e.target.value,
                }))}
                className="glass-input"
                placeholder={serviceMode === 'amount' ? '0.00' : '0'}
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {formData.items.map((item, index) => (
                <div key={index} className="glass-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Item {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    className="glass-input text-sm"
                    placeholder="Item description"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                      className="glass-input text-sm"
                      placeholder="Price"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="glass-input text-sm"
                      placeholder="Qty"
                      min="1"
                    />
                    <select
                      value={item.userId}
                      onChange={(e) => handleItemChange(index, 'userId', e.target.value)}
                      className="glass-select text-sm"
                    >
                      <option value="">Who?</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-white/40">
                  Click "Add Item" to start adding items to split
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="glass-input"
              rows={2}
              placeholder="Add any additional notes (item details will be auto-generated)"
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Receipt Image</label>
            <input
              type="file"
              ref={receiptInputRef}
              accept="image/*"
              onChange={(e) => handleReceiptChange(e, false)}
              className="hidden"
            />
            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full h-40 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => removeReceipt(false)}
                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600"
                >
                  <XMarkIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl hover:border-white/40 transition-colors"
              >
                <PhotoIcon className="w-8 h-8 mx-auto text-white/40" />
                <p className="text-sm text-white/40 mt-2">Click to upload receipt</p>
              </button>
            )}
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
            <button
              type="button"
              onClick={handleCalculate}
              className="glass-button flex-1 flex items-center justify-center gap-2"
            >
              <CalculatorIcon className="w-5 h-5" />
              Calculate
            </button>
          </div>
        </div>
      </Modal>

      {/* Calculation Result Modal */}
      <Modal
        isOpen={showCalculation}
        onClose={() => setShowCalculation(false)}
        title="Split Bill Result"
      >
        {calculatedResult && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Subtotal</span>
                <span className="text-white">RM {calculatedResult.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Tax</span>
                <span className="text-white">RM {calculatedResult.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Service Charge</span>
                <span className="text-white">RM {calculatedResult.serviceCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-white/10">
                <span className="text-white">Total</span>
                <span className="text-green-400">RM {calculatedResult.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white/70">Per Person</h4>
              {calculatedResult.userBreakdown.map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                      {item.user?.displayName[0]}
                    </div>
                    <div>
                      <p className="text-white">{item.user?.displayName}</p>
                      <p className="text-xs text-white/50">
                        Subtotal: RM {item.subtotal.toFixed(2)} + Tax: RM{' '}
                        {item.tax.toFixed(2)} + Svc: RM {item.service.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-green-400">
                    RM {item.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-400">
                <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                This will create a single expense with splits for each person.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowCalculation(false)}
                className="glass-button-secondary flex-1"
              >
                Back
              </button>
              <button onClick={handleCreateExpenses} className="glass-button flex-1">
                Create Expenses
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
