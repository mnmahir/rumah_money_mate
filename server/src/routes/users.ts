import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { upload, getUploadPath } from '../middleware/upload';

const router = Router();

// Get all users (for transparency - all members can see)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isDeleted: false },  // Only show active users
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        isAdmin: true,
        bankName: true,
        bankAccountNo: true,
        bankAccountName: true,
        paymentQrImage: true,
        avatarUrl: true,
        createdAt: true
      },
      orderBy: { displayName: 'asc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        isAdmin: true,
        bankName: true,
        bankAccountNo: true,
        bankAccountName: true,
        paymentQrImage: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update own profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { username, displayName, email, bankName, bankAccountNo, bankAccountName, currentPassword, newPassword } = req.body;

    const updateData: any = {};

    // Username change
    if (username && username !== req.user!.username) {
      // Check if username is taken
      const existingUsername = await prisma.user.findFirst({
        where: { username, NOT: { id: req.user!.id } }
      });
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already in use' });
      }
      updateData.username = username;
    }

    if (displayName) updateData.displayName = displayName;
    if (email) {
      // Check if email is taken
      const existingUser = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user!.id } }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updateData.email = email;
    }
    
    // Bank info - explicitly set even if empty string (to allow clearing)
    if (bankName !== undefined) updateData.bankName = bankName || null;
    if (bankAccountNo !== undefined) updateData.bankAccountNo = bankAccountNo || null;
    if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName || null;

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      const isValid = await bcrypt.compare(currentPassword, user!.password);

      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        isAdmin: true,
        bankName: true,
        bankAccountNo: true,
        bankAccountName: true,
        paymentQrImage: true,
        avatarUrl: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload QR code
router.post('/qr-code', authenticateToken, upload.single('qrCode'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'QR code image required' });
    }

    const qrPath = getUploadPath(req.file.filename, 'qrcodes');

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { paymentQrImage: qrPath },
      select: {
        id: true,
        paymentQrImage: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Upload QR error:', error);
    res.status(500).json({ error: 'Failed to upload QR code' });
  }
});

