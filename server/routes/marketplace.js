import { Router } from 'express';
import {
  createListing,
  getListing,
  listActiveAuctions,
  placeBid,
  purchaseFixedPrice,
  reserveFixedPrice,
} from '../controllers/marketplaceController.js';

export default function marketplaceRouter({ requireAuth, requireRole, asyncRoute }) {
  const router = Router();

  router.get('/listings/active-auctions', asyncRoute(listActiveAuctions));
  router.get('/listings/:id', asyncRoute(getListing));
  router.post('/listings', requireAuth, requireRole('farmer'), asyncRoute(createListing));
  router.post('/bids', requireAuth, requireRole('household', 'bulk-buyer'), asyncRoute(placeBid));
  router.post('/reservations', requireAuth, requireRole('household', 'bulk-buyer'), asyncRoute(reserveFixedPrice));
  router.post('/listings/:id/reserve', requireAuth, requireRole('household', 'bulk-buyer'), asyncRoute((request, response) => {
    request.body = { ...request.body, listingId: request.params.id };
    return reserveFixedPrice(request, response);
  }));
  router.post('/listings/:id/purchase', requireAuth, requireRole('household', 'bulk-buyer'), asyncRoute((request, response) => {
    request.body = { ...request.body, listingId: request.params.id };
    return purchaseFixedPrice(request, response);
  }));

  return router;
}
