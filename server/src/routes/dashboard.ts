import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to get start date based on period
function getStartDateForPeriod(period: string): Date {
  const now = new Date();
  
  switch (period) {
    case '6months':
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
    case '1year':
      return new Date(now.getFullYear() - 1, now.getMonth(), 1);
    case '2years':
      return new Date(now.getFullYear() - 2, now.getMonth(), 1);
    case '5years':
      return new Date(now.getFullYear() - 5, now.getMonth(), 1);
    case 'all':
      return new Date(0);
    default:
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
  }
}

// Helper to get number of months for period
function getMonthsForPeriod(period: string): number {
  switch (period) {
    case '6months': return 6;
    case '1year': return 12;
    case '2years': return 24;
    case '5years': return 60;
    case 'all': return 120; // Max 10 years of data
    default: return 6;
  }
}

// Get dashboard summary
router.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { period = '6months', userId } = req.query;

    const startDate = getStartDateForPeriod(period as string);

    const where: any = {
      date: { gte: startDate }
    };
    if (userId) where.userId = userId;

    // Get total expenses
    const totalExpenses = await prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: true
    });

    // Get expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: true
    });

    // Get category details
    const categoryIds = expensesByCategory.map(e => e.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } }
    });
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const categoryBreakdown = expensesByCategory.map(e => ({
      category: e.categoryId ? categoryMap.get(e.categoryId) : { id: null, name: 'No Category', icon: '❓', color: '#666' },
      total: e._sum.amount || 0,
      count: e._count
    }));

    // Get expenses by user
    const expensesByUser = await prisma.expense.groupBy({
      by: ['userId'],
      where: { date: { gte: startDate } },
      _sum: { amount: true },
      _count: true
    });

    const userIds = expensesByUser.map(e => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, avatarUrl: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const userBreakdown = expensesByUser.map(e => ({
      user: userMap.get(e.userId),
      total: e._sum.amount || 0,
      count: e._count
    }));

    // Get recent expenses
    const recentExpenses = await prisma.expense.findMany({
      where,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true, icon: true, color: true } }
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    // Get pending payments count
    const pendingPayments = await prisma.payment.count({
      where: { status: 'pending' }
    });

    res.json({
      period,
      totalAmount: totalExpenses._sum.amount || 0,
      totalCount: totalExpenses._count,
      categoryBreakdown,
      userBreakdown,
      recentExpenses,
      pendingPayments
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to get dashboard summary' });
  }
});

// Get expense trend over time (with optional category filter)
router.get('/expense-trend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { period = '6months', categoryId, userId } = req.query;
    
    const numMonths = getMonthsForPeriod(period as string);
    const months = [];
    const now = new Date();

    for (let i = numMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const where: any = {
        date: { gte: date, lte: endDate }
      };
      if (categoryId && categoryId !== 'all') where.categoryId = categoryId;
      if (userId) where.userId = userId;

      const result = await prisma.expense.aggregate({
        where,
        _sum: { amount: true }
      });

      months.push({
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        amount: result._sum.amount || 0
      });
    }

    res.json(months);
  } catch (error) {
    console.error('Get expense trend error:', error);
    res.status(500).json({ error: 'Failed to get expense trend' });
  }
});

// Get utilities trend (Water and Electricity usage and amount)
router.get('/utilities-trend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { period = '6months' } = req.query;
    
    const numMonths = getMonthsForPeriod(period as string);
    const now = new Date();

    // Find Water and Electricity categories
    const waterCategory = await prisma.category.findFirst({
      where: { name: 'Water' }
    });
    const electricityCategory = await prisma.category.findFirst({
      where: { name: 'Electricity' }
    });

    const data = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const dateFilter = { gte: date, lte: endDate };

      // Get water expenses for this month
      let waterAmount = 0;
      let waterUsage = 0;
      if (waterCategory) {
        const waterExpenses = await prisma.expense.findMany({
          where: { categoryId: waterCategory.id, date: dateFilter }
        });
        waterAmount = waterExpenses.reduce((sum, e) => sum + e.amount, 0);
        waterUsage = waterExpenses.reduce((sum, e) => sum + (e.usage || 0), 0);
      }

      // Get electricity expenses for this month
      let electricityAmount = 0;
      let electricityUsage = 0;
      if (electricityCategory) {
        const electricityExpenses = await prisma.expense.findMany({
          where: { categoryId: electricityCategory.id, date: dateFilter }
        });
        electricityAmount = electricityExpenses.reduce((sum, e) => sum + e.amount, 0);
        electricityUsage = electricityExpenses.reduce((sum, e) => sum + (e.usage || 0), 0);
      }

      data.push({
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        waterAmount,
        waterUsage,
        electricityAmount,
        electricityUsage
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Get utilities trend error:', error);
    res.status(500).json({ error: 'Failed to get utilities trend' });
  }
});

