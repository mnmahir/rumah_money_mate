import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Export all data to JSON
router.get('/json', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [users, categories, expenses, payments, splitBills] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          isAdmin: true,
          bankName: true,
          bankAccountNo: true,
          bankAccountName: true,
          createdAt: true
        }
      }),
      prisma.category.findMany(),
      prisma.expense.findMany({
        include: {
          user: { select: { id: true, displayName: true } },
          category: { select: { id: true, name: true } }
        }
      }),
      prisma.payment.findMany({
        include: {
          fromUser: { select: { id: true, displayName: true } },
          toUser: { select: { id: true, displayName: true } }
        }
      }),
      prisma.splitBill.findMany({
        include: {
          items: {
            include: {
              user: { select: { id: true, displayName: true } }
            }
          }
        }
      })
    ]);

    const data = {
      exportDate: new Date().toISOString(),
      users,
      categories,
      expenses,
      payments,
      splitBills
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=house-finance-export-${new Date().toISOString().split('T')[0]}.json`);
    res.json(data);
  } catch (error) {
    console.error('Export JSON error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Export expenses to CSV
router.get('/expenses/csv', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        user: { select: { displayName: true } },
        category: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });

    const headers = ['ID', 'Date', 'Description', 'Amount', 'Category', 'User', 'Notes', 'Has Receipt', 'Created At'];
    const rows = expenses.map(e => [
      e.id,
      e.date.toISOString().split('T')[0],
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount.toFixed(2),
      e.category?.name || 'No Category',
      e.user.displayName,
      e.notes ? `"${e.notes.replace(/"/g, '""')}"` : '',
      e.receiptImage ? 'Yes' : 'No',
      e.createdAt.toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expenses-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export expenses CSV error:', error);
    res.status(500).json({ error: 'Failed to export expenses' });
  }
});

// Export payments to CSV
router.get('/payments/csv', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        fromUser: { select: { displayName: true } },
        toUser: { select: { displayName: true } }
      },
      orderBy: { date: 'desc' }
    });

    const headers = ['ID', 'Date', 'From', 'To', 'Amount', 'Description', 'Status', 'Has Receipt', 'Created At'];
    const rows = payments.map(p => [
      p.id,
      p.date.toISOString().split('T')[0],
      p.fromUser.displayName,
      p.toUser.displayName,
      p.amount.toFixed(2),
      p.description ? `"${p.description.replace(/"/g, '""')}"` : '',
      p.status,
      p.receiptImage ? 'Yes' : 'No',
      p.createdAt.toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payments-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export payments CSV error:', error);
    res.status(500).json({ error: 'Failed to export payments' });
  }
});

// Import data from JSON (admin only)
router.post('/import', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { categories, expenses } = req.body;

    let importedCategories = 0;
    let importedExpenses = 0;

    // Import categories
    if (categories && Array.isArray(categories)) {
      for (const cat of categories) {
        try {
          await prisma.category.upsert({
            where: { name: cat.name },
            update: { icon: cat.icon, color: cat.color },
            create: { name: cat.name, icon: cat.icon, color: cat.color }
          });
          importedCategories++;
        } catch (e) {
          console.error('Failed to import category:', cat.name);
        }
      }
    }

    // Import expenses (simplified - associates with current user if user doesn't exist)
    if (expenses && Array.isArray(expenses)) {
      for (const exp of expenses) {
        try {
          // Find or use current user
          let userId = req.user!.id;
          if (exp.userId) {
            const user = await prisma.user.findUnique({ where: { id: exp.userId } });
            if (user) userId = user.id;
          }

          // Find category
          let categoryId = null;
          if (exp.categoryId) {
            const cat = await prisma.category.findUnique({ where: { id: exp.categoryId } });
            if (cat) categoryId = cat.id;
          } else if (exp.category?.name) {
            const cat = await prisma.category.findUnique({ where: { name: exp.category.name } });
            if (cat) categoryId = cat.id;
          }

          await prisma.expense.create({
            data: {
              description: exp.description,
              amount: parseFloat(exp.amount),
              date: new Date(exp.date),
              notes: exp.notes,
              userId,
              categoryId
            }
          });
          importedExpenses++;
        } catch (e) {
          console.error('Failed to import expense:', exp.description);
        }
      }
    }

    res.json({
      message: 'Import completed',
      imported: {
        categories: importedCategories,
        expenses: importedExpenses
      }
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Import from CSV (admin only)
router.post('/import/csv', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { csv, type = 'expenses' } = req.body;

    if (!csv) {
      return res.status(400).json({ error: 'CSV data required' });
    }

    const lines = csv.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header and at least one data row' });
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      headers.forEach((h: string, idx: number) => {
        row[h] = values[idx]?.trim();
      });

      try {
        if (type === 'expenses') {
          let categoryId = null;
          if (row.category) {
            const cat = await prisma.category.findUnique({ where: { name: row.category } });
            if (cat) categoryId = cat.id;
          }

          await prisma.expense.create({
            data: {
              description: row.description || 'Imported expense',
              amount: parseFloat(row.amount) || 0,
              date: row.date ? new Date(row.date) : new Date(),
              notes: row.notes,
              userId: req.user!.id,
              categoryId
            }
          });
          imported++;
        }
      } catch (e) {
        console.error('Failed to import row:', i);
      }
    }

    res.json({
      message: `Imported ${imported} ${type}`,
      imported
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

export default router;
