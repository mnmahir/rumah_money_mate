import { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  CheckCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { splitBillsAPI, usersAPI, categoriesAPI } from '../lib/api';
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
    taxAmount: '',
    taxPercent: '',
    serviceCharge: '',
    servicePercent: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    userIds: [] as string[],
  });
  const [quickTaxMode, setQuickTaxMode] = useState<'amount' | 'percent'>('amount');
  const [quickServiceMode, setQuickServiceMode] = useState<'amount' | 'percent'>('amount');

  useEffect(() => {
    fetchData();
  }, []);

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

      const payload: any = {
        title: formData.title,
        date: formData.date,
        items: validItems.map((item) => ({
          description: item.description,
          amount: parseFloat(item.amount),
          quantity: parseInt(item.quantity) || 1,
          userId: item.userId,
        })),
      };

      if (formData.categoryId) payload.categoryId = formData.categoryId;
      if (formData.notes) payload.notes = formData.notes;

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

      await splitBillsAPI.createExpenses(payload);
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
      const payload: any = {
        description: quickSplitData.description,
        totalAmount: parseFloat(quickSplitData.totalAmount),
        date: quickSplitData.date,
        userIds: quickSplitData.userIds,
      };

      if (quickSplitData.categoryId) payload.categoryId = quickSplitData.categoryId;

      // Add tax based on mode
      if (quickTaxMode === 'percent' && quickSplitData.taxPercent) {
        payload.taxPercent = parseFloat(quickSplitData.taxPercent);
      } else if (quickSplitData.taxAmount) {
        payload.taxAmount = parseFloat(quickSplitData.taxAmount);
      }

      // Add service based on mode
      if (quickServiceMode === 'percent' && quickSplitData.servicePercent) {
        payload.servicePercent = parseFloat(quickSplitData.servicePercent);
      } else if (quickSplitData.serviceCharge) {
        payload.serviceCharge = parseFloat(quickSplitData.serviceCharge);
      }

      await splitBillsAPI.quickSplit(payload);
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
  };

  const resetQuickSplitForm = () => {
    setQuickSplitData({
      description: '',
      totalAmount: '',
      categoryId: '',
      taxAmount: '',
      taxPercent: '',
      serviceCharge: '',
      servicePercent: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      userIds: [],
    });
    setQuickTaxMode('amount');
    setQuickServiceMode('amount');
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
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetQuickSplitForm();
              setShowQuickSplitModal(true);
            }}
            className="glass-button-secondary flex items-center gap-2"
          >
            <UsersIcon className="w-5 h-5" />
            Quick Split
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="glass-button flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Itemized Split
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Quick Split</h3>
              <p className="text-sm text-white/60">
                Split a total amount equally among selected members. Great for shared meals, utilities, or any expense that's divided evenly.
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <CalculatorIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Itemized Split</h3>
              <p className="text-sm text-white/60">
                Add individual items and assign them to members. Tax and service charges are proportionally split. Perfect for restaurant bills.
              </p>
            </div>
          </div>
        </div>
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
                className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
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
                This will create individual expense records for each person automatically.
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
