import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
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
  MoreHorizontal,
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
const PROFILE_KEY = 'pluto.profile.v1';

function normalizeTheme(value) {
  if (value === 'Light' || value === 'Orbit violet') return 'Light';
  return 'Dark';
}

const modes = [
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'coding', label: 'Coding', icon: Code2 },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'file', label: 'Artifacts', icon: FileText },
  { id: 'workspace', label: 'Workspace', icon: BrainCircuit },
];

const menu = [
  ['chat', 'Chat AI', Bot],
  ['coding', 'Coding', Code2],
  ['image', 'Gambar AI', Image],
  ['file', 'Artifacts', FileText],
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

const skillHighlights = [
  { id: 'pluto-code', name: 'Pluto Code', detail: 'Kode minimal, aman, dan tidak over-engineering.', icon: Code2, prompt: 'Review kode saya dengan mindset Pluto Code.' },
  { id: 'critical-engineer', name: 'Critical Engineer', detail: 'Cari root cause, risiko, dan fix paling kecil.', icon: BrainCircuit, prompt: 'Analisis masalah ini seperti critical engineer.' },
  { id: 'study', name: 'Study Mentor', detail: 'Bantu mata kuliah, tugas, laporan, ujian, dan konsep sulit.', icon: FileText, prompt: 'Bantu saya memahami materi kuliah ini dan kerjakan langkahnya.' },
  { id: 'agency', name: 'Agency Producer', detail: 'Ubah brief client jadi video, campaign, script, dan production plan.', icon: Sparkles, prompt: 'Ubah brief client ini jadi konsep video dan production plan.' },
  { id: 'hackathon', name: 'Hackathon Strategist', detail: 'Susun MVP, demo flow, dan winning angle.', icon: Sparkles, prompt: 'Bantu saya menyusun MVP hackathon yang bisa menang.' },
  { id: 'product', name: 'Product Strategist', detail: 'Ubah ide jadi produk dengan value jelas.', icon: FileText, prompt: 'Ubah ide saya jadi product plan yang jelas.' },
  { id: 'demo', name: 'Demo Director', detail: 'Buat script demo dan jawaban untuk juri.', icon: Mic, prompt: 'Buatkan script demo 3 menit untuk produk saya.' },
  { id: 'canvas', name: 'Canvas Assistant', detail: 'Baca canvas aktif dan bantu edit isinya.', icon: PenLine, prompt: 'Rapikan canvas aktif saya dan buat versinya lebih kuat.' },
];

const projectTemplates = [
  {
    id: 'landing',
    name: 'Landing Page',
    detail: 'Hero premium, benefit cards, pricing CTA.',
    title: 'Landing Page',
    files: () => createProjectFiles({
      title: 'Pluto Landing',
      html: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Pluto Landing</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <nav><strong>Orbitly</strong><a>Features</a><a>Pricing</a><button>Start</button></nav>\n    <main class="hero">\n      <p class="eyebrow">AI workspace for fast teams</p>\n      <h1>Ship polished ideas before momentum dies.</h1>\n      <p class="lead">Plan, write, prototype, and present your next product from one focused canvas.</p>\n      <div class="actions"><button id="cta">Start free</button><button class="ghost">Watch demo</button></div>\n    </main>\n    <section class="cards"><article>Smart canvas</article><article>Project preview</article><article>Client-ready export</article></section>\n    <script src="main.js"></script>\n  </body>\n</html>',
      css: ':root { font-family: Inter, system-ui, sans-serif; color: #f8fafc; background: #070712; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; background: radial-gradient(circle at top left, #6d28d9, transparent 32%), #070712; }\nnav { display: flex; align-items: center; gap: 22px; padding: 24px clamp(20px, 5vw, 72px); }\nnav strong { margin-right: auto; }\nnav a { color: #cbd5e1; }\nbutton { border: 0; border-radius: 999px; padding: 12px 18px; color: white; background: linear-gradient(135deg, #8b5cf6, #2563eb); }\n.hero { width: min(980px, calc(100% - 40px)); margin: 64px auto 36px; padding: clamp(32px, 7vw, 82px); border: 1px solid rgba(255,255,255,.12); border-radius: 36px; background: rgba(255,255,255,.06); box-shadow: 0 30px 90px rgba(0,0,0,.35); }\n.eyebrow { color: #c4b5fd; text-transform: uppercase; letter-spacing: .14em; font-size: 12px; font-weight: 800; }\nh1 { max-width: 780px; margin: 0; font-size: clamp(46px, 9vw, 104px); line-height: .9; letter-spacing: -.07em; }\n.lead { max-width: 620px; color: #cbd5e1; font-size: 18px; line-height: 1.65; }\n.actions { display: flex; gap: 12px; flex-wrap: wrap; }\n.ghost { background: rgba(255,255,255,.1); }\n.cards { width: min(980px, calc(100% - 40px)); margin: 0 auto 48px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }\n.cards article { padding: 22px; border-radius: 24px; background: rgba(255,255,255,.08); color: #e2e8f0; }\n@media (max-width: 720px) { nav a { display: none; } .cards { grid-template-columns: 1fr; } }',
      js: "document.getElementById('cta')?.addEventListener('click', () => alert('Welcome aboard.'));",
    }),
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    detail: 'Profil kreator, karya pilihan, kontak.',
    title: 'Portfolio Site',
    files: () => createProjectFiles({
      title: 'Portfolio',
      html: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Portfolio</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main>\n      <section class="intro"><span>Available for projects</span><h1>Designer building clean digital experiences.</h1><p>I turn ideas into sharp websites, visuals, and product stories.</p></section>\n      <section class="work"><article>Brand System</article><article>Landing Page</article><article>Video Campaign</article></section>\n      <a class="contact" href="mailto:hello@example.com">hello@example.com</a>\n    </main>\n    <script src="main.js"></script>\n  </body>\n</html>',
      css: 'body { margin: 0; min-height: 100vh; font-family: Georgia, serif; color: #1f2937; background: #f6efe7; }\nmain { width: min(1040px, calc(100% - 36px)); margin: 0 auto; padding: 56px 0; }\n.intro { display: grid; gap: 18px; min-height: 56vh; align-content: center; }\n.intro span { width: max-content; padding: 8px 12px; border: 1px solid #d6c2aa; border-radius: 999px; color: #8a5a2b; }\nh1 { max-width: 820px; margin: 0; font-size: clamp(46px, 10vw, 116px); line-height: .9; letter-spacing: -.06em; }\np { max-width: 520px; color: #6b5a49; font-size: 18px; line-height: 1.7; }\n.work { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }\n.work article { min-height: 220px; display: grid; align-content: end; padding: 20px; border-radius: 28px; background: #111827; color: white; }\n.contact { display: inline-block; margin-top: 28px; color: #111827; font-weight: 700; }\n@media (max-width: 760px) { .work { grid-template-columns: 1fr; } }',
      js: "console.log('Portfolio ready');",
    }),
  },
  {
    id: 'saas',
    name: 'SaaS UI',
    detail: 'Dashboard SaaS modern dengan metrics.',
    title: 'SaaS Dashboard',
    files: () => createProjectFiles({
      title: 'SaaS UI',
      html: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>SaaS UI</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <aside><strong>NovaCRM</strong><a class="active">Dashboard</a><a>Leads</a><a>Reports</a></aside>\n    <main><header><div><span>Revenue</span><h1>$84,240</h1></div><button id="refresh">Refresh</button></header><section class="grid"><article>Conversion 18.4%</article><article>Active users 12,841</article><article>Pipeline $240K</article></section><section class="panel">Weekly performance chart</section></main>\n    <script src="main.js"></script>\n  </body>\n</html>',
      css: 'body { margin: 0; min-height: 100vh; display: grid; grid-template-columns: 240px 1fr; font-family: Inter, system-ui, sans-serif; color: #0f172a; background: #eef2ff; }\naside { padding: 24px; display: grid; align-content: start; gap: 14px; background: #0f172a; color: white; }\naside strong { margin-bottom: 24px; font-size: 22px; }\naside a { padding: 12px; color: #cbd5e1; border-radius: 14px; }\naside .active { color: white; background: rgba(255,255,255,.12); }\nmain { padding: clamp(18px, 4vw, 42px); }\nheader { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 28px; border-radius: 30px; background: white; box-shadow: 0 20px 60px rgba(79,70,229,.14); }\nspan { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }\nh1 { margin: 4px 0 0; font-size: clamp(42px, 8vw, 78px); letter-spacing: -.06em; }\nbutton { border: 0; border-radius: 14px; padding: 12px 16px; color: white; background: #4f46e5; }\n.grid { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }\n.grid article, .panel { padding: 24px; border-radius: 24px; background: white; }\n.panel { min-height: 260px; margin-top: 18px; display: grid; place-items: center; color: #64748b; }\n@media (max-width: 800px) { body { grid-template-columns: 1fr; } aside { grid-auto-flow: column; overflow: auto; } .grid { grid-template-columns: 1fr; } }',
      js: "document.getElementById('refresh')?.addEventListener('click', () => alert('Dashboard refreshed.'));",
    }),
  },
  {
    id: 'admin',
    name: 'Admin Dashboard',
    detail: 'Admin panel tabel, status, dan activity.',
    title: 'Admin Dashboard',
    files: () => createProjectFiles({
      title: 'Admin Dashboard',
      html: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Admin Dashboard</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <main><header><h1>Operations</h1><button id="export">Export</button></header><section class="stats"><article>Orders 1,284</article><article>Tickets 42</article><article>Uptime 99.9%</article></section><table><tr><th>User</th><th>Status</th><th>Plan</th></tr><tr><td>Alya</td><td>Active</td><td>Pro</td></tr><tr><td>Raka</td><td>Pending</td><td>Free</td></tr></table></main>\n    <script src="main.js"></script>\n  </body>\n</html>',
      css: 'body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, sans-serif; color: #172033; background: #f8fafc; }\nmain { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }\nheader { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }\nh1 { font-size: clamp(34px, 6vw, 64px); letter-spacing: -.05em; margin: 0; }\nbutton { border: 0; border-radius: 14px; padding: 12px 16px; color: white; background: #111827; }\n.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }\n.stats article { padding: 22px; border-radius: 22px; background: white; box-shadow: 0 16px 40px rgba(15,23,42,.08); }\ntable { width: 100%; margin-top: 18px; border-collapse: collapse; overflow: hidden; border-radius: 22px; background: white; box-shadow: 0 16px 40px rgba(15,23,42,.08); }\nth, td { padding: 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }\nth { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .1em; }\n@media (max-width: 720px) { .stats { grid-template-columns: 1fr; } table { display: block; overflow-x: auto; } }',
      js: "document.getElementById('export')?.addEventListener('click', () => alert('Export started.'));",
    }),
  },
];

function createCanvas(type = 'Document', templateId = 'landing') {
  const id = crypto.randomUUID();
  const titles = { Document: 'Untitled Document', Code: 'Code Canvas', Plan: 'Plan Canvas', Project: 'HTML Website' };
  const template = projectTemplates.find((item) => item.id === templateId) || projectTemplates[0];
  const files = type === 'Project' ? template.files() : [];
  return {
    id,
    title: type === 'Project' ? template.title : titles[type] || 'Untitled Canvas',
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
  return projectTemplates[0].files();
}

function createProjectFiles({ title, html, css, js }) {
  return [
    {
      id: crypto.randomUUID(),
      path: 'index.html',
      language: 'html',
      content: html.replace('<title>Pluto Landing</title>', `<title>${title}</title>`),
    },
    {
      id: crypto.randomUUID(),
      path: 'style.css',
      language: 'css',
      content: css,
    },
    {
      id: crypto.randomUUID(),
      path: 'main.js',
      language: 'javascript',
      content: js,
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
    planFlow: null,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [historyQuery, setHistoryQuery] = useState('');
  const [authState, setAuthState] = useState(() => getStoredAuth());
  const [profile, setProfile] = useState(() => loadStored(PROFILE_KEY, { displayName: '', role: '', source: '', goal: '', onboardingDone: false }));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [onboardingOpen, setOnboardingOpen] = useState(() => !loadStored(PROFILE_KEY, null)?.onboardingDone);
  const [accountOpen, setAccountOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
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
  useEffect(() => saveStored(PROFILE_KEY, profile), [profile]);
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
    if (mode === 'chat' || mode === 'file' || mode === 'coding' || mode === 'plan') setWorkspaceOpen(false);
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
    const autoPlan = mode !== 'coding' && mode !== 'image' && shouldAutoPlan(prompt);
    const requestMode = autoPlan ? 'plan' : mode;
    const finalPrompt = autoPlan || mode === 'plan' ? buildPlanAgentPrompt(prompt, activeSession.planFlow) : prompt;
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
          mode: requestMode,
          model,
          message: finalPrompt,
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
          planFlow: autoPlan || mode === 'plan' ? buildNextPlanFlow(prompt, response, session.planFlow) : session.planFlow,
          ...buildSmartArtifactPatch({ session, response, prompt, mode: requestMode }),
        }));
        if (buildSmartArtifactFromResponse(response, prompt, requestMode)) setCanvasOpen(true);
        return;
      }
      let response;
      try {
        let streamed = '';
        response = await streamGuestChat({
          sessionId: activeSession.id,
            mode: requestMode,
            model,
            message: finalPrompt,
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
        response = await askPluto({ mode: requestMode, prompt: finalPrompt, model, files: activeSession.files });
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
          planFlow: autoPlan || mode === 'plan' ? buildNextPlanFlow(prompt, response, session.planFlow) : session.planFlow,
          ...buildSmartArtifactPatch({ session, response, prompt, mode: requestMode }),
        }));
        if (buildSmartArtifactFromResponse(response, prompt, requestMode)) setCanvasOpen(true);
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
    setProfile((current) => ({ ...current, displayName: current.displayName || result.user?.name || payload.name || '', onboardingDone: true }));
    setAuthState(result);
    setAuthOpen(false);
  };

  const handleGoogleAuth = async (credential) => {
    const result = await authApi.googleLogin(credential);
    saveAuth(result);
    localStorage.setItem(WELCOME_AUTH_KEY, 'seen');
    setProfile((current) => ({ ...current, displayName: current.displayName || result.user?.name || '', onboardingDone: true }));
    setAuthState(result);
    setAuthOpen(false);
  };

  const continueGuest = () => {
    localStorage.setItem(WELCOME_AUTH_KEY, 'seen');
    setProfile((current) => ({ ...current, onboardingDone: true }));
    setOnboardingOpen(false);
    setAuthOpen(false);
  };

  const logout = () => {
    clearAuth();
    setAuthState({ token: null, user: null });
    setProfile((current) => ({ ...current, displayName: '', role: '', onboardingDone: true }));
    setUsage(null);
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

  const createArtifactFromMessage = (message) => {
    if (!message?.content?.trim()) return;
    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    const previousUser = activeSession.messages
      .slice(0, messageIndex >= 0 ? messageIndex : activeSession.messages.length)
      .reverse()
      .find((item) => item.role === 'user')?.content || activeSession.title;
    const artifact = buildSmartArtifactFromResponse(message.content, previousUser, activeSession.mode);
    if (!artifact) return;
    updateSession(activeSession.id, (session) => ({
      ...session,
      mode: 'workspace',
      activeCanvasId: artifact.canvas.id,
      canvases: [artifact.canvas, ...(session.canvases || [])],
    }));
    setWorkspaceOpen(false);
    setCanvasOpen(true);
  };

  const openArtifact = (artifact) => {
    if (artifact.kind === 'canvas') {
      updateSession(activeSession.id, (session) => ({ ...session, mode: 'workspace', activeCanvasId: artifact.id }));
      setWorkspaceOpen(false);
      setCanvasOpen(true);
    }
  };

  const deleteArtifact = (artifact) => {
    if (artifact.kind === 'canvas') {
      updateSession(activeSession.id, (session) => {
        const canvases = session.canvases?.filter((canvas) => canvas.id !== artifact.id) || [];
        return { ...session, canvases: canvases.length ? canvases : [createCanvas('Document')], activeCanvasId: canvases[0]?.id || null };
      });
    }
    if (artifact.kind === 'file') updateSession(activeSession.id, (session) => ({ ...session, files: (session.files || []).filter((file) => file.id !== artifact.id) }));
    if (artifact.kind === 'pseudo') updateSession(activeSession.id, (session) => ({ ...session, pseudoFiles: (session.pseudoFiles || []).filter((file) => file.id !== artifact.id) }));
    if (artifact.kind === 'image') updateSession(activeSession.id, (session) => ({ ...session, imageResults: (session.imageResults || []).filter((image) => image.id !== artifact.id) }));
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
  const effectiveWorkspaceOpen = !isCanvasMode && (workspaceOpen || (!isMobile && ['image', 'coding'].includes(activeSession.mode)));
  const effectiveSidebarCollapsed = sidebarCollapsed || isCanvasMode;

  return (
    <main className={`app-shell theme-${theme.toLowerCase()} layout-${activeSession.mode} ${effectiveWorkspaceOpen ? 'workspace-open' : ''} ${effectiveSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <SpaceBackdrop />
      <Sidebar
        sessions={sessions}
        activeId={activeSession.id}
        activeMode={activeSession.mode}
        drawerOpen={drawerOpen}
        collapsed={effectiveSidebarCollapsed}
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
        profile={profile}
        usage={usage}
        onAuth={() => setAuthOpen(true)}
        onAccount={() => setAccountOpen((value) => !value)}
        onLogout={logout}
      />
      <AccountCard
        open={accountOpen}
        authState={authState}
        profile={profile}
        usage={usage}
        onClose={() => setAccountOpen(false)}
        onAuth={() => { setAuthOpen(true); setAccountOpen(false); }}
        onPlan={() => { setPlanOpen(true); setAccountOpen(false); }}
        onLogout={() => { logout(); setAccountOpen(false); }}
      />

      <section className="main-panel">
        {!isCanvasMode && (
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
        )}

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
        ) : activeSession.mode === 'file' ? (
          <ArtifactLibrary
            session={activeSession}
            onOpen={openArtifact}
            onDelete={deleteArtifact}
            onPrompt={sendMessage}
          />
        ) : (
          <ChatWindow
            session={activeSession}
            isTyping={isTyping}
            onPrompt={sendMessage}
            profile={profile}
            onCopy={(text) => navigator.clipboard.writeText(text)}
            onDelete={deleteMessage}
            onEdit={editMessage}
            onRegenerate={regenerateLast}
            onArtifact={createArtifactFromMessage}
          />
        )}

        {!isCanvasMode && activeSession.mode !== 'file' && (
          <Composer
            value={composer}
            mode={activeSession.mode}
            model={model}
            imageStyle={imageStyle}
            disabled={isTyping}
            isTyping={isTyping}
            onChange={setComposer}
            onSend={() => sendMessage()}
            onStop={stopGenerating}
            onMode={selectMode}
            onModel={setModel}
            onAttach={() => fileInputRef.current?.click()}
            onVoice={startVoice}
            onImageStyle={setImageStyle}
          />
        )}
      </section>

      {effectiveWorkspaceOpen && <WorkspacePanel session={activeSession} onUpdate={(patch) => updateSession(activeSession.id, (s) => ({ ...s, ...patch }))} onPrompt={sendMessage} onClose={() => setWorkspaceOpen(false)} />}

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
      <OnboardingModal
        open={onboardingOpen}
        profile={profile}
        onComplete={(nextProfile, wantsLogin) => {
          setProfile({ ...nextProfile, onboardingDone: true });
          setOnboardingOpen(false);
          localStorage.setItem(WELCOME_AUTH_KEY, 'seen');
          if (wantsLogin) setAuthOpen(true);
        }}
        onSkip={continueGuest}
      />
      <UsagePlanModal
        open={planOpen}
        usage={usage}
        authState={authState}
        onClose={() => setPlanOpen(false)}
        onAuth={() => { setAuthOpen(true); setPlanOpen(false); }}
        onUpgrade={async () => { const data = await authApi.upgrade(authState.token); setUsage(data); }}
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
      <AuthModal open={authOpen} mode={authMode} onMode={setAuthMode} onSubmit={handleAuth} onGoogle={handleGoogleAuth} onGuest={continueGuest} onClose={continueGuest} />
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
  const { sessions, activeId, activeMode, drawerOpen, collapsed, query, authState, profile, usage, onClose, onCollapse, onQuery, onNew, onSelect, onMode, onRename, onDelete, onAuth, onAccount } = props;
  const filteredSessions = sessions.filter((session) => session.title.toLowerCase().includes(query.toLowerCase()));
  const grouped = groupSessions(filteredSessions);
  const displayName = profile.displayName || authState.user?.name || 'Guest';
  const initials = displayName.slice(0, 1).toUpperCase();
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
        {authState.user || profile.displayName ? (
          <button className="account-trigger" onClick={onAccount} title="Account & Plan">
            <b>{initials}</b>
            <span>{collapsed ? '' : displayName}</span>
            <small>{collapsed ? '' : `${usage?.plan || 'free'} plan`}</small>
            {!collapsed && <ChevronRight size={15} />}
          </button>
        ) : <button onClick={onAuth}>Login</button>}
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

function AccountCard({ open, authState, profile, usage, onClose, onAuth, onPlan, onLogout }) {
  if (!open) return null;
  const displayName = profile.displayName || authState.user?.name || 'Guest';
  const role = profile.role || 'Belum pilih peran';
  return (
    <aside className="account-card glass">
      <button className="account-close" onClick={onClose}><X size={15} /></button>
      <div className="account-head"><b>{displayName.slice(0, 1).toUpperCase()}</b><div><strong>{displayName}</strong><span>{role}</span></div></div>
      <div className="account-plan"><span>{usage?.plan || (authState.user ? 'free' : 'guest')} plan</span>{usage ? <small>{usage.usage.messagesToday} / {usage.limits.messagesPerDay} pesan hari ini</small> : <small>Login untuk sync usage dan workspace.</small>}</div>
      {usage && <QuotaBar label="Pesan" value={usage.usage.messagesToday} limit={usage.limits.messagesPerDay} compact />}
      <div className="account-actions">
        <button onClick={onPlan}>Usage & Plan</button>
        {authState.user ? <button onClick={onLogout}>Logout</button> : <button onClick={onAuth}>Login / Daftar</button>}
      </div>
    </aside>
  );
}

function OnboardingModal({ open, profile, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(profile);
  if (!open) return null;
  const goals = [
    { label: 'Chat AI', detail: 'Tanya, riset, dan brainstorming cepat', icon: Bot },
    { label: 'Buat dokumen', detail: 'Draft laporan, proposal, dan brief', icon: FileText },
    { label: 'Coding', detail: 'Tulis, debug, dan refactor kode', icon: Code2 },
    { label: 'Gambar AI', detail: 'Prompt visual, style, dan ide konten', icon: Image },
    { label: 'Upload file', detail: 'Analisis file sebagai konteks', icon: Upload },
  ];
  const sources = [
    { label: 'TikTok', detail: 'Konten pendek atau review' },
    { label: 'Instagram', detail: 'Post, story, atau reels' },
    { label: 'Teman', detail: 'Rekomendasi langsung' },
    { label: 'Google', detail: 'Search atau artikel' },
    { label: 'GitHub', detail: 'Repo atau developer' },
    { label: 'Kampus', detail: 'Dosen, kelas, atau teman' },
  ];
  const roles = ['Mahasiswa', 'Developer', 'Content Creator', 'Agency', 'Founder', 'Freelancer'];
  return (
    <div className="modal-backdrop onboarding-backdrop">
      <section className="onboarding-card glass">
        <button className="modal-close" onClick={onSkip}><X /></button>
        {step === 0 && <OnboardingStep eyebrow="Selamat datang" title="Halo, aku Pluto" text="AI workspace untuk chat, dokumen, proposal, coding, file, dan ide kreatif. Mau mulai dari mana hari ini?" options={goals} value={form.goal} onPick={(goal) => setForm({ ...form, goal })} />}
        {step === 1 && <OnboardingStep eyebrow="Personalisasi" title="Kamu tahu Pluto dari mana?" text="Ini bantu kami memahami channel yang paling berguna tanpa mengganggu pengalamanmu." options={sources} value={form.source} onPick={(source) => setForm({ ...form, source })} />}
        {step === 2 && (
          <div className="onboarding-step">
            <span>Identitas</span><h2>Mau Pluto manggil kamu siapa?</h2><p>Nama dan peran dipakai untuk sapaan, rekomendasi template, dan gaya bantuan AI.</p>
            <input value={form.displayName || ''} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Nama panggilan" />
            <div className="onboarding-options">{roles.map((role) => <button key={role} className={form.role === role ? 'active' : ''} onClick={() => setForm({ ...form, role })}>{role}</button>)}</div>
          </div>
        )}
        {step === 3 && (
          <div className="onboarding-step">
            <span>Simpan progres</span><h2>Workspace kamu siap</h2><p>Login kalau mau chat, dokumen, project, dan preferensi tersimpan lintas perangkat. Bisa lanjut sebagai tamu dulu.</p>
            <div className="onboarding-summary"><b>{form.displayName || 'Guest'}</b><small>{form.role || 'Role belum dipilih'} · {form.goal || 'Goal belum dipilih'} · {form.source || 'Source belum dipilih'}</small></div>
          </div>
        )}
        <div className="wizard-dots">{[0, 1, 2, 3].map((item) => <i key={item} className={item === step ? 'active' : ''} />)}</div>
        {step < 3 ? (
          <div className="wizard-actions">
            <button onClick={step ? () => setStep(step - 1) : onSkip}>{step ? 'Kembali' : 'Lewati'}</button>
            <button onClick={() => setStep(step + 1)}>Lanjut</button>
          </div>
        ) : (
          <div className="onboarding-finish-actions">
            <button className="finish-primary" onClick={() => onComplete(form, true)}><Sparkles size={17} /> Login / Daftar<span>Simpan chat, canvas, project, dan preferensi lintas perangkat.</span></button>
            <button className="finish-secondary" onClick={() => onComplete(form, false)}>Lanjut sebagai tamu<span>Coba dulu di perangkat ini. Data lokal tetap bisa dipakai.</span></button>
            <button className="finish-back" onClick={() => setStep(step - 1)}>Kembali</button>
          </div>
        )}
      </section>
    </div>
  );
}

function OnboardingStep({ eyebrow, title, text, options, value, onPick }) {
  return (
    <div className="onboarding-step">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="onboarding-options">
        {options.map((option) => {
          const item = typeof option === 'string' ? { label: option } : option;
          const Icon = item.icon;
          return (
            <button key={item.label} className={value === item.label ? 'active' : ''} onClick={() => onPick(item.label)}>
              {Icon && <i><Icon size={17} /></i>}
              <span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UsagePlanModal({ open, usage, authState, onClose, onAuth, onUpgrade }) {
  if (!open) return null;
  const freeLimits = { messagesPerDay: 30, filesPerDay: 5, tokensPerMonth: 3000000, canvases: 5, projectCanvases: 2, memories: 20 };
  const proLimits = { messagesPerDay: 1000, filesPerDay: 100, tokensPerMonth: 5000000, canvases: 100, projectCanvases: 30, memories: 500 };
  const current = usage || { plan: authState.user ? 'free' : 'guest', usage: {}, limits: freeLimits };
  return (
    <div className="modal-backdrop plan-backdrop">
      <section className="plan-modal glass">
        <button className="modal-close" onClick={onClose}><X /></button>
        <div className="plan-hero"><span>Account & Plan</span><h2>Usage dan limit Pluto</h2><p>Limit mengikuti plan yang sudah ada di server. Free untuk mulai cepat, Pro untuk workload serius.</p></div>
        <div className="plan-usage">
          <QuotaBar label="Pesan hari ini" value={current.usage.messagesToday || 0} limit={current.limits.messagesPerDay} />
          <QuotaBar label="File hari ini" value={current.usage.filesToday || 0} limit={current.limits.filesPerDay} />
          <QuotaBar label="Token bulan ini" value={current.usage.tokensMonth || 0} limit={current.limits.tokensPerMonth} compact />
          <QuotaBar label="Canvas" value={current.usage.canvases || 0} limit={current.limits.canvases} />
          <QuotaBar label="Project canvas" value={current.usage.projectCanvases || 0} limit={current.limits.projectCanvases} />
          <QuotaBar label="Memory" value={current.usage.memories || 0} limit={current.limits.memories} />
        </div>
        <div className="pricing-grid">
          <PlanCard title="Free" price="Rp0" active={current.plan === 'free'} limits={freeLimits} action={authState.user ? 'Plan aktif' : 'Login untuk sync'} onAction={authState.user ? null : onAuth} />
          <PlanCard title="Pro" price="Upgrade" active={current.plan === 'pro'} limits={proLimits} action={current.plan === 'pro' ? 'Plan aktif' : 'Upgrade ke Pro'} onAction={authState.user ? onUpgrade : onAuth} />
        </div>
      </section>
    </div>
  );
}

function PlanCard({ title, price, active, limits, action, onAction }) {
  return <article className={`plan-card ${active ? 'active' : ''}`}><span>{title}</span><h3>{price}</h3><ul><li>{limits.messagesPerDay} pesan/hari</li><li>{limits.filesPerDay} file/hari</li><li>{limits.canvases} canvas</li><li>{limits.projectCanvases} project canvas</li><li>{limits.memories} memory</li></ul><button disabled={!onAction || active} onClick={onAction}>{action}</button></article>;
}

function ChatHeader({ mode, model, theme, onMenu, onModel, onSettings, onTheme, onCommand }) {
  const label = modes.find((item) => item.id === mode)?.label || 'Chat';
  return (
    <header className="chat-header glass">
      <button className="icon mobile-menu" onClick={onMenu}><Menu /></button>
      <div><span>{label === 'Coding' ? 'Mode Coding' : label === 'Artifacts' ? 'Artifact Library' : label === 'Image' ? 'Gambar AI' : label === 'Workspace' ? 'AI Canvas' : 'Chat AI'}</span><strong>{label === 'Workspace' ? 'Workspace canvas' : label === 'Artifacts' ? 'Output tersimpan' : 'Mulai eksplorasi'}</strong></div>
      <div className="header-actions">
        <ModelSelector value={model} onChange={onModel} />
        <button onClick={onTheme} className="pill">{theme}</button>
        <button className="icon" onClick={onSettings}><Settings /></button>
      </div>
    </header>
  );
}

function ModelSelector({ value, onChange, className = '' }) {
  return <CustomSelect value={value} options={MODEL_OPTIONS} onChange={onChange} className={`model-select ${className}`} />;
}

function CustomSelect({ value, options, onChange, className = '', labels = {} }) {
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
        <span>{labels[value] || value}</span>
        <ChevronDown size={16} className={open ? 'rotate' : ''} />
      </button>
      {open && (
        <div className="select-menu glass">
          {options.map((option) => (
            (() => {
              const item = typeof option === 'string' ? { name: option, label: labels[option] || option } : option;
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
              <span className="select-copy"><strong>{item.label || item.name}</strong>{item.detail && <small>{item.detail}</small>}</span>
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

function ActionMenu({ actions }) {
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
    <div className="action-menu" ref={ref}>
      <button className="more-trigger" type="button" onClick={() => setOpen((value) => !value)}><MoreHorizontal size={18} /> More</button>
      {open && (
        <div className="action-menu-panel glass">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                className={action.danger ? 'danger-action' : ''}
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
              >
                <Icon size={15} />
                <span><strong>{action.label}</strong>{action.detail && <small>{action.detail}</small>}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatWindow({ session, isTyping, profile, onPrompt, onCopy, onDelete, onEdit, onRegenerate, onArtifact }) {
  const endRef = useRef(null);
  const lastAssistantId = [...session.messages].reverse().find((message) => message.role === 'assistant' && message.content.trim())?.id;
  const hasPendingAssistant = session.messages.some((message) => message.role === 'assistant' && !message.content.trim());
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [session.messages, isTyping]);
  return (
    <div className="chat-window">
      {!session.messages.length ? (session.mode === 'coding' ? <CodingStartScreen onPrompt={onPrompt} /> : session.mode === 'plan' ? <PlanStartScreen onPrompt={onPrompt} /> : <WelcomeScreen mode={session.mode} profile={profile} onPrompt={onPrompt} />) : (
        <div className="chat-thread">
          {session.messages.map((message) => (
            <MessageBubble key={message.id} message={message} onCopy={onCopy} onDelete={onDelete} onEdit={onEdit} onRegenerate={onRegenerate} onArtifact={onArtifact} canRegenerate={!isTyping && message.id === lastAssistantId} />
          ))}
          {isTyping && !hasPendingAssistant && <div className="typing"><span /><span /><span /> Pluto sedang merangkai orbit jawaban...</div>}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

function PlanStartScreen({ onPrompt }) {
  const actions = [
    ['Build App', 'Brief jadi milestone, scope MVP, task, dan risiko.', 'Bantu saya membangun app ini sebagai rencana eksekusi bertahap.'],
    ['Launch Produk', 'Positioning, GTM, demo flow, dan checklist launch.', 'Buat plan launch produk dengan positioning, channel, dan action items.'],
    ['Sprint Mingguan', 'Prioritas tajam untuk 5 hari kerja.', 'Susun sprint plan 1 minggu dari target ini.'],
    ['Decision Plan', 'Rekomendasi, tradeoff, risiko, dan next action.', 'Bantu saya mengambil keputusan ini dengan plan aksi.'],
  ];
  return (
    <section className="plan-start">
      <div className="plan-hero-card glass">
        <span>Progressive Plan Agent</span>
        <h1>Ubah ide jadi langkah kerja.</h1>
        <p>Mode Plan memecah tujuan jadi outcome, milestone, checklist, risiko, dan langkah berikutnya. Setiap jawaban bisa langsung jadi Plan canvas di Workspace.</p>
        <div className="plan-agent-steps">
          {['Clarify', 'Structure', 'Execute', 'Review'].map((step) => <b key={step}>{step}</b>)}
        </div>
      </div>
      <div className="plan-action-grid">
        {actions.map(([title, detail, prompt]) => <button key={title} onClick={() => onPrompt(prompt)}><strong>{title}</strong><span>{detail}</span></button>)}
      </div>
    </section>
  );
}

function CodingStartScreen({ onPrompt }) {
  const actions = [
    ['Debug error', 'Tempel stack trace, cari root cause, beri patch kecil.', 'Debug error ini dan berikan patch minimal.'],
    ['Refactor', 'Rapikan fungsi tanpa mengubah behavior.', 'Refactor kode ini agar lebih bersih tanpa over-engineering.'],
    ['Review diff', 'Cari bug, regresi, edge case, dan missing tests.', 'Review perubahan ini dengan fokus bug dan risiko.'],
    ['Write tests', 'Buat test cases untuk fungsi atau komponen.', 'Buat test untuk kode ini, sertakan edge case penting.'],
    ['Generate component', 'Buat komponen React siap pakai.', 'Buat komponen React modern berdasarkan brief ini.'],
    ['Explain code', 'Jelaskan alur kode dan bagian berisiko.', 'Jelaskan kode ini dengan ringkas dan tunjukkan risiko.'],
  ];
  return (
    <section className="coding-start">
      <div className="coding-hero glass">
        <span>Pluto Code</span>
        <h1>Build, debug, refactor.</h1>
        <p>Mode coding fokus ke snippet, stack trace, patch, review, dan artifact. Workspace tetap untuk canvas/project, sementara Coding jadi cockpit teknis cepat.</p>
        <div className="coding-command-line"><Code2 size={16} /><code>paste error | ask patch | review diff | write tests</code></div>
      </div>
      <div className="coding-action-grid">
        {actions.map(([title, detail, prompt]) => <button key={title} onClick={() => onPrompt(prompt)}><strong>{title}</strong><span>{detail}</span></button>)}
      </div>
    </section>
  );
}

function WelcomeScreen({ mode, profile, onPrompt }) {
  const name = profile?.displayName?.trim();
  const role = profile?.role ? ` untuk ${profile.role}` : '';
  const copy = {
    chat: [name ? `Halo, ${name}` : 'Apa yang ingin kamu eksplorasi?', `Percakapan tenang${role} untuk ide, riset, dan keputusan cepat.`, ['Buat proposal profesional', 'Tulis email profesional', 'Susun rencana belajar', 'Cari ide konten premium']],
    plan: ['Rancang langkah kerja', 'Mode agentik untuk mengubah ide jadi outcome, milestone, task, risiko, dan next step.', ['Buat launch plan produk', 'Susun sprint 1 minggu', 'Pecah ide app jadi MVP', 'Bantu ambil keputusan ini']],
    coding: ['Bangun kode lebih cepat', 'Tulis, debug, refactor, dan simpan artifact kode di workspace.', ['Buat komponen React', 'Debug kode JavaScript saya', 'Refactor fungsi ini', 'Buat struktur API backend']],
    image: ['Ciptakan gambar dari imajinasi', 'Studio visual untuk prompt, style, rasio, dan galeri hasil.', ['Planet Pluto luxury cinematic', 'Logo SaaS luar angkasa', 'Poster nebula violet', 'Karakter astronot elegan']],
    file: ['Artifact Library', 'Penyimpanan output Pluto: dokumen, plan, kode, project, file upload, dan gambar.', ['Buat plan MVP', 'Buat project landing page', 'Buat dokumen brief', 'Review artifact terakhir']],
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

function MessageBubble({ message, onCopy, onDelete, onEdit, onRegenerate, onArtifact, canRegenerate }) {
  const chunks = parseCodeBlocks(message.content);
  const isPending = message.role === 'assistant' && !message.content.trim();
  return (
    <article className={`message ${message.role}`} tabIndex={0}>
      <div className="bubble glass">
        {isPending ? <TypingDots /> : chunks.map((chunk, index) => chunk.type === 'code' ? <CodeBlock key={index} code={chunk.value} language={chunk.language} onCopy={onCopy} /> : <MarkdownText key={index} text={chunk.value} />)}
      </div>
      {!!message.content.trim() && (
        <div className="message-actions">
          {message.role === 'user' && <button onClick={() => onEdit(message.id)}><PenLine size={14} /> Edit</button>}
          {canRegenerate && <button onClick={onRegenerate}><RefreshCw size={14} /> Regenerate</button>}
          {message.role === 'assistant' && <button onClick={() => onArtifact(message)}><BrainCircuit size={14} /> Turn into Workspace</button>}
          <button onClick={() => onCopy(message.content)}><Copy size={14} /> Copy</button>
          <button onClick={() => onDelete(message.id)}><Trash2 size={14} /> Hapus</button>
        </div>
      )}
    </article>
  );
}

function TypingDots() {
  return <div className="typing-dots"><span /><span /><span /></div>;
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

function Composer({ value, mode, model, imageStyle, disabled, isTyping, onChange, onSend, onStop, onMode, onModel, onAttach, onVoice, onImageStyle }) {
  const textRef = useRef(null);
  useEffect(() => {
    if (!textRef.current) return;
    textRef.current.style.height = 'auto';
    textRef.current.style.height = `${Math.min(textRef.current.scrollHeight, 180)}px`;
  }, [value]);
  const placeholder = {
    chat: 'Tanyakan apa saja...',
    plan: 'Tulis tujuan besar, Pluto pecah jadi plan bertahap...',
    coding: 'Minta Pluto menulis, debug, atau refactor kode...',
    image: 'Deskripsikan gambar yang ingin dibuat...',
    file: 'Tanyakan sesuatu dari file atau konteks...',
  }[mode] || 'Tanyakan apa saja...';

  return (
      <div className="composer glass">
      <div className="composer-row">
        <button className="icon" onClick={onAttach}><Paperclip /></button>
        <textarea ref={textRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
        <ModelSelector value={model} onChange={onModel} className="composer-model" />
        <button className="icon" onClick={onVoice}><Mic /></button>
        {isTyping ? <button className="send stop" onClick={onStop}><X size={18} /></button> : <button className="send" disabled={!value.trim() || disabled} onClick={onSend}><Send size={18} /></button>}
      </div>
    </div>
  );
}

function CanvasStage({ session, composer, isTyping, open, onUpdate, onCloudSave, onOpen, onComposer, onSend, onStop, onAttach, onVoice }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingProjectPatch, setPendingProjectPatch] = useState(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const canvases = session.canvases?.length ? session.canvases : [createCanvas('Document')];
  const activeCanvas = canvases.find((canvas) => canvas.id === session.activeCanvasId) || canvases[0];
  const lastAssistant = [...session.messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());

  useEffect(() => {
    if (activeCanvas?.type === 'Project') setPreviewOpen(true);
  }, [activeCanvas?.id, activeCanvas?.type]);

  useEffect(() => {
    if (isTyping || lastAssistant) setAiDrawerOpen(true);
  }, [isTyping, lastAssistant?.id]);

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

  const downloadCanvas = async (format = 'auto') => {
    const safeTitle = getSafeFileName(activeCanvas.title || 'pluto-canvas');

    if (activeCanvas.type === 'Project') {
      const files = activeCanvas.files?.length ? activeCanvas.files : createHtmlProjectFiles();
      if (format === 'preview-html') {
        triggerDownload(new Blob([buildProjectPreview(files)], { type: 'text/html;charset=utf-8' }), `${safeTitle}-preview.html`);
        return;
      }
      const zip = new JSZip();
      files.forEach((file) => zip.file(normalizeProjectPath(file.path), file.content || ''));
      zip.file('preview.html', buildProjectPreview(files));
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `${safeTitle}.zip`);
      return;
    }

    if (activeCanvas.type === 'Code') {
      const extension = languageExtensions[activeCanvas.language] || 'txt';
      const filename = format === 'txt' ? `${safeTitle}.txt` : `${safeTitle}.${extension}`;
      triggerDownload(new Blob([activeCanvas.content || ''], { type: 'text/plain;charset=utf-8' }), filename);
      return;
    }

    if (format === 'md') {
      triggerDownload(new Blob([activeCanvas.content || ''], { type: 'text/markdown;charset=utf-8' }), `${safeTitle}.md`);
      return;
    }

    if (format === 'txt') {
      triggerDownload(new Blob([activeCanvas.content || ''], { type: 'text/plain;charset=utf-8' }), `${safeTitle}.txt`);
      return;
    }

    const html = buildDocDownload(activeCanvas);
    const extension = format === 'html' ? 'html' : 'doc';
    const type = format === 'html' ? 'text/html;charset=utf-8' : 'application/msword;charset=utf-8';
    triggerDownload(new Blob([html], { type }), `${safeTitle}.${extension}`);
  };

  const printCanvasPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(buildDocDownload(activeCanvas));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadOption = (action) => {
    if (action === 'pdf') return printCanvasPdf();
    return downloadCanvas(action);
  };

  const downloadOptions = getCanvasDownloadOptions(activeCanvas);

  const addCanvas = (type = 'Document', templateId = 'landing') => {
    const next = createCanvas(type, templateId);
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
    if (activeCanvas.type === 'Project') {
      const patch = parseProjectPatch(lastAssistant.content, activeCanvas.files || []);
      if (patch.length) {
        setPendingProjectPatch({ mode, files: patch });
        return;
      }
    }
    const content = extractCanvasPayload(lastAssistant.content, activeCanvas.type);
    const snapshot = {
      content: activeCanvas.content || '',
      title: activeCanvas.title,
      type: activeCanvas.type,
      language: activeCanvas.language,
      files: activeCanvas.files,
      activeFileId: activeCanvas.activeFileId,
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
    const snapshot = { content: activeCanvas.content || '', title: activeCanvas.title, type: activeCanvas.type, language: activeCanvas.language, files: activeCanvas.files, activeFileId: activeCanvas.activeFileId, createdAt: Date.now() };
    const { start, end, fileId } = activeCanvas.selection;
    if (activeCanvas.type === 'Project' && fileId) {
      updateCanvas({
        files: activeCanvas.files.map((file) => file.id === fileId ? { ...file, content: `${file.content.slice(0, start)}${content}${file.content.slice(end)}` } : file),
        versions: [snapshot, ...(activeCanvas.versions || [])].slice(0, 10),
        selection: null,
      });
      return;
    }
    updateCanvas({ content: `${activeCanvas.content.slice(0, start)}${content}${activeCanvas.content.slice(end)}`, versions: [snapshot, ...(activeCanvas.versions || [])].slice(0, 10), selection: null });
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

  const changeCanvasType = (type) => updateCanvas(type === 'Project' ? { ...createCanvas('Project'), id: activeCanvas.id, createdAt: activeCanvas.createdAt, versions: activeCanvas.versions || [] } : { type, language: type === 'Code' ? 'javascript' : 'markdown' });

  const moreActions = [
    { label: 'Diff', detail: 'Lihat perubahan terakhir', icon: Code2, disabled: !activeCanvas.versions?.length, onClick: () => setDiffOpen(true) },
    { label: 'New Canvas', detail: 'Buat canvas kosong baru', icon: Plus, onClick: () => addCanvas() },
    { label: 'Delete Canvas', detail: canvases.length <= 1 ? 'Kosongkan isi canvas ini' : 'Hapus canvas aktif', icon: Trash2, danger: true, onClick: deleteCanvas },
  ];

  const applyProjectPatch = () => {
    if (!pendingProjectPatch?.files?.length) return;
    const currentFiles = activeCanvas.files?.length ? activeCanvas.files : createHtmlProjectFiles();
    const nextFiles = mergeProjectFiles(currentFiles, pendingProjectPatch.files, pendingProjectPatch.mode);
    const snapshot = { content: activeCanvas.content || '', title: activeCanvas.title, type: activeCanvas.type, language: activeCanvas.language, files: currentFiles, activeFileId: activeCanvas.activeFileId, createdAt: Date.now() };
    updateCanvas({
      files: nextFiles,
      activeFileId: nextFiles[0]?.id || null,
      versions: [snapshot, ...(activeCanvas.versions || [])].slice(0, 10),
    });
    setPendingProjectPatch(null);
  };

  const captureSelection = (event) => {
    const { selectionStart, selectionEnd } = event.target;
    updateCanvas({ selection: selectionEnd > selectionStart ? { start: selectionStart, end: selectionEnd, text: activeCanvas.content.slice(selectionStart, selectionEnd) } : null });
  };

  if (!open) {
    return <WorkspaceHome canvases={canvases} onCreate={addCanvas} onOpenCanvas={(id) => { onUpdate({ activeCanvasId: id }); onOpen(true); }} onDuplicate={duplicateCanvas} onDelete={deleteCanvasById} />;
  }

  return (
    <section className={`canvas-stage ${aiDrawerOpen ? 'ai-open' : ''}`}>
      <div className="canvas-stage-toolbar glass">
        <div className="canvas-title-stack">
          <button className="canvas-back" onClick={() => onOpen(false)}>Back</button>
          <div>
            <input value={activeCanvas.title} onChange={(event) => updateCanvas({ title: event.target.value || 'Untitled Canvas' })} placeholder="Untitled Canvas" />
            <span className={activeCanvas.savedAt && activeCanvas.updatedAt <= activeCanvas.savedAt ? 'saved' : 'unsaved'}>{activeCanvas.savedAt && activeCanvas.updatedAt <= activeCanvas.savedAt ? `Synced ${new Date(activeCanvas.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Unsaved changes'}</span>
          </div>
        </div>
        <div className="canvas-stage-actions">
          <CustomSelect value={activeCanvas.type} options={canvasTypes} onChange={changeCanvasType} />
          {activeCanvas.type === 'Code' && <CustomSelect value={activeCanvas.language || 'javascript'} options={canvasLanguages} onChange={(language) => updateCanvas({ language })} />}
          <button onClick={() => setPreviewOpen((value) => !value)}><FileText size={15} /> {previewOpen ? 'Edit' : 'Preview'}</button>
          <button onClick={saveCanvas}><Check size={15} /> Save</button>
          <button onClick={() => setAiDrawerOpen((value) => !value)}><Sparkles size={15} /> Ask AI</button>
          <CustomSelect value="Export" className="download-select" options={downloadOptions} onChange={handleDownloadOption} />
          <ActionMenu actions={moreActions} />
        </div>
      </div>
      <div className="canvas-work-area">
        <div className={`canvas-sheet glass ${activeCanvas.type === 'Project' ? 'project-sheet' : ''}`}>
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
        </div>
        <CanvasAIDock
          open={aiDrawerOpen}
          assistant={lastAssistant}
          composer={composer}
          canvas={activeCanvas}
          isTyping={isTyping}
          hasSelection={Boolean(activeCanvas.selection)}
          canUndo={Boolean(activeCanvas.versions?.length)}
          isProject={activeCanvas.type === 'Project'}
          selection={activeCanvas.selection}
          versions={activeCanvas.versions || []}
          onClose={() => setAiDrawerOpen(false)}
          onUndo={undoCanvas}
          onReplace={() => applyAssistant('replace')}
          onAppend={() => applyAssistant('append')}
          onSelection={applyToSelection}
          onNewCanvas={createCanvasFromAssistant}
          onRestore={restoreVersion}
          onChange={onComposer}
          onSend={onSend}
          onStop={onStop}
          onAttach={onAttach}
          onVoice={onVoice}
        />
      </div>
      {pendingProjectPatch && <ProjectDiffPreview currentFiles={activeCanvas.files || []} patch={pendingProjectPatch.files} mode={pendingProjectPatch.mode} onCancel={() => setPendingProjectPatch(null)} onApply={applyProjectPatch} />}
      {diffOpen && <CanvasDiffModal canvas={activeCanvas} onClose={() => setDiffOpen(false)} onRestore={restoreVersion} />}
    </section>
  );
}

function buildDocDownload(canvas) {
  const body = String(canvas.content || '')
    .split('\n')
    .map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p>&nbsp;</p>')
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(canvas.title || 'Pluto Document')}</title><style>body{font-family:Arial,sans-serif;line-height:1.65;color:#1f2937;padding:48px;}h1{font-size:28px;}p{margin:0 0 12px;}</style></head><body><h1>${escapeHtml(canvas.title || 'Pluto Document')}</h1>${body}</body></html>`;
}

function getCanvasDownloadOptions(canvas) {
  if (canvas.type === 'Project') {
    return [
      { name: 'zip', label: 'Project ZIP', detail: 'Semua file + preview.html', badge: 'CODE' },
      { name: 'preview-html', label: 'Preview HTML', detail: 'Satu file hasil render', badge: 'HTML' },
    ];
  }

  if (canvas.type === 'Code') {
    const extension = languageExtensions[canvas.language] || 'txt';
    return [
      { name: 'source', label: `Source .${extension}`, detail: `File ${canvas.language || 'code'} asli`, badge: extension.toUpperCase() },
      { name: 'txt', label: 'Plain Text', detail: 'Backup universal .txt', badge: 'TXT' },
    ];
  }

  if (canvas.type === 'Plan') {
    return [
      { name: 'md', label: 'Markdown', detail: 'Cocok untuk checklist dan docs', badge: 'MD' },
      { name: 'pdf', label: 'Save as PDF', detail: 'Lewat print dialog', badge: 'PDF' },
      { name: 'txt', label: 'Plain Text', detail: 'Catatan mentah universal', badge: 'TXT' },
      { name: 'html', label: 'HTML', detail: 'Buka di browser', badge: 'HTML' },
    ];
  }

  return [
    { name: 'doc', label: 'Word / Docs', detail: 'Format dokumen editable', badge: 'DOC' },
    { name: 'pdf', label: 'Save as PDF', detail: 'Lewat print dialog', badge: 'PDF' },
    { name: 'html', label: 'Web Page', detail: 'Buka di browser', badge: 'HTML' },
    { name: 'txt', label: 'Plain Text', detail: 'Isi mentah tanpa layout', badge: 'TXT' },
  ];
}

function getSafeFileName(value) {
  return String(value || 'pluto-canvas').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pluto-canvas';
}

function normalizeProjectPath(path) {
  const safePath = String(path || 'untitled.txt').replaceAll('\\', '/').split('/').filter(Boolean).join('/');
  return safePath.replaceAll('..', '') || 'untitled.txt';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function ProjectEditor({ canvas, previewOpen, onUpdate }) {
  const files = canvas.files?.length ? canvas.files : createHtmlProjectFiles();
  const activeFile = files.find((file) => file.id === canvas.activeFileId) || files[0];

  const updateFiles = (nextFiles, activeFileId = activeFile.id) => onUpdate({ files: nextFiles, activeFileId });
  const updateFile = (content) => updateFiles(files.map((file) => file.id === activeFile.id ? { ...file, content } : file));
  const captureFileSelection = (event) => {
    const { selectionStart, selectionEnd } = event.target;
    onUpdate({ selection: selectionEnd > selectionStart ? { start: selectionStart, end: selectionEnd, text: activeFile.content.slice(selectionStart, selectionEnd), fileId: activeFile.id, filePath: activeFile.path } : null });
  };
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

  return (
    <div className={`project-editor ${previewOpen ? 'with-preview' : ''}`}>
      <aside className="project-files">
        <div><span>Files</span><button onClick={addFile}><Plus size={13} /></button></div>
        {files.map((file) => <button key={file.id} className={file.id === activeFile.id ? 'active' : ''} onClick={() => onUpdate({ activeFileId: file.id })}>{file.path}</button>)}
      </aside>
      <section className="project-code">
        <div className="project-filebar">
          <input value={activeFile.path} onChange={(event) => renameFile(event.target.value)} />
          <button onClick={deleteFile} disabled={files.length <= 1}><Trash2 size={14} /></button>
        </div>
        <textarea value={activeFile.content} onChange={(event) => updateFile(event.target.value)} onSelect={captureFileSelection} spellCheck={false} />
      </section>
      {previewOpen && <iframe className="project-preview" title="Project preview" sandbox="allow-scripts" srcDoc={buildProjectPreview(files)} />}
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

function buildSmartArtifactPatch({ session, response, prompt, mode }) {
  const artifact = buildSmartArtifactFromResponse(response, prompt, mode);
  if (artifact && artifact.kind !== 'project' && artifact.kind !== 'code' && mode !== 'plan') return {};
  if (artifact) {
    const patch = {
      mode: 'workspace',
      activeCanvasId: artifact.canvas.id,
      canvases: [artifact.canvas, ...(session.canvases || [])],
    };
    if (artifact.canvas.type === 'Project') {
      patch.codeOutput = response;
      patch.pseudoFiles = artifact.canvas.files.map((file) => ({ id: file.id, name: file.path, content: file.content }));
      patch.terminalOutput = '$ preview project\nProject AI siap direview di canvas preview.';
    }
    return patch;
  }
  if (mode === 'coding' || looksLikeCode(response) || looksLikeCodeRequest(prompt)) return { mode: 'coding' };
  return {};
}

function buildSmartArtifactFromResponse(response, prompt = '', mode = 'chat') {
  const project = buildSmartProjectFromResponse(response, prompt);
  if (project) {
    const canvas = {
      ...createCanvas('Project'),
      title: project.title,
      files: project.files,
      activeFileId: project.files[0]?.id || null,
      savedAt: null,
      updatedAt: Date.now(),
    };
    return { kind: 'project', canvas };
  }

  if (mode === 'plan' || looksLikePlanResponse(response) || looksLikePlanRequest(prompt)) {
    const canvas = {
      ...createCanvas('Plan'),
      title: makeArtifactTitle(prompt, 'Plan'),
      content: extractCanvasPayload(response, 'Plan'),
      savedAt: null,
      updatedAt: Date.now(),
    };
    return { kind: 'plan', canvas };
  }

  if (looksLikeCode(response) || looksLikeCodeRequest(prompt)) {
    const blocks = extractCodeBlocks(response);
    const first = blocks.find((block) => block.code.trim()) || { language: 'markdown', code: response };
    const canvas = {
      ...createCanvas('Code'),
      title: makeArtifactTitle(prompt, 'Code'),
      language: first.language === 'js' ? 'javascript' : first.language || 'javascript',
      content: first.code,
      savedAt: null,
      updatedAt: Date.now(),
    };
    return { kind: 'code', canvas };
  }

  if (looksLikeDocumentResponse(response)) {
    const canvas = {
      ...createCanvas('Document'),
      title: makeArtifactTitle(prompt, 'Document'),
      content: extractCanvasPayload(response, 'Document'),
      savedAt: null,
      updatedAt: Date.now(),
    };
    return { kind: 'document', canvas };
  }

  return null;
}

function buildPlanAgentPrompt(prompt, flow) {
  const previous = flow?.steps?.length ? `\nProgress lama:\n${flow.steps.map((step, index) => `${index + 1}. ${step.title} - ${step.status}`).join('\n')}` : '';
  return `Mode Plan Pluto. Ubah request user jadi progressive agent workflow, bukan jawaban biasa.

Brief user:
${prompt}${previous}

Format wajib:
# Plan: [nama outcome]
## Outcome
- hasil akhir yang harus jadi
## Clarify
- asumsi penting
- pertanyaan jika ada info kritis hilang
## Milestone
- [ ] milestone 1
- [ ] milestone 2
- [ ] milestone 3
## Task Sekarang
- [ ] task kecil yang bisa langsung dilakukan
## Risiko
- risiko dan mitigasi
## Next Step
Satu instruksi lanjut paling berguna.

Jaga sesuai brief Pluto: ubah chat jadi ruang kerja, fokus output nyata, progres bertahap, minim fluff.`;
}

function buildNextPlanFlow(prompt, response, previousFlow) {
  const checkboxes = [...String(response || '').matchAll(/[-*]\s+\[[ xX]\]\s+(.+)/g)].map((match) => match[1].trim()).slice(0, 8);
  const steps = checkboxes.length ? checkboxes.map((title, index) => ({ id: crypto.randomUUID(), title, status: index === 0 ? 'active' : 'pending' })) : previousFlow?.steps || [];
  return {
    goal: String(prompt || '').slice(0, 120),
    stage: steps.some((step) => step.status === 'active') ? 'execute' : 'clarify',
    steps,
    updatedAt: Date.now(),
  };
}

function looksLikePlanResponse(text) {
  return /(^|\n)##\s+(Outcome|Milestone|Task Sekarang|Risiko|Next Step)|[-*]\s+\[[ xX]\]|\b(milestone|roadmap|rencana|action items|next step|timeline)\b/i.test(String(text || ''));
}

function looksLikePlanRequest(text) {
  return /\b(plan|rencana|roadmap|milestone|task|checklist|sprint|launch|strategi|workflow|langkah)\b/i.test(String(text || ''));
}

function shouldAutoPlan(text) {
  const value = String(text || '');
  return looksLikePlanRequest(value) || /\b(mvp|startup|aplikasi|platform|saas|fitur besar|end-to-end|launch|rilis|sprint)\b/i.test(value) || /\b(bangun|develop|ship)\b/i.test(value) && /\b(produk|app|project besar|sistem)\b/i.test(value);
}

function looksLikeDocumentResponse(text) {
  return /^#\s+|\n##\s+|\b(proposal|brief|dokumen|report|laporan|email|pitch)\b/i.test(String(text || ''));
}

function makeArtifactTitle(prompt, fallback) {
  const cleaned = String(prompt || '').replace(/buat(in)?|tolong|saya|aku|plan|rencana|dokumen|kode|code/gi, '').trim();
  return cleaned ? cleaned.slice(0, 42).replace(/^\w/, (letter) => letter.toUpperCase()) : `AI ${fallback}`;
}

function buildSmartProjectFromResponse(response, prompt = '') {
  const text = String(response || '');
  const patch = parseProjectPatch(text, []);
  if (patch.some((file) => file.path.endsWith('.html'))) {
    return {
      title: makeProjectTitle(prompt),
      files: patch.map((file) => ({ id: crypto.randomUUID(), path: file.path, language: file.language || getLanguageFromPath(file.path), content: file.content })),
    };
  }
  const blocks = extractCodeBlocks(text);
  const html = blocks.find((block) => block.language === 'html' || /<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]/i.test(block.code))?.code;
  if (!html && !/landing|website|web|html|css|tailwind|page|halaman/i.test(prompt)) return null;
  const css = blocks.filter((block) => block.language === 'css').map((block) => block.code).join('\n\n');
  const js = blocks.filter((block) => ['js', 'javascript'].includes(block.language)).map((block) => block.code).join('\n\n');
  if (!html) return null;
  return {
    title: makeProjectTitle(prompt),
    files: createProjectFiles({ title: makeProjectTitle(prompt), html, css, js }),
  };
}

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(String(text || '')))) {
    blocks.push({ language: (match[1] || '').toLowerCase(), code: match[2].trim() });
  }
  return blocks;
}

function looksLikeCode(text) {
  return /```|function\s+\w+|const\s+\w+\s*=|class\s+\w+|<!doctype html|<html[\s>]|import\s+.+from/i.test(String(text || ''));
}

function looksLikeCodeRequest(text) {
  return /buat(in)?\s+(kode|code|website|landing|html|css|javascript|react|component|komponen)|coding|debug|script/i.test(String(text || ''));
}

function makeProjectTitle(prompt) {
  const cleaned = String(prompt || '').replace(/buat(in)?|tolong|saya|aku|website|html|kode|code/gi, '').trim();
  return cleaned ? cleaned.slice(0, 42).replace(/^\w/, (letter) => letter.toUpperCase()) : 'AI Website';
}

function parseProjectPatch(text, currentFiles = []) {
  const source = String(text || '').replace(/```[a-zA-Z0-9_-]*\n?/g, '').trim();
  const markers = [...source.matchAll(/^FILE:\s*(.+?)\s*$/gim)];
  if (!markers.length) return [];
  return markers.map((match, index) => {
    const start = match.index + match[0].length;
    const end = markers[index + 1]?.index ?? source.length;
    const path = normalizeProjectPath(match[1]);
    const content = source.slice(start, end).replace(/^\s*```\w*\s*/i, '').replace(/```\s*$/i, '').trim();
    const current = currentFiles.find((file) => normalizeProjectPath(file.path) === path);
    return { path, content, language: getLanguageFromPath(path), status: current ? 'modified' : 'created', previous: current?.content || '' };
  }).filter((file) => file.path && file.content);
}

function mergeProjectFiles(currentFiles, patchFiles, mode = 'replace') {
  const next = currentFiles.map((file) => ({ ...file }));
  patchFiles.forEach((patchFile) => {
    const index = next.findIndex((file) => normalizeProjectPath(file.path) === normalizeProjectPath(patchFile.path));
    if (index >= 0) {
      next[index] = { ...next[index], content: mode === 'append' && next[index].content ? `${next[index].content.trim()}\n\n${patchFile.content}` : patchFile.content, language: getLanguageFromPath(patchFile.path) };
    } else {
      next.push({ id: crypto.randomUUID(), path: patchFile.path, language: patchFile.language || getLanguageFromPath(patchFile.path), content: patchFile.content });
    }
  });
  return next;
}

function getLanguageFromPath(path) {
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.md')) return 'markdown';
  return 'javascript';
}

function ProjectDiffPreview({ currentFiles, patch, mode, onCancel, onApply }) {
  const previewFiles = patch.map((file) => {
    const current = currentFiles.find((item) => normalizeProjectPath(item.path) === normalizeProjectPath(file.path));
    const previous = current?.content || '';
    const next = mode === 'append' && previous ? `${previous.trim()}\n\n${file.content}` : file.content;
    return { ...file, previous, next, status: current ? 'Modified' : 'Created', diff: buildLineDiff(previous, next) };
  });
  return (
    <div className="diff-backdrop">
      <section className="project-diff glass">
        <div className="diff-head">
          <div><span>Apply Preview</span><h2>Review perubahan AI</h2><p>Periksa file sebelum Pluto menimpa project. Aman seperti Cursor/Figma: preview dulu, apply jika cocok.</p></div>
          <button className="modal-close" onClick={onCancel}><X size={17} /></button>
        </div>
        <div className="diff-list">
          {previewFiles.map((file) => (
            <article className="diff-file" key={file.path}>
              <div className="diff-file-head"><strong>{file.path}</strong><span>{file.status}</span></div>
              <div className="diff-columns">
                <div className="diff-pane"><span>Before</span><pre>{file.diff.before.map((line, index) => <code key={`${file.path}-before-${index}`} className={line.changed ? 'diff-line removed' : 'diff-line'}>{line.text || ' '}</code>)}</pre></div>
                <div className="diff-pane"><span>After</span><pre>{file.diff.after.map((line, index) => <code key={`${file.path}-after-${index}`} className={line.changed ? 'diff-line added' : 'diff-line'}>{line.text || ' '}</code>)}</pre></div>
              </div>
            </article>
          ))}
        </div>
        <div className="diff-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onApply}>Apply {previewFiles.length} file</button>
        </div>
      </section>
    </div>
  );
}

function buildLineDiff(previous, next) {
  const before = String(previous || '').split('\n');
  const after = String(next || '').split('\n');
  const max = Math.max(before.length, after.length);
  return {
    before: Array.from({ length: max }, (_, index) => ({ text: before[index] ?? '', changed: before[index] !== after[index] })),
    after: Array.from({ length: max }, (_, index) => ({ text: after[index] ?? '', changed: before[index] !== after[index] })),
  };
}

function CanvasDiffModal({ canvas, onClose, onRestore }) {
  const latest = canvas.versions?.[0];
  if (!latest) return null;
  const isProject = canvas.type === 'Project';
  const files = isProject ? buildProjectCanvasDiff(latest.files || [], canvas.files || []) : [{ path: canvas.title, diff: buildLineDiff(latest.content || '', canvas.content || ''), status: 'Modified' }];
  return (
    <div className="diff-backdrop">
      <section className="project-diff canvas-diff-modal glass">
        <div className="diff-head">
          <div><span>Git Diff</span><h2>Perubahan terakhir</h2><p>Lihat before/after dari versi terakhir sebelum perubahan AI atau edit manual.</p></div>
          <button className="modal-close" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="diff-list">
          {files.map((file) => (
            <article className="diff-file" key={file.path}>
              <div className="diff-file-head"><strong>{file.path}</strong><span>{file.status}</span></div>
              <div className="diff-columns">
                <div className="diff-pane"><span>Before</span><pre>{file.diff.before.map((line, index) => <code key={`${file.path}-before-${index}`} className={line.changed ? 'diff-line removed' : 'diff-line'}>{line.text || ' '}</code>)}</pre></div>
                <div className="diff-pane"><span>After</span><pre>{file.diff.after.map((line, index) => <code key={`${file.path}-after-${index}`} className={line.changed ? 'diff-line added' : 'diff-line'}>{line.text || ' '}</code>)}</pre></div>
              </div>
            </article>
          ))}
        </div>
        <div className="diff-actions"><button onClick={onClose}>Tutup</button><button onClick={() => { onRestore(latest); onClose(); }}>Restore versi sebelum</button></div>
      </section>
    </div>
  );
}

function buildProjectCanvasDiff(beforeFiles, afterFiles) {
  const paths = [...new Set([...beforeFiles, ...afterFiles].map((file) => normalizeProjectPath(file.path)))];
  return paths.map((path) => {
    const before = beforeFiles.find((file) => normalizeProjectPath(file.path) === path);
    const after = afterFiles.find((file) => normalizeProjectPath(file.path) === path);
    return { path, status: before && after ? 'Modified' : before ? 'Deleted' : 'Created', diff: buildLineDiff(before?.content || '', after?.content || '') };
  });
}

function CanvasPreview({ canvas }) {
  if (!canvas.content?.trim()) return <div className="canvas-preview doc-preview empty">Canvas masih kosong.</div>;
  if (canvas.type === 'Code') return <pre className="canvas-preview canvas-code"><code>{canvas.content}</code></pre>;
  return <div className="canvas-preview doc-preview"><article><h1>{canvas.title}</h1><DocumentMarkdown text={canvas.content} /></article></div>;
}

function DocumentMarkdown({ text }) {
  const blocks = [];
  const lines = String(text || '').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^---+$/.test(line)) {
      blocks.push(<hr key={index} />);
    } else if (line.startsWith('### ')) {
      blocks.push(<h3 key={index}><InlineMarkdown text={line.slice(4)} /></h3>);
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={index}><InlineMarkdown text={line.slice(3)} /></h2>);
    } else if (line.startsWith('# ')) {
      blocks.push(<h1 key={index}><InlineMarkdown text={line.slice(2)} /></h1>);
    } else if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      index -= 1;
      blocks.push(<ul key={index}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineMarkdown text={item} /></li>)}</ul>);
    } else if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      index -= 1;
      blocks.push(<ol key={index}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineMarkdown text={item} /></li>)}</ol>);
    } else {
      blocks.push(<p key={index}><InlineMarkdown text={line} /></p>);
    }
  }
  return <div className="document-body">{blocks}</div>;
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

