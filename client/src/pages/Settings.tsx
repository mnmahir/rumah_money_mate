import { useState, useEffect } from 'react';
import { Cog6ToothIcon, CurrencyDollarIcon, BeakerIcon, BoltIcon, TrashIcon, PencilIcon, CheckCircleIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { settingsAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';

interface Settings {
  currency: string;
  waterUnit: string;
  electricityUnit: string;
  allowUserSelfDelete: string;
  allowUserSelfEdit: string;
  autoAcceptPayments: string;
  requirePaymentReceipt: string;
}

export default function Settings() {
  const { user } = useAuthStore();
  const refreshGlobalSettings = useSettingsStore((state) => state.fetchSettings);
  const [settings, setSettings] = useState<Settings>({
    currency: 'RM',
    waterUnit: 'm³',
    electricityUnit: 'kWh',
    allowUserSelfDelete: 'false',
    allowUserSelfEdit: 'false',
    autoAcceptPayments: 'true',
    requirePaymentReceipt: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      // Merge with defaults to ensure all settings are present
      setSettings(prev => ({
        ...prev,
        ...response.data,
      }));
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsAPI.update(settings as unknown as Record<string, string>);
      // Refresh global settings store so changes apply immediately across the app
      await refreshGlobalSettings();
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Only admins can access this page
  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
          <Cog6ToothIcon className="w-8 h-8 text-purple-400" />
          Settings
        </h1>
        <p className="text-white/60 mt-1">Configure application settings (Admin only)</p>
      </div>

      {/* Settings Form */}
      <div className="glass-card p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-white mb-6">General Settings</h2>

        <div className="space-y-6">
          {/* Currency */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <CurrencyDollarIcon className="w-4 h-4" />
              Currency Symbol
            </label>
            <input
              type="text"
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="glass-input"
              placeholder="e.g., RM, $, €"
            />
            <p className="text-xs text-white/40 mt-1">
              This will be displayed before all amounts throughout the app
            </p>
          </div>

          {/* Water Unit */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <BeakerIcon className="w-4 h-4 text-cyan-400" />
              Water Usage Unit
            </label>
            <input
              type="text"
              value={settings.waterUnit}
              onChange={(e) => setSettings({ ...settings, waterUnit: e.target.value })}
              className="glass-input"
              placeholder="e.g., m³, gallons, liters"
            />
            <p className="text-xs text-white/40 mt-1">
              Unit for measuring water consumption (default: m³)
            </p>
          </div>

          {/* Electricity Unit */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <BoltIcon className="w-4 h-4 text-yellow-400" />
              Electricity Usage Unit
            </label>
            <input
              type="text"
              value={settings.electricityUnit}
              onChange={(e) => setSettings({ ...settings, electricityUnit: e.target.value })}
              className="glass-input"
              placeholder="e.g., kWh, MWh"
            />
            <p className="text-xs text-white/40 mt-1">
              Unit for measuring electricity consumption (default: kWh)
            </p>
          </div>
        </div>

        {/* Permissions Section */}
        <h2 className="text-lg font-semibold text-white mt-8 mb-6 pt-6 border-t border-white/10">Permission Settings</h2>

        <div className="space-y-6">
          {/* Allow User Self Delete */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <TrashIcon className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <label className="text-sm font-medium text-white">
                  Allow Users to Delete Own Records
                </label>
                <p className="text-xs text-white/40 mt-1">
                  When enabled, users can delete their own expenses and payments without admin approval
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ 
                ...settings, 
                allowUserSelfDelete: settings.allowUserSelfDelete === 'true' ? 'false' : 'true' 
              })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                settings.allowUserSelfDelete === 'true' ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.allowUserSelfDelete === 'true' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Allow Users to Edit Own Records */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <PencilIcon className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <label className="text-sm font-medium text-white">
                  Allow Users to Edit Own Records
                </label>
                <p className="text-xs text-white/40 mt-1">
                  When enabled, users can edit their own expenses and payments without admin approval
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ 
                ...settings, 
                allowUserSelfEdit: settings.allowUserSelfEdit === 'true' ? 'false' : 'true' 
              })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                settings.allowUserSelfEdit === 'true' ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.allowUserSelfEdit === 'true' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Accept Payments */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <label className="text-sm font-medium text-white">
                  Auto-Accept Payments
                </label>
                <p className="text-xs text-white/40 mt-1">
                  When enabled, payments are automatically confirmed when submitted with receipt
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ 
                ...settings, 
                autoAcceptPayments: settings.autoAcceptPayments === 'true' ? 'false' : 'true' 
              })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                settings.autoAcceptPayments === 'true' ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.autoAcceptPayments === 'true' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Require Payment Receipt */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <DocumentIcon className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <label className="text-sm font-medium text-white">
                  Require Payment Receipt
                </label>
                <p className="text-xs text-white/40 mt-1">
                  When enabled, users must upload a receipt image when recording payments
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ 
                ...settings, 
                requirePaymentReceipt: settings.requirePaymentReceipt === 'true' ? 'false' : 'true' 
              })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                settings.requirePaymentReceipt === 'true' ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.requirePaymentReceipt === 'true' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="glass-card p-6 max-w-2xl bg-blue-500/10 border-blue-500/20">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">ℹ️ About Settings</h3>
        <ul className="text-sm text-white/60 space-y-1">
          <li>• Only administrators can modify these settings</li>
          <li>• Currency symbol will be applied to all monetary displays</li>
          <li>• Usage units are shown when adding Water or Electricity expenses</li>
          <li>• Changes take effect immediately after saving</li>
        </ul>
      </div>

      {/* Version Info */}
      <div className="max-w-2xl text-center text-white/30 text-xs">
        <p>Rumah Money Mate v1.0.0</p>
      </div>
    </div>
  );
}
