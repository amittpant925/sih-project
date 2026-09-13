import mongoose from 'mongoose';

const { Schema } = mongoose;

const checkpointSchema = new Schema({
  stage: { type: String, enum: ['harvested', 'packed', 'in-transit', 'at-hub', 'out-for-delivery', 'delivered'], required: true },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  location: { type: String, trim: true, maxlength: 240, default: '' },
  notes: { type: String, trim: true, maxlength: 400, default: '' },
  recordedAt: { type: Date, default: Date.now },
}, { _id: false });

const harvestBatchSchema = new Schema({
  batchId: { type: String, required: true, unique: true, index: true, trim: true, maxlength: 80 },
  farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  listing: { type: Schema.Types.ObjectId, ref: 'Listing' },
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  produce: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, trim: true, maxlength: 80, default: 'Produce' },
  qualityGrade: { type: String, enum: ['A+', 'A', 'B', 'C'], required: true, index: true },
  harvestDate: { type: Date, required: true, index: true },
  quantityKg: { type: Number, min: 0.01 },
  farmLocationGps: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  farmAddress: { type: String, trim: true, maxlength: 240, default: '' },
  signedPayload: { type: Schema.Types.Mixed, required: true },
  signature: { type: String, required: true },
  qrDataUrl: { type: String, required: true },
  verifyUrl: { type: String, required: true },
  status: { type: String, enum: ['active', 'in-transit', 'delivered', 'recalled'], default: 'active', index: true },
  history: { type: [checkpointSchema], default: [] },
}, { timestamps: true });

harvestBatchSchema.index({ farmer: 1, harvestDate: -1 });

export const HarvestBatch = mongoose.models.HarvestBatch || mongoose.model('HarvestBatch', harvestBatchSchema);
