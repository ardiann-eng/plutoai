const API_BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'pluto.auth.token.v1';
const USER_KEY = 'pluto.auth.user.v1';

export function getStoredAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  return { token, user: rawUser ? JSON.parse(rawUser) : null };
}

export function saveAuth({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function authRequest(path, options = {}, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request gagal.');
  return data;
}

export const authApi = {
  login: (payload) => authRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  signup: (payload) => authRequest('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  googleLogin: (credential) => authRequest('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  sessions: (token) => authRequest('/api/sessions', {}, token),
  saveSession: (session, token, model) => authRequest('/api/sessions', { method: 'POST', body: JSON.stringify({ ...session, model }) }, token),
  saveMessage: (sessionId, message, token) => authRequest(`/api/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify(message) }, token),
  usage: (token) => authRequest('/api/usage', {}, token),
  upgrade: (token) => authRequest('/api/subscription/mock-upgrade', { method: 'POST', body: '{}' }, token),
  memories: (token) => authRequest('/api/memories', {}, token),
  deleteMemory: (id, token) => authRequest(`/api/memories/${id}`, { method: 'DELETE' }, token),
  search: (query, token) => authRequest(`/api/search?q=${encodeURIComponent(query)}`, {}, token),
  uploadTextFile: (payload, token) => authRequest('/api/files/text', { method: 'POST', body: JSON.stringify(payload) }, token),
  canvases: (sessionId, token) => authRequest(`/api/sessions/${sessionId}/canvases`, {}, token),
  createCanvas: (sessionId, canvas, token) => authRequest(`/api/sessions/${sessionId}/canvases`, { method: 'POST', body: JSON.stringify(canvas) }, token),
  updateCanvas: (canvas, token) => authRequest(`/api/canvases/${canvas.id}`, { method: 'PATCH', body: JSON.stringify(canvas) }, token),
  deleteCanvas: (id, token) => authRequest(`/api/canvases/${id}`, { method: 'DELETE' }, token),
};

export async function streamChat({ token, sessionId, mode, model, message, history = [], canvas = null, onToken }) {
  const response = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ sessionId, mode, model, message, history, canvas }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'AI request gagal.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const line = event.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.error) throw new Error(data.error);
      if (data.token) {
        full += data.token;
        onToken(data.token);
      }
    }
  }
  return full;
}

export async function streamGuestChat({ sessionId, mode, model, message, history = [], canvas = null, onToken }) {
  const response = await fetch(`${API_BASE}/api/ai/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, mode, model, message, history, canvas }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'AI request gagal.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const line = event.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.error) throw new Error(data.error);
      if (data.token) {
        full += data.token;
        onToken(data.token);
      }
    }
  }
  return full;
}
