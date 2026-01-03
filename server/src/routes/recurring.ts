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
    const { description, amount, frequency, startDate, endDate, totalOccurrences, categoryId, notes, userId, splitEqually } = req.body;

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
        splitEqually: splitEqually !== undefined ? splitEqually : true
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
    const { description, amount, frequency, endDate, totalOccurrences, categoryId, notes, isActive } = req.body;

    const existing = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Recurring expense not found' });
    }

    // Only owner or admin can update
    if (existing.userId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to update this recurring expense' });
    }

    const recurring = await prisma.recurringExpense.update({
      where: { id },
      data: {
        description,
        amount: amount ? parseFloat(amount) : undefined,
        frequency,
        endDate: endDate ? new Date(endDate) : null,
        totalOccurrences: totalOccurrences ? parseInt(totalOccurrences) : null,
        categoryId: categoryId || null,
        notes,
        isActive: isActive !== undefined ? isActive : undefined
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

      // Calculate splits if splitEqually is enabled
      let splitsData: { userId: string; amount: number }[] = [];
      if (recurring.splitEqually && activeUsers.length > 0) {
        const perPerson = Math.floor((recurring.amount / activeUsers.length) * 100) / 100;
        const totalOthers = perPerson * (activeUsers.length - 1);
        const ownerAmount = Math.round((recurring.amount - totalOthers) * 100) / 100;
        
        // Owner (userId) gets remainder, others get equal share
        splitsData = activeUsers.map((u, idx) => ({
          userId: u.id,
          amount: u.id === recurring.userId ? ownerAmount : perPerson
        }));
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
