import { Router } from 'express';
import { createBatch, verifyBatch } from '../controllers/batchController.js';

export default function batchRouter({ requireAuth, requireRole, asyncRoute }) {
  const router = Router();
  router.get('/verify-batch/:batchId', asyncRoute(verifyBatch));
  router.post('/batches', requireAuth, requireRole('farmer'), asyncRoute(createBatch));
  return router;
}
