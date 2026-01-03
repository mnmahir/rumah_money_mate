import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  ClockIcon,
  ArrowRightIcon,
  BanknotesIcon,
  BoltIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { dashboardAPI, categoriesAPI } from '../lib/api';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardData {
  totalAmount: number;
  totalCount: number;
  categoryBreakdown: any[];
  userBreakdown: any[];
  recentExpenses: any[];
  pendingPayments: number;
}

interface Balance {
  from: { id: string; displayName: string };
  to: { id: string; displayName: string };
  amount: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

type Period = '6months' | '1year' | '2years' | '5years' | 'all';

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('6months');
  const [trendCategory, setTrendCategory] = useState<string>('all');
  const [showMyDataOnly, setShowMyDataOnly] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [expenseTrend, setExpenseTrend] = useState<any[]>([]);
  const [utilitiesTrend, setUtilitiesTrend] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWaterUsage, setShowWaterUsage] = useState(true);
  const [showWaterAmount, setShowWaterAmount] = useState(true);
  const [showElectricityUsage, setShowElectricityUsage] = useState(true);
  const [showElectricityAmount, setShowElectricityAmount] = useState(true);
  
  const { currency, waterUnit, electricityUnit } = useSettingsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchDashboardData();
  }, [period, showMyDataOnly]);

  useEffect(() => {
    fetchExpenseTrend();
  }, [period, trendCategory, showMyDataOnly]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params: any = { period };
      if (showMyDataOnly && user) {
        params.userId = user.id;
      }
      const [summaryRes, balancesRes, utilitiesRes, categoriesRes] = await Promise.all([
        dashboardAPI.getSummary(params),
        dashboardAPI.getBalances(),
        dashboardAPI.getUtilitiesTrend({ period }),
        categoriesAPI.getAll(),
      ]);
      setData(summaryRes.data);
      setBalances(balancesRes.data.debts || []);
      setUtilitiesTrend(utilitiesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseTrend = async () => {
    try {
      const params: any = { period, categoryId: trendCategory };
      if (showMyDataOnly && user) {
        params.userId = user.id;
      }
      const res = await dashboardAPI.getExpenseTrend(params);
      setExpenseTrend(res.data);
    } catch (error) {
      console.error('Failed to fetch expense trend:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!data) {
    return <div className="text-center text-white/60">Failed to load dashboard</div>;
  }

  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 20, 50, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
      },
    },
  };

  const lineChartData = {
    labels: expenseTrend.map((m) => `${m.month} ${m.year}`),
    datasets: [
      {
        label: 'Expenses',
        data: expenseTrend.map((m) => m.amount),
        fill: true,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.4,
        pointBackgroundColor: '#a855f7',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const doughnutData = {
    labels: data.categoryBreakdown.map((c) => c.category?.name || 'No Category'),
    datasets: [
      {
        data: data.categoryBreakdown.map((c) => c.total),
        backgroundColor: data.categoryBreakdown.map(
          (c) => c.category?.color || '#666'
        ),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(30, 20, 50, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  const barChartData = {
    labels: data.userBreakdown.map((u) => u.user?.displayName || 'Unknown'),
    datasets: [
      {
        label: 'Total Expenses',
        data: data.userBreakdown.map((u) => u.total),
        backgroundColor: 'rgba(168, 85, 247, 0.6)',
        borderColor: '#a855f7',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 20, 50, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
      },
    },
  };

  const periodLabels: Record<Period, string> = {
    '6months': '6 Months',
    '1year': '1 Year',
    '2years': '2 Years',
    '5years': '5 Years',
    'all': 'All Time',
  };

  // Utilities chart configuration
  const utilitiesChartData = {
    labels: utilitiesTrend.map((m) => `${m.month} ${m.year}`),
    datasets: [
      ...(showWaterUsage ? [{
        label: `Water Usage (${waterUnit})`,
        data: utilitiesTrend.map((m) => m.waterUsage),
        borderColor: '#06B6D4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      }] : []),
      ...(showWaterAmount ? [{
        label: `Water Bill (${currency})`,
        data: utilitiesTrend.map((m) => m.waterAmount),
        borderColor: '#0891B2',
        backgroundColor: 'rgba(8, 145, 178, 0.1)',
        tension: 0.4,
        borderDash: [5, 5],
        yAxisID: 'y',
      }] : []),
      ...(showElectricityUsage ? [{
        label: `Electricity Usage (${electricityUnit})`,
        data: utilitiesTrend.map((m) => m.electricityUsage),
        borderColor: '#EAB308',
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      }] : []),
      ...(showElectricityAmount ? [{
        label: `Electricity Bill (${currency})`,
        data: utilitiesTrend.map((m) => m.electricityAmount),
        borderColor: '#CA8A04',
        backgroundColor: 'rgba(202, 138, 4, 0.1)',
        tension: 0.4,
        borderDash: [5, 5],
        yAxisID: 'y',
      }] : []),
    ],
  };

  const utilitiesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(30, 20, 50, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        title: {
          display: true,
          text: `Amount (${currency})`,
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        title: {
          display: true,
          text: 'Usage',
          color: 'rgba(255, 255, 255, 0.5)',
        },
      },
    },
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-white/60 mt-1">
            {showMyDataOnly ? `Your personal expenses` : `Overview of your shared expenses`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* My Data Only Toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-xl">
            <input
              type="checkbox"
              checked={showMyDataOnly}
              onChange={(e) => setShowMyDataOnly(e.target.checked)}
              className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm text-white/70">My data only</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Expenses</p>
              <p className="text-2xl font-bold text-white mt-1">
                {currency} {data.totalAmount.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <CurrencyDollarIcon className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">
            {data.totalCount} transactions
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm">Average per Month</p>
              <p className="text-2xl font-bold text-white mt-1">
                {currency} {(data.totalAmount / (period === '6months' ? 6 : period === '1year' ? 12 : period === '2years' ? 24 : period === '5years' ? 60 : Math.max(expenseTrend.length, 1))).toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">
            Based on {periodLabels[period].toLowerCase()}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm">Active Members</p>
              <p className="text-2xl font-bold text-white mt-1">
                {data.userBreakdown.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">
            Contributing to expenses
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm">Pending Payments</p>
              <p className="text-2xl font-bold text-white mt-1">
                {data.pendingPayments}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">
            Awaiting confirmation
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Trend */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Expense Trend</h3>
            <select
              value={trendCategory}
              onChange={(e) => setTrendCategory(e.target.value)}
              className="glass-select text-sm py-1 px-3"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-64">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">By Category</h3>
          <div className="h-64">
            {data.categoryBreakdown.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-white/40">
                No expense data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Utilities Trend */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BoltIcon className="w-5 h-5 text-yellow-400" />
            <BeakerIcon className="w-5 h-5 text-cyan-400" />
            Utilities Trend
          </h3>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showWaterUsage}
                onChange={(e) => setShowWaterUsage(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-cyan-400">💧 Water Usage</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showWaterAmount}
                onChange={(e) => setShowWaterAmount(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-cyan-700 focus:ring-cyan-700"
              />
              <span className="text-cyan-600">💧 Water Bill</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showElectricityUsage}
                onChange={(e) => setShowElectricityUsage(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500"
              />
              <span className="text-yellow-400">⚡ Electricity Usage</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showElectricityAmount}
                onChange={(e) => setShowElectricityAmount(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-yellow-700 focus:ring-yellow-700"
              />
              <span className="text-yellow-600">⚡ Electricity Bill</span>
            </label>
          </div>
        </div>
        <div className="h-72">
          {utilitiesTrend.some(m => m.waterAmount > 0 || m.electricityAmount > 0) ? (
            <Line data={utilitiesChartData} options={utilitiesChartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-white/40">
              No utilities data available. Add Water or Electricity expenses to see trends.
            </div>
          )}
        </div>
      </div>

      {/* Member Comparison & Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Comparison */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">By Member</h3>
          <div className="h-64">
            {data.userBreakdown.length > 0 ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-white/40">
                No expense data available
              </div>
            )}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Expenses</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentExpenses.length > 0 ? (
              data.recentExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        backgroundColor: `${expense.category?.color || '#666'}20`,
                      }}
                    >
                      {expense.category?.icon || '📦'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {expense.description}
                      </p>
                      <p className="text-xs text-white/50">
                        {expense.user?.displayName} •{' '}
                        {format(new Date(expense.date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {currency} {expense.amount.toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-white/40 py-8">
                No recent expenses
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Who Owes Who Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-green-400" />
            Who Owes Who
          </h3>
          <Link 
            to="/payments" 
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            View payments
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
        {balances.length > 0 ? (
          <div className="space-y-3">
            {balances.map((balance, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-red-400">
                      {balance.from.displayName[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{balance.from.displayName}</span>
                    <ArrowRightIcon className="w-4 h-4 text-white/40" />
                    <span className="text-white font-medium">{balance.to.displayName}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-400">
                    {currency} {balance.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-white/40">owes</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <p>🎉 All settled! No outstanding debts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
