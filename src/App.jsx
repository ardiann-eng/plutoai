import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  Code2,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Download,
  FileText,
  Image,
  Menu,
  Mic,
  MoonStar,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MODEL_OPTIONS, askPluto } from './services/openai.js';
import { authApi, clearAuth, getStoredAuth, saveAuth, streamChat, streamGuestChat } from './services/api.js';
import { downloadJson, loadStored, saveStored } from './utils/storage.js';

const STORAGE_KEY = 'pluto.sessions.v1';
const MODEL_KEY = 'pluto.model.v1';
const THEME_KEY = 'pluto.theme.v1';
const WELCOME_AUTH_KEY = 'pluto.auth.welcome.v1';

function normalizeTheme(value) {
  if (value === 'Light' || value === 'Orbit violet') return 'Light';
  return 'Dark';
}

const modes = [
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'coding', label: 'Coding', icon: Code2 },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'file', label: 'File', icon: FileText },
  { id: 'workspace', label: 'Workspace', icon: BrainCircuit },
];

const menu = [
  ['chat', 'Chat AI', Bot],
  ['coding', 'Coding', Code2],
  ['image', 'Gambar AI', Image],
  ['file', 'File', FileText],
  ['workspace', 'Workspace', BrainCircuit],
  ['settings', 'Pengaturan', Settings],
];

const quickPrompts = [
  'Tulis rencana produk AI',
  'Debug kode JavaScript saya',
  'Buat prompt gambar premium',
  'Ringkas dokumen ini',
];

const imageStyles = ['Realistic', '3D', 'Anime', 'Logo', 'Space Art'];
const canvasTypes = ['Document', 'Code', 'Plan', 'Project'];
const canvasLanguages = ['javascript', 'jsx', 'typescript', 'tsx', 'html', 'css', 'sql', 'markdown'];
const languageExtensions = { javascript: 'js', jsx: 'jsx', typescript: 'ts', tsx: 'tsx', html: 'html', css: 'css', sql: 'sql', markdown: 'md' };

