import { useState, useRef } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { exportAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function Export() {
  const { user } = useAuthStore();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = async () => {
    try {
      const response = await exportAPI.exportJSON();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      downloadBlob(blob, `house-finance-backup-${getDateString()}.json`);
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const handleExportExpensesCSV = async () => {
    try {
      const response = await exportAPI.exportExpensesCSV();
      downloadBlob(response.data, `expenses-${getDateString()}.csv`);
      toast.success('Expenses exported successfully');
    } catch (error) {
      toast.error('Failed to export expenses');
    }
  };

  const handleExportPaymentsCSV = async () => {
    try {
      const response = await exportAPI.exportPaymentsCSV();
      downloadBlob(response.data, `payments-${getDateString()}.csv`);
      toast.success('Payments exported successfully');
    } catch (error) {
      toast.error('Failed to export payments');
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const response = await exportAPI.importJSON(data);
      toast.success(
        `Imported ${response.data.imported.categories} categories and ${response.data.imported.expenses} expenses`
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import data');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const response = await exportAPI.importCSV(text, 'expenses');
      toast.success(`Imported ${response.data.imported} expenses`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import CSV');
    } finally {
      setImporting(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Export & Import</h1>
        <p className="text-white/60 mt-1">Backup and restore your data</p>
      </div>

      {/* Export Section */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <ArrowDownTrayIcon className="w-5 h-5" />
          Export Data
        </h2>
        <p className="text-white/60 text-sm">
          Download your data for backup or analysis
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={handleExportJSON}
            className="glass-card-hover p-4 text-left space-y-2"
          >
            <DocumentTextIcon className="w-8 h-8 text-purple-400" />
            <p className="font-medium text-white">Full Backup</p>
            <p className="text-xs text-white/50">Export all data as JSON</p>
          </button>

          <button
            onClick={handleExportExpensesCSV}
            className="glass-card-hover p-4 text-left space-y-2"
          >
            <TableCellsIcon className="w-8 h-8 text-green-400" />
            <p className="font-medium text-white">Expenses CSV</p>
            <p className="text-xs text-white/50">Export expenses to spreadsheet</p>
          </button>

          <button
            onClick={handleExportPaymentsCSV}
            className="glass-card-hover p-4 text-left space-y-2"
          >
            <TableCellsIcon className="w-8 h-8 text-blue-400" />
            <p className="font-medium text-white">Payments CSV</p>
            <p className="text-xs text-white/50">Export payments to spreadsheet</p>
          </button>
        </div>
      </div>

      {/* Import Section (Admin Only) */}
      {user?.isAdmin && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowUpTrayIcon className="w-5 h-5" />
            Import Data
          </h2>
          <p className="text-white/60 text-sm">
            Restore data from a backup file (Admin only)
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`glass-card-hover p-4 text-left space-y-2 cursor-pointer ${
                importing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <DocumentTextIcon className="w-8 h-8 text-purple-400" />
              <p className="font-medium text-white">Import JSON</p>
              <p className="text-xs text-white/50">Restore from full backup</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
                disabled={importing}
              />
            </label>

            <label
              className={`glass-card-hover p-4 text-left space-y-2 cursor-pointer ${
                importing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <TableCellsIcon className="w-8 h-8 text-green-400" />
              <p className="font-medium text-white">Import CSV</p>
              <p className="text-xs text-white/50">Import expenses from CSV</p>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
                disabled={importing}
              />
            </label>
          </div>

          {importing && (
            <div className="flex items-center justify-center gap-2 text-white/60">
              <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <span>Importing...</span>
            </div>
          )}
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">CSV Format Guide</h2>
        <p className="text-white/60 text-sm">
          When importing expenses from CSV, use the following format:
        </p>
        <div className="bg-black/30 rounded-xl p-4 font-mono text-sm overflow-x-auto">
          <p className="text-white/60">date,description,amount,category,notes</p>
          <p className="text-white">2024-01-15,Electricity Bill,150.00,Utilities,Monthly bill</p>
          <p className="text-white">2024-01-16,Groceries,85.50,Groceries,Weekly shopping</p>
        </div>
        <div className="text-xs text-white/50 space-y-1">
          <p>• Date format: YYYY-MM-DD</p>
          <p>• Amount: Numeric value without currency symbol</p>
          <p>• Category: Must match existing category name</p>
          <p>• Notes: Optional field</p>
        </div>
      </div>
    </div>
  );
}
