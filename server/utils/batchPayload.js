import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const QUALITY_GRADES = ['A+', 'A', 'B', 'C'];

function signingSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to sign batch payloads');
  return secret;
}

function canonicalPayload({ batchId, farmLocationGps, harvestDate, qualityGrade, farmerId }) {
  return JSON.stringify({
    BatchID: batchId,
    FarmLocationGPS: farmLocationGps,
    HarvestDate: harvestDate,
    QualityGrade: qualityGrade,
    FarmerID: farmerId,
  });
}

export function signBatchPayload(payload) {
  return createHmac('sha256', signingSecret()).update(canonicalPayload(payload)).digest('hex');
}

export function verifyBatchSignature(payload, signature) {
  if (!signature) return false;
  const expected = Buffer.from(signBatchPayload(payload), 'hex');
  const received = Buffer.from(String(signature), 'hex');
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function createSignedBatchPayload({
  batchId = `DF-BATCH-${randomUUID()}`,
  farmLocationGps,
  harvestDate,
  qualityGrade,
  farmerId,
} = {}) {
  const latitude = Number(farmLocationGps?.latitude);
  const longitude = Number(farmLocationGps?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw Object.assign(new Error('Farm location GPS latitude and longitude are required'), { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw Object.assign(new Error('Farm location GPS coordinates are invalid'), { status: 400 });
  }
  if (!farmerId) {
    throw Object.assign(new Error('Farmer ID is required'), { status: 400 });
  }

  const harvest = harvestDate ? new Date(harvestDate) : new Date();
  if (Number.isNaN(harvest.getTime())) {
    throw Object.assign(new Error('Harvest date is invalid'), { status: 400 });
  }
  if (harvest > new Date()) {
    throw Object.assign(new Error('Harvest date cannot be in the future'), { status: 400 });
  }

  const grade = String(qualityGrade || 'A').toUpperCase();
  if (!QUALITY_GRADES.includes(grade)) {
    throw Object.assign(new Error(`Quality grade must be one of ${QUALITY_GRADES.join(', ')}`), { status: 400 });
  }

  const fields = {
    batchId,
    farmLocationGps: { latitude, longitude },
    harvestDate: harvest.toISOString(),
    qualityGrade: grade,
    farmerId: String(farmerId),
  };

  const json = {
    BatchID: fields.batchId,
    FarmLocationGPS: fields.farmLocationGps,
    HarvestDate: fields.harvestDate,
    QualityGrade: fields.qualityGrade,
    FarmerID: fields.farmerId,
  };

  return {
    ...fields,
    payload: json,
    signature: signBatchPayload(fields),
  };
}

export { QUALITY_GRADES };
