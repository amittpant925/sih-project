import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT) || 3000;
const jwtSecret = process.env.JWT_SECRET;
const mongoUri = process.env.MONGO_URI;

if (!jwtSecret) throw new Error('JWT_SECRET is required');
if (!mongoUri) throw new Error('MONGO_URI is required');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['farmer', 'household', 'bulk-buyer', 'admin'], required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
    address: { type: String, trim: true, maxlength: 240 },
  },
}, { timestamps: true });
userSchema.index({ location: '2dsphere' });

const productSchema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true, maxlength: 1000 },
  images: { type: [String], default: [] },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  availableQuantity: { type: Number, required: true, min: 0 },
  minOrderQuantity: { type: Number, default: 1, min: 0 },
  harvestDate: Date,
  organic: { type: Boolean, default: false },
  available: { type: Boolean, default: true, index: true },
}, { timestamps: true });
productSchema.index({ name: 'text', category: 'text' });

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    quantity: { type: Number, min: 1, required: true },
    unit: String,
    price: { type: Number, min: 0, required: true },
  }],
  subtotal: { type: Number, min: 0, required: true },
  deliveryMethod: { type: String, enum: ['pickup', 'drop', 'platform'], required: true },
  deliveryFee: { type: Number, min: 0, required: true },
  total: { type: Number, min: 0, required: true },
  paymentMethod: { type: String, enum: ['upi'], default: 'upi' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  status: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'out-for-delivery', 'ready-for-pickup', 'delivered', 'completed', 'cancelled', 'rejected'], default: 'pending' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const qrSessions = new Map();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true }));

const signUser = (user) => jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '2h' });
const safeUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, location: user.location });

