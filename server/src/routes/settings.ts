import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Default settings
const DEFAULT_SETTINGS: Record<string, string> = {
  currency: 'RM',
  waterUnit: 'm³',
  electricityUnit: 'kWh',
  allowUserSelfDelete: 'false',  // Allow users to delete their own records (default: disabled)
  autoAcceptPayments: 'true',    // Auto-accept payments when made (default: enabled)
  requirePaymentReceipt: 'true', // Require receipt upload for payments (default: required)
};

// Get all settings (anyone can view)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.settings.findMany();
    
    // Create a map of settings with defaults
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
    
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    res.json(settingsMap);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updates = req.body;

    // Validate that only allowed keys are being updated
    const allowedKeys = Object.keys(DEFAULT_SETTINGS);
    
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) {
        continue; // Skip unknown keys
      }

      await prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    // Return updated settings
    const settings = await prisma.settings.findMany();
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
    
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    res.json(settingsMap);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get a single setting value
router.get('/:key', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { key } = req.params;
    
    const setting = await prisma.settings.findUnique({
      where: { key },
    });

    const value = setting?.value || DEFAULT_SETTINGS[key] || null;
    
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key, value });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

export default router;
