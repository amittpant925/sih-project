import mongoose from 'mongoose';
import { Bid, CART_RESERVATION_MS, CartReservation, Listing } from '../models/marketplace.js';

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function toNumber(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function sellerTypeForRole(role) {
  return role === 'farmer' ? 'farmer' : 'fpo';
}

export async function releaseExpiredReservations(session) {
  const now = new Date();
  const expired = await CartReservation.find({ status: 'active', expiresAt: { $lte: now } }).session(session || null);
  for (const reservation of expired) {
    await Listing.updateOne(
      { _id: reservation.listing, reservedQuantityKg: { $gte: reservation.quantityKg } },
      { $inc: { availableQuantityKg: reservation.quantityKg, reservedQuantityKg: -reservation.quantityKg } },
      session ? { session } : {},
    );
    reservation.status = 'expired';
    await reservation.save(session ? { session } : {});
  }
  return expired.length;
}

function validateFixedPrice(body) {
  const pricePerKg = toNumber(body.pricePerKg);
  const totalQuantityKg = toNumber(body.totalQuantityKg);
  const minOrderQuantityKg = toNumber(body.minOrderQuantityKg, 1);
  if (!(pricePerKg > 0)) throw httpError('Fixed-price listings require a pricePerKg greater than 0');
  if (!(totalQuantityKg > 0)) throw httpError('Fixed-price listings require totalQuantityKg greater than 0');
  if (!(minOrderQuantityKg > 0)) throw httpError('minOrderQuantityKg must be greater than 0');
  return { pricePerKg, totalQuantityKg, minOrderQuantityKg };
}

function validateAuction(body) {
  const totalQuantityKg = toNumber(body.totalQuantityKg);
  const startingPricePerKg = toNumber(body.startingPricePerKg);
  const minIncrementPerKg = toNumber(body.minIncrementPerKg);
  const reservePricePerKg = toNumber(body.reservePricePerKg, startingPricePerKg);
  const auctionEndsAt = body.auctionEndsAt ? new Date(body.auctionEndsAt) : null;
  const auctionStartsAt = body.auctionStartsAt ? new Date(body.auctionStartsAt) : new Date();
  if (!(totalQuantityKg > 0)) throw httpError('Auction listings require totalQuantityKg greater than 0');
  if (!(startingPricePerKg >= 0)) throw httpError('Auction listings require a startingPricePerKg');
  if (!(minIncrementPerKg > 0)) throw httpError('Auction listings require a minIncrementPerKg greater than 0');
  if (!(reservePricePerKg >= 0)) throw httpError('Auction listings require a reservePricePerKg');
  if (!auctionEndsAt || Number.isNaN(auctionEndsAt.getTime())) throw httpError('Auction listings require a valid auctionEndsAt');
  if (auctionEndsAt <= auctionStartsAt) throw httpError('auctionEndsAt must be after auctionStartsAt');
  if (auctionEndsAt <= new Date()) throw httpError('auctionEndsAt must be in the future');
  return { totalQuantityKg, startingPricePerKg, minIncrementPerKg, reservePricePerKg, auctionStartsAt, auctionEndsAt };
}

export async function createListing(request, response) {
  const body = request.body || {};
  const transactionModel = body.transactionModel === 'auction' ? 'auction' : body.transactionModel === 'fixed-price' ? 'fixed-price' : null;
  if (!transactionModel) throw httpError('transactionModel must be fixed-price or auction');

  const title = String(body.title || '').trim();
  const produce = String(body.produce || body.name || '').trim();
  const category = String(body.category || '').trim();
  if (!title || !produce || !category) throw httpError('title, produce, and category are required');

  const common = {
    seller: request.auth.sub,
    sellerType: body.sellerType === 'fpo' ? 'fpo' : sellerTypeForRole(request.auth.role),
    transactionModel,
    title,
    produce,
    category,
    description: String(body.description || '').trim(),
    images: Array.isArray(body.images) ? body.images.slice(0, 8) : [],
    harvestDate: body.harvestDate ? new Date(body.harvestDate) : undefined,
    organic: Boolean(body.organic),
    unit: 'kg',
    status: 'active',
  };

  let listing;
  if (transactionModel === 'fixed-price') {
    const { pricePerKg, totalQuantityKg, minOrderQuantityKg } = validateFixedPrice(body);
    listing = await Listing.create({
      ...common,
      totalQuantityKg,
      availableQuantityKg: totalQuantityKg,
      reservedQuantityKg: 0,
      minOrderQuantityKg,
      pricePerKg,
    });
  } else {
    const auction = validateAuction(body);
    listing = await Listing.create({
      ...common,
      sellerType: 'fpo',
      totalQuantityKg: auction.totalQuantityKg,
      availableQuantityKg: auction.totalQuantityKg,
      reservedQuantityKg: 0,
      minOrderQuantityKg: auction.totalQuantityKg,
      startingPricePerKg: auction.startingPricePerKg,
      currentBidPerKg: auction.startingPricePerKg,
      minIncrementPerKg: auction.minIncrementPerKg,
      reservePricePerKg: auction.reservePricePerKg,
      auctionStartsAt: auction.auctionStartsAt,
      auctionEndsAt: auction.auctionEndsAt,
      bidCount: 0,
      reserveMet: auction.startingPricePerKg >= auction.reservePricePerKg,
    });
  }

  response.status(201).json({ listing });
}

export async function listActiveAuctions(_request, response) {
  const now = new Date();
  await Listing.updateMany(
    { transactionModel: 'auction', status: 'active', auctionEndsAt: { $lte: now }, reserveMet: true, highestBidder: { $ne: null } },
    { $set: { status: 'sold' } },
  );
  await Listing.updateMany(
    { transactionModel: 'auction', status: 'active', auctionEndsAt: { $lte: now } },
    { $set: { status: 'ended' } },
  );

  const listings = await Listing.find({
    transactionModel: 'auction',
    status: 'active',
    auctionStartsAt: { $lte: now },
    auctionEndsAt: { $gt: now },
    availableQuantityKg: { $gt: 0 },
  })
    .populate('seller', 'name role location')
    .populate('highestBidder', 'name')
    .sort({ auctionEndsAt: 1 })
    .limit(100);

  response.json({ listings, generatedAt: now.toISOString() });
}

export async function placeBid(request, response) {
  const listingId = request.body?.listingId || request.body?.listing;
  const amountPerKg = toNumber(request.body?.amountPerKg);
  if (!listingId || !mongoose.isValidObjectId(listingId)) throw httpError('A valid listingId is required');
  if (!(amountPerKg > 0)) throw httpError('amountPerKg must be greater than 0');

  const session = await mongoose.startSession();
  let bid;
  let listing;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      listing = await Listing.findOne({ _id: listingId, transactionModel: 'auction' }).session(session);
      if (!listing) throw httpError('Auction listing not found', 404);
      if (String(listing.seller) === String(request.auth.sub)) throw httpError('Sellers cannot bid on their own harvest', 403);
      if (listing.status !== 'active') throw httpError('This auction is no longer accepting bids', 409);
      if (listing.auctionStartsAt && listing.auctionStartsAt > now) throw httpError('This auction has not started yet', 409);
      if (listing.auctionEndsAt <= now) {
        listing.status = listing.reserveMet && listing.highestBidder ? 'sold' : 'ended';
        await listing.save({ session });
        throw httpError('This auction has ended', 409);
      }

      const minimumBid = roundMoney((listing.currentBidPerKg || listing.startingPricePerKg || 0) + (listing.bidCount > 0 ? listing.minIncrementPerKg : 0));
      if (amountPerKg < minimumBid) throw httpError(`Bid must be at least ₹${minimumBid} per kg`);

      if (listing.highestBidder) {
        await Bid.updateMany(
          { listing: listing._id, status: { $in: ['active', 'winning'] } },
          { $set: { status: 'outbid', isWinning: false } },
          { session },
        );
      }

      const quantityKg = listing.totalQuantityKg;
      [bid] = await Bid.create([{
        listing: listing._id,
        bidder: request.auth.sub,
        amountPerKg,
        quantityKg,
        totalAmount: roundMoney(amountPerKg * quantityKg),
        isWinning: true,
        status: 'winning',
      }], { session });

      listing.currentBidPerKg = amountPerKg;
      listing.highestBidder = request.auth.sub;
      listing.winningBid = bid._id;
      listing.bidCount += 1;
      listing.reserveMet = amountPerKg >= listing.reservePricePerKg;

      const remainingMs = listing.auctionEndsAt.getTime() - now.getTime();
      if (remainingMs <= listing.antiSnipeExtensionMs) {
        listing.auctionEndsAt = new Date(now.getTime() + listing.antiSnipeExtensionMs);
      }

      await listing.save({ session });
    });
  } finally {
    await session.endSession();
  }

  response.status(201).json({
    bid,
    listing: {
      id: listing.id,
      currentBidPerKg: listing.currentBidPerKg,
      reserveMet: listing.reserveMet,
      auctionEndsAt: listing.auctionEndsAt,
      bidCount: listing.bidCount,
    },
  });
}

