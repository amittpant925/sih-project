import mongoose from 'mongoose';
import { HarvestBatch } from '../models/batch.js';
import { createTrackedBatch, toPublicBatch } from '../services/batchQrService.js';

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function createBatch(request, response) {
  const body = request.body || {};
  const latitude = Number(body.latitude ?? body.farmLocationGps?.latitude);
  const longitude = Number(body.longitude ?? body.farmLocationGps?.longitude);
  const produce = String(body.produce || body.name || '').trim();
  if (!produce) throw httpError('produce is required');

  const User = mongoose.model('User');
  const farmer = await User.findById(request.auth.sub);
  if (!farmer) throw httpError('Farmer not found', 404);

  const farmLocationGps = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : {
      latitude: farmer.location?.coordinates?.[1],
      longitude: farmer.location?.coordinates?.[0],
    };

  const { batch, signed } = await createTrackedBatch({
    farmerId: farmer.id,
    farmLocationGps,
    harvestDate: body.harvestDate,
    qualityGrade: body.qualityGrade,
    produce,
    category: body.category,
    farmAddress: body.farmAddress || farmer.location?.address,
    quantityKg: body.quantityKg,
    listingId: body.listingId,
    productId: body.productId,
  });

  response.status(201).json({
    batch: toPublicBatch(batch),
    signedPayload: signed.payload,
    signature: signed.signature,
    qrDataUrl: batch.qrDataUrl,
  });
}

export async function verifyBatch(request, response) {
  const batchId = String(request.params.batchId || '').trim();
  if (!batchId) throw httpError('batchId is required');

  const batch = await HarvestBatch.findOne({ batchId }).populate('farmer', 'name location');
  if (!batch) throw httpError('Batch not found', 404);

  response.json({ verification: toPublicBatch(batch) });
}