function requireAuth(request, response, next) {
  const header = request.get('authorization');
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ error: 'Authentication required' });
  try {
    request.auth = jwt.verify(header.slice(7), jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (request, response, next) => roles.includes(request.auth.role)
    ? next()
    : response.status(403).json({ error: 'Insufficient permissions' });
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

app.get('/api/health', (_request, response) => {
  response.json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded', service: 'directfarm-api', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', asyncRoute(async (request, response) => {
  const { name, email, password, role, address, latitude, longitude } = request.body;
  if (!name || !email || !password || !['farmer', 'household', 'bulk-buyer'].includes(role)) return response.status(400).json({ error: 'Name, email, password, and a valid role are required' });
  if (String(password).length < 8) return response.status(400).json({ error: 'Password must be at least 8 characters' });
  const normalizedEmail = String(email).toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) return response.status(409).json({ error: 'Email is already registered' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: normalizedEmail, passwordHash, role, location: { address, coordinates: [Number(longitude) || 0, Number(latitude) || 0] } });
  response.status(201).json({ user: safeUser(user), token: signUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (request, response) => {
  const { email, password } = request.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return response.status(401).json({ error: 'Invalid email or password' });
  response.json({ user: safeUser(user), token: signUser(user) });
}));

app.post('/api/auth/qr/session', (_request, response) => {
  const id = randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  qrSessions.set(id, { expiresAt, status: 'pending' });
  response.status(201).json({ id, expiresAt, authUrl: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/?qrAuth=${id}` });
});

app.get('/api/auth/qr/session/:id', asyncRoute(async (request, response) => {
  const session = qrSessions.get(request.params.id);
  if (!session || session.expiresAt < Date.now()) {
    qrSessions.delete(request.params.id);
    return response.status(410).json({ error: 'QR sign-in session expired' });
  }
  if (session.status !== 'approved') return response.json({ status: 'pending' });
  const user = await User.findById(session.userId);
  qrSessions.delete(request.params.id);
  if (!user) return response.status(404).json({ error: 'User not found' });
  response.json({ status: 'approved', user: safeUser(user), token: session.token });
}));

app.post('/api/auth/qr/session/:id/approve', requireAuth, (request, response) => {
  const session = qrSessions.get(request.params.id);
  if (!session || session.expiresAt < Date.now()) {
    qrSessions.delete(request.params.id);
    return response.status(410).json({ error: 'QR sign-in session expired' });
  }
  session.status = 'approved';
  session.userId = request.auth.sub;
  session.token = request.get('authorization').slice(7);
  response.json({ status: 'approved' });
});

app.get('/api/auth/me', requireAuth, asyncRoute(async (request, response) => {
  const user = await User.findById(request.auth.sub);
  if (!user) return response.status(404).json({ error: 'User not found' });
  response.json({ user: safeUser(user) });
}));

app.get('/api/products', asyncRoute(async (request, response) => {
  const { search, category, organic, minPrice, maxPrice, sort = 'recommended', farmer } = request.query;
  const query = { available: true, availableQuantity: { $gt: 0 } };
  if (search) query.$text = { $search: String(search) };
  if (category && category !== 'All produce') query.category = category;
  if (farmer) query.farmer = farmer;
  if (organic === 'true') query.organic = true;
  if (minPrice || maxPrice) query.price = { ...(minPrice ? { $gte: Number(minPrice) } : {}), ...(maxPrice ? { $lte: Number(maxPrice) } : {}) };
  const sortMap = { 'price-asc': { price: 1 }, 'price-desc': { price: -1 }, freshest: { harvestDate: -1 }, recommended: { createdAt: -1 } };
  const products = await Product.find(query).populate('farmer', 'name location').sort(sortMap[sort] || sortMap.recommended).limit(100).lean();
  response.json({ products });
}));

app.post('/api/products', requireAuth, requireRole('farmer'), asyncRoute(async (request, response) => {
  const product = await Product.create({ ...request.body, farmer: request.auth.sub });
  response.status(201).json({ product });
}));

app.patch('/api/products/:id', requireAuth, requireRole('farmer'), asyncRoute(async (request, response) => {
  const product = await Product.findOneAndUpdate({ _id: request.params.id, farmer: request.auth.sub }, { $set: request.body }, { new: true, runValidators: true });
  if (!product) return response.status(404).json({ error: 'Product not found' });
  response.json({ product });
}));

app.post('/api/orders', requireAuth, requireRole('household', 'bulk-buyer'), asyncRoute(async (request, response) => {
  const { items, deliveryMethod = 'pickup', paymentMethod = 'upi', paymentStatus = 'pending' } = request.body;
  if (!Array.isArray(items) || !items.length || !['pickup', 'drop', 'platform'].includes(deliveryMethod)) return response.status(400).json({ error: 'Items and a valid delivery method are required' });
  if (paymentMethod !== 'upi' || !['pending', 'paid', 'failed'].includes(paymentStatus)) return response.status(400).json({ error: 'A valid payment method and status are required' });
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const firstItem = items[0];
      const firstProduct = await Product.findOne({ _id: firstItem.product, available: true }).session(session);
      if (!firstProduct) throw Object.assign(new Error('Product not found'), { status: 404 });
      const normalizedItems = [];
      let subtotal = 0;
      for (const item of items) {
        const product = await Product.findOneAndUpdate({ _id: item.product, farmer: firstProduct.farmer, available: true, availableQuantity: { $gte: Number(item.quantity) } }, { $inc: { availableQuantity: -Number(item.quantity) } }, { new: true, session });
        if (!product) throw Object.assign(new Error('Product is unavailable or quantity is insufficient'), { status: 409 });
        const quantity = Number(item.quantity);
        subtotal += product.price * quantity;
        normalizedItems.push({ product: product.id, name: product.name, quantity, unit: product.unit, price: product.price });
      }
      const deliveryFee = deliveryMethod === 'platform' ? Math.max(40, Math.round(subtotal * 0.05)) : 0;
      [order] = await Order.create([{ customer: request.auth.sub, farmer: firstProduct.farmer, items: normalizedItems, subtotal, deliveryMethod, deliveryFee, total: subtotal + deliveryFee, paymentMethod, paymentStatus }], { session });
    });
  } finally {
    await session.endSession();
  }
  response.status(201).json({ order });
}));

app.get('/api/orders', requireAuth, asyncRoute(async (request, response) => {
  const filter = request.auth.role === 'farmer' ? { farmer: request.auth.sub } : { customer: request.auth.sub };
  response.json({ orders: await Order.find(filter).populate('farmer', 'name').populate('customer', 'name').sort({ createdAt: -1 }) });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => response.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' }));

try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
} catch (error) {
  console.error(`MongoDB connection failed for ${mongoUri}. Start MongoDB or set MONGO_URI to a reachable MongoDB instance.`);
  console.error(error.message);
  process.exitCode = 1;
  process.exit();
}
app.listen(port, () => console.log(`DirectFarm API listening on http://localhost:${port}`));
