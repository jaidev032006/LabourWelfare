import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, services, users, bookings, notifications, reviews } from './data.js';
import { auth } from './middleware.js';
import { distanceKm, id, publicUser, tokenPayload } from './utils.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_ORIGIN || '*', methods: ['GET', 'POST'] } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const port = Number(process.env.PORT || 3000);
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true }));
app.use(express.static(path.join(root, '..', 'public')));

const notify = (userId, type, title, message, data = {}) => {
  const item = { id: id('notification'), userId, type, title, message, data, createdAt: new Date().toISOString(), read: false };
  notifications.unshift(item);
  io.to(`user:${userId}`).emit('notification', item);
  return item;
};

function findUser(userId) { return users.find(user => user.id === userId); }
function serviceById(serviceId) { return services.find(service => service.id === serviceId); }
function workerView(worker, customerLocation, serviceId) {
  const service = serviceById(serviceId);
  const distance = customerLocation ? distanceKm(customerLocation, worker.location) : null;
  const compatibility = worker.skills.includes(serviceId) ? 100 : service && worker.skills.some(skill => service.keywords.some(keyword => skill.includes(keyword))) ? 45 : 0;
  const score = compatibility * 0.5 + (worker.online ? 20 : 0) + Math.max(0, 15 - Math.min(distance || 15, 15)) + worker.rating * 2 + Math.min(worker.completedJobs / 100, 5);
  return { ...publicUser(worker), category: categories.find(category => worker.skills.some(skill => services.find(item => item.id === skill)?.categoryId === category.id))?.name || 'Skilled professional', skillNames: worker.skills.map(skill => serviceById(skill)?.name).filter(Boolean), distanceKm: distance === null ? null : Number(distance.toFixed(1)), compatibility, score: Number(score.toFixed(2)) };
}

function matchWorkers({ serviceId, categoryId, location }) {
  return users.filter(user => user.role === 'worker' && user.online && user.verified && (!categoryId || user.skills.some(skill => serviceById(skill)?.categoryId === categoryId)) && (!serviceId || user.skills.includes(serviceId)))
    .map(worker => workerView(worker, location, serviceId))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || b.score - a.score);
}

function heuristicAnalysis(text = '') {
  const lower = text.toLowerCase();
  const selected = services.find(service => service.keywords.some(keyword => lower.includes(keyword))) || services.find(service => service.id === 'plumber');
  const category = categories.find(item => item.id === selected.categoryId);
  return { detected_category: category.id, recommended_service: selected.id, possible_issue: text || 'A professional inspection is recommended.', required_skill: selected.id, confidence: text ? 0.82 : 0.42, explanation: text ? `This sounds like a ${selected.name.toLowerCase()} request.` : 'We need a little more detail, so we selected a general plumbing assessment.' };
}

async function analyzeWithGemini(text, file) {
  if (!process.env.GEMINI_API_KEY) return heuristicAnalysis(text);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
  const prompt = `You are LabourWelfare's service triage assistant. Return only valid JSON with keys detected_category (home|mechanical|construction|interior), recommended_service (one of: ${services.map(item => item.id).join(', ')}), possible_issue, required_skill (service id), confidence (0 to 1), explanation. Analyze this customer description: ${text || 'No text provided'}. This is a recommendation only, not a diagnosis.`;
  const parts = [{ text: prompt }];
  if (file) parts.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } });
  const result = await model.generateContent(parts);
  const raw = result.response.text().replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(raw);
  if (!categories.some(category => category.id === parsed.detected_category) || !services.some(service => service.id === parsed.recommended_service)) throw new Error('Invalid AI result');
  return parsed;
}

