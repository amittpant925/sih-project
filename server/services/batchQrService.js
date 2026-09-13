import QRCode from 'qrcode';
import { HarvestBatch } from '../models/batch.js';
import { createSignedBatchPayload, verifyBatchSignature } from '../utils/batchPayload.js';

const FRESHNESS_WINDOWS_HOURS = {
  'A+': 72,
  A: 96,
  B: 120,
  C: 168,
};

function clientOrigin() {
  return process.env.CLIENT_ORIGIN || 'http://localhost:5173';
}

function hoursSince(date) {
  return Math.max(0, (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60));
}

export function freshnessDetails(harvestDate, qualityGrade) {
  const harvestedAt = new Date(harvestDate);
  const ageHours = hoursSince(harvestedAt);
  const windowHours = FRESHNESS_WINDOWS_HOURS[qualityGrade] || FRESHNESS_WINDOWS_HOURS.A;
  const remainingHours = Math.max(0, windowHours - ageHours);
  let status = 'peak';
  if (remainingHours === 0) status = 'past-peak';
  else if (remainingHours <= 24) status = 'use-soon';
  else if (ageHours <= 24) status = 'harvested-today';
  return {
    harvestedAt: harvestedAt.toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
    freshnessWindowHours: windowHours,
    remainingHours: Math.round(remainingHours * 10) / 10,
    status,
    summary: status === 'harvested-today'
      ? 'Harvested within the last day.'
      : status === 'peak'
        ? 'Still within the recommended freshness window.'
        : status === 'use-soon'
          ? 'Best used within the next day.'
          : 'Past the recommended freshness window.',
  };
}

export async function encodeBatchQr(signed, verifyUrl) {
  const qrPayload = JSON.stringify({
    ...signed.payload,
    Signature: signed.signature,
    VerifyURL: verifyUrl,
  });
  return QRCode.toDataURL(qrPayload, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
}

export async function createTrackedBatch({
  farmerId,
  farmLocationGps,
  harvestDate,
  qualityGrade,
  produce,
  category,
  farmAddress,
  quantityKg,
  listingId,
  productId,
}) {
  const signed = createSignedBatchPayload({
    farmLocationGps,
    harvestDate,
    qualityGrade,
    farmerId,
  });
  const verifyUrl = `${clientOrigin()}/verify-batch/${encodeURIComponent(signed.batchId)}`;
  const qrDataUrl = await encodeBatchQr(signed, verifyUrl);
  const harvest = new Date(signed.harvestDate);
  const address = String(farmAddress || '').trim();

  const batch = await HarvestBatch.create({
    batchId: signed.batchId,
    farmer: farmerId,
    listing: listingId || undefined,
    product: productId || undefined,
    produce: String(produce || 'Harvest').trim(),
    category: String(category || 'Produce').trim(),
    qualityGrade: signed.qualityGrade,
    harvestDate: harvest,
    quantityKg: quantityKg ? Number(quantityKg) : undefined,
    farmLocationGps: signed.farmLocationGps,
    farmAddress: address,
    signedPayload: signed.payload,
    signature: signed.signature,
    qrDataUrl,
    verifyUrl,
    status: 'active',
    history: [{
      stage: 'harvested',
      label: 'Harvest recorded at the farm',
      location: address,
      notes: `Grade ${signed.qualityGrade} produce packed for DirectFarm.`,
      recordedAt: harvest,
    }],
  });

  return { batch, signed };
}

export function toPublicBatch(batch) {
  const farmer = batch.farmer && typeof batch.farmer === 'object' ? batch.farmer : null;
  const signatureValid = verifyBatchSignature({
    batchId: batch.batchId,
    farmLocationGps: batch.farmLocationGps,
    harvestDate: new Date(batch.harvestDate).toISOString(),
    qualityGrade: batch.qualityGrade,
    farmerId: String(farmer?._id || farmer?.id || batch.farmer),
  }, batch.signature);

  return {
    batchId: batch.batchId,
    produce: batch.produce,
    category: batch.category,
    qualityGrade: batch.qualityGrade,
    harvestDate: batch.harvestDate,
    quantityKg: batch.quantityKg,
    farm: {
      name: farmer?.name || 'Verified DirectFarm grower',
      address: batch.farmAddress || farmer?.location?.address || '',
      gps: batch.farmLocationGps,
    },
    authenticity: {
      signatureValid,
      signedPayload: batch.signedPayload,
    },
    freshness: freshnessDetails(batch.harvestDate, batch.qualityGrade),
    history: [...(batch.history || [])].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)),
    status: batch.status,
    qrDataUrl: batch.qrDataUrl,
    verifyUrl: batch.verifyUrl,
  };
}
