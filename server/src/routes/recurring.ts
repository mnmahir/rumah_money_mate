import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { addDays, addWeeks, addMonths, addYears, isBefore, isAfter, startOfDay } from 'date-fns';

const router = Router();

// Get frequency label
const getFrequencyLabel = (freq: string) => {
  switch (freq) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Yearly';
    default: return freq;
  }
};

// Calculate next due date based on frequency
const calculateNextDueDate = (currentDate: Date, frequency: string): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(currentDate, 1);
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'monthly':
      return addMonths(currentDate, 1);
    case 'yearly':
      return addYears(currentDate, 1);
    default:
      return addMonths(currentDate, 1);
  }
};

// Get all recurring expenses
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const recurring = await prisma.recurringExpense.findMany({
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        }
      },
      orderBy: { nextDueDate: 'asc' }
    });

    res.json(recurring);
  } catch (error) {
    console.error('Get recurring expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch recurring expenses' });
  }
});

// Create recurring expense
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { description, amount, frequency, startDate, endDate, totalOccurrences, categoryId, notes, userId, splitEqually, splitType, splitConfig } = req.body;

    // Allow creating for another user
    const targetUserId = userId || req.user!.id;

    const recurring = await prisma.recurringExpense.create({
      data: {
        description,
        amount: parseFloat(amount),
        frequency,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        totalOccurrences: totalOccurrences ? parseInt(totalOccurrences) : null,
        nextDueDate: new Date(startDate),
        categoryId: categoryId || null,
        notes,
        userId: targetUserId,
        splitEqually: splitEqually !== undefined ? splitEqually : true,
        splitType: splitType || 'equal',
        splitConfig: splitConfig ? JSON.stringify(splitConfig) : null
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json(recurring);
  } catch (error) {
    console.error('Create recurring expense error:', error);
    res.status(500).json({ error: 'Failed to create recurring expense' });
  }
});

// Update recurring expense
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { description, amount, frequency, startDate, endDate, totalOccurrences, categoryId, notes, isActive, splitEqually, splitType, splitConfig, userId } = req.body;

    const existing = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Recurring expense not found' });
    }

    // Only owner or admin can update
    if (existing.userId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to update this recurring expense' });
    }

    // If startDate changed and is in the future, update nextDueDate as well
    let newNextDueDate = existing.nextDueDate;
    if (startDate && new Date(startDate).getTime() !== existing.startDate.getTime()) {
      newNextDueDate = new Date(startDate);
    }

    const recurring = await prisma.recurringExpense.update({
      where: { id },
      data: {
        description,
        amount: amount ? parseFloat(amount) : undefined,
        frequency,
        startDate: startDate ? new Date(startDate) : undefined,
        nextDueDate: newNextDueDate,
        endDate: endDate ? new Date(endDate) : endDate === '' ? null : undefined,
        totalOccurrences: totalOccurrences ? parseInt(totalOccurrences) : totalOccurrences === '' ? null : undefined,
        categoryId: categoryId || categoryId === '' ? (categoryId || null) : undefined,
        notes,
        isActive: isActive !== undefined ? isActive : undefined,
        splitEqually: splitEqually !== undefined ? splitEqually : undefined,
        splitType: splitType || undefined,
        splitConfig: splitConfig !== undefined ? (splitConfig ? JSON.stringify(splitConfig) : null) : undefined,
        userId: userId || undefined
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true }
        }
      }
    });

    res.json(recurring);
  } catch (error) {
    console.error('Update recurring expense error:', error);
    res.status(500).json({ error: 'Failed to update recurring expense' });
  }
});

// Cancel/deactivate recurring expense (doesn't delete existing records)
router.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Recurring expense not found' });
    }

    // Only owner or admin can cancel
    if (existing.userId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to cancel this recurring expense' });
    }

    const recurring = await prisma.recurringExpense.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Recurring expense cancelled', recurring });
  } catch (error) {
    console.error('Cancel recurring expense error:', error);
    res.status(500).json({ error: 'Failed to cancel recurring expense' });
  }
});

// Reactivate recurring expense
router.post('/:id/reactivate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Recurring expense not found' });
    }

    // Only owner or admin can reactivate
    if (existing.userId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to reactivate this recurring expense' });
    }

    // Calculate next due date from today
    const today = startOfDay(new Date());
    let nextDueDate = new Date(existing.startDate);
    while (isBefore(nextDueDate, today)) {
      nextDueDate = calculateNextDueDate(nextDueDate, existing.frequency);
    }

    const recurring = await prisma.recurringExpense.update({
      where: { id },
      data: { 
        isActive: true,
        nextDueDate
      }
    });

    res.json({ message: 'Recurring expense reactivated', recurring });
  } catch (error) {
    console.error('Reactivate recurring expense error:', error);
    res.status(500).json({ error: 'Failed to reactivate recurring expense' });
  }
});

