import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all pending delete requests (admin only)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const where = req.user!.isAdmin 
      ? {} 
      : { requestedById: req.user!.id };

    const requests = await prisma.deleteRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        approvedBy: {
          select: { id: true, username: true, displayName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch the actual records for each request
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        let record = null;
        if (request.recordType === 'expense') {
          record = await prisma.expense.findUnique({
            where: { id: request.recordId },
            include: {
              user: { select: { id: true, username: true, displayName: true } },
              category: { select: { id: true, name: true, icon: true } }
            }
          });
        } else if (request.recordType === 'payment') {
          record = await prisma.payment.findUnique({
            where: { id: request.recordId },
            include: {
              fromUser: { select: { id: true, username: true, displayName: true } },
              toUser: { select: { id: true, username: true, displayName: true } }
            }
          });
        }
        return { ...request, record };
      })
    );

    res.json(enrichedRequests);
  } catch (error) {
    console.error('Get delete requests error:', error);
    res.status(500).json({ error: 'Failed to fetch delete requests' });
  }
});

// Create delete request (non-admin for their own records)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { recordType, recordId, reason } = req.body;

    // Validate record type
    if (!['expense', 'payment'].includes(recordType)) {
      return res.status(400).json({ error: 'Invalid record type' });
    }

    // Check if record exists and belongs to user
    let record: any = null;
    if (recordType === 'expense') {
      record = await prisma.expense.findUnique({ where: { id: recordId } });
      if (!record) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      if (record.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: 'You can only request deletion of your own records' });
      }
    } else if (recordType === 'payment') {
      record = await prisma.payment.findUnique({ where: { id: recordId } });
      if (!record) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      if (record.fromUserId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ error: 'You can only request deletion of your own records' });
      }
    }

    // Check for existing pending request
    const existingRequest = await prisma.deleteRequest.findFirst({
      where: {
        recordType,
        recordId,
        status: 'pending'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'A delete request already exists for this record' });
    }

    // If user is admin, delete directly
    if (req.user!.isAdmin) {
      if (recordType === 'expense') {
        await prisma.expense.delete({ where: { id: recordId } });
      } else if (recordType === 'payment') {
        await prisma.payment.delete({ where: { id: recordId } });
      }
      return res.json({ message: 'Record deleted successfully' });
    }

    // Create delete request for non-admin
    const request = await prisma.deleteRequest.create({
      data: {
        recordType,
        recordId,
        reason,
        requestedById: req.user!.id
      },
      include: {
        requestedBy: {
          select: { id: true, username: true, displayName: true }
        }
      }
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Create delete request error:', error);
    res.status(500).json({ error: 'Failed to create delete request' });
  }
});

// Approve delete request (admin only)
router.post('/:id/approve', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Delete request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Delete the actual record
    if (request.recordType === 'expense') {
      await prisma.expense.delete({ where: { id: request.recordId } }).catch(() => {});
    } else if (request.recordType === 'payment') {
      await prisma.payment.delete({ where: { id: request.recordId } }).catch(() => {});
    }

    // Update request status
    const updated = await prisma.deleteRequest.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: req.user!.id
      }
    });

    res.json({ message: 'Delete request approved', request: updated });
  } catch (error) {
    console.error('Approve delete request error:', error);
    res.status(500).json({ error: 'Failed to approve delete request' });
  }
});

// Reject delete request (admin only)
router.post('/:id/reject', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Delete request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Update request status
    const updated = await prisma.deleteRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedById: req.user!.id
      }
    });

    res.json({ message: 'Delete request rejected', request: updated });
  } catch (error) {
    console.error('Reject delete request error:', error);
    res.status(500).json({ error: 'Failed to reject delete request' });
  }
});

// Cancel own delete request
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Delete request not found' });
    }

    if (request.requestedById !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to cancel this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot cancel processed request' });
    }

    await prisma.deleteRequest.delete({ where: { id } });

    res.json({ message: 'Delete request cancelled' });
  } catch (error) {
    console.error('Cancel delete request error:', error);
    res.status(500).json({ error: 'Failed to cancel delete request' });
  }
});

export default router;
