import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    invitationKey: string;
  }) => api.post('/auth/register', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  updateProfile: (data: any) => api.put('/users/profile', data),
  uploadQR: (file: File) => {
    const formData = new FormData();
    formData.append('qrCode', file);
    return api.post('/users/qr-code', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  setAdmin: (id: string, isAdmin: boolean) =>
    api.put(`/users/${id}/admin`, { isAdmin }),
  getStats: (id: string) => api.get(`/users/${id}/stats`),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  resetAllPasswords: (newPassword: string) =>
    api.post('/users/reset-all-passwords', { newPassword }),
};

// Expenses API
export const expensesAPI = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  getById: (id: string) => api.get(`/expenses/${id}`),
  create: (data: FormData) =>
    api.post('/expenses', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: FormData) =>
    api.put(`/expenses/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  getSummaryByCategory: (params?: any) =>
    api.get('/expenses/summary/by-category', { params }),
};

// Categories API
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  getById: (id: string) => api.get(`/categories/${id}`),
  create: (data: { name: string; icon?: string; color?: string }) =>
    api.post('/categories', data),
  update: (id: string, data: { name?: string; icon?: string; color?: string }) =>
    api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Payments API
export const paymentsAPI = {
  getAll: (params?: any) => api.get('/payments', { params }),
  getById: (id: string) => api.get(`/payments/${id}`),
  create: (data: FormData) =>
    api.post('/payments', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateStatus: (id: string, status: 'confirmed' | 'rejected') =>
    api.put(`/payments/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/payments/${id}`),
  getBalance: (userId: string) => api.get(`/payments/balance/${userId}`),
  getAllBalances: () => api.get('/payments/balances/all'),
};

// Split Bills API
export const splitBillsAPI = {
  calculate: (data: any) => api.post('/split-bills/calculate', data),
  createExpenses: (data: FormData) =>
    api.post('/split-bills/create-expenses', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  quickSplit: (data: FormData) =>
    api.post('/split-bills/quick-split', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Dashboard API
export const dashboardAPI = {
  getSummary: (params?: { period?: string; userId?: string }) =>
    api.get('/dashboard/summary', { params }),
  getComparison: (params?: { period?: string }) =>
    api.get('/dashboard/comparison', { params }),
  getExpenseTrend: (params?: { period?: string; categoryId?: string }) =>
    api.get('/dashboard/expense-trend', { params }),
  getUtilitiesTrend: (params?: { period?: string }) =>
    api.get('/dashboard/utilities-trend', { params }),
  getCategoryTrend: (params?: { categoryId?: string; months?: number }) =>
    api.get('/dashboard/category-trend', { params }),
  getTopExpenses: (params?: { period?: string; limit?: number }) =>
    api.get('/dashboard/top-expenses', { params }),
  getBalances: () => api.get('/dashboard/balances'),
};

// Recurring Expenses API
export const recurringAPI = {
  getAll: () => api.get('/recurring'),
  create: (data: any) => api.post('/recurring', data),
  update: (id: string, data: any) => api.put(`/recurring/${id}`, data),
  cancel: (id: string) => api.post(`/recurring/${id}/cancel`),
  reactivate: (id: string) => api.post(`/recurring/${id}/reactivate`),
  delete: (id: string) => api.delete(`/recurring/${id}`),
  process: () => api.post('/recurring/process'),
};

// Delete Requests API
export const deleteRequestsAPI = {
  getAll: () => api.get('/delete-requests'),
  create: (data: { recordType: string; recordId: string; reason?: string }) =>
    api.post('/delete-requests', data),
  approve: (id: string) => api.post(`/delete-requests/${id}/approve`),
  reject: (id: string) => api.post(`/delete-requests/${id}/reject`),
  cancel: (id: string) => api.delete(`/delete-requests/${id}`),
};

// Export API
export const exportAPI = {
  exportJSON: () => api.get('/export/json', { responseType: 'blob' }),
  exportExpensesCSV: () =>
    api.get('/export/expenses/csv', { responseType: 'blob' }),
  exportPaymentsCSV: () =>
    api.get('/export/payments/csv', { responseType: 'blob' }),
  importJSON: (data: any) => api.post('/export/import', data),
  importCSV: (csv: string, type: string) =>
    api.post('/export/import/csv', { csv, type }),
};

// Settings API
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  update: (data: Record<string, string>) => api.put('/settings', data),
  get: (key: string) => api.get(`/settings/${key}`),
};
