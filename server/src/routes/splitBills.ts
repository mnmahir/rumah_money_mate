import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { upload, getUploadPath } from '../middleware/upload';

const router = Router();

// Calculate split bill (preview without saving)
router.post('/calculate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { items, taxAmount = 0, serviceCharge = 0, taxPercent, servicePercent, subtotalOverride } = req.body;

    const userTotals: { [key: string]: { userId: string; subtotal: number; tax: number; service: number; total: number } } = {};
    
    items.forEach((item: any) => {
      if (!userTotals[item.userId]) {
        userTotals[item.userId] = {
          userId: item.userId,
          subtotal: 0,
          tax: 0,
          service: 0,
          total: 0
        };
      }
      userTotals[item.userId].subtotal += parseFloat(item.amount) * (parseInt(item.quantity) || 1);
    });

    const subtotal = subtotalOverride ? parseFloat(subtotalOverride) : Object.values(userTotals).reduce((sum, ut) => sum + ut.subtotal, 0);
    
    // Calculate tax and service - support both fixed amount and percentage
    let actualTax = parseFloat(taxAmount) || 0;
    let actualService = parseFloat(serviceCharge) || 0;
    
    if (taxPercent) {
      actualTax = subtotal * (parseFloat(taxPercent) / 100);
    }
    if (servicePercent) {
      actualService = subtotal * (parseFloat(servicePercent) / 100);
    }

    const taxRate = subtotal > 0 ? actualTax / subtotal : 0;
    const serviceRate = subtotal > 0 ? actualService / subtotal : 0;

    Object.values(userTotals).forEach(ut => {
      ut.tax = ut.subtotal * taxRate;
      ut.service = ut.subtotal * serviceRate;
      ut.total = ut.subtotal + ut.tax + ut.service;
    });

    // Get user details
    const userIds = Object.keys(userTotals);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });

    const result = Object.values(userTotals).map(ut => ({
      ...ut,
      user: users.find(u => u.id === ut.userId)
    }));

    res.json({
      subtotal,
      taxAmount: actualTax,
      taxPercent: taxPercent || null,
      serviceCharge: actualService,
      servicePercent: servicePercent || null,
      total: subtotal + actualTax + actualService,
      userBreakdown: result
    });
  } catch (error) {
    console.error('Calculate split bill error:', error);
    res.status(500).json({ error: 'Failed to calculate split bill' });
  }
});

// Create expenses from split bill calculation (single grouped record with splits)
router.post('/create-expenses', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
  try {
    const { title, items, taxAmount = 0, serviceCharge = 0, taxPercent, servicePercent, categoryId, date, notes } = req.body;

    // Parse items if it's a string
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    const receiptImage = req.file ? getUploadPath(req.file.filename, 'receipts') : null;

    // Calculate user totals
    const userTotals: { [key: string]: number } = {};
    
    parsedItems.forEach((item: any) => {
      if (!userTotals[item.userId]) {
        userTotals[item.userId] = 0;
      }
      userTotals[item.userId] += parseFloat(item.amount) * (parseInt(item.quantity) || 1);
    });

    const subtotal = Object.values(userTotals).reduce((sum, val) => sum + val, 0);

    // Calculate tax and service - support both fixed amount and percentage
    let actualTax = parseFloat(taxAmount) || 0;
    let actualService = parseFloat(serviceCharge) || 0;
    
    if (taxPercent) {
      actualTax = subtotal * (parseFloat(taxPercent) / 100);
    }
    if (servicePercent) {
      actualService = subtotal * (parseFloat(servicePercent) / 100);
    }

    const taxRate = subtotal > 0 ? actualTax / subtotal : 0;
    const serviceRate = subtotal > 0 ? actualService / subtotal : 0;
    const grandTotal = subtotal + actualTax + actualService;

    // Calculate each user's total (their portion of subtotal + proportional tax + service)
    const userSplits = Object.entries(userTotals).map(([userId, userSubtotal]) => {
      const userTax = userSubtotal * taxRate;
      const userService = userSubtotal * serviceRate;
      const total = Math.round((userSubtotal + userTax + userService) * 100) / 100;
      return { userId, amount: total };
    });

    // Create a single expense with splits (assigned to the first user/creator)
    const primaryUserId = req.user!.id;
    
    const expense = await prisma.expense.create({
      data: {
        description: title,
        amount: Math.round(grandTotal * 100) / 100,
        date: date ? new Date(date) : new Date(),
        receiptImage,
        notes: notes || `Split bill - ${userSplits.length} people`,
        userId: primaryUserId,
        createdById: req.user!.id,
        categoryId: categoryId || null,
        splits: {
          create: userSplits.map(s => ({
            userId: s.userId,
            amount: s.amount
          }))
        }
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        category: {
          select: { id: true, name: true, icon: true, color: true }
        },
        splits: true
      }
    });

    res.status(201).json({
      message: `Created expense with ${userSplits.length} splits`,
      expense,
      summary: {
        title,
        subtotal,
        taxAmount: actualTax,
        serviceCharge: actualService,
        total: grandTotal
      }
    });
  } catch (error) {
    console.error('Create expenses from split error:', error);
    res.status(500).json({ error: 'Failed to create expenses from split bill' });
  }
});