// Get user comparison stats
router.get('/comparison', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const users = await prisma.user.findMany({
      select: { id: true, displayName: true, avatarUrl: true }
    });

    const comparison = await Promise.all(users.map(async (user) => {
      const [expenses, paymentsMade, paymentsReceived] = await Promise.all([
        prisma.expense.aggregate({
          where: { userId: user.id, date: { gte: startDate } },
          _sum: { amount: true },
          _count: true
        }),
        prisma.payment.aggregate({
          where: { fromUserId: user.id, status: 'confirmed', date: { gte: startDate } },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: { toUserId: user.id, status: 'confirmed', date: { gte: startDate } },
          _sum: { amount: true }
        })
      ]);

      return {
        user,
        totalExpenses: expenses._sum.amount || 0,
        expenseCount: expenses._count,
        paymentsMade: paymentsMade._sum.amount || 0,
        paymentsReceived: paymentsReceived._sum.amount || 0
      };
    }));

    res.json(comparison);
  } catch (error) {
    console.error('Get comparison error:', error);
    res.status(500).json({ error: 'Failed to get comparison data' });
  }
});

// Get category trend over time
router.get('/category-trend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { categoryId, months = '6' } = req.query;

    const trend = [];
    const now = new Date();
    const numMonths = parseInt(months as string);

    for (let i = numMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const where: any = {
        date: { gte: date, lte: endDate }
      };
      if (categoryId) where.categoryId = categoryId;

      const result = await prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true
      });

      trend.push({
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        amount: result._sum.amount || 0,
        count: result._count
      });
    }

    res.json(trend);
  } catch (error) {
    console.error('Get category trend error:', error);
    res.status(500).json({ error: 'Failed to get category trend' });
  }
});

// Get top expenses
router.get('/top-expenses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { period = 'month', limit = '10' } = req.query;

    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startDate } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true, icon: true, color: true } }
      },
      orderBy: { amount: 'desc' },
      take: parseInt(limit as string)
    });

    res.json(expenses);
  } catch (error) {
    console.error('Get top expenses error:', error);
    res.status(500).json({ error: 'Failed to get top expenses' });
  }
});

// Get who owes who summary based on expenses and payments
router.get('/balances', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });

    // Get all confirmed payments
    const payments = await prisma.payment.findMany({
      where: { status: 'confirmed' },
      select: { fromUserId: true, toUserId: true, amount: true }
    });

    // Get total expenses per user
    const expensesByUser = await prisma.expense.groupBy({
      by: ['userId'],
      _sum: { amount: true }
    });

    const totalExpenses = expensesByUser.reduce((sum, e) => sum + (e._sum.amount || 0), 0);
    const memberCount = users.length;
    const fairShare = memberCount > 0 ? totalExpenses / memberCount : 0;

    // Calculate each user's expense total
    const userExpenses: { [key: string]: number } = {};
    expensesByUser.forEach(e => {
      userExpenses[e.userId] = e._sum.amount || 0;
    });

    // Calculate net balance for each user (positive = they've paid more than fair share)
    const userBalances: { [key: string]: number } = {};
    users.forEach(u => {
      const spent = userExpenses[u.id] || 0;
      userBalances[u.id] = spent - fairShare;
    });

    // Adjust for payments already made
    payments.forEach(p => {
      userBalances[p.fromUserId] = (userBalances[p.fromUserId] || 0) + p.amount;
      userBalances[p.toUserId] = (userBalances[p.toUserId] || 0) - p.amount;
    });

    // Calculate who owes who
    const debts: Array<{
      from: typeof users[0];
      to: typeof users[0];
      amount: number;
    }> = [];

    // Create sorted lists of creditors and debtors
    const creditors = users
      .filter(u => userBalances[u.id] > 0.01)
      .map(u => ({ user: u, amount: userBalances[u.id] }))
      .sort((a, b) => b.amount - a.amount);

    const debtors = users
      .filter(u => userBalances[u.id] < -0.01)
      .map(u => ({ user: u, amount: -userBalances[u.id] }))
      .sort((a, b) => b.amount - a.amount);

    // Simple debt settlement algorithm
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);

      if (amount > 0.01) {
        debts.push({
          from: debtor.user,
          to: creditor.user,
          amount: Math.round(amount * 100) / 100
        });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    // User summary
    const userSummary = users.map(u => ({
      user: u,
      totalExpenses: userExpenses[u.id] || 0,
      fairShare,
      netBalance: Math.round(userBalances[u.id] * 100) / 100,
      status: userBalances[u.id] > 0.01 ? 'owed' : userBalances[u.id] < -0.01 ? 'owes' : 'settled'
    }));

    res.json({
      totalExpenses,
      fairShare: Math.round(fairShare * 100) / 100,
      memberCount,
      debts,
      userSummary
    });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Failed to get balance summary' });
  }
});

export default router;