function createCanvas(type = 'Document') {
  const id = crypto.randomUUID();
  const titles = { Document: 'Untitled Document', Code: 'Code Canvas', Plan: 'Plan Canvas', Project: 'HTML Website' };
  const files = type === 'Project' ? createHtmlProjectFiles() : [];
  return {
    id,
    title: titles[type] || 'Untitled Canvas',
    type,
    language: type === 'Code' ? 'javascript' : 'markdown',
    content: '',
    files,
    activeFileId: files[0]?.id || null,
    versions: [],
    selection: null,
    savedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createHtmlProjectFiles() {
  return [
    {
      id: crypto.randomUUID(),
      path: 'index.html',
      language: 'html',
      content: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Pluto Project</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main class="hero">\n      <p>Pluto Canvas</p>\n      <h1>Build something cosmic.</h1>\n      <button id="cta">Launch</button>\n    </main>\n    <script src="main.js"></script>\n  </body>\n</html>',
    },
    {
      id: crypto.randomUUID(),
      path: 'style.css',
      language: 'css',
      content: ':root {\n  font-family: Inter, system-ui, sans-serif;\n  color: #f8f4ff;\n  background: #080615;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n}\n\n.hero {\n  width: min(720px, calc(100% - 32px));\n  padding: 56px;\n  border: 1px solid rgba(255,255,255,.12);\n  border-radius: 32px;\n  background: linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.03));\n}\n\n.hero p { color: #c4b5fd; }\n.hero h1 { font-size: clamp(42px, 8vw, 88px); line-height: .95; margin: 0 0 24px; }\nbutton { padding: 12px 18px; border: 0; border-radius: 999px; color: white; background: linear-gradient(135deg, #7c3aed, #2563eb); }',
    },
    {
      id: crypto.randomUUID(),
      path: 'main.js',
      language: 'javascript',
      content: "document.getElementById('cta')?.addEventListener('click', () => {\n  alert('Welcome to Pluto.');\n});",
    },
  ];
}

function createSession() {
  const id = crypto.randomUUID();
  return {
    id,
    title: 'Eksplorasi baru',
    mode: 'chat',
    messages: [],
    files: [],
    notes: '',
    codeOutput: '',
    workspaceTab: 'context',
    canvases: [createCanvas('Document')],
    activeCanvasId: null,
    pseudoFiles: [],
    terminalOutput: '',
    chatSummary: '',
    savedPrompts: [],
    imageSettings: { style: 'Space Art', aspectRatio: '16:9', negativePrompt: '', seed: '' },
    imageResults: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export function App() {
  const [sessions, setSessions] = useState(() => loadStored(STORAGE_KEY, [createSession()]));
  const [activeId, setActiveId] = useState(() => loadStored(STORAGE_KEY, [])[0]?.id);
  const [model, setModel] = useState(() => {
    const stored = localStorage.getItem(MODEL_KEY);
    return MODEL_OPTIONS.some((item) => item.name === stored) ? stored : 'Pluto Apex';
  });
  const [theme, setTheme] = useState(() => normalizeTheme(localStorage.getItem(THEME_KEY)));
  const [composer, setComposer] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [authState, setAuthState] = useState(() => getStoredAuth());
  const [authOpen, setAuthOpen] = useState(() => !localStorage.getItem(WELCOME_AUTH_KEY));
  const [authMode, setAuthMode] = useState('login');
  const [usage, setUsage] = useState(null);
  const [memories, setMemories] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [imageStyle, setImageStyle] = useState('Space Art');
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);
  const isMobile = useIsMobile();

  const activeSession = useMemo(() => {
    return sessions.find((session) => session.id === activeId) || sessions[0];
  }, [activeId, sessions]);

  useEffect(() => {
    if (!activeId && sessions[0]) setActiveId(sessions[0].id);
  }, [activeId, sessions]);

  useEffect(() => {
    if (!isMobile && activeSession?.mode === 'image') setWorkspaceOpen(true);
    if (isMobile) setWorkspaceOpen(false);
  }, [activeSession?.id, activeSession?.mode, isMobile]);

  useEffect(() => saveStored(STORAGE_KEY, sessions), [sessions]);
  useEffect(() => localStorage.setItem(MODEL_KEY, model), [model]);
  useEffect(() => localStorage.setItem(THEME_KEY, theme), [theme]);

  useEffect(() => {
    if (!authState.token) return;
    refreshAccountData();
  }, [authState.token]);

  const refreshAccountData = async () => {
    if (!authState.token) return;
    try {
      const [usageData, memoryData, sessionData] = await Promise.all([authApi.usage(authState.token), authApi.memories(authState.token), authApi.sessions(authState.token)]);
      setUsage(usageData);
      setMemories(memoryData.memories || []);
      const cloudSessions = sessionData.sessions || [];
      if (cloudSessions.length) {
        setSessions((current) => {
          const localOnly = current.filter((session) => !cloudSessions.some((cloud) => cloud.id === session.id));
          return [...cloudSessions, ...localOnly].sort((a, b) => b.updatedAt - a.updatedAt);
        });
        setActiveId((id) => id || cloudSessions[0].id);
      }
    } catch (error) {
      console.warn(error.message);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setSettingsOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateSession = (id, updater) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...updater(session), updatedAt: Date.now() } : session,
      ),
    );
  };

  const startNewChat = () => {
    const next = createSession();
    setSessions((current) => [next, ...current]);
    setActiveId(next.id);
    setDrawerOpen(false);
  };

  const selectMode = (mode) => {
    if (mode === 'settings') return setSettingsOpen(true);
    if (mode === 'workspace') {
      setWorkspaceOpen(false);
      setCanvasOpen(false);
    }
    if (!isMobile && mode === 'image') setWorkspaceOpen(true);
    if (mode === 'chat' || mode === 'file' || mode === 'coding') setWorkspaceOpen(false);
    updateSession(activeSession.id, (session) => ({ ...session, mode }));
  };

  const sendMessage = async (overridePrompt) => {
    const prompt = (overridePrompt ?? composer).trim();
    if (!prompt || isTyping || !activeSession) return;
    if (/^(login|masuk|signup|sign up|daftar|register)$/i.test(prompt)) {
      setAuthMode(/login|masuk/i.test(prompt) ? 'login' : 'signup');
      setAuthOpen(true);
      setComposer('');
      return;
    }

    const mode = activeSession.mode;
    const history = activeSession.messages.slice(-8).map((message) => ({ role: message.role, content: message.content }));
    const activeCanvas = activeSession.canvases?.find((canvas) => canvas.id === activeSession.activeCanvasId) || activeSession.canvases?.[0] || null;
    const userMessage = { id: crypto.randomUUID(), role: 'user', content: prompt, createdAt: Date.now() };
    const assistantId = crypto.randomUUID();
    const title = activeSession.messages.length ? activeSession.title : prompt.slice(0, 34);
    setComposer('');
    abortRef.current = false;
    updateSession(activeSession.id, (session) => ({
      ...session,
      title,
      messages: [...session.messages, userMessage, { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }],
    }));
    if (!authState.token) syncSession(activeSession, userMessage);
    setIsTyping(true);

    try {
      if (authState.token) {
        let streamed = '';
        const response = await streamChat({
          token: authState.token,
          sessionId: activeSession.id,
          mode,
          model,
          message: prompt,
          history,
          canvas: activeCanvas,
          onToken: (token) => {
            if (abortRef.current) return;
            streamed += token;
            updateSession(activeSession.id, (session) => ({
              ...session,
              messages: session.messages.map((message) => message.id === assistantId ? { ...message, content: streamed } : message),
            }));
          },
        });
        updateSession(activeSession.id, (session) => ({
          ...session,
          codeOutput: mode === 'coding' ? response : session.codeOutput,
          pseudoFiles: mode === 'coding' ? [{ id: crypto.randomUUID(), name: 'pluto-output.js', content: response }] : session.pseudoFiles,
          terminalOutput: mode === 'coding' ? '$ node pluto-output.js\nArtifact kode siap direview.' : session.terminalOutput,
          imageResults: mode === 'image' ? [{ id: crypto.randomUUID(), prompt, style: imageStyle, createdAt: Date.now() }, ...session.imageResults] : session.imageResults,
        }));
        return;
      }
      let response;
      try {
        let streamed = '';
        response = await streamGuestChat({
          sessionId: activeSession.id,
            mode,
            model,
            message: prompt,
            history,
            canvas: activeCanvas,
            onToken: (token) => {
            if (abortRef.current) return;
            streamed += token;
            updateSession(activeSession.id, (session) => ({
              ...session,
              messages: session.messages.map((message) => message.id === assistantId ? { ...message, content: streamed } : message),
            }));
          },
        });
      } catch {
        response = await askPluto({ mode, prompt, model, files: activeSession.files });
        await streamAssistantMessage(activeSession.id, assistantId, response);
      }
      if (!abortRef.current) {
        const assistantMessage = { id: assistantId, role: 'assistant', content: response, createdAt: Date.now() };
        syncSession(activeSession, assistantMessage);
        updateSession(activeSession.id, (session) => ({
          ...session,
          codeOutput: mode === 'coding' ? response : session.codeOutput,
          pseudoFiles: mode === 'coding' ? [{ id: crypto.randomUUID(), name: 'pluto-output.js', content: response }] : session.pseudoFiles,
          terminalOutput: mode === 'coding' ? '$ node pluto-output.js\nArtifact kode siap direview.' : session.terminalOutput,
          imageResults:
            mode === 'image'
              ? [{ id: crypto.randomUUID(), prompt, style: imageStyle, createdAt: Date.now() }, ...session.imageResults]
              : session.imageResults,
        }));
      }
    } catch (error) {
      updateSession(activeSession.id, (session) => ({
        ...session,
        messages: session.messages.map((message) =>
          message.id === assistantId ? { ...message, content: error.message } : message,
        ),
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const syncSession = async (session, message) => {
    if (!authState.token) return;
    try {
      await authApi.saveSession(session, authState.token, model);
      if (message) await authApi.saveMessage(session.id, message, authState.token);
    } catch (error) {
      console.warn('Sinkron Turso gagal:', error.message);
    }
  };

  const handleAuth = async (payload) => {
    const result = authMode === 'login' ? await authApi.login(payload) : await authApi.signup(payload);
    saveAuth(result);
    localStorage.setItem(WELCOME_AUTH_KEY, 'seen');
    setAuthState(result);
    setAuthOpen(false);
  };

  const continueGuest = () => {
    localStorage.setItem(WELCOME_AUTH_KEY, 'seen');
    setAuthOpen(false);
  };

  const logout = () => {
    clearAuth();
    setAuthState({ token: null, user: null });
  };

  const streamAssistantMessage = async (sessionId, messageId, fullText) => {
    let streamed = '';
    for (const char of fullText) {
      if (abortRef.current) break;
      streamed += char;
      updateSession(sessionId, (session) => ({
        ...session,
        messages: session.messages.map((message) =>
          message.id === messageId ? { ...message, content: streamed } : message,
        ),
      }));
      await new Promise((resolve) => setTimeout(resolve, char === '\n' ? 18 : 7));
    }
  };

  const stopGenerating = () => {
    abortRef.current = true;
    setIsTyping(false);
  };

  const regenerateLast = () => {
    const lastUser = [...activeSession.messages].reverse().find((message) => message.role === 'user');
    if (lastUser) sendMessage(lastUser.content);
  };

  const deleteMessage = (messageId) => {
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.filter((message) => message.id !== messageId),
    }));
  };

  const editMessage = (messageId) => {
    const index = activeSession.messages.findIndex((message) => message.id === messageId);
    const message = activeSession.messages[index];
    if (!message || message.role !== 'user') return;
    setComposer(message.content);
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: session.messages.slice(0, index),
    }));
  };

  const renameSession = (id) => {
    const session = sessions.find((item) => item.id === id);
    const title = prompt('Nama sesi Pluto', session?.title || 'Sesi Pluto');
    if (title?.trim()) updateSession(id, (item) => ({ ...item, title: title.trim() }));
  };

  const deleteSession = (id) => {
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== id);
      if (!remaining.length) return [createSession()];
      return remaining;
    });
  };

  const attachFiles = async (event) => {
    const rawFiles = Array.from(event.target.files || []);
    const files = rawFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || 'File lokal',
      createdAt: Date.now(),
    }));
    if (files.length) updateSession(activeSession.id, (session) => ({ ...session, files: [...files, ...session.files] }));
    if (authState.token) {
      for (const file of rawFiles) {
        const isText = /text|json|javascript|typescript|css|html|csv|markdown/.test(file.type) || /\.(txt|md|json|csv|js|jsx|ts|tsx|html|css)$/i.test(file.name);
        if (!isText) continue;
        try {
          await authApi.uploadTextFile({ sessionId: activeSession.id, name: file.name, size: file.size, type: file.type, content: await file.text() }, authState.token);
        } catch (error) {
          setComposer((value) => `${value}${value ? '\n' : ''}${error.message}`);
        }
      }
    }
    event.target.value = '';
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setComposer((value) => `${value}${value ? '\n' : ''}Voice input tidak tersedia di browser ini.`);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setComposer((value) => `${value}${value ? ' ' : ''}${event.results[0][0].transcript}`);
    };
    recognition.start();
  };

  const clearAllData = () => {
    if (!confirm('Hapus semua data lokal Pluto? Aksi ini tidak bisa dibatalkan.')) return;
    const fresh = createSession();
    setSessions([fresh]);
    setActiveId(fresh.id);
    localStorage.removeItem(STORAGE_KEY);
  };

  const importJson = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (Array.isArray(data.sessions)) {
      setSessions(data.sessions);
      setActiveId(data.sessions[0]?.id);
    }
    event.target.value = '';
  };

  if (!activeSession) return null;
  const isCanvasMode = activeSession.mode === 'workspace';
  const effectiveWorkspaceOpen = !isCanvasMode && (workspaceOpen || (!isMobile && activeSession.mode === 'image'));

  return (
    <main className={`app-shell theme-${theme.toLowerCase()} layout-${activeSession.mode} ${effectiveWorkspaceOpen ? 'workspace-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <SpaceBackdrop />
      <Sidebar
        sessions={sessions}
        activeId={activeSession.id}
        activeMode={activeSession.mode}
        drawerOpen={drawerOpen}
        collapsed={sidebarCollapsed}
        query={historyQuery}
        onClose={() => setDrawerOpen(false)}
        onCollapse={() => setSidebarCollapsed((value) => !value)}
        onQuery={setHistoryQuery}
        onNew={startNewChat}
        onSelect={(id) => {
          setActiveId(id);
          setDrawerOpen(false);
        }}
        onMode={selectMode}
        onRename={renameSession}
        onDelete={deleteSession}
        authState={authState}
        onAuth={() => setAuthOpen(true)}
        onLogout={logout}
      />

      <section className="main-panel">
        <ChatHeader
          mode={activeSession.mode}
          model={model}
          theme={theme}
          onMenu={() => setDrawerOpen(true)}
          onModel={setModel}
          onSettings={() => setSettingsOpen(true)}
          onTheme={() => setTheme(theme === 'Dark' ? 'Light' : 'Dark')}
          onCommand={() => setCommandOpen(true)}
        />

        {isCanvasMode ? (
          <CanvasStage
            session={activeSession}
            composer={composer}
            isTyping={isTyping}
            open={canvasOpen}
            onUpdate={(patch) => updateSession(activeSession.id, (s) => ({ ...s, ...patch }))}
            onCloudSave={(updatedSession) => syncSession(updatedSession)}
            onOpen={setCanvasOpen}
            onComposer={setComposer}
            onSend={() => sendMessage()}
            onStop={stopGenerating}
            onAttach={() => fileInputRef.current?.click()}
            onVoice={startVoice}
          />
        ) : (
          <ChatWindow
            session={activeSession}
            isTyping={isTyping}
            onPrompt={sendMessage}
            onCopy={(text) => navigator.clipboard.writeText(text)}
            onDelete={deleteMessage}
            onEdit={editMessage}
            onRegenerate={regenerateLast}
          />
        )}

        {!isCanvasMode && (
          <Composer
            value={composer}
            mode={activeSession.mode}
            imageStyle={imageStyle}
            disabled={isTyping}
            isTyping={isTyping}
            onChange={setComposer}
            onSend={() => sendMessage()}
            onStop={stopGenerating}
            onMode={selectMode}
            onAttach={() => fileInputRef.current?.click()}
            onVoice={startVoice}
            onImageStyle={setImageStyle}
          />
        )}
      </section>

      {effectiveWorkspaceOpen && <WorkspacePanel session={activeSession} onUpdate={(patch) => updateSession(activeSession.id, (s) => ({ ...s, ...patch }))} onClose={() => setWorkspaceOpen(false)} />}

      <input ref={fileInputRef} className="hidden" type="file" multiple onChange={attachFiles} />
      <SettingsModal
        open={settingsOpen}
        model={model}
        theme={theme}
        sessions={sessions}
        onClose={() => setSettingsOpen(false)}
        onModel={setModel}
        onTheme={setTheme}
        onClear={clearAllData}
        onExport={() => downloadJson('pluto-chat-export.json', { sessions, model, theme })}
        onImport={importJson}
        authState={authState}
        usage={usage}
        memories={memories}
        onUpgrade={async () => { const data = await authApi.upgrade(authState.token); setUsage(data); }}
        onDeleteMemory={async (id) => { await authApi.deleteMemory(id, authState.token); refreshAccountData(); }}
      />
      <CommandPalette
        open={commandOpen}
        sessions={sessions}
        token={authState.token}
        onClose={() => setCommandOpen(false)}
        onNew={startNewChat}
        onSettings={() => setSettingsOpen(true)}
        onWorkspace={() => setWorkspaceOpen((value) => !value)}
        onSelectSession={setActiveId}
        onMode={selectMode}
      />
      <AuthModal open={authOpen} mode={authMode} onMode={setAuthMode} onSubmit={handleAuth} onGuest={continueGuest} onClose={continueGuest} />
    </main>
  );
}

function SpaceBackdrop() {
  return (
    <div className="space-backdrop" aria-hidden="true">
      <div className="pluto-orbit" />
      <div className="pluto-planet" />
      <div className="nebula nebula-one" />
      <div className="nebula nebula-two" />
    </div>
  );
}

function Sidebar(props) {
  const { sessions, activeId, activeMode, drawerOpen, collapsed, query, authState, onClose, onCollapse, onQuery, onNew, onSelect, onMode, onRename, onDelete, onAuth, onLogout } = props;
  const filteredSessions = sessions.filter((session) => session.title.toLowerCase().includes(query.toLowerCase()));
  const grouped = groupSessions(filteredSessions);
  return (
    <aside className={`sidebar glass ${drawerOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="mobile-close"><button onClick={onClose}><X size={18} /></button></div>
      <div className="sidebar-top"><div className="brand"><strong>Pluto</strong></div><button className="collapse-btn" onClick={onCollapse}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <button className="new-chat" onClick={onNew}><Plus size={18} /> <span>Chat Baru</span></button>
      <input className="history-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Cari riwayat..." />
      <nav className="feature-menu">
        {menu.map(([id, label, Icon]) => (
          <button key={id} className={activeMode === id ? 'active' : ''} onClick={() => { onMode(id); onClose(); }} title={label}><Icon size={17} /> <span>{label}</span></button>
        ))}
      </nav>
      <div className="history-title">Riwayat Chat</div>
      <div className="history-list">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="history-group">
            <span>{group}</span>
            {items.map((session) => (
              <div key={session.id} className={`history-item ${session.id === activeId ? 'active' : ''}`}>
                <button onClick={() => onSelect(session.id)}>{session.title}</button>
                <span onClick={() => onRename(session.id)}><PenLine size={14} /></span>
                <span onClick={() => onDelete(session.id)}><Trash2 size={14} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="local-status auth-status">
        {authState.user ? <button onClick={onLogout}>Keluar</button> : <button onClick={onAuth}>Login</button>}
      </div>
    </aside>
  );
}

function groupSessions(sessions) {
  const now = new Date();
  return sessions.reduce((groups, session) => {
    const days = Math.floor((now - new Date(session.updatedAt)) / 86400000);
    const key = days < 1 ? 'Hari ini' : days < 2 ? 'Kemarin' : days < 7 ? '7 hari terakhir' : 'Lebih lama';
    groups[key] = [...(groups[key] || []), session];
    return groups;
  }, {});
}

function ChatHeader({ mode, model, theme, onMenu, onModel, onSettings, onTheme, onCommand }) {
  const label = modes.find((item) => item.id === mode)?.label || 'Chat';
  return (
    <header className="chat-header glass">
      <button className="icon mobile-menu" onClick={onMenu}><Menu /></button>
      <div><span>{label === 'Coding' ? 'Mode Coding' : label === 'Image' ? 'Gambar AI' : label === 'Workspace' ? 'AI Canvas' : 'Chat AI'}</span><strong>{label === 'Workspace' ? 'Workspace canvas' : 'Mulai eksplorasi'}</strong></div>
      <div className="header-actions">
        <ModelSelector value={model} onChange={onModel} />
        <button onClick={onTheme} className="pill">{theme}</button>
        <button className="icon" onClick={onSettings}><Settings /></button>
      </div>
    </header>
  );
}

function ModelSelector({ value, onChange }) {
  return <CustomSelect value={value} options={MODEL_OPTIONS} onChange={onChange} className="model-select" />;
}

function CustomSelect({ value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return (
    <div className={`custom-select ${className}`} ref={ref}>
      <button className="select-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        <span>{value}</span>
        <ChevronDown size={16} className={open ? 'rotate' : ''} />
      </button>
      {open && (
        <div className="select-menu glass">
          {options.map((option) => (
            (() => {
              const item = typeof option === 'string' ? { name: option } : option;
              return (
            <button
              key={item.id || item.name}
              type="button"
              className={item.name === value ? 'selected' : ''}
              onClick={() => {
                onChange(item.name);
                setOpen(false);
              }}
            >
              <span className="select-copy"><strong>{item.name}</strong>{item.detail && <small>{item.detail}</small>}</span>
              {item.badge && <em>{item.badge}</em>}
              {item.name === value && <Check size={15} />}
            </button>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
}

function ChatWindow({ session, isTyping, onPrompt, onCopy, onDelete, onEdit, onRegenerate }) {
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [session.messages, isTyping]);
  return (
    <div className="chat-window">
      {!session.messages.length ? <WelcomeScreen mode={session.mode} onPrompt={onPrompt} /> : session.messages.map((message) => (
        <MessageBubble key={message.id} message={message} onCopy={onCopy} onDelete={onDelete} onEdit={onEdit} />
      ))}
      {isTyping && <div className="typing"><span /><span /><span /> Pluto sedang merangkai orbit jawaban...</div>}
      {!!session.messages.length && !isTyping && <button className="regenerate" onClick={onRegenerate}><RefreshCw size={15} /> Regenerate response</button>}
      <div ref={endRef} />
    </div>
  );
}

function WelcomeScreen({ mode, onPrompt }) {
  const copy = {
    chat: ['Apa yang ingin kamu eksplorasi?', 'Percakapan tenang untuk ide, riset, dan keputusan cepat.', ['Buat ringkasan strategi produk', 'Tulis email profesional', 'Susun rencana belajar', 'Cari ide konten premium']],
    coding: ['Bangun kode lebih cepat', 'Tulis, debug, refactor, dan simpan artifact kode di workspace.', ['Buat komponen React', 'Debug kode JavaScript saya', 'Refactor fungsi ini', 'Buat struktur API backend']],
    image: ['Ciptakan gambar dari imajinasi', 'Studio visual untuk prompt, style, rasio, dan galeri hasil.', ['Planet Pluto luxury cinematic', 'Logo SaaS luar angkasa', 'Poster nebula violet', 'Karakter astronot elegan']],
    file: ['Bawa file sebagai konteks', 'Upload file lokal lalu pakai sebagai konteks percakapan.', ['Ringkas dokumen ini', 'Cari poin penting', 'Buat action items', 'Bandingkan isi file']],
  }[mode] || ['Pluto', 'Asisten AI luar angkasa untuk chat, coding, gambar, dan ide tanpa batas.', quickPrompts];
  return (
    <section className="welcome">
      <h1>{copy[0]}</h1>
      <p>{copy[1]}</p>
      <div className="quick-grid">{copy[2].map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)}>{prompt}</button>)}</div>
      <div className="feature-cards">{['Chat AI', 'Coding', 'Gambar AI', 'File Context', 'Voice Input'].map((item) => <article key={item}>{item}<span>Tanyakan apa saja</span></article>)}</div>
    </section>
  );
}

function MessageBubble({ message, onCopy, onDelete, onEdit }) {
  const chunks = parseCodeBlocks(message.content);
  return (
    <article className={`message ${message.role}`} tabIndex={0}>
      <div className="bubble glass">
        {message.role === 'user' && <button className="inline-edit" onClick={() => onEdit(message.id)}><PenLine size={13} /></button>}
        {chunks.map((chunk, index) => chunk.type === 'code' ? <CodeBlock key={index} code={chunk.value} language={chunk.language} onCopy={onCopy} /> : <MarkdownText key={index} text={chunk.value} />)}
        <div className="message-actions">
          <button onClick={() => onCopy(message.content)}><Copy size={14} /> Copy</button>
          <button onClick={() => onDelete(message.id)}><Trash2 size={14} /> Hapus</button>
        </div>
      </div>
    </article>
  );
}

function MarkdownText({ text }) {
  return <div className="markdown">{text.split('\n').filter((line) => line.trim()).map((line, index) => <p key={index}><InlineMarkdown text={line} /></p>)}</div>;
}

function InlineMarkdown({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>);
}

function CodeBlock({ code, language = 'kode', onCopy }) {
  return <div className="code-block"><div className="code-head"><span>{language || 'kode'}</span><button onClick={() => onCopy(code)}><Copy size={13} /> Copy</button></div><pre><code>{code}</code></pre></div>;
}

function parseCodeBlocks(text) {
  const chunks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) chunks.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    chunks.push({ type: 'code', language: match[1] || 'kode', value: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    const fenceIndex = rest.indexOf('```');
    if (fenceIndex >= 0) {
      if (fenceIndex > 0) chunks.push({ type: 'text', value: rest.slice(0, fenceIndex) });
      const openFence = rest.slice(fenceIndex).match(/^```(\w+)?\n?([\s\S]*)$/);
      chunks.push({ type: 'code', language: openFence?.[1] || 'kode', value: openFence?.[2] || '' });
    } else chunks.push({ type: 'text', value: rest });
  }
  return chunks.length ? chunks : [{ type: 'text', value: text }];
}

function Composer({ value, mode, imageStyle, disabled, isTyping, onChange, onSend, onStop, onMode, onAttach, onVoice, onImageStyle }) {
  const textRef = useRef(null);
  useEffect(() => {
    if (!textRef.current) return;
    textRef.current.style.height = 'auto';
    textRef.current.style.height = `${Math.min(textRef.current.scrollHeight, 180)}px`;
  }, [value]);
  const placeholder = {
    chat: 'Tanyakan apa saja...',
    coding: 'Minta Pluto menulis, debug, atau refactor kode...',
    image: 'Deskripsikan gambar yang ingin dibuat...',
    file: 'Tanyakan sesuatu dari file atau konteks...',
  }[mode] || 'Tanyakan apa saja...';

  return (
      <div className="composer glass">
      <div className="composer-row">
        <button className="icon" onClick={onAttach}><Paperclip /></button>
        <textarea ref={textRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
        <button className="icon" onClick={onVoice}><Mic /></button>
        {isTyping ? <button className="send stop" onClick={onStop}><X size={18} /></button> : <button className="send" disabled={!value.trim() || disabled} onClick={onSend}><Send size={18} /></button>}
      </div>
    </div>
  );
}

function CanvasStage({ session, composer, isTyping, open, onUpdate, onCloudSave, onOpen, onComposer, onSend, onStop, onAttach, onVoice }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const canvases = session.canvases?.length ? session.canvases : [createCanvas('Document')];
  const activeCanvas = canvases.find((canvas) => canvas.id === session.activeCanvasId) || canvases[0];
  const lastAssistant = [...session.messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());

  const saveCanvases = (nextCanvases, activeCanvasId = activeCanvas.id) => {
    onUpdate({ canvases: nextCanvases, activeCanvasId });
  };

  const updateCanvas = (patch) => {
    saveCanvases(canvases.map((canvas) => (
      canvas.id === activeCanvas.id ? { ...canvas, ...patch, updatedAt: Date.now() } : canvas
    )));
  };

  const saveCanvas = () => {
    const savedAt = Date.now();
    const nextCanvases = canvases.map((canvas) => (
      canvas.id === activeCanvas.id ? { ...canvas, savedAt, updatedAt: savedAt } : canvas
    ));
    saveCanvases(nextCanvases);
    onCloudSave?.({ ...session, canvases: nextCanvases, activeCanvasId: activeCanvas.id });
  };

  const downloadCanvas = () => {
    const extension = activeCanvas.type === 'Project' ? 'html' : activeCanvas.type === 'Code' ? (languageExtensions[activeCanvas.language] || 'txt') : 'md';
    const safeTitle = (activeCanvas.title || 'pluto-canvas').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pluto-canvas';
    const content = activeCanvas.type === 'Project' ? buildProjectPreview(activeCanvas.files || []) : activeCanvas.content || '';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addCanvas = () => {
    const next = createCanvas('Document');
    saveCanvases([next, ...canvases], next.id);
    onOpen(true);
  };

  const deleteCanvas = () => {
    if (canvases.length <= 1) return updateCanvas({ content: '', title: activeCanvas.title || 'Untitled Document' });
    const remaining = canvases.filter((canvas) => canvas.id !== activeCanvas.id);
    saveCanvases(remaining, remaining[0].id);
  };

  const duplicateCanvas = (id) => {
    const source = canvases.find((canvas) => canvas.id === id);
    if (!source) return;
    const copy = { ...source, id: crypto.randomUUID(), title: `${source.title} Copy`, createdAt: Date.now(), updatedAt: Date.now(), savedAt: null, versions: [] };
    saveCanvases([copy, ...canvases], copy.id);
  };

  const deleteCanvasById = (id) => {
    if (canvases.length <= 1) return;
    const remaining = canvases.filter((canvas) => canvas.id !== id);
    saveCanvases(remaining, remaining[0].id);
  };

  const applyAssistant = (mode) => {
    if (!lastAssistant) return;
    const content = extractCanvasPayload(lastAssistant.content, activeCanvas.type);
    const snapshot = {
      content: activeCanvas.content || '',
      title: activeCanvas.title,
      type: activeCanvas.type,
      language: activeCanvas.language,
      createdAt: Date.now(),
    };
    updateCanvas({
      content: mode === 'append' && activeCanvas.content ? `${activeCanvas.content.trim()}\n\n${content}` : content,
      versions: [snapshot, ...(activeCanvas.versions || [])].slice(0, 10),
    });
  };

  const applyToSelection = () => {
    if (!lastAssistant || !activeCanvas.selection) return;
    const content = extractCanvasPayload(lastAssistant.content, activeCanvas.type);
    const snapshot = { content: activeCanvas.content || '', title: activeCanvas.title, type: activeCanvas.type, language: activeCanvas.language, createdAt: Date.now() };
    const { start, end } = activeCanvas.selection;
    updateCanvas({
      content: `${activeCanvas.content.slice(0, start)}${content}${activeCanvas.content.slice(end)}`,
      versions: [snapshot, ...(activeCanvas.versions || [])].slice(0, 10),
      selection: null,
    });
  };

  const createCanvasFromAssistant = () => {
    if (!lastAssistant) return;
    const content = extractCanvasPayload(lastAssistant.content, activeCanvas.type);
    const next = { ...createCanvas(activeCanvas.type), title: `${activeCanvas.title} - AI Draft`, language: activeCanvas.language, content, savedAt: null };
    saveCanvases([next, ...canvases], next.id);
  };

  const undoCanvas = () => {
    const [latest, ...rest] = activeCanvas.versions || [];
    if (!latest) return;
    updateCanvas({ ...latest, versions: rest });
  };

  const restoreVersion = (version) => updateCanvas({ ...version, versions: activeCanvas.versions || [] });

  const captureSelection = (event) => {
    const { selectionStart, selectionEnd } = event.target;
    updateCanvas({ selection: selectionEnd > selectionStart ? { start: selectionStart, end: selectionEnd, text: activeCanvas.content.slice(selectionStart, selectionEnd) } : null });
  };

  if (!open) {
    return <WorkspaceHome canvases={canvases} onCreate={addCanvas} onOpenCanvas={(id) => { onUpdate({ activeCanvasId: id }); onOpen(true); }} onDuplicate={duplicateCanvas} onDelete={deleteCanvasById} />;
  }

  return (
    <section className="canvas-stage">
      <div className="canvas-stage-toolbar glass">
        <div className="canvas-title-stack">
          <button className="canvas-back" onClick={() => onOpen(false)}>Back to workspace</button>
          <div>
            <span>AI Canvas</span>
            <strong>{activeCanvas.title}</strong>
          </div>
        </div>
        <div className="canvas-stage-actions">
          <CustomSelect value={activeCanvas.type} options={canvasTypes} onChange={(type) => updateCanvas({ type, language: type === 'Code' ? 'javascript' : 'markdown' })} />
          {activeCanvas.type === 'Code' && <CustomSelect value={activeCanvas.language || 'javascript'} options={canvasLanguages} onChange={(language) => updateCanvas({ language })} />}
          <button onClick={() => setPreviewOpen((value) => !value)}><FileText size={15} /> {previewOpen ? 'Edit' : 'Preview'}</button>
          <button onClick={saveCanvas}><Check size={15} /> Save</button>
          <button onClick={downloadCanvas}><Download size={15} /> Download</button>
          <button onClick={addCanvas}><Plus size={15} /> New</button>
          <button onClick={deleteCanvas}><Trash2 size={15} /></button>
        </div>
      </div>
      <div className="canvas-sheet glass">
        <div className="canvas-sheet-head">
          <input value={activeCanvas.title} onChange={(event) => updateCanvas({ title: event.target.value || 'Untitled Canvas' })} placeholder="Nama canvas" />
          <span className={activeCanvas.savedAt && activeCanvas.updatedAt <= activeCanvas.savedAt ? 'saved' : 'unsaved'}>{activeCanvas.savedAt && activeCanvas.updatedAt <= activeCanvas.savedAt ? `Synced ${new Date(activeCanvas.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Unsaved changes'}</span>
        </div>
        {activeCanvas.type === 'Project' ? (
          <ProjectEditor canvas={activeCanvas} previewOpen={previewOpen} onUpdate={updateCanvas} />
        ) : previewOpen ? (
          <CanvasPreview canvas={activeCanvas} />
        ) : (
          <textarea
            className={`canvas-stage-editor canvas-${activeCanvas.type.toLowerCase()}`}
            value={activeCanvas.content}
            onChange={(event) => updateCanvas({ content: event.target.value })}
            onSelect={captureSelection}
            placeholder={activeCanvas.type === 'Code' ? 'Tulis atau paste kode di sini...' : activeCanvas.type === 'Plan' ? 'Tulis rencana, task, atau checklist...' : 'Mulai tulis dokumen, ide, proposal, atau draft di canvas ini...'}
          />
        )}
        <CanvasHistory versions={activeCanvas.versions || []} onRestore={restoreVersion} />
      </div>
      <FloatingCanvasComposer
        value={composer}
        canvas={activeCanvas}
        isTyping={isTyping}
        onChange={onComposer}
        onSend={onSend}
        onStop={onStop}
        onAttach={onAttach}
        onVoice={onVoice}
      />
      <CanvasAIDock assistant={lastAssistant} isTyping={isTyping} hasSelection={Boolean(activeCanvas.selection)} canUndo={Boolean(activeCanvas.versions?.length)} onUndo={undoCanvas} onReplace={() => applyAssistant('replace')} onAppend={() => applyAssistant('append')} onSelection={applyToSelection} onNewCanvas={createCanvasFromAssistant} />
    </section>
  );
}

function ProjectEditor({ canvas, previewOpen, onUpdate }) {
  const files = canvas.files?.length ? canvas.files : createHtmlProjectFiles();
  const activeFile = files.find((file) => file.id === canvas.activeFileId) || files[0];

  const updateFiles = (nextFiles, activeFileId = activeFile.id) => onUpdate({ files: nextFiles, activeFileId });
  const updateFile = (content) => updateFiles(files.map((file) => file.id === activeFile.id ? { ...file, content } : file));
  const addFile = () => {
    const next = { id: crypto.randomUUID(), path: 'new-file.js', language: 'javascript', content: '' };
    updateFiles([...files, next], next.id);
  };
  const deleteFile = () => {
    if (files.length <= 1) return;
    const remaining = files.filter((file) => file.id !== activeFile.id);
    updateFiles(remaining, remaining[0].id);
  };
  const renameFile = (path) => {
    const language = path.endsWith('.css') ? 'css' : path.endsWith('.html') ? 'html' : path.endsWith('.sql') ? 'sql' : 'javascript';
    updateFiles(files.map((file) => file.id === activeFile.id ? { ...file, path, language } : file));
  };

  if (previewOpen) return <iframe className="project-preview" title="Project preview" sandbox="allow-scripts" srcDoc={buildProjectPreview(files)} />;

  return (
    <div className="project-editor">
      <aside className="project-files">
        <div><span>Files</span><button onClick={addFile}><Plus size={13} /></button></div>
        {files.map((file) => <button key={file.id} className={file.id === activeFile.id ? 'active' : ''} onClick={() => onUpdate({ activeFileId: file.id })}>{file.path}</button>)}
      </aside>
      <section className="project-code">
        <div className="project-filebar">
          <input value={activeFile.path} onChange={(event) => renameFile(event.target.value)} />
          <button onClick={deleteFile} disabled={files.length <= 1}><Trash2 size={14} /></button>
        </div>
        <textarea value={activeFile.content} onChange={(event) => updateFile(event.target.value)} spellCheck={false} />
      </section>
    </div>
  );
}

function buildProjectPreview(files) {
  const html = files.find((file) => file.path.endsWith('.html'))?.content || '<main></main>';
  const css = files.filter((file) => file.path.endsWith('.css')).map((file) => file.content).join('\n');
  const js = files.filter((file) => file.path.endsWith('.js')).map((file) => file.content).join('\n');
  return html
    .replace('</head>', `<style>${css}</style></head>`)
    .replace('</body>', `<script>${js}<\/script></body>`);
}

function CanvasPreview({ canvas }) {
  if (!canvas.content?.trim()) return <div className="canvas-preview empty">Canvas masih kosong.</div>;
  if (canvas.type === 'Code') return <pre className="canvas-preview canvas-code"><code>{canvas.content}</code></pre>;
  return <div className="canvas-preview"><MarkdownText text={canvas.content} /></div>;
}

function CanvasHistory({ versions, onRestore }) {
  return (
    <div className="canvas-history">
      <span>History</span>
      <div>
        {versions.length ? versions.slice(0, 4).map((version, index) => (
          <button key={`${version.createdAt}-${index}`} onClick={() => onRestore(version)}>
            <strong>{new Date(version.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            <small>{version.type || 'Canvas'} snapshot</small>
          </button>
        )) : <p>Belum ada history. History muncul setelah Replace, Append, atau Apply Selection.</p>}
      </div>
    </div>
  );
}

function extractCanvasPayload(text, type) {
  if (type === 'Code') {
    const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return text.replace(/```(?:\w+)?\n([\s\S]*?)```/g, '$1').trim();
}

function CanvasAIDock({ assistant, isTyping, hasSelection, canUndo, onUndo, onReplace, onAppend, onSelection, onNewCanvas }) {
  if (!assistant && !isTyping) return null;
  return (
    <aside className="canvas-ai-dock glass">
      <div className="dock-head">
        <div><span>AI Output</span><strong>{isTyping ? 'Pluto sedang bekerja...' : 'Hasil terakhir'}</strong></div>
      </div>
      <div className="dock-body">
        {assistant ? <MarkdownText text={assistant.content.slice(0, 1400)} /> : <p>Menunggu jawaban Pluto...</p>}
      </div>
      {assistant && (
        <div className="dock-actions">
          <button onClick={onReplace}>Replace Canvas</button>
          <button onClick={onAppend}>Append</button>
          <button onClick={onSelection} disabled={!hasSelection}>Apply Selection</button>
          <button onClick={onNewCanvas}>New Canvas</button>
          <button onClick={onUndo} disabled={!canUndo}>Undo</button>
        </div>
      )}
    </aside>
  );
}

function WorkspaceHome({ canvases, onCreate, onOpenCanvas, onDuplicate, onDelete }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const filteredCanvases = canvases.filter((canvas) => {
    const matchesType = filter === 'All' || canvas.type === filter;
    const matchesQuery = `${canvas.title} ${canvas.content}`.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  });
  const stats = [
    ['Canvas', canvases.length],
    ['Document', canvases.filter((canvas) => canvas.type === 'Document').length],
    ['Code', canvases.filter((canvas) => canvas.type === 'Code').length],
  ];

  return (
    <section className="workspace-home">
      <div className="workspace-hero glass">
        <span>AI Workspace</span>
        <h1>Bangun ide di canvas Pluto</h1>
        <p>Pilih canvas yang sudah ada atau buat ruang kerja baru untuk dokumen, kode, dan rencana. Chat AI akan jadi asisten kerja di atas canvas.</p>
        <div className="workspace-hero-actions">
          <button onClick={onCreate}><Plus size={17} /> Buat Canvas</button>
          <button onClick={() => canvases[0] && onOpenCanvas(canvases[0].id)}>Buka Terakhir</button>
        </div>
      </div>
      <div className="workspace-stats">
        {stats.map(([label, value]) => <div className="glass" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="workspace-library glass">
        <div className="library-head"><span>Canvas Library</span><button onClick={onCreate}><Plus size={15} /> New</button></div>
        <div className="library-tools">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari canvas..." />
          <CustomSelect value={filter} options={['All', ...canvasTypes]} onChange={setFilter} />
        </div>
        <div className="library-grid">
          {filteredCanvases.length ? filteredCanvases.map((canvas) => (
            <article key={canvas.id} className="canvas-tile">
              <button className="canvas-tile-main" onClick={() => onOpenCanvas(canvas.id)}>
                <span>{canvas.type}</span>
                <strong>{canvas.title}</strong>
                <p>{canvas.content ? canvas.content.slice(0, 110) : 'Canvas kosong. Klik untuk mulai menulis.'}</p>
              </button>
              <div className="canvas-tile-actions">
                <button onClick={() => onDuplicate(canvas.id)}>Duplicate</button>
                <button onClick={() => onDelete(canvas.id)} disabled={canvases.length <= 1}>Delete</button>
              </div>
            </article>
          )) : <div className="library-empty"><strong>Tidak ada canvas.</strong><p>Coba ubah filter atau buat canvas baru.</p><button onClick={onCreate}><Plus size={15} /> Buat Canvas</button></div>}
        </div>
      </div>
    </section>
  );
}

function FloatingCanvasComposer({ value, canvas, isTyping, onChange, onSend, onStop, onAttach, onVoice }) {
  const [position, setPosition] = useState({ x: 50, y: 88 });
  const dragRef = useRef(null);

  const startDrag = (event) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = position;
    dragRef.current = true;

    const move = (moveEvent) => {
      if (!dragRef.current) return;
      setPosition({
        x: Math.min(92, Math.max(8, startPosition.x + ((moveEvent.clientX - startX) / window.innerWidth) * 100)),
        y: Math.min(90, Math.max(12, startPosition.y + ((moveEvent.clientY - startY) / window.innerHeight) * 100)),
      });
    };
    const stop = () => {
      dragRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  return (
    <div className="floating-composer glass" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
      <span className="composer-context">Using {canvas?.title || 'canvas'}</span>
      <button className="drag-handle" onPointerDown={startDrag} title="Geser input">⋮⋮</button>
      <button className="icon" onClick={onAttach}><Paperclip /></button>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Minta AI mengerjakan canvas ini..." onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
      <button className="icon" onClick={onVoice}><Mic /></button>
      {isTyping ? <button className="send stop" onClick={onStop}><X size={18} /></button> : <button className="send" disabled={!value.trim()} onClick={onSend}><Send size={18} /></button>}
    </div>
  );
}

function ModeSelector({ value, onChange }) {
  return <div className="mode-selector">{modes.map(({ id, label, icon: Icon }) => <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}><Icon size={15} /> {label}</button>)}</div>;
}

function WorkspacePanel({ session, onUpdate, onClose }) {
  if (session.mode === 'coding') return <CodingWorkspace session={session} onUpdate={onUpdate} onClose={onClose} />;
  if (session.mode === 'image') return <ImageWorkspace session={session} onUpdate={onUpdate} onClose={onClose} />;
  return <ChatWorkspace session={session} onUpdate={onUpdate} onClose={onClose} />;
}

function WorkspaceTitle({ children, onClose }) {
  return <div className="workspace-title"><h2>{children}</h2><button onClick={onClose}><X size={16} /></button></div>;
}

function ChatWorkspace({ session, onUpdate, onClose }) {
  return (
    <aside className="workspace glass workspace-chat">
      <WorkspaceTitle onClose={onClose}>Konteks Chat</WorkspaceTitle>
      <CanvasBoard session={session} onUpdate={onUpdate} />
      <div className="workspace-card"><span>Project</span><strong>{session.title}</strong></div>
      <div className="workspace-card"><span>File aktif</span>{session.files.length ? session.files.map((file) => <FileAttachmentCard key={file.id} file={file} />) : <p>Belum ada file.</p>}</div>
      <div className="workspace-card"><span>Ringkasan sesi</span><textarea value={session.chatSummary || ''} onChange={(event) => onUpdate({ chatSummary: event.target.value })} placeholder="Ringkasan percakapan..." /></div>
      <div className="workspace-card"><span>Catatan penting</span><textarea value={session.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value })} placeholder="Catatan konteks..." /></div>
    </aside>
  );
}

function CodingWorkspace({ session, onUpdate, onClose }) {
  const files = session.pseudoFiles?.length ? session.pseudoFiles : [{ id: 'main', name: 'pluto-output.js', content: session.codeOutput || 'Belum ada artifact kode.' }];
  return (
    <aside className="workspace glass workspace-coding">
      <WorkspaceTitle onClose={onClose}>Artifacts Coding</WorkspaceTitle>
      <CanvasBoard session={session} onUpdate={onUpdate} />
      <div className="workspace-tabs"><button className="active">Files</button><button>Code</button><button>Preview</button></div>
      <div className="workspace-card"><span>Files</span>{files.map((file) => <div className="pseudo-file" key={file.id || file.name}><Code2 size={15} /><strong>{file.name}</strong></div>)}</div>
      <div className="workspace-card code-artifact"><span>Code Output</span><pre>{session.codeOutput || 'Kode dari respons Pluto akan muncul di sini.'}</pre></div>
      <div className="workspace-card"><span>Terminal Mock</span><pre>{session.terminalOutput || '$ npm run build\nSiap menjalankan preview mock.'}</pre></div>
      <div className="workspace-card"><span>Todo Coding</span><textarea value={session.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value })} placeholder="Catatan teknis, bug, atau TODO..." /></div>
    </aside>
  );
}

function ImageWorkspace({ session, onUpdate, onClose }) {
  const settings = session.imageSettings || { style: 'Space Art', aspectRatio: '16:9', negativePrompt: '', seed: '' };
  const updateSettings = (patch) => onUpdate({ imageSettings: { ...settings, ...patch } });
  return (
    <aside className="workspace glass workspace-image">
      <WorkspaceTitle onClose={onClose}>Image Studio</WorkspaceTitle>
      <CanvasBoard session={session} onUpdate={onUpdate} />
      <div className="workspace-card"><span>Style</span><CustomSelect value={settings.style} options={imageStyles} onChange={(style) => updateSettings({ style })} /></div>
      <div className="workspace-card"><span>Aspect ratio</span><CustomSelect value={settings.aspectRatio} options={['1:1', '4:5', '16:9', '9:16']} onChange={(aspectRatio) => updateSettings({ aspectRatio })} /></div>
      <div className="workspace-card"><span>Prompt negatif</span><textarea value={settings.negativePrompt} onChange={(event) => updateSettings({ negativePrompt: event.target.value })} placeholder="blur, low quality, distorted..." /></div>
      <div className="workspace-card"><span>Seed</span><input value={settings.seed} onChange={(event) => updateSettings({ seed: event.target.value })} placeholder="Auto" /></div>
      <div className="workspace-card image-gallery"><span>Galeri</span>{session.imageResults?.length ? session.imageResults.map((image) => <ImageResultCard key={image.id} image={image} />) : <p>Hasil gambar akan tampil di sini.</p>}</div>
    </aside>
  );
}

function CanvasBoard({ session, onUpdate }) {
  const canvases = session.canvases?.length ? session.canvases : [createCanvas('Document')];
  const activeCanvas = canvases.find((canvas) => canvas.id === session.activeCanvasId) || canvases[0];

  const saveCanvases = (nextCanvases, activeCanvasId = activeCanvas.id) => {
    onUpdate({ canvases: nextCanvases, activeCanvasId });
  };

  const updateCanvas = (patch) => {
    saveCanvases(canvases.map((canvas) => (
      canvas.id === activeCanvas.id ? { ...canvas, ...patch, updatedAt: Date.now() } : canvas
    )));
  };

  const addCanvas = () => {
    const next = createCanvas('Document');
    saveCanvases([next, ...canvases], next.id);
  };

  const deleteCanvas = () => {
    if (canvases.length <= 1) return updateCanvas({ content: '', title: activeCanvas.title || 'Untitled Document' });
    const remaining = canvases.filter((canvas) => canvas.id !== activeCanvas.id);
    saveCanvases(remaining, remaining[0].id);
  };

  return (
    <section className="canvas-board workspace-card">
      <div className="canvas-head">
        <div><span>AI Canvas</span><strong>{activeCanvas.title}</strong></div>
        <div className="canvas-actions">
          <button onClick={addCanvas} title="Canvas baru"><Plus size={14} /></button>
          <button onClick={deleteCanvas} title="Hapus canvas"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="canvas-controls">
        <CustomSelect value={activeCanvas.title} options={canvases.map((canvas) => canvas.title)} onChange={(title) => onUpdate({ activeCanvasId: canvases.find((canvas) => canvas.title === title)?.id || activeCanvas.id })} />
        <CustomSelect value={activeCanvas.type} options={canvasTypes} onChange={(type) => updateCanvas({ type, language: type === 'Code' ? 'javascript' : 'markdown' })} />
      </div>
      <input className="canvas-title-input" value={activeCanvas.title} onChange={(event) => updateCanvas({ title: event.target.value || 'Untitled Canvas' })} placeholder="Nama canvas" />
      <textarea
        className={`canvas-editor canvas-${activeCanvas.type.toLowerCase()}`}
        value={activeCanvas.content}
        onChange={(event) => updateCanvas({ content: event.target.value })}
        placeholder={activeCanvas.type === 'Code' ? 'Tulis atau paste kode di sini...' : activeCanvas.type === 'Plan' ? 'Tulis rencana, task, atau checklist...' : 'Tulis dokumen, ide, atau draft di sini...'}
      />
    </section>
  );
}

function FileAttachmentCard({ file }) {
  return <div className="file-card"><FileText size={16} /><div><strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} KB</span></div></div>;
}

function ImageResultCard({ image }) {
  return <div className="image-card"><div className="mock-image"><MoonStar /></div><strong>{image.style}</strong><p>{image.prompt}</p><button><Download size={14} /> Download</button></div>;
}

function CommandPalette({ open, sessions, token, onClose, onNew, onSettings, onWorkspace, onSelectSession, onMode }) {
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState([]);
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  useEffect(() => {
    if (!open || !token || query.trim().length < 2) return setRemoteResults([]);
    const timeout = setTimeout(async () => {
      try {
        const data = await authApi.search(query, token);
        setRemoteResults(data.results || []);
      } catch {
        setRemoteResults([]);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [open, query, token]);
  if (!open) return null;

  const actions = [
    { label: 'Chat baru', hint: 'Mulai sesi kosong', run: onNew },
    { label: 'Buka pengaturan', hint: 'Model dan data lokal', run: onSettings },
    { label: 'Toggle workspace', hint: 'Artifacts dan konteks', run: onWorkspace },
    { label: 'Mode Chat AI', hint: 'Percakapan umum', run: () => onMode('chat') },
    { label: 'Mode Coding', hint: 'Bangun kode lebih cepat', run: () => onMode('coding') },
    { label: 'Mode Gambar AI', hint: 'Ciptakan gambar', run: () => onMode('image') },
  ];
  const rows = [
    ...actions,
    ...sessions.map((session) => ({ label: session.title, hint: 'Buka riwayat chat', run: () => onSelectSession(session.id) })),
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="command-backdrop" onClick={onClose}>
      <section className="command-palette glass" onClick={(event) => event.stopPropagation()}>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari perintah atau chat..." />
        <div className="command-list">
          {remoteResults.map((item) => (
            <button key={`${item.type}-${item.id}`} onClick={() => { if (item.session_id) onSelectSession(item.session_id); onClose(); }}>
              <strong>{item.type}</strong>
              <span>{String(item.content || item.title || '').slice(0, 120)}</span>
            </button>
          ))}
          {rows.map((item) => (
            <button key={`${item.label}-${item.hint}`} onClick={() => { item.run(); onClose(); }}>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AuthModal({ open, mode, onMode, onSubmit, onGuest, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'signup' && form.password !== form.confirm) return setError('Konfirmasi password tidak sama.');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop auth-backdrop">
      <section className="auth-modal glass">
        <button className="modal-close" onClick={onClose}><X /></button>
        <div className="auth-hero">
          <span>Pluto Cloud</span>
          <h2>{mode === 'login' ? 'Masuk ke orbit Pluto' : 'Buat akun Pluto'}</h2>
          <p>Sinkronkan sesi, workspace, dan riwayat chat di semua perangkat. Atau lanjut lokal tanpa akun.</p>
        </div>
        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => onMode('login')}>Masuk</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => onMode('signup')}>Daftar</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama" />}
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" type="password" />
          {mode === 'signup' && <input value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Konfirmasi password" type="password" />}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" disabled={loading}>{loading ? 'Menghubungkan...' : mode === 'login' ? 'Masuk ke Pluto' : 'Buat akun Pluto'}</button>
        </form>
        <button className="guest-button" onClick={onGuest}>Lanjut tanpa login</button>
      </section>
    </div>
  );
}

function SettingsModal({ open, model, theme, sessions, authState, usage, memories, onClose, onModel, onTheme, onClear, onExport, onImport, onUpgrade, onDeleteMemory }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <section className="settings-modal glass">
        <div className="settings-head">
          <div>
            <span>Pluto Control</span>
            <h2>Pengaturan</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>
        <div className="settings-grid">
          <label>Model default<ModelSelector value={model} onChange={onModel} /></label>
          <label>Mode tampilan<CustomSelect value={theme} options={['Dark', 'Light']} onChange={onTheme} /></label>
        </div>
        <div className="api-status"><Sparkles size={16} /> Status API OpenAI: {import.meta.env.VITE_OPENAI_API_BASE ? 'Endpoint siap' : 'Mode demo aktif'}</div>
        {authState?.user && usage && (
          <div className="usage-panel">
            <strong>Quota Pluto</strong>
            <span>Plan: {usage.plan === 'pro' ? 'Pluto Pro' : 'Free'}</span>
            <div><b>{usage.usage.messagesToday}</b>/<small>{usage.limits.messagesPerDay}</small> pesan hari ini</div>
            <div><b>{usage.usage.filesToday}</b>/<small>{usage.limits.filesPerDay}</small> file hari ini</div>
            <div><b>{formatCompact(usage.usage.tokensMonth)}</b>/<small>{formatCompact(usage.limits.tokensPerMonth)}</small> token bulan ini</div>
            <div><b>{usage.usage.canvases}</b>/<small>{usage.limits.canvases}</small> canvas</div>
            <div><b>{usage.usage.projectCanvases}</b>/<small>{usage.limits.projectCanvases}</small> project canvas</div>
            <div><b>{usage.usage.memories}</b>/<small>{usage.limits.memories}</small> memory</div>
            {usage.plan !== 'pro' && <button onClick={onUpgrade}>Upgrade ke Pluto Pro</button>}
          </div>
        )}
        {authState?.user && (
          <div className="memory-panel">
            <strong>Memory User</strong>
            {memories.length ? memories.map((memory) => <div key={memory.id}><span>{memory.content}</span><button onClick={() => onDeleteMemory(memory.id)}><Trash2 size={13} /></button></div>) : <p>Belum ada memory. Ketik “ingat ...” di chat.</p>}
          </div>
        )}
        <div className="settings-actions">
          <button onClick={onExport}><Download size={16} /> Export chat JSON</button>
          <label className="import-label"><Upload size={16} /> Import chat JSON<input type="file" accept="application/json" onChange={onImport} /></label>
          <button className="danger" onClick={onClear}><Trash2 size={16} /> Hapus semua data lokal</button>
        </div>
        <p className="settings-footnote">{sessions.length} sesi tersimpan lokal. Tidak perlu login.</p>
      </section>
    </div>
  );
}

function formatCompact(value) {
  return Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}