// Quick split - split a total amount equally among users (single grouped record)
router.post('/quick-split', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
  try {
    const { description, totalAmount, taxAmount = 0, serviceCharge = 0, taxPercent, servicePercent, userIds, categoryId, date, notes } = req.body;

    // Parse userIds if it's a string
    const parsedUserIds: string[] = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;

    if (!parsedUserIds || parsedUserIds.length === 0) {
      return res.status(400).json({ error: 'At least one user is required' });
    }

    const receiptImage = req.file ? getUploadPath(req.file.filename, 'receipts') : null;

    const subtotal = parseFloat(totalAmount);

    // Calculate tax and service
    let actualTax = parseFloat(taxAmount) || 0;
    let actualService = parseFloat(serviceCharge) || 0;
    
    if (taxPercent) {
      actualTax = subtotal * (parseFloat(taxPercent) / 100);
    }
    if (servicePercent) {
      actualService = subtotal * (parseFloat(servicePercent) / 100);
    }

    const grandTotal = subtotal + actualTax + actualService;
    
    // Calculate per person with smart rounding (first person gets remainder)
    const perPerson = Math.floor((grandTotal / parsedUserIds.length) * 100) / 100;
    const totalOthers = perPerson * (parsedUserIds.length - 1);
    const firstPersonAmount = Math.round((grandTotal - totalOthers) * 100) / 100;

    // Create splits array
    const userSplits = parsedUserIds.map((userId, idx) => ({
      userId,
      amount: idx === 0 ? firstPersonAmount : perPerson
    }));

    // Create a single expense with splits (assigned to first user or creator)
    const primaryUserId = parsedUserIds.includes(req.user!.id) ? req.user!.id : parsedUserIds[0];
    
    const expense = await prisma.expense.create({
      data: {
        description: description,
        amount: Math.round(grandTotal * 100) / 100,
        date: date ? new Date(date) : new Date(),
        receiptImage,
        notes: notes || `Equal split among ${parsedUserIds.length} people`,
        userId: primaryUserId,
        createdById: req.user!.id,
        categoryId: categoryId || null,
        splits: {
          create: userSplits.map(s => ({
            userId: s.userId,
            amount: s.amount
          }))
        }
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        category: {
          select: { id: true, name: true, icon: true, color: true }
        },
        splits: true
      }
    });

    res.status(201).json({
      message: `Created expense with ${parsedUserIds.length} equal splits`,
      expense,
      summary: {
        description,
        subtotal,
        taxAmount: actualTax,
        serviceCharge: actualService,
        total: grandTotal,
        perPerson,
        numberOfPeople: parsedUserIds.length
      }
    });
  } catch (error) {
    console.error('Quick split error:', error);
    res.status(500).json({ error: 'Failed to create quick split' });
  }
});

export default router;
