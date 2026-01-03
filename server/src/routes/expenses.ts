import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { upload, getUploadPath } from '../middleware/upload';

const router = Router();

// Get all expenses (for transparency)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, categoryId, startDate, endDate, page = '1', limit = '50' } = req.query;

    const where: any = {};
    
    if (userId) where.userId = userId;
    if (categoryId) where.categoryId = categoryId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true }
          },
          createdBy: {
            select: { id: true, username: true, displayName: true }
          },
          category: {
            select: { id: true, name: true, icon: true, color: true }
          },
          recurringExpense: {
            select: { id: true, description: true, frequency: true }
          },
          splits: true
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.expense.count({ where })
    ]);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

// Get single expense
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        createdBy: {
          select: { id: true, username: true, displayName: true }
        },
        category: {
          select: { id: true, name: true, icon: true, color: true }
        },
        recurringExpense: {
          select: { id: true, description: true, frequency: true }
        },
        splits: true
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to get expense' });
  }
});

// Create expense (can be on behalf of another user, with optional splits)
router.post('/', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
  try {
    const { description, amount, date, categoryId, notes, userId, usage, splits } = req.body;

    const receiptImage = req.file ? getUploadPath(req.file.filename, 'receipts') : null;

    // Allow creating expense for another user (on behalf of)
    const targetUserId = userId || req.user!.id;
    const createdById = userId && userId !== req.user!.id ? req.user!.id : null;

    // Parse splits if provided (JSON string from form data)
    let parsedSplits: { memberId: string; amount: number }[] = [];
    if (splits) {
      try {
        parsedSplits = typeof splits === 'string' ? JSON.parse(splits) : splits;
      } catch (e) {
        console.error('Failed to parse splits:', e);
      }
    }

    const expense = await prisma.expense.create({
      data: {
        description,
        amount: parseFloat(amount),
        usage: usage ? parseFloat(usage) : null,
        date: date ? new Date(date) : new Date(),
        receiptImage,
        notes,
        userId: targetUserId,
        createdById,
        categoryId: categoryId || null,
        // Create splits if provided
        splits: parsedSplits.length > 0 ? {
          create: parsedSplits.map(s => ({
            userId: s.memberId,
            amount: s.amount
          }))
        } : undefined
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        createdBy: {
          select: { id: true, username: true, displayName: true }
        },
        category: {
          select: { id: true, name: true, icon: true, color: true }
        },
        splits: true
      }
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense (own or admin)
router.put('/:id', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Check if record is locked (associated with deleted user)
    if (expense.isLocked) {
      return res.status(403).json({ error: 'This record is locked and cannot be edited. It is associated with a deleted user.' });
    }

    // Check permission - only admin can edit
    if (!req.user!.isAdmin) {
      return res.status(403).json({ error: 'Only admins can edit expenses' });
    }

    const { description, amount, date, categoryId, notes, userId, usage, splits } = req.body;

    const updateData: any = {};
    
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (usage !== undefined) updateData.usage = usage ? parseFloat(usage) : null;
    if (date !== undefined) updateData.date = new Date(date);
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (notes !== undefined) updateData.notes = notes;
    if (userId !== undefined) updateData.userId = userId;
    
    if (req.file) {
      updateData.receiptImage = getUploadPath(req.file.filename, 'receipts');
    }

    // Handle splits update
    let parsedSplits: { memberId: string; amount: number }[] = [];
    if (splits !== undefined) {
      try {
        parsedSplits = typeof splits === 'string' ? JSON.parse(splits) : splits;
      } catch (e) {
        console.error('Failed to parse splits:', e);
      }

      // Delete existing splits and create new ones
      await prisma.expenseSplit.deleteMany({
        where: { expenseId: req.params.id }
      });
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        // Recreate splits if provided
        splits: parsedSplits.length > 0 ? {
          create: parsedSplits.map(s => ({
            userId: s.memberId,
            amount: s.amount
          }))
        } : undefined
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        createdBy: {
          select: { id: true, username: true, displayName: true }
        },
        category: {
          select: { id: true, name: true, icon: true, color: true }
        },
        splits: true
      }
    });

    res.json(updatedExpense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense (admin, or owner if allowUserSelfDelete is enabled)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Check if record is locked (associated with deleted user)
    if (expense.isLocked) {
      return res.status(403).json({ error: 'This record is locked and cannot be deleted. It is associated with a deleted user.' });
    }

    // Check permissions: admin can always delete
    if (!req.user!.isAdmin) {
      // Check if user owns this expense
      if (expense.userId !== req.user!.id && expense.createdById !== req.user!.id) {
        return res.status(403).json({ error: 'Permission denied. Only admins or the record owner can delete.' });
      }

      // Check if self-delete is allowed
      const allowSelfDeleteSetting = await prisma.settings.findUnique({
        where: { key: 'allowUserSelfDelete' }
      });
      const allowSelfDelete = allowSelfDeleteSetting?.value === 'true';

      if (!allowSelfDelete) {
        return res.status(403).json({ error: 'Self-deletion is disabled. Please contact an admin or submit a delete request.' });
      }
    }

    await prisma.expense.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Get expense summary by category
router.get('/summary/by-category', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    const where: any = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const expenses = await prisma.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: true
    });

    // Get category details
    const categoryIds = expenses.map(e => e.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const result = expenses.map(e => ({
      category: e.categoryId ? categoryMap.get(e.categoryId) : { id: null, name: 'No Category', icon: '❓', color: '#666' },
      total: e._sum.amount || 0,
      count: e._count
    }));

    res.json(result);
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ error: 'Failed to get expense summary' });
  }
});

export default router;