app.get('/api/health', (_, res) => res.json({ ok: true, mode: process.env.SUPABASE_URL ? 'supabase-ready-demo-data' : 'demo-mode' }));
app.get('/api/categories', (_, res) => res.json({ categories, services }));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password, location } = req.body;
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email and a password of at least 8 characters are required.' });
  if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = { id: id('customer'), role: 'customer', name: name.trim(), email: email.toLowerCase().trim(), phone: phone || '', passwordHash: await bcrypt.hash(password, 12), location: location || { lat: 12.9716, lng: 77.5946, label: 'Bengaluru, Karnataka' } };
  users.push(user);
  const token = jwt.sign(tokenPayload(user), process.env.JWT_SECRET || 'development-secret', { expiresIn: '7d' });
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (role === 'admin' && email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const admin = { id: 'admin-env', role: 'admin', name: 'Platform admin', email, passwordHash: '' };
    const token = jwt.sign(tokenPayload(admin), process.env.JWT_SECRET || 'development-secret', { expiresIn: '8h' });
    return res.json({ token, user: publicUser(admin) });
  }
  const user = users.find(item => item.email.toLowerCase() === String(email).toLowerCase() && (!role || item.role === role));
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'Email, password or role is incorrect.' });
  const token = jwt.sign(tokenPayload(user), process.env.JWT_SECRET || 'development-secret', { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', auth(), (req, res) => res.json({ user: publicUser(findUser(req.user.id)) }));
app.get('/api/workers', auth(['customer', 'admin']), (req, res) => res.json({ workers: matchWorkers(req.query) }));

app.post('/api/ai/analyze', auth(['customer']), upload.single('image'), async (req, res) => {
  try {
    const analysis = await analyzeWithGemini(req.body.description, req.file);
    const location = JSON.parse(req.body.location || JSON.stringify(findUser(req.user.id).location));
    res.json({ analysis, workers: matchWorkers({ serviceId: analysis.recommended_service, categoryId: analysis.detected_category, location }), notice: 'AI suggestions are guidance only. A professional may need to inspect the issue in person.' });
  } catch (error) {
    res.status(502).json({ error: 'We could not complete the image analysis. Try describing the problem in a few words.' });
  }
});

app.get('/api/bookings', auth(['customer', 'worker', 'admin']), (req, res) => {
  const visible = req.user.role === 'admin' ? bookings : bookings.filter(booking => booking.customerId === req.user.id || booking.workerId === req.user.id);
  res.json({ bookings: visible });
});

app.post('/api/bookings', auth(['customer']), (req, res) => {
  const { workerId, serviceId, description, location, requestedTime } = req.body;
  const worker = findUser(workerId);
  if (!worker || worker.role !== 'worker' || !worker.online) return res.status(409).json({ error: 'That worker is no longer available. Please choose another nearby professional.' });
  const customer = findUser(req.user.id);
  const booking = { id: id('booking'), customerId: customer.id, customerName: customer.name, workerId, workerName: worker.name, serviceId, serviceName: serviceById(serviceId)?.name || serviceId, description: description || '', location: location || customer.location, requestedTime: requestedTime || 'As soon as possible', status: 'awaiting_worker', createdAt: new Date().toISOString(), attempts: [{ id: id('attempt'), workerId, workerName: worker.name, status: 'pending', sentAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 120000).toISOString() }] };
  bookings.unshift(booking);
  notify(worker.id, 'booking_request', 'New service request', `${customer.name} needs ${booking.serviceName}. You have 2 minutes to respond.`, { bookingId: booking.id });
  notify(customer.id, 'booking_sent', 'Request sent', `We sent your request to ${worker.name}. We will automatically try the next nearby worker if needed.`, { bookingId: booking.id });
  io.emit('booking:update', booking);
  setTimeout(() => expireAttempt(booking.id), 120000);
  res.status(201).json({ booking });
});

function expireAttempt(bookingId) {
  const booking = bookings.find(item => item.id === bookingId);
  if (!booking || booking.status !== 'awaiting_worker') return;
  const attempt = booking.attempts.at(-1);
  if (attempt?.status !== 'pending') return;
  attempt.status = 'expired'; attempt.reason = 'No response within 2 minutes'; attempt.respondedAt = new Date().toISOString();
  notify(booking.customerId, 'fallback', 'Finding another professional', `${booking.workerName} did not respond. We are checking the next suitable worker now.`);
  assignNextWorker(booking);
}

function assignNextWorker(booking) {
  const tried = new Set(booking.attempts.map(attempt => attempt.workerId));
  const next = matchWorkers({ serviceId: booking.serviceId, location: booking.location }).find(worker => !tried.has(worker.id));
  if (!next) { booking.status = 'failed'; notify(booking.customerId, 'booking_failed', 'No professional available', 'No nearby professional is available right now. Try again in a few minutes.'); }
  else { booking.workerId = next.id; booking.workerName = next.name; booking.attempts.push({ id: id('attempt'), workerId: next.id, workerName: next.name, status: 'pending', sentAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 120000).toISOString() }); notify(next.id, 'booking_request', 'New service request', `${booking.customerName} needs ${booking.serviceName}. You have 2 minutes to respond.`, { bookingId: booking.id }); setTimeout(() => expireAttempt(booking.id), 120000); }
  io.emit('booking:update', booking);
}

app.post('/api/bookings/:id/respond', auth(['worker']), (req, res) => {
  const booking = bookings.find(item => item.id === req.params.id && item.workerId === req.user.id);
  if (!booking || booking.status !== 'awaiting_worker') return res.status(404).json({ error: 'Booking request is no longer active.' });
  const attempt = booking.attempts.at(-1);
  if (attempt.status !== 'pending' || new Date(attempt.expiresAt) < new Date()) return res.status(409).json({ error: 'The response window has expired.' });
  const accepted = req.body.action === 'accept'; attempt.status = accepted ? 'accepted' : 'rejected'; attempt.respondedAt = new Date().toISOString();
  if (accepted) { booking.status = 'confirmed'; notify(booking.customerId, 'booking_confirmed', 'Booking confirmed', `${booking.workerName} accepted your request.`, { bookingId: booking.id }); }
  else { notify(booking.customerId, 'fallback', `${booking.workerName} is unavailable`, 'We are checking the next suitable worker now.'); assignNextWorker(booking); }
  io.emit('booking:update', booking); res.json({ booking });
});