// Delete recurring expense (admin only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Only admins can delete recurring expenses' });
    }

    // Delete the recurring expense (generated expenses remain)
    await prisma.recurringExpense.delete({ where: { id } });

    res.json({ message: 'Recurring expense deleted' });
  } catch (error) {
    console.error('Delete recurring expense error:', error);
    res.status(500).json({ error: 'Failed to delete recurring expense' });
  }
});

// Process due recurring expenses (creates expense records with splits)
router.post('/process', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const today = startOfDay(new Date());
    
    // Find all active recurring expenses that are due
    const dueRecurring = await prisma.recurringExpense.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
        OR: [
          { endDate: null },
          { endDate: { gte: today } }
        ]
      }
    });

    // Get all active users for splitting
    const activeUsers = await prisma.user.findMany({
      where: { isDeleted: false },
      select: { id: true }
    });

    const created: any[] = [];

    for (const recurring of dueRecurring) {
      // Check if max occurrences reached
      if (recurring.totalOccurrences && recurring.occurrencesCreated >= recurring.totalOccurrences) {
        await prisma.recurringExpense.update({
          where: { id: recurring.id },
          data: { isActive: false }
        });
        continue;
      }

      // Calculate splits based on configuration
      let splitsData: { userId: string; amount: number }[] = [];
      
      if (recurring.splitEqually) {
        // Split equally among all active users
        if (activeUsers.length > 0) {
          const perPerson = Math.floor((recurring.amount / activeUsers.length) * 100) / 100;
          const totalOthers = perPerson * (activeUsers.length - 1);
          const ownerAmount = Math.round((recurring.amount - totalOthers) * 100) / 100;
          
          splitsData = activeUsers.map((u) => ({
            userId: u.id,
            amount: u.id === recurring.userId ? ownerAmount : perPerson
          }));
        }
      } else if (recurring.splitConfig) {
        // Use custom split configuration
        const config = JSON.parse(recurring.splitConfig) as Array<{ memberId: string; percentage?: number; amount?: number }>;
        const splitType = recurring.splitType || 'equal';
        
        if (splitType === 'percentage') {
          // Calculate based on percentage
          let totalOthersAmount = 0;
          const othersAmounts = config.slice(1).map((c) => {
            const percentage = c.percentage || 0;
            const amount = Math.round((recurring.amount * percentage / 100) * 100) / 100;
            totalOthersAmount += amount;
            return { userId: c.memberId, amount };
          });
          
          // Owner gets remainder
          const ownerAmount = Math.round((recurring.amount - totalOthersAmount) * 100) / 100;
          splitsData = [
            { userId: config[0]?.memberId || recurring.userId, amount: ownerAmount },
            ...othersAmounts
          ];
        } else if (splitType === 'amount') {
          // Calculate based on fixed amounts
          let totalOthersAmount = 0;
          const othersAmounts = config.slice(1).map((c) => {
            totalOthersAmount += c.amount || 0;
            return { userId: c.memberId, amount: c.amount || 0 };
          });
          
          // Owner gets remainder
          const ownerAmount = Math.round((recurring.amount - totalOthersAmount) * 100) / 100;
          splitsData = [
            { userId: config[0]?.memberId || recurring.userId, amount: Math.max(0, ownerAmount) },
            ...othersAmounts
          ];
        } else {
          // Equal split among selected members
          const perPerson = Math.floor((recurring.amount / config.length) * 100) / 100;
          const totalOthers = perPerson * (config.length - 1);
          const ownerAmount = Math.round((recurring.amount - totalOthers) * 100) / 100;
          
          splitsData = config.map((c, idx) => ({
            userId: c.memberId,
            amount: idx === 0 ? ownerAmount : perPerson
          }));
        }
      }

      // Create expense record with splits
      const expense = await prisma.expense.create({
        data: {
          description: recurring.description,
          amount: recurring.amount,
          date: recurring.nextDueDate,
          categoryId: recurring.categoryId,
          userId: recurring.userId,
          recurringExpenseId: recurring.id,
          notes: `Auto-generated from recurring: ${recurring.description}`,
          splits: splitsData.length > 0 ? {
            create: splitsData.map(s => ({
              userId: s.userId,
              amount: s.amount
            }))
          } : undefined
        }
      });

      created.push(expense);

      // Update next due date and occurrences count
      const nextDueDate = calculateNextDueDate(recurring.nextDueDate, recurring.frequency);
      
      await prisma.recurringExpense.update({
        where: { id: recurring.id },
        data: {
          nextDueDate,
          occurrencesCreated: recurring.occurrencesCreated + 1
        }
      });
    }

    res.json({ message: `Processed ${created.length} recurring expenses`, created });
  } catch (error) {
    console.error('Process recurring expenses error:', error);
    res.status(500).json({ error: 'Failed to process recurring expenses' });
  }
});

export default router;
