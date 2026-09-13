import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CART_RESERVATION_MS = 10 * 60 * 1000;
export const AUCTION_ANTI_SNIPE_MS = 2 * 60 * 1000;

const listingSchema = new Schema({
  seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sellerType: { type: String, enum: ['farmer', 'fpo'], default: 'farmer', index: true },
  transactionModel: { type: String, enum: ['fixed-price', 'auction'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  produce: { type: String, required: true, trim: true, maxlength: 120, index: true },
  category: { type: String, required: true, trim: true, maxlength: 80, index: true },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  images: { type: [String], default: [] },
  harvestDate: Date,
  organic: { type: Boolean, default: false },
  unit: { type: String, default: 'kg', trim: true, maxlength: 20 },
  totalQuantityKg: { type: Number, required: true, min: 0.01 },
  availableQuantityKg: { type: Number, required: true, min: 0 },
  reservedQuantityKg: { type: Number, default: 0, min: 0 },
  minOrderQuantityKg: { type: Number, default: 1, min: 0.01 },
  pricePerKg: { type: Number, min: 0 },
  startingPricePerKg: { type: Number, min: 0 },
  currentBidPerKg: { type: Number, min: 0, default: 0 },
  minIncrementPerKg: { type: Number, min: 0 },
  reservePricePerKg: { type: Number, min: 0 },
  auctionStartsAt: Date,
  auctionEndsAt: Date,
  antiSnipeExtensionMs: { type: Number, default: AUCTION_ANTI_SNIPE_MS, min: 0 },
  bidCount: { type: Number, default: 0, min: 0 },
  highestBidder: { type: Schema.Types.ObjectId, ref: 'User' },
  winningBid: { type: Schema.Types.ObjectId, ref: 'Bid' },
  reserveMet: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'active', 'reserved', 'sold', 'ended', 'cancelled'], default: 'active', index: true },
}, { timestamps: true });

listingSchema.index({ transactionModel: 1, status: 1, auctionEndsAt: 1 });
listingSchema.index({ produce: 'text', title: 'text', category: 'text' });

listingSchema.virtual('currentPricePerKg').get(function currentPricePerKg() {
  if (this.transactionModel === 'auction') return this.currentBidPerKg || this.startingPricePerKg || 0;
  return this.pricePerKg || 0;
});

listingSchema.virtual('lineTotal').get(function lineTotal() {
  const kg = this.transactionModel === 'auction' ? this.totalQuantityKg : this.availableQuantityKg;
  return Math.round((this.currentPricePerKg || 0) * kg * 100) / 100;
});

listingSchema.set('toJSON', { virtuals: true });
listingSchema.set('toObject', { virtuals: true });

const bidSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  bidder: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amountPerKg: { type: Number, required: true, min: 0 },
  quantityKg: { type: Number, required: true, min: 0.01 },
  totalAmount: { type: Number, required: true, min: 0 },
  isWinning: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['active', 'outbid', 'winning', 'won', 'lost', 'rejected'], default: 'active', index: true },
}, { timestamps: true });

bidSchema.index({ listing: 1, amountPerKg: -1, createdAt: -1 });
bidSchema.index({ listing: 1, bidder: 1, createdAt: -1 });

const cartReservationSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  quantityKg: { type: Number, required: true, min: 0.01 },
  pricePerKg: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['active', 'converted', 'expired', 'released'], default: 'active', index: true },
}, { timestamps: true });

cartReservationSchema.index({ buyer: 1, listing: 1, status: 1 });
cartReservationSchema.index({ expiresAt: 1, status: 1 });

export const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
export const Bid = mongoose.models.Bid || mongoose.model('Bid', bidSchema);
export const CartReservation = mongoose.models.CartReservation || mongoose.model('CartReservation', cartReservationSchema);