app.post('/api/bookings/:id/status', auth(['worker']), (req, res) => {
  const booking = bookings.find(item => item.id === req.params.id && item.workerId === req.user.id);
  const allowed = ['on_the_way', 'arrived', 'work_started', 'completed'];
  if (!booking || !allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid booking status.' });
  booking.status = req.body.status;
  notify(booking.customerId, 'status_update', 'Booking updated', `${booking.workerName} marked the job as ${req.body.status.replaceAll('_', ' ')}.`, { bookingId: booking.id });
  io.emit('booking:update', booking); res.json({ booking });
});

app.post('/api/workers/me/status', auth(['worker']), (req, res) => {
  const worker = findUser(req.user.id); worker.online = Boolean(req.body.online); res.json({ user: publicUser(worker) });
});
app.post('/api/reviews', auth(['customer']), (req, res) => {
  const booking = bookings.find(item => item.id === req.body.bookingId && item.customerId === req.user.id && item.status === 'completed');
  if (!booking || req.body.rating < 1 || req.body.rating > 5) return res.status(400).json({ error: 'A completed booking and rating from 1 to 5 are required.' });
  const review = { id: id('review'), bookingId: booking.id, workerId: booking.workerId, customerId: req.user.id, rating: Number(req.body.rating), text: String(req.body.text || '').slice(0, 500), createdAt: new Date().toISOString() }; reviews.push(review);
  const worker = findUser(booking.workerId); const workerReviews = reviews.filter(item => item.workerId === worker.id); worker.rating = Number((workerReviews.reduce((sum, item) => sum + item.rating, 0) / workerReviews.length).toFixed(1));
  res.status(201).json({ review });
});
app.get('/api/workers/:id/reviews', auth(['customer', 'worker', 'admin']), (req, res) => {
  const worker = findUser(req.params.id);
  if (!worker || worker.role !== 'worker') return res.status(404).json({ error: 'Worker not found.' });
  res.json({ reviews: reviews.filter(review => review.workerId === worker.id).map(review => ({ ...review, customerName: findUser(review.customerId)?.name || 'Customer' })) });
});
app.get('/api/notifications', auth(), (req, res) => res.json({ notifications: notifications.filter(item => item.userId === req.user.id).slice(0, 30) }));
app.get('/api/admin/stats', auth(['admin']), (_, res) => res.json({ stats: { customers: users.filter(user => user.role === 'customer').length, workers: users.filter(user => user.role === 'worker').length, onlineWorkers: users.filter(user => user.role === 'worker' && user.online).length, activeBookings: bookings.filter(booking => !['completed', 'failed'].includes(booking.status)).length, completedBookings: bookings.filter(booking => booking.status === 'completed').length, categories: categories.map(category => ({ name: category.name, workers: users.filter(user => user.role === 'worker' && user.skills.some(skill => serviceById(skill)?.categoryId === category.id)).length })) } }));
app.get('/api/admin/workers', auth(['admin']), (_, res) => res.json({ workers: users.filter(user => user.role === 'worker').map(publicUser) }));
app.post('/api/admin/workers', auth(['admin']), async (req, res) => {
  const { name, email, phone, password, photoUrl, skills, location, experience, serviceArea } = req.body;
  if (!name || !email || !password || password.length < 8 || !Array.isArray(skills) || !skills.length || !location?.lat || !location?.lng) return res.status(400).json({ error: 'Name, email, password, at least one skill and a valid map location are required.' });
  if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
  const worker = { id: id('worker'), role: 'worker', name: name.trim(), email: email.toLowerCase().trim(), phone: phone || '', passwordHash: await bcrypt.hash(password, 12), photoUrl: photoUrl || '', verified: true, active: true, online: false, skills: skills.filter(skill => services.some(service => service.id === skill)), experience: Number(experience || 0), completedJobs: 0, rating: 0, serviceArea: serviceArea || location.label || 'Local service area', location };
  users.push(worker);
  notify(worker.id, 'account_created', 'Worker account created', 'Your LabourWelfare worker account is ready. Sign in and go online when you are available.');
  res.status(201).json({ worker: publicUser(worker) });
});

io.on('connection', socket => { socket.on('join:user', userId => socket.join(`user:${userId}`)); });
app.use((_, res) => res.sendFile(path.join(root, '..', 'public', 'index.html')));
app.use((error, _, res, __) => res.status(500).json({ error: 'Something went wrong. Please try again.' }));

httpServer.listen(port, () => console.log(`LabourWelfare running at http://localhost:${port}`));
