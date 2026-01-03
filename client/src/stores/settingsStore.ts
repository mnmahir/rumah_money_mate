import { create } from 'zustand';
import { settingsAPI } from '../lib/api';

interface SettingsState {
  currency: string;
  waterUnit: string;
  electricityUnit: string;
  allowUserSelfDelete: boolean;
  allowUserSelfEdit: boolean;
  autoAcceptPayments: boolean;
  requirePaymentReceipt: boolean;
  loaded: boolean;
  loading: boolean;
  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currency: 'RM',
  waterUnit: 'm³',
  electricityUnit: 'kWh',
  allowUserSelfDelete: false,
  allowUserSelfEdit: false,
  autoAcceptPayments: true,
  requirePaymentReceipt: true,
  loaded: false,
  loading: false,

  fetchSettings: async () => {
    try {
      set({ loading: true });
      const response = await settingsAPI.getAll();
      set({
        currency: response.data.currency || 'RM',
        waterUnit: response.data.waterUnit || 'm³',
        electricityUnit: response.data.electricityUnit || 'kWh',
        allowUserSelfDelete: response.data.allowUserSelfDelete === 'true',
        allowUserSelfEdit: response.data.allowUserSelfEdit === 'true',
        autoAcceptPayments: response.data.autoAcceptPayments !== 'false',  // default true
        requirePaymentReceipt: response.data.requirePaymentReceipt !== 'false',  // default true
        loaded: true,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      set({ loading: false, loaded: true });
    }
  },
}));
