import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { upload, getUploadPath } from '../middleware/upload';

const router = Router();

// Get all payments
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { fromUserId, toUserId, status, startDate, endDate, page = '1', limit = '50' } = req.query;

    const where: any = {};
    
    if (fromUserId) where.fromUserId = fromUserId;
    if (toUserId) where.toUserId = toUserId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          fromUser: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, bankName: true, bankAccountNo: true, bankAccountName: true, paymentQrImage: true }
          },
          toUser: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, bankName: true, bankAccountNo: true, bankAccountName: true, paymentQrImage: true }
          },
          createdBy: {
            select: { id: true, username: true, displayName: true }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      payments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Get single payment
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        fromUser: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, bankName: true, bankAccountNo: true, bankAccountName: true, paymentQrImage: true }
        },
        toUser: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, bankName: true, bankAccountNo: true, bankAccountName: true, paymentQrImage: true }
        },
        createdBy: {
          select: { id: true, username: true, displayName: true }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to get payment' });
  }
});

// Create payment (receipt may be optional based on settings)
router.post('/', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
  try {
    // Check if receipt is required
    const requireReceiptSetting = await prisma.settings.findUnique({
      where: { key: 'requirePaymentReceipt' }
    });
    const requireReceipt = requireReceiptSetting?.value !== 'false';  // default true

    if (requireReceipt && !req.file) {
      return res.status(400).json({ error: 'Receipt image is required as proof of payment' });
    }

    const { fromUserId, toUserId, amount, description } = req.body;

    // Allow creating payment on behalf of another user
    const actualFromUserId = fromUserId || req.user!.id;
    const createdById = fromUserId && fromUserId !== req.user!.id ? req.user!.id : null;

    if (actualFromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot make payment to yourself' });
    }

    const receiptImage = req.file ? getUploadPath(req.file.filename, 'receipts') : null;

    // Check if auto-accept is enabled
    const autoAcceptSetting = await prisma.settings.findUnique({
      where: { key: 'autoAcceptPayments' }
    });
    const autoAccept = autoAcceptSetting?.value !== 'false';  // default true

    const payment = await prisma.payment.create({
      data: {
        fromUserId: actualFromUserId,
        toUserId,
        amount: parseFloat(amount),
        description,
        receiptImage,
        createdById,
        status: autoAccept ? 'confirmed' : 'pending'
      },
      include: {
        fromUser: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        toUser: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        createdBy: {
          select: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Confirm/reject payment (receiver or admin)
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;

    if (!['confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check if record is locked (associated with deleted user)
    if (payment.isLocked) {
      return res.status(403).json({ error: 'This payment is locked and cannot be modified. It is associated with a deleted user.' });
    }

    // Only receiver or admin can confirm/reject
    if (payment.toUserId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        fromUser: {
          select: { id: true, displayName: true, avatarUrl: true }
        },
        toUser: {
          select: { id: true, displayName: true, avatarUrl: true }
        }
      }
    });

    res.json(updatedPayment);
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Delete payment (admin, or owner if allowUserSelfDelete is enabled)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check if record is locked (associated with deleted user)
    if (payment.isLocked) {
      return res.status(403).json({ error: 'This payment is locked and cannot be deleted. It is associated with a deleted user.' });
    }

    // Check permissions: admin can always delete
    if (!req.user!.isAdmin) {
      // Check if user owns this payment (either sender or creator)
      if (payment.fromUserId !== req.user!.id && payment.createdById !== req.user!.id) {
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

    await prisma.payment.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// Get balance between users
router.get('/balance/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user!.id;

    const [paidToOther, receivedFromOther] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          fromUserId: currentUserId,
          toUserId: otherUserId,
          status: 'confirmed'
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          fromUserId: otherUserId,
          toUserId: currentUserId,
          status: 'confirmed'
        },
        _sum: { amount: true }
      })
    ]);

    const paid = paidToOther._sum.amount || 0;
    const received = receivedFromOther._sum.amount || 0;
    const balance = paid - received; // Positive means you've paid more

    res.json({
      paidToOther: paid,
      receivedFromOther: received,
      balance,
      message: balance > 0 
        ? `They owe you RM ${balance.toFixed(2)}` 
        : balance < 0 
          ? `You owe them RM ${Math.abs(balance).toFixed(2)}`
          : 'You are even'
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get all balances for current user (based on expense splits and payments)
router.get('/balances/all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;

    // Get all other users
    const users = await prisma.user.findMany({
      where: { id: { not: currentUserId } },
      select: { id: true, displayName: true, avatarUrl: true, bankName: true, bankAccountNo: true, bankAccountName: true, paymentQrImage: true }
    });

    const balances = await Promise.all(users.map(async (otherUser) => {
      // 1. Get expense splits where current user owes otherUser
      // (otherUser paid for expense, current user has a split)
      const expensesIPaidFor = await prisma.expense.findMany({
        where: { userId: currentUserId },
        include: { splits: true }
      });
      
      const expensesTheyPaidFor = await prisma.expense.findMany({
        where: { userId: otherUser.id },
        include: { splits: true }
      });

      // Amount I owe them: My split amount from their expenses
      let iOweThem = 0;
      for (const expense of expensesTheyPaidFor) {
        const mySplit = expense.splits.find(s => s.userId === currentUserId);
        if (mySplit) {
          iOweThem += mySplit.amount;
        }
      }

      // Amount they owe me: Their split amount from my expenses
      let theyOweMe = 0;
      for (const expense of expensesIPaidFor) {
        const theirSplit = expense.splits.find(s => s.userId === otherUser.id);
        if (theirSplit) {
          theyOweMe += theirSplit.amount;
        }
      }

      // 2. Factor in confirmed payments
      const [paidToThem, receivedFromThem] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            fromUserId: currentUserId,
            toUserId: otherUser.id,
            status: 'confirmed'
          },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: {
            fromUserId: otherUser.id,
            toUserId: currentUserId,
            status: 'confirmed'
          },
          _sum: { amount: true }
        })
      ]);

      const paid = paidToThem._sum.amount || 0;
      const received = receivedFromThem._sum.amount || 0;

      // Net balance: what I owe them - what they owe me - what I paid + what I received
      // Positive = I owe them, Negative = They owe me
      const netBalance = iOweThem - theyOweMe - paid + received;

      return {
        user: otherUser,
        expenseIOwe: iOweThem,
        expenseTheyOwe: theyOweMe,
        paidToThem: paid,
        receivedFromThem: received,
        balance: netBalance,
        youOwe: netBalance > 0,
        theyOwe: netBalance < 0,
        amount: Math.abs(netBalance)
      };
    }));

    // Only return balances with non-zero amounts
    res.json(balances.filter(b => b.amount > 0.01));
  } catch (error) {
    console.error('Get all balances error:', error);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

export default router;