// Upload avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Avatar image required' });
    }

    const avatarPath = getUploadPath(req.file.filename, 'avatars');

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: avatarPath },
      select: {
        id: true,
        avatarUrl: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Admin: Reset user password
router.post('/:id/reset-password', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists and is not deleted
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.isDeleted) {
      return res.status(400).json({ error: 'Cannot reset password for deleted user' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Invalidate all refresh tokens for this user (force re-login)
    await prisma.refreshToken.deleteMany({ where: { userId } });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Admin: Reset all passwords
router.post('/reset-all-passwords', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update all active users' passwords
    const result = await prisma.user.updateMany({
      where: { isDeleted: false },
      data: { password: hashedPassword }
    });

    // Invalidate all refresh tokens (force everyone to re-login)
    await prisma.refreshToken.deleteMany({});

    res.json({ 
      message: `Password reset for ${result.count} users. Everyone will need to log in again.`
    });
  } catch (error) {
    console.error('Reset all passwords error:', error);
    res.status(500).json({ error: 'Failed to reset passwords' });
  }
});

// Admin: Promote/demote user
router.put('/:id/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { isAdmin } = req.body;

    // Prevent self-demotion
    if (req.params.id === req.user!.id && !isAdmin) {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { isAdmin },
      select: {
        id: true,
        username: true,
        displayName: true,
        isAdmin: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update admin status error:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Get user statistics
router.get('/:id/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user!.id;

    const [totalExpenses, totalPaymentsMade, totalPaymentsReceived, expenseCount] = await Promise.all([
      prisma.expense.aggregate({
        where: { userId },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { fromUserId: userId, status: 'confirmed' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { toUserId: userId, status: 'confirmed' },
        _sum: { amount: true }
      }),
      prisma.expense.count({ where: { userId } })
    ]);

    // Calculate debt information
    // Get all active users for fair share calculation
    const allUsers = await prisma.user.findMany({
      where: { isDeleted: false },
      select: { id: true }
    });
    
    // Get all expenses with splits
    const allExpenses = await prisma.expense.findMany({
      where: { isDeleted: false },
      include: { splits: true }
    });
    
    // Get all confirmed payments
    const allPayments = await prisma.payment.findMany({
      where: { status: 'confirmed' },
      select: { fromUserId: true, toUserId: true, amount: true }
    });

    // Calculate what this user owes to others (their debt)
    let userTotalDebt = 0;
    
    // Calculate what they owe each person
    const userDebts: { [key: string]: number } = {};
    
    for (const otherUser of allUsers) {
      if (otherUser.id === userId) continue;
      
      // Amount userId owes to otherUser (from otherUser's expenses that userId was split into)
      let owes = 0;
      for (const expense of allExpenses) {
        if (expense.userId === otherUser.id) {
          const split = expense.splits.find(s => s.userId === userId);
          if (split) owes += split.amount;
        }
      }
      
      // Amount otherUser owes to userId (from userId's expenses)
      let owed = 0;
      for (const expense of allExpenses) {
        if (expense.userId === userId) {
          const split = expense.splits.find(s => s.userId === otherUser.id);
          if (split) owed += split.amount;
        }
      }
      
      // Factor in payments
      const paidToOther = allPayments
        .filter(p => p.fromUserId === userId && p.toUserId === otherUser.id)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const receivedFromOther = allPayments
        .filter(p => p.fromUserId === otherUser.id && p.toUserId === userId)
        .reduce((sum, p) => sum + p.amount, 0);
      
      // Net: positive = userId owes otherUser, negative = otherUser owes userId
      const netWithOther = owes - owed - paidToOther + receivedFromOther;
      userDebts[otherUser.id] = netWithOther;
      
      if (netWithOther > 0) {
        userTotalDebt += netWithOther;
      }
    }

    // If checking another user, also calculate debt between current user and target user
    let debtToCurrentUser = 0;  // What userId owes to currentUser
    let currentUserDebt = 0;    // What currentUser owes to userId
    
    if (userId !== currentUserId) {
      const netWithCurrent = userDebts[currentUserId] || 0;
      if (netWithCurrent > 0) {
        // userId owes currentUser
        debtToCurrentUser = netWithCurrent;
      } else if (netWithCurrent < 0) {
        // currentUser owes userId
        currentUserDebt = -netWithCurrent;
      }
    }

    res.json({
      totalExpenses: totalExpenses._sum.amount || 0,
      totalPaymentsMade: totalPaymentsMade._sum.amount || 0,
      totalPaymentsReceived: totalPaymentsReceived._sum.amount || 0,
      expenseCount,
      // Debt information
      userTotalDebt: Math.round(userTotalDebt * 100) / 100,
      debtToCurrentUser: Math.round(debtToCurrentUser * 100) / 100,
      currentUserDebt: Math.round(currentUserDebt * 100) / 100
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

// Delete user (admin only, only when no outstanding balances)
// Performs soft delete and locks associated records
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.id;

    // Cannot delete yourself
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Check if user exists and is not already deleted
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToDelete.isDeleted) {
      return res.status(400).json({ error: 'User is already deleted' });
    }

    // Get all other active users to calculate balances
    const otherUsers = await prisma.user.findMany({
      where: { id: { not: userId }, isDeleted: false },
      select: { id: true }
    });

    // Check balance with each user
    for (const otherUser of otherUsers) {
      // Get expense splits where this user owes otherUser
      const expensesOtherPaidFor = await prisma.expense.findMany({
        where: { userId: otherUser.id },
        include: { splits: true }
      });
      
      const expensesThisUserPaidFor = await prisma.expense.findMany({
        where: { userId: userId },
        include: { splits: true }
      });

      // Amount this user owes otherUser
      let thisUserOwes = 0;
      for (const expense of expensesOtherPaidFor) {
        const split = expense.splits.find(s => s.userId === userId);
        if (split) {
          thisUserOwes += split.amount;
        }
      }

      // Amount otherUser owes this user
      let otherUserOwes = 0;
      for (const expense of expensesThisUserPaidFor) {
        const split = expense.splits.find(s => s.userId === otherUser.id);
        if (split) {
          otherUserOwes += split.amount;
        }
      }

      // Factor in confirmed payments
      const [paidToOther, receivedFromOther] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            fromUserId: userId,
            toUserId: otherUser.id,
            status: 'confirmed'
          },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: {
            fromUserId: otherUser.id,
            toUserId: userId,
            status: 'confirmed'
          },
          _sum: { amount: true }
        })
      ]);

      const paid = paidToOther._sum.amount || 0;
      const received = receivedFromOther._sum.amount || 0;

      // Net balance calculation
      const netBalance = thisUserOwes - otherUserOwes - paid + received;

      // If there's any outstanding balance (either way), block deletion
      if (Math.abs(netBalance) > 0.01) {
        return res.status(400).json({ 
          error: 'Cannot delete user with outstanding balances. All debts must be settled first.' 
        });
      }
    }

    // Check for pending payments
    const pendingPayments = await prisma.payment.count({
      where: {
        OR: [
          { fromUserId: userId, status: 'pending' },
          { toUserId: userId, status: 'pending' }
        ]
      }
    });

    if (pendingPayments > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with pending payments. Please confirm or reject all pending payments first.' 
      });
    }

    // All checks passed - perform soft delete and lock associated records
    await prisma.$transaction(async (tx) => {
      // Lock all expenses where this user is the primary payer
      await tx.expense.updateMany({ 
        where: { userId }, 
        data: { isLocked: true } 
      });
      
      // Lock all expenses where this user has a split
      const expensesWithSplits = await tx.expenseSplit.findMany({
        where: { userId },
        select: { expenseId: true }
      });
      if (expensesWithSplits.length > 0) {
        await tx.expense.updateMany({
          where: { id: { in: expensesWithSplits.map(e => e.expenseId) } },
          data: { isLocked: true }
        });
      }
      
      // Lock all payments involving this user
      await tx.payment.updateMany({ 
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        data: { isLocked: true }
      });
      
      // Delete refresh tokens (these can be hard deleted)
      await tx.refreshToken.deleteMany({ where: { userId } });
      
      // Delete delete requests (these can be hard deleted)
      await tx.deleteRequest.deleteMany({ 
        where: { OR: [{ requestedById: userId }, { approvedById: userId }] } 
      });
      
      // Delete recurring expenses (since they're for future, no need to keep)
      await tx.recurringExpense.deleteMany({ where: { userId } });
      
      // Delete split bill items (part of split bill process, not historical)
      await tx.splitBillItem.deleteMany({ where: { userId } });
      
      // Soft delete the user - mark as deleted but keep the record
      await tx.user.update({ 
        where: { id: userId },
        data: { 
          isDeleted: true,
          deletedAt: new Date(),
          // Scramble credentials so they can't log in
          password: 'DELETED',
          email: `deleted_${userId}@deleted.local`,
          username: `deleted_${userId}`
        }
      });
    });

    res.json({ message: 'User deleted successfully. Associated records have been locked for historical reference.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
