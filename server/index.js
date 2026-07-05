import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, requireEnv } from './db.js';
import { buildSystemPrompt } from './skills.js';

dotenv.config({ override: true });

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '14d' });
}

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.created_at };
}

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login diperlukan.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [payload.sub] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid.' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: Boolean(process.env.TURSO_DATABASE_URL) });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    requireEnv();
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });
    const id = crypto.randomUUID();
    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute({
      sql: 'INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, name.trim(), email.trim().toLowerCase(), passwordHash, now, now],
    });
    const user = { id, name: name.trim(), email: email.trim().toLowerCase(), created_at: now };
    res.json({ user: sanitizeUser(user), token: signToken(user) });
  } catch (error) {
    const duplicate = String(error.message).toLowerCase().includes('unique');
    res.status(duplicate ? 409 : 500).json({ error: duplicate ? 'Email sudah terdaftar.' : error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    requireEnv();
    const { email, password } = req.body;
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email?.trim().toLowerCase()] });
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }
    res.json({ user: sanitizeUser(user), token: signToken(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

const modelMap = {
  'Pluto Nova': 'combo/deepseek-v4-flash',
  'Pluto Atlas': 'xmtp/mimo-v2.5-pro',
  'Pluto Apex': 'mimo/mimo-v2.5-pro',
};

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function estimateTokens(text = '') {
  return Math.ceil(String(text).length / 4);
}

async function getPlan(userId) {
  const now = Date.now();
  const result = await db.execute({ sql: 'SELECT * FROM subscriptions WHERE user_id = ?', args: [userId] });
  if (result.rows[0]) return result.rows[0].plan;
  await db.execute({ sql: 'INSERT INTO subscriptions (user_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', args: [userId, 'free', 'active', now, now] });
  return 'free';
}

function limitsFor(plan) {
  return {
    messagesPerDay: Number(process.env[plan === 'pro' ? 'PRO_DAILY_MESSAGES' : 'FREE_DAILY_MESSAGES'] || (plan === 'pro' ? 1000 : 30)),
    filesPerDay: Number(process.env[plan === 'pro' ? 'PRO_DAILY_FILES' : 'FREE_DAILY_FILES'] || (plan === 'pro' ? 100 : 5)),
    memories: plan === 'pro' ? 500 : 20,
    chunks: plan === 'pro' ? 10000 : 100,
    tokensPerMonth: Number(process.env[plan === 'pro' ? 'PRO_MONTHLY_TOKENS' : 'FREE_MONTHLY_TOKENS'] || (plan === 'pro' ? 5000000 : 3000000)),
    canvases: plan === 'pro' ? 100 : 5,
    projectCanvases: plan === 'pro' ? 30 : 2,
    allowedModels: plan === 'pro' ? ['Pluto Nova', 'Pluto Atlas', 'Pluto Apex'] : ['Pluto Nova'],
  };
}

async function usageFor(userId) {
  const plan = await getPlan(userId);
  const limits = limitsFor(plan);
  const since = startOfDay();
  const messages = await db.execute({ sql: 'SELECT COUNT(*) as count FROM usage_events WHERE user_id = ? AND type = ? AND created_at >= ?', args: [userId, 'message', since] });
  const files = await db.execute({ sql: 'SELECT COUNT(*) as count FROM usage_events WHERE user_id = ? AND type = ? AND created_at >= ?', args: [userId, 'file', since] });
  const memories = await db.execute({ sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ?', args: [userId] });
  const chunks = await db.execute({ sql: 'SELECT COUNT(*) as count FROM document_chunks WHERE user_id = ?', args: [userId] });
  const tokenRows = await db.execute({ sql: 'SELECT COALESCE(SUM(input_chars + output_chars), 0) as chars FROM usage_events WHERE user_id = ? AND type = ? AND created_at >= ?', args: [userId, 'message', startOfMonth()] });
  const canvasRows = await db.execute({ sql: 'SELECT COUNT(*) as count FROM canvases WHERE user_id = ?', args: [userId] });
  const projectRows = await db.execute({ sql: 'SELECT COUNT(*) as count FROM canvases WHERE user_id = ? AND type = ?', args: [userId, 'Project'] });
  return {
    plan,
    limits,
    usage: {
      messagesToday: Number(messages.rows[0]?.count || 0),
      filesToday: Number(files.rows[0]?.count || 0),
      memories: Number(memories.rows[0]?.count || 0),
      chunks: Number(chunks.rows[0]?.count || 0),
      tokensMonth: Math.ceil(Number(tokenRows.rows[0]?.chars || 0) / 4),
      canvases: Number(canvasRows.rows[0]?.count || 0),
      projectCanvases: Number(projectRows.rows[0]?.count || 0),
    },
  };
}

async function assertLimit(userId, type) {
  const data = await usageFor(userId);
  if (type === 'message' && data.usage.messagesToday >= data.limits.messagesPerDay) {
    const error = new Error('Limit pesan harian habis. Upgrade ke Pluto Pro untuk lanjut.');
    error.status = 429;
    throw error;
  }
  if (type === 'file' && data.usage.filesToday >= data.limits.filesPerDay) {
    const error = new Error('Limit file harian habis. Upgrade ke Pluto Pro untuk lanjut.');
    error.status = 429;
    throw error;
  }
  return data;
}

async function assertModelAccess(userId, model) {
  const data = await usageFor(userId);
  if (!data.limits.allowedModels.includes(model)) {
    const error = new Error('Model ini khusus Pluto Pro. Upgrade untuk memakai Pluto Atlas dan Pluto Apex.');
    error.status = 403;
    throw error;
  }
  return data;
}

async function assertTokenBudget(userId, estimatedTokens) {
  const data = await usageFor(userId);
  if (data.usage.tokensMonth + estimatedTokens > data.limits.tokensPerMonth) {
    const error = new Error('Kuota token bulanan habis. Akan reset bulan depan atau upgrade paket.');
    error.status = 429;
    throw error;
  }
  return data;
}

async function assertCanvasBudget(userId, canvases = []) {
  const data = await usageFor(userId);
  const total = canvases.length;
  const projects = canvases.filter((canvas) => canvas.type === 'Project').length;
  if (total > data.limits.canvases) {
    const error = new Error(`Limit canvas tercapai. Paket kamu maksimal ${data.limits.canvases} canvas.`);
    error.status = 429;
    throw error;
  }
  if (projects > data.limits.projectCanvases) {
    const error = new Error(`Limit project canvas tercapai. Paket kamu maksimal ${data.limits.projectCanvases} project canvas.`);
    error.status = 429;
    throw error;
  }
}

async function logUsage(userId, type, model, inputChars = 0, outputChars = 0) {
  await db.execute({
    sql: 'INSERT INTO usage_events (id, user_id, type, model, input_chars, output_chars, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [crypto.randomUUID(), userId, type, model || null, inputChars, outputChars, Date.now()],
  });
}

function chunkText(text, size = 1200) {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) chunks.push(text.slice(index, index + size));
  return chunks.filter((chunk) => chunk.trim());
}

function scoreChunk(query, content) {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const lower = content.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

async function getRagContext(userId, sessionId, query) {
  const result = await db.execute({ sql: 'SELECT content, metadata FROM document_chunks WHERE user_id = ? AND (session_id = ? OR session_id IS NULL) LIMIT 200', args: [userId, sessionId] });
  return result.rows
    .map((row) => ({ ...row, score: scoreChunk(query, row.content) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => row.content)
    .join('\n\n---\n\n');
}

async function maybeSaveMemory(userId, prompt) {
  const match = prompt.match(/^(ingat|simpan preferensi|mulai sekarang)\s+(.+)/i);
  if (!match) return null;
  const data = await usageFor(userId);
  if (data.usage.memories >= data.limits.memories) return null;
  const content = match[2].trim();
  const now = Date.now();
  await db.execute({ sql: 'INSERT INTO memories (id, user_id, content, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', args: [crypto.randomUUID(), userId, content, 'chat', now, now] });
  return content;
}

async function callOpenAIStream({ messages, model, onToken }) {
  let pendingStar = false;
  let full = '';

  const emitClean = (text) => {
    let clean = '';
    for (const char of text) {
      if (char === '*') {
        if (pendingStar) {
          pendingStar = false;
          continue;
        }
        pendingStar = true;
        continue;
      }
      if (pendingStar) {
        clean += '*';
        pendingStar = false;
      }
      clean += char;
    }
    if (clean) {
      full += clean;
      onToken(clean);
    }
  };

  const flushClean = () => {
    if (!pendingStar) return;
    full += '*';
    onToken('*');
    pendingStar = false;
  };

  if (!process.env.OPENAI_API_KEY) {
    const fallback = 'API OpenAI belum dikonfigurasi di server. Pluto tetap menyimpan pesan, memory, usage, dan RAG context.';
    emitClean(fallback);
    flushClean();
    return full;
  }
  const response = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!response.ok || !response.body) throw new Error(`OpenAI error: ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      const json = JSON.parse(data);
      const token = json.choices?.[0]?.delta?.content || '';
      if (token) {
        emitClean(token);
      }
    }
  }
  flushClean();
  return full;
}

app.get('/api/sessions', auth, async (req, res) => {
  const sessions = await db.execute({ sql: 'SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC', args: [req.user.id] });
  const hydrated = await Promise.all(sessions.rows.map(async (session) => {
    const messages = await db.execute({ sql: 'SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC', args: [session.id] });
    const files = await db.execute({ sql: 'SELECT id, name, size, type, created_at FROM files WHERE session_id = ? ORDER BY created_at DESC', args: [session.id] });
    const images = await db.execute({ sql: 'SELECT id, prompt, style, image_url, metadata, created_at FROM image_results WHERE session_id = ? ORDER BY created_at DESC', args: [session.id] });
    const canvases = await db.execute({ sql: 'SELECT * FROM canvases WHERE session_id = ? AND user_id = ? ORDER BY updated_at DESC', args: [session.id, req.user.id] });
    return {
      id: session.id,
      title: session.title,
      mode: session.mode,
      messages: messages.rows.map((message) => ({ id: message.id, role: message.role, content: message.content, createdAt: message.created_at })),
      files: files.rows.map((file) => ({ id: file.id, name: file.name, size: file.size, type: file.type, createdAt: file.created_at })),
      notes: session.notes || '',
      codeOutput: session.code_output || '',
      workspaceTab: 'context',
      pseudoFiles: [],
      terminalOutput: session.terminal_output || '',
      chatSummary: session.chat_summary || '',
      savedPrompts: [],
      imageSettings: JSON.parse(session.image_settings || '{}'),
      imageResults: images.rows.map((image) => ({ id: image.id, prompt: image.prompt, style: image.style, imageUrl: image.image_url, metadata: image.metadata ? JSON.parse(image.metadata) : null, createdAt: image.created_at })),
      canvases: canvases.rows.map((canvas) => ({ id: canvas.id, title: canvas.title, type: canvas.type, language: canvas.language, content: canvas.content || '', versions: canvas.versions ? JSON.parse(canvas.versions) : [], savedAt: canvas.saved_at, createdAt: canvas.created_at, updatedAt: canvas.updated_at })),
      activeCanvasId: canvases.rows[0]?.id || null,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    };
  }));
  res.json({ sessions: hydrated });
});

app.get('/api/usage', auth, async (req, res) => {
  res.json(await usageFor(req.user.id));
});

app.post('/api/subscription/mock-upgrade', auth, async (req, res) => {
  const now = Date.now();
  await db.execute({ sql: 'INSERT INTO subscriptions (user_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, status = excluded.status, updated_at = excluded.updated_at', args: [req.user.id, 'pro', 'active', now, now] });
  res.json(await usageFor(req.user.id));
});

app.get('/api/memories', auth, async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM memories WHERE user_id = ? ORDER BY updated_at DESC', args: [req.user.id] });
  res.json({ memories: result.rows });
});

app.post('/api/memories', auth, async (req, res) => {
  const now = Date.now();
  const data = await usageFor(req.user.id);
  if (data.usage.memories >= data.limits.memories) return res.status(429).json({ error: 'Limit memory habis. Upgrade ke Pluto Pro.' });
  await db.execute({ sql: 'INSERT INTO memories (id, user_id, content, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', args: [crypto.randomUUID(), req.user.id, req.body.content, 'manual', now, now] });
  res.json({ ok: true });
});

app.delete('/api/memories/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM memories WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
  res.json({ ok: true });
});

app.post('/api/files/text', auth, async (req, res) => {
  try {
    await assertLimit(req.user.id, 'file');
    const { sessionId, name, size, type, content } = req.body;
    const fileId = crypto.randomUUID();
    const now = Date.now();
    await db.execute({ sql: 'INSERT INTO files (id, session_id, name, size, type, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: [fileId, sessionId, name, size || 0, type || 'text/plain', now] });
    const chunks = chunkText(content || '');
    const data = await usageFor(req.user.id);
    if (data.usage.chunks + chunks.length > data.limits.chunks) return res.status(429).json({ error: 'Limit konteks file habis. Upgrade ke Pluto Pro.' });
    for (const chunk of chunks) {
      await db.execute({ sql: 'INSERT INTO document_chunks (id, user_id, session_id, file_id, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [crypto.randomUUID(), req.user.id, sessionId, fileId, chunk, JSON.stringify({ name, type }), now] });
    }
    await logUsage(req.user.id, 'file', null, content?.length || 0, 0);
    res.json({ fileId, chunks: chunks.length });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/ai/guest', async (req, res) => {
  try {
    const { mode, model, message, history = [], canvas = null } = req.body;
    const mappedModel = modelMap[model] || process.env.OPENAI_DEFAULT_MODEL || 'mimo/mimo-v2.5-pro';
    const system = buildSystemPrompt({ mode, model, message, history, canvas });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const full = await callOpenAIStream({ messages: [{ role: 'system', content: system }, { role: 'user', content: message }], model: mappedModel, onToken: (token) => res.write(`data: ${JSON.stringify({ token })}\n\n`) });
    res.write(`data: ${JSON.stringify({ done: true, outputChars: full.length })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ error: error.message });
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.get('/api/search', auth, async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  if (q === '%%') return res.json({ results: [] });
  const [sessions, messages, chunks, memories, images] = await Promise.all([
    db.execute({ sql: 'SELECT id, title as content, title FROM sessions WHERE user_id = ? AND title LIKE ? LIMIT 10', args: [req.user.id, q] }),
    db.execute({ sql: 'SELECT messages.id, messages.session_id, messages.content FROM messages JOIN sessions ON messages.session_id = sessions.id WHERE sessions.user_id = ? AND messages.content LIKE ? LIMIT 10', args: [req.user.id, q] }),
    db.execute({ sql: 'SELECT id, session_id, content, metadata FROM document_chunks WHERE user_id = ? AND content LIKE ? LIMIT 10', args: [req.user.id, q] }),
    db.execute({ sql: 'SELECT id, content FROM memories WHERE user_id = ? AND content LIKE ? LIMIT 10', args: [req.user.id, q] }),
    db.execute({ sql: 'SELECT image_results.id, image_results.session_id, image_results.prompt as content FROM image_results JOIN sessions ON image_results.session_id = sessions.id WHERE sessions.user_id = ? AND image_results.prompt LIKE ? LIMIT 10', args: [req.user.id, q] }),
  ]);
  res.json({ results: [
    ...sessions.rows.map((row) => ({ type: 'Chat', ...row })),
    ...messages.rows.map((row) => ({ type: 'Message', ...row })),
    ...chunks.rows.map((row) => ({ type: 'File', ...row })),
    ...memories.rows.map((row) => ({ type: 'Memory', ...row })),
    ...images.rows.map((row) => ({ type: 'Image', ...row })),
  ] });
});

app.post('/api/ai/chat', auth, async (req, res) => {
  try {
    await assertLimit(req.user.id, 'message');
    const { sessionId, mode, model, message, history = [], canvas = null } = req.body;
    await assertModelAccess(req.user.id, model);
    await assertTokenBudget(req.user.id, estimateTokens(`${message}\n${canvas?.content || ''}\n${JSON.stringify(canvas?.files || [])}`));
    const now = Date.now();
    const userMessageId = crypto.randomUUID();
    await maybeSaveMemory(req.user.id, message);
    await db.execute({ sql: 'INSERT OR REPLACE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', args: [userMessageId, sessionId, 'user', message, now] });
    const memories = await db.execute({ sql: 'SELECT content FROM memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT 12', args: [req.user.id] });
    const recent = await db.execute({ sql: 'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 12', args: [sessionId] });
    const rag = await getRagContext(req.user.id, sessionId, message);
    const recentHistory = recent.rows.reverse().map((row) => ({ role: row.role, content: row.content }));
    const system = buildSystemPrompt({ mode, model, message, memories: memories.rows, rag, history: history.length ? history : recentHistory, canvas });
    const mappedModel = modelMap[model] || process.env.OPENAI_DEFAULT_MODEL || 'mimo/mimo-v2.5-pro';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    let assistantContent = '';
    const messages = [{ role: 'system', content: system }, ...recentHistory, { role: 'user', content: message }];
    assistantContent = await callOpenAIStream({ messages, model: mappedModel, onToken: (token) => res.write(`data: ${JSON.stringify({ token })}\n\n`) });
    const assistantId = crypto.randomUUID();
    await db.execute({ sql: 'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', args: [assistantId, sessionId, 'assistant', assistantContent, Date.now()] });
    await logUsage(req.user.id, 'message', mappedModel, message.length, assistantContent.length);
    res.write(`data: ${JSON.stringify({ done: true, id: assistantId })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) return res.status(error.status || 500).json({ error: error.message });
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post('/api/sessions', auth, async (req, res) => {
  const session = req.body;
  if (Array.isArray(session.canvases)) await assertCanvasBudget(req.user.id, session.canvases);
  const now = Date.now();
  const id = session.id || crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, title, mode, model, notes, chat_summary, code_output, terminal_output, image_settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, mode=excluded.mode, model=excluded.model, notes=excluded.notes, chat_summary=excluded.chat_summary, code_output=excluded.code_output, terminal_output=excluded.terminal_output, image_settings=excluded.image_settings, updated_at=excluded.updated_at`,
    args: [id, req.user.id, session.title || 'Sesi Pluto', session.mode || 'chat', session.model || null, session.notes || '', session.chatSummary || '', session.codeOutput || '', session.terminalOutput || '', JSON.stringify(session.imageSettings || {}), session.createdAt || now, now],
  });
  if (Array.isArray(session.canvases)) {
    await db.execute({ sql: 'DELETE FROM canvases WHERE session_id = ? AND user_id = ?', args: [id, req.user.id] });
    for (const canvas of session.canvases) {
      await db.execute({
        sql: 'INSERT INTO canvases (id, session_id, user_id, title, type, language, content, versions, saved_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [canvas.id || crypto.randomUUID(), id, req.user.id, canvas.title || 'Untitled Canvas', canvas.type || 'Document', canvas.language || 'markdown', canvas.content || '', JSON.stringify(canvas.versions || []), canvas.savedAt || now, canvas.createdAt || now, canvas.updatedAt || now],
      });
    }
  }
  res.json({ id });
});

app.post('/api/sessions/:id/messages', auth, async (req, res) => {
  const message = req.body;
  const id = message.id || crypto.randomUUID();
  await db.execute({
    sql: 'INSERT OR REPLACE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, req.params.id, message.role, message.content || '', message.createdAt || Date.now()],
  });
  await db.execute({ sql: 'UPDATE sessions SET updated_at = ? WHERE id = ? AND user_id = ?', args: [Date.now(), req.params.id, req.user.id] });
  res.json({ id });
});

app.delete('/api/sessions/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM canvases WHERE session_id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
  await db.execute({ sql: 'DELETE FROM messages WHERE session_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
  res.json({ ok: true });
});

app.get('/api/sessions/:id/canvases', auth, async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM canvases WHERE session_id = ? AND user_id = ? ORDER BY updated_at DESC', args: [req.params.id, req.user.id] });
  res.json({ canvases: result.rows.map((canvas) => ({ id: canvas.id, title: canvas.title, type: canvas.type, language: canvas.language, content: canvas.content || '', versions: canvas.versions ? JSON.parse(canvas.versions) : [], savedAt: canvas.saved_at, createdAt: canvas.created_at, updatedAt: canvas.updated_at })) });
});

app.post('/api/sessions/:id/canvases', auth, async (req, res) => {
  const now = Date.now();
  const canvas = req.body;
  const data = await usageFor(req.user.id);
  if (data.usage.canvases >= data.limits.canvases) return res.status(429).json({ error: `Limit canvas tercapai. Paket kamu maksimal ${data.limits.canvases} canvas.` });
  if (canvas.type === 'Project' && data.usage.projectCanvases >= data.limits.projectCanvases) return res.status(429).json({ error: `Limit project canvas tercapai. Paket kamu maksimal ${data.limits.projectCanvases} project canvas.` });
  const id = canvas.id || crypto.randomUUID();
  await db.execute({
    sql: 'INSERT INTO canvases (id, session_id, user_id, title, type, language, content, versions, saved_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, req.params.id, req.user.id, canvas.title || 'Untitled Canvas', canvas.type || 'Document', canvas.language || 'markdown', canvas.content || '', JSON.stringify(canvas.versions || []), canvas.savedAt || now, canvas.createdAt || now, now],
  });
  res.json({ id });
});

app.patch('/api/canvases/:id', auth, async (req, res) => {
  const canvas = req.body;
  const now = Date.now();
  await db.execute({
    sql: 'UPDATE canvases SET title = ?, type = ?, language = ?, content = ?, versions = ?, saved_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    args: [canvas.title || 'Untitled Canvas', canvas.type || 'Document', canvas.language || 'markdown', canvas.content || '', JSON.stringify(canvas.versions || []), canvas.savedAt || now, now, req.params.id, req.user.id],
  });
  res.json({ ok: true });
});

app.delete('/api/canvases/:id', auth, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM canvases WHERE id = ? AND user_id = ?', args: [req.params.id, req.user.id] });
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || 'Server error.' });
});

app.listen(port, () => {
  console.log(`Pluto API aktif di http://localhost:${port}`);
});