function CanvasAIDock({ open, assistant, composer, canvas, isTyping, hasSelection, canUndo, isProject, selection, versions, onClose, onUndo, onReplace, onAppend, onSelection, onNewCanvas, onRestore, onChange, onSend, onStop, onAttach, onVoice }) {
  if (!open) return null;
  return (
    <aside className="canvas-ai-dock glass">
      <div className="dock-head">
        <div><span>AI Assistant</span><strong>{isTyping ? 'Sedang bekerja...' : 'Edit canvas dengan AI'}</strong></div>
        <button onClick={onClose}><X size={15} /></button>
      </div>
      <div className="dock-composer">
        <span>Using {canvas?.title || 'canvas'}</span>
        {selection?.text && <div className="selection-chip">Selection aktif{selection.filePath ? ` · ${selection.filePath}` : ''}: {selection.text.slice(0, 90)}</div>}
        <div>
          <button className="icon" onClick={onAttach}><Paperclip /></button>
          <textarea value={composer} onChange={(event) => onChange(event.target.value)} placeholder="Minta AI menulis, merapikan, atau mengubah canvas ini..." onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} />
          <button className="icon" onClick={onVoice}><Mic /></button>
          {isTyping ? <button className="send stop" onClick={onStop}><X size={18} /></button> : <button className="send" disabled={!composer.trim()} onClick={onSend}><Send size={18} /></button>}
        </div>
      </div>
      <div className={`dock-body ${isTyping ? 'generating' : ''}`}>
        {assistant ? <MarkdownText text={assistant.content} /> : <p>AI output akan muncul di sini setelah kamu mengirim instruksi.</p>}
        {isTyping && <div className="ai-generating"><span /><span /><span /> AI sedang generate...</div>}
      </div>
      {assistant && (
        <div className="dock-actions">
          <button onClick={onAppend}>{isProject ? 'Preview Append' : 'Insert'}</button>
          <button onClick={onReplace}>{isProject ? 'Preview Apply' : 'Replace'}</button>
          <button onClick={onSelection} disabled={!hasSelection}>Apply Selection</button>
          <button onClick={onNewCanvas}>New Canvas</button>
          <button onClick={onUndo} disabled={!canUndo}>Undo</button>
        </div>
      )}
      <CanvasHistory versions={versions} onRestore={onRestore} />
    </aside>
  );
}