export async function reserveFixedPrice(request, response) {
  const listingId = request.body?.listingId || request.body?.listing;
  const quantityKg = toNumber(request.body?.quantityKg);
  if (!listingId || !mongoose.isValidObjectId(listingId)) throw httpError('A valid listingId is required');
  if (!(quantityKg > 0)) throw httpError('quantityKg must be greater than 0');

  const session = await mongoose.startSession();
  let reservation;
  let listing;
  try {
    await session.withTransaction(async () => {
      await releaseExpiredReservations(session);
      listing = await Listing.findOne({ _id: listingId, transactionModel: 'fixed-price' }).session(session);
      if (!listing) throw httpError('Fixed-price listing not found', 404);
      if (String(listing.seller) === String(request.auth.sub)) throw httpError('Sellers cannot reserve their own harvest', 403);
      if (!['active', 'reserved'].includes(listing.status)) throw httpError('This listing is not available for purchase', 409);
      if (quantityKg < listing.minOrderQuantityKg) throw httpError(`Minimum order is ${listing.minOrderQuantityKg} kg`);
      if (listing.availableQuantityKg < quantityKg) throw httpError('Requested quantity is not available', 409);

      listing.availableQuantityKg = roundMoney(listing.availableQuantityKg - quantityKg);
      listing.reservedQuantityKg = roundMoney(listing.reservedQuantityKg + quantityKg);
      listing.status = listing.availableQuantityKg === 0 ? 'reserved' : 'active';
      await listing.save({ session });

      [reservation] = await CartReservation.create([{
        listing: listing._id,
        buyer: request.auth.sub,
        quantityKg,
        pricePerKg: listing.pricePerKg,
        subtotal: roundMoney(listing.pricePerKg * quantityKg),
        expiresAt: new Date(Date.now() + CART_RESERVATION_MS),
        status: 'active',
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  response.status(201).json({ reservation, listing });
}

export async function purchaseFixedPrice(request, response) {
  const reservationId = request.body?.reservationId;
  const listingId = request.body?.listingId || request.body?.listing;
  const quantityKg = toNumber(request.body?.quantityKg);
  const Order = mongoose.model('Order');

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      await releaseExpiredReservations(session);
      let reservation;
      let listing;
      let kg;
      let pricePerKg;

      if (reservationId) {
        if (!mongoose.isValidObjectId(reservationId)) throw httpError('A valid reservationId is required');
        reservation = await CartReservation.findOne({ _id: reservationId, buyer: request.auth.sub, status: 'active' }).session(session);
        if (!reservation) throw httpError('Active reservation not found', 404);
        if (reservation.expiresAt <= new Date()) throw httpError('Reservation expired. Stock has been released.', 409);
        listing = await Listing.findById(reservation.listing).session(session);
        if (!listing) throw httpError('Listing not found', 404);
        kg = reservation.quantityKg;
        pricePerKg = reservation.pricePerKg;
        reservation.status = 'converted';
        await reservation.save({ session });
        listing.reservedQuantityKg = roundMoney(Math.max(0, listing.reservedQuantityKg - kg));
      } else {
        if (!listingId || !mongoose.isValidObjectId(listingId)) throw httpError('A valid listingId is required');
        if (!(quantityKg > 0)) throw httpError('quantityKg must be greater than 0');
        listing = await Listing.findOne({ _id: listingId, transactionModel: 'fixed-price' }).session(session);
        if (!listing) throw httpError('Fixed-price listing not found', 404);
        if (listing.availableQuantityKg < quantityKg) throw httpError('Requested quantity is not available', 409);
        listing.availableQuantityKg = roundMoney(listing.availableQuantityKg - quantityKg);
        kg = quantityKg;
        pricePerKg = listing.pricePerKg;
      }

      if (listing.availableQuantityKg === 0 && listing.reservedQuantityKg === 0) listing.status = 'sold';
      else if (listing.availableQuantityKg === 0) listing.status = 'reserved';
      else listing.status = 'active';
      await listing.save({ session });

      const subtotal = roundMoney(pricePerKg * kg);
      [order] = await Order.create([{
        customer: request.auth.sub,
        farmer: listing.seller,
        items: [{ product: listing._id, name: listing.title, quantity: kg, unit: 'kg', price: pricePerKg }],
        subtotal,
        deliveryMethod: request.body?.deliveryMethod || 'pickup',
        deliveryFee: 0,
        total: subtotal,
        paymentMethod: 'upi',
        paymentStatus: request.body?.paymentStatus || 'pending',
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  response.status(201).json({ order });
}

export async function getListing(request, response) {
  await releaseExpiredReservations();
  const listing = await Listing.findById(request.params.id)
    .populate('seller', 'name role location')
    .populate('highestBidder', 'name');
  if (!listing) throw httpError('Listing not found', 404);
  const bids = listing.transactionModel === 'auction'
    ? await Bid.find({ listing: listing._id }).populate('bidder', 'name').sort({ amountPerKg: -1, createdAt: -1 }).limit(25)
    : [];
  response.json({ listing, bids });
}