function WorkspaceHome({ canvases, onCreate, onOpenCanvas, onDuplicate, onDelete }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [newType, setNewType] = useState('Document');
  const [templateId, setTemplateId] = useState(projectTemplates[0].id);
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
  const smartStarters = [
    { title: 'Buat laporan kuliah', text: 'Canvas dokumen untuk struktur tugas, konsep, dan checklist dosen.', type: 'Document' },
    { title: 'Ubah brief client', text: 'Canvas rencana untuk campaign, script video, dan timeline produksi.', type: 'Plan' },
    { title: 'Bikin landing page', text: 'Project siap edit dengan preview, ZIP export, dan apply preview.', type: 'Project', templateId: 'landing' },
    { title: 'Bangun portfolio', text: 'Project portfolio mobile-friendly untuk kreator atau freelancer.', type: 'Project', templateId: 'portfolio' },
  ];

  return (
    <section className="workspace-home">
      <div className="workspace-hero glass">
        <span>AI Workspace</span>
        <h1>Bangun ide di canvas Pluto</h1>
        <p>Pilih canvas yang sudah ada atau buat ruang kerja baru untuk dokumen, kode, dan rencana. Chat AI akan jadi asisten kerja di atas canvas.</p>
        <div className="workspace-hero-actions">
          <button onClick={() => onCreate(newType, templateId)}><Plus size={17} /> Buat Canvas</button>
          <button onClick={() => canvases[0] && onOpenCanvas(canvases[0].id)}>Buka Terakhir</button>
        </div>
        <div className="workspace-create-panel">
          <div><span>Canvas type</span><CustomSelect value={newType} options={canvasTypes} onChange={setNewType} /></div>
          {newType === 'Project' && <div><span>Project template</span><CustomSelect value={templateId} options={projectTemplates.map((template) => template.id)} labels={Object.fromEntries(projectTemplates.map((template) => [template.id, template.name]))} onChange={setTemplateId} /></div>}
        </div>
        {newType === 'Project' && (
          <div className="template-grid">
            {projectTemplates.map((template) => <button key={template.id} className={template.id === templateId ? 'active' : ''} onClick={() => setTemplateId(template.id)}><strong>{template.name}</strong><span>{template.detail}</span></button>)}
          </div>
        )}
      </div>
      <div className="workspace-stats">
        {stats.map(([label, value]) => <div className="glass" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="workspace-library glass">
        <div className="library-head"><span>Canvas Library</span><button onClick={() => onCreate(newType, templateId)}><Plus size={15} /> New</button></div>
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
          )) : <div className="library-empty smart-empty"><strong>Mulai dari kebutuhan nyata.</strong><p>Pilih starter di bawah, atau buat canvas kosong kalau sudah tahu mau menulis apa.</p><div>{smartStarters.map((starter) => <button key={starter.title} onClick={() => onCreate(starter.type, starter.templateId || templateId)}><strong>{starter.title}</strong><span>{starter.text}</span></button>)}</div><button onClick={() => onCreate(newType, templateId)}><Plus size={15} /> Canvas kosong</button></div>}
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

function ArtifactLibrary({ session, onOpen, onDelete, onPrompt }) {
  const [query, setQuery] = useState('');
  const artifacts = buildArtifactList(session).filter((item) => `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(query.toLowerCase()));
  const featured = artifacts[0];
  const quickPrompts = [
    'Buat plan MVP dari project ini',
    'Buat dokumen brief project',
    'Buat struktur file website landing page',
  ];
  return (
    <section className="artifact-page">
      <div className="artifact-hero glass">
        <span>Pluto Artifacts</span>
        <h1>Semua output kerja, tersimpan rapi.</h1>
        <p>Dokumen, plan, kode, project, file upload, dan hasil AI dikumpulkan di sini. Buka lagi, lanjut edit di Workspace, atau download saat siap.</p>
        <div className="artifact-search-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari artifact, project, file..." />
          <button onClick={() => onPrompt('Buat plan dari artifact dan konteks terakhir saya.')}>Auto Plan</button>
        </div>
      </div>
      <div className="artifact-stats">
        <div className="glass"><span>Total</span><strong>{artifacts.length}</strong></div>
        <div className="glass"><span>Canvas</span><strong>{session.canvases?.length || 0}</strong></div>
        <div className="glass"><span>Files</span><strong>{session.files?.length || 0}</strong></div>
      </div>
      <div className="artifact-layout">
        <div className="artifact-grid">
          {artifacts.length ? artifacts.map((artifact) => <ArtifactCard key={`${artifact.kind}-${artifact.id}`} artifact={artifact} onOpen={onOpen} onDelete={onDelete} />) : <EmptyArtifacts onPrompt={onPrompt} />}
        </div>
        <aside className="artifact-side glass">
          <span>Smart Builder</span>
          <strong>{featured ? featured.title : 'Belum ada artifact'}</strong>
          <p>{featured ? featured.preview : 'Mulai chat atau minta Pluto buat project. Output besar otomatis masuk ke Workspace sebagai artifact.'}</p>
          <div>{quickPrompts.map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)}>{prompt}</button>)}</div>
        </aside>
      </div>
    </section>
  );
}

function buildArtifactList(session) {
  const canvases = (session.canvases || []).map((canvas) => ({
    kind: 'canvas',
    id: canvas.id,
    type: canvas.type || 'Canvas',
    title: canvas.title || 'Untitled Canvas',
    detail: canvas.type === 'Project' ? `${canvas.files?.length || 0} file project` : canvas.language || 'markdown',
    preview: canvas.type === 'Project' ? (canvas.files || []).map((file) => file.path).join(', ') : String(canvas.content || 'Canvas kosong.').slice(0, 180),
    createdAt: canvas.updatedAt || canvas.createdAt || Date.now(),
    icon: canvas.type === 'Project' ? BrainCircuit : canvas.type === 'Code' ? Code2 : FileText,
  }));
  const uploads = (session.files || []).map((file) => ({ kind: 'file', id: file.id, type: 'Upload', title: file.name, detail: `${Math.ceil((file.size || 0) / 1024)} KB`, preview: file.type || 'File lokal', createdAt: file.createdAt || Date.now(), icon: FileText }));
  const pseudo = (session.pseudoFiles || []).map((file) => ({ kind: 'pseudo', id: file.id, type: 'Code Output', title: file.name, detail: 'Generated file', preview: String(file.content || '').slice(0, 180), createdAt: Date.now(), icon: Code2 }));
  const images = (session.imageResults || []).map((image) => ({ kind: 'image', id: image.id, type: 'Image', title: image.style || 'Generated image', detail: 'Prompt visual', preview: image.prompt || '', createdAt: image.createdAt || Date.now(), icon: Image }));
  return [...canvases, ...pseudo, ...uploads, ...images].sort((a, b) => b.createdAt - a.createdAt);
}

function ArtifactCard({ artifact, onOpen, onDelete }) {
  const Icon = artifact.icon;
  const canOpen = artifact.kind === 'canvas';
  const download = () => {
    triggerDownload(new Blob([artifact.preview || artifact.title], { type: 'text/plain;charset=utf-8' }), `${getSafeFileName(artifact.title)}.txt`);
  };
  return (
    <article className={`artifact-card artifact-${artifact.type.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="artifact-icon"><Icon size={18} /></div>
      <div className="artifact-copy"><span>{artifact.type}</span><strong>{artifact.title}</strong><p>{artifact.preview || 'Tidak ada preview.'}</p></div>
      <div className="artifact-meta"><small>{artifact.detail}</small><small>{new Date(artifact.createdAt).toLocaleDateString('id-ID')}</small></div>
      <div className="artifact-actions">
        <button disabled={!canOpen} onClick={() => onOpen(artifact)}>{canOpen ? 'Open' : 'Stored'}</button>
        <button onClick={download}><Download size={14} /></button>
        <button onClick={() => onDelete(artifact)}><Trash2 size={14} /></button>
      </div>
    </article>
  );
}

function EmptyArtifacts({ onPrompt }) {
  return <div className="empty-artifacts glass"><Sparkles size={22} /><strong>Artifact belum ada.</strong><p>Minta Pluto bikin project, dokumen, plan, atau kode. Output besar otomatis disimpan sebagai artifact.</p><button onClick={() => onPrompt('Buat plan MVP untuk ide produk saya.')}>Buat artifact pertama</button></div>;
}

function WorkspacePanel({ session, onUpdate, onPrompt, onClose }) {
  if (session.mode === 'coding') return <CodingWorkspace session={session} onUpdate={onUpdate} onPrompt={onPrompt} onClose={onClose} />;
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

function CodingWorkspace({ session, onUpdate, onPrompt, onClose }) {
  const codeContext = session.codeContext || { language: 'javascript', snippet: '' };
  const files = session.pseudoFiles?.length ? session.pseudoFiles : [{ id: 'main', name: 'pluto-output.js', content: session.codeOutput || 'Belum ada artifact kode.' }];
  const updateContext = (patch) => onUpdate({ codeContext: { ...codeContext, ...patch } });
  const sendCodeTask = (task) => {
    const snippet = codeContext.snippet?.trim();
    const labels = {
      debug: 'Debug kode ini. Cari root cause, jelaskan singkat, lalu berikan patch minimal.',
      refactor: 'Refactor kode ini agar lebih bersih tanpa mengubah behavior. Jelaskan tradeoff.',
      explain: 'Jelaskan kode ini, alur eksekusi, dan risiko bug yang mungkin ada.',
      test: 'Buat test untuk kode ini. Sertakan edge case penting.',
      review: 'Review kode ini seperti code review. Fokus bug, risiko, security, dan missing tests.',
    };
    const prompt = `${labels[task] || labels.debug}\n\nLanguage: ${codeContext.language}\n\n\`\`\`${codeContext.language}\n${snippet || '// tempel kode di Code Context dulu'}\n\`\`\``;
    onPrompt(prompt);
  };
  return (
    <aside className="workspace glass workspace-coding">
      <WorkspaceTitle onClose={onClose}>Code Lab</WorkspaceTitle>
      <div className="code-lab-hero"><span>Snippet Context</span><strong>Debug cepat tanpa buka canvas.</strong><p>Workspace menyimpan canvas/project. Code Lab fokus ke snippet, stack trace, review, dan output teknis.</p></div>
      <div className="workspace-card code-context-card">
        <div className="code-context-head"><span>Language</span><CustomSelect value={codeContext.language} options={canvasLanguages} onChange={(language) => updateContext({ language })} /></div>
        <textarea value={codeContext.snippet || ''} onChange={(event) => updateContext({ snippet: event.target.value })} placeholder="Tempel snippet, stack trace, atau diff di sini..." />
        <div className="code-task-grid">
          {[
            ['debug', 'Debug'],
            ['refactor', 'Refactor'],
            ['review', 'Review'],
          ].map(([id, label]) => <button key={id} onClick={() => sendCodeTask(id)}>{label}</button>)}
        </div>
      </div>
      <div className="linked-canvas-block"><CanvasBoard session={session} onUpdate={onUpdate} /></div>
      <div className="workspace-card code-artifacts-card"><span>Artifacts</span>{files.map((file) => <div className="pseudo-file" key={file.id || file.name}><Code2 size={15} /><strong>{file.name}</strong></div>)}</div>
      <div className="workspace-card code-artifact"><span>Latest Code Output</span><pre>{session.codeOutput || 'Respons kode Pluto akan muncul di sini setelah kamu bertanya.'}</pre></div>
      <div className="workspace-card"><span>Terminal Mock</span><pre>{session.terminalOutput || '$ npm run build\nBelum ada output. Kirim task coding dulu.'}</pre></div>
      <div className="workspace-card"><span>Todo Teknis</span><textarea value={session.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value })} placeholder="Bug, TODO, edge case, atau command yang mau dicoba..." /></div>
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
        <CustomSelect value={activeCanvas.type} options={canvasTypes} onChange={(type) => updateCanvas(type === 'Project' ? { ...createCanvas('Project'), id: activeCanvas.id, createdAt: activeCanvas.createdAt, versions: activeCanvas.versions || [] } : { type, language: type === 'Code' ? 'javascript' : 'markdown' })} />
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

function AuthModal({ open, mode, onMode, onSubmit, onGoogle, onGuest, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  if (!open) return null;

  const wizard = [
    { title: 'Mulai kerja dari ide kosong', text: 'Tulis tugas kuliah, brief client, kode, rencana produk, atau draft konten. Pluto bantu pecah jadi langkah yang bisa langsung dikerjakan.', items: ['Tugas kuliah', 'Brief client', 'Kode', 'Konten'] },
    { title: 'Bukan cuma chat, ada workspace', text: 'Jawaban penting bisa disimpan ke canvas. Kamu bisa edit dokumen, bikin project website, preview hasil, lalu download saat selesai.', items: ['Canvas', 'Project preview', 'Download ZIP', 'History'] },
    { title: 'Skill otomatis sesuai kebutuhan', text: 'Pluto menyesuaikan gaya bantuan: tutor kuliah, producer agency, coder, product strategist, atau demo coach. Tidak perlu pilih manual.', items: ['Study Mentor', 'Agency Producer', 'Pluto Code', 'Demo Coach'] },
    { title: 'Simpan progres saat login', text: 'Login membuat chat, canvas, project, dan preferensi tetap tersimpan lintas perangkat. Mode tamu tetap bisa dipakai untuk coba cepat.', items: ['Chat tersimpan', 'Canvas tersimpan', 'Mode tamu', 'Privasi'] },
  ];

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

  const startGoogleLogin = () => {
    setError('');
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return setError('Google Login belum dikonfigurasi. Tambahkan VITE_GOOGLE_CLIENT_ID.');
    const run = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setLoading(true);
          try {
            await onGoogle(response.credential);
          } catch (error) {
            setError(error.message);
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.prompt();
    };
    if (window.google?.accounts?.id) return run();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = run;
    script.onerror = () => setError('Gagal memuat Google Login.');
    document.head.appendChild(script);
  };

  return (
    <div className="modal-backdrop auth-backdrop">
      <section className="auth-modal glass">
        <button className="modal-close" onClick={onClose}><X /></button>
        <div className="auth-hero">
          <span>{step < wizard.length ? `Welcome ${step + 1}/${wizard.length}` : 'Mulai pakai Pluto'}</span>
          <h2>{step < wizard.length ? wizard[step].title : mode === 'login' ? 'Masuk ke Pluto' : 'Buat akun Pluto'}</h2>
          <p>{step < wizard.length ? wizard[step].text : 'Masuk untuk menyimpan chat, canvas, project, dan preferensi. Kalau mau coba dulu, lanjut tanpa login juga bisa.'}</p>
        </div>
        {step < wizard.length ? (
          <>
            <div className="wizard-chips">{wizard[step].items.map((item) => <span key={item}>{item}</span>)}</div>
            <div className="wizard-dots">{wizard.map((_, index) => <i key={index} className={index === step ? 'active' : ''} />)}</div>
            <div className="wizard-actions"><button onClick={onGuest}>Lewati</button><button onClick={() => setStep((value) => value + 1)}>{step === wizard.length - 1 ? 'Mulai login' : 'Lanjut'}</button></div>
          </>
        ) : (
          <>
            <button className="google-button" onClick={startGoogleLogin} disabled={loading}>Login dengan Google</button>
            <div className="auth-divider"><span>atau email</span></div>
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
          </>
        )}
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
            <div className="quota-head"><div><strong>Quota Pluto</strong><span>Plan: {usage.plan === 'pro' ? 'Pluto Pro' : 'Free'}</span></div><button onClick={onUpgrade}>{usage.plan === 'pro' ? 'Change Plan' : 'Upgrade Pro'}</button></div>
            <QuotaBar label="Pesan hari ini" value={usage.usage.messagesToday} limit={usage.limits.messagesPerDay} />
            <QuotaBar label="File hari ini" value={usage.usage.filesToday} limit={usage.limits.filesPerDay} />
            <QuotaBar label="Token bulan ini" value={usage.usage.tokensMonth} limit={usage.limits.tokensPerMonth} compact />
            <QuotaBar label="Canvas" value={usage.usage.canvases} limit={usage.limits.canvases} />
            <QuotaBar label="Project canvas" value={usage.usage.projectCanvases} limit={usage.limits.projectCanvases} />
            <QuotaBar label="Memory" value={usage.usage.memories} limit={usage.limits.memories} />
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

function QuotaBar({ label, value, limit, compact = false }) {
  const percent = limit ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  return (
    <div className="quota-row">
      <div><span>{label}</span><small>{compact ? formatCompact(value) : value} / {compact ? formatCompact(limit) : limit}</small></div>
      <div className="quota-track"><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function formatCompact(value) {
  return Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}
