export const MODEL_OPTIONS = [
  { id: 'combo/deepseek-v4-flash', name: 'Pluto Nova', detail: 'Model cepat untuk chat harian dan ide ringan.', badge: 'Fast' },
  { id: 'xmtp/mimo-v2.5-pro', name: 'Pluto Atlas', detail: 'Model seimbang untuk analisis, coding, dan workspace.', badge: 'Pro' },
  { id: 'mimo/mimo-v2.5-pro', name: 'Pluto Apex', detail: 'Model tertinggi untuk reasoning berat dan tugas kompleks.', badge: 'Max' },
];

export const OPENAI_MODELS = MODEL_OPTIONS.map((model) => model.name);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function askPluto({ mode, prompt, model, files = [] }) {
  const apiBase = import.meta.env.VITE_OPENAI_API_BASE;
  const apiKeyConfigured = Boolean(import.meta.env.VITE_OPENAI_API_KEY);

  if (apiBase && apiKeyConfigured) {
    return callOpenAIProxy({ apiBase, mode, prompt, model, files });
  }

  await sleep(850);
  return createMockResponse({ mode, prompt, model, files });
}

async function callOpenAIProxy({ apiBase, mode, prompt, model, files }) {
  const response = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, prompt, model, files }),
  });

  if (!response.ok) {
    throw new Error('API OpenAI belum merespons dengan benar. Pluto memakai mode demo.');
  }

  const data = await response.json();
  return data.message || 'Respons kosong dari endpoint OpenAI.';
}

function createMockResponse({ mode, prompt, model, files }) {
  const fileNote = files.length ? `\n\nKonteks file aktif: ${files.map((file) => file.name).join(', ')}.` : '';

  if (mode === 'coding') {
    return `Demo Pluto Coding memakai ${model}.\n\nSaya akan pecah tugas menjadi struktur kecil, lalu beri contoh kode siap adaptasi.\n\n\`\`\`js\nfunction orbitPrompt(input) {\n  return {\n    platform: 'Pluto',\n    mode: 'coding',\n    prompt: input.trim(),\n    ready: Boolean(input.trim()),\n  };\n}\n\nconsole.log(orbitPrompt('${escapeForCode(prompt).slice(0, 42)}'));\n\`\`\`\n\nPenjelasan: fungsi menjaga prompt tetap bersih, memberi metadata mode, dan mudah dipakai sebagai fondasi integrasi backend.${fileNote}`;
  }

  if (mode === 'plan') {
    return `# Plan: ${prompt.slice(0, 48) || 'Outcome Baru'}

## Outcome
- Hasil akhir jelas, bisa dipindahkan ke Workspace sebagai Plan canvas.

## Clarify
- Asumsi: target user dan deadline belum detail.
- Jika ada deadline keras, prioritas task harus dipersempit.

## Milestone
- [ ] Definisikan scope MVP dan kriteria selesai.
- [ ] Pecah pekerjaan jadi sprint kecil.
- [ ] Review risiko, dependency, dan next action.

## Task Sekarang
- [ ] Tulis brief 1 paragraf tentang hasil akhir yang kamu mau.
- [ ] Tentukan 3 fitur atau deliverable wajib.

## Risiko
- Scope melebar. Mitigasi: batasi ke output yang bisa didemo dulu.

## Next Step
Kirim detail tujuan, target user, deadline, dan aset yang sudah ada.${fileNote}`;
  }

  if (mode === 'image') {
    return `Demo Gambar AI Pluto memakai ${model}.\n\nPrompt visual dibuat: planet Pluto futuristik, nebula ungu premium, cahaya lavender halus, detail sinematik, rasio 16:9.\n\nHasil sementara muncul sebagai kartu mock di workspace sampai endpoint image generation aktif.${fileNote}`;
  }

  if (mode === 'file') {
    return `Demo File Context Pluto memakai ${model}.\n\nFile diterima sebagai konteks UI. Setelah backend aktif, isi dokumen bisa diringkas, dicari, dan dipakai untuk jawaban berbasis sumber.${fileNote}`;
  }

  return `Demo Chat AI Pluto memakai ${model}.\n\nSaya memahami permintaan: "${prompt}".\n\nJawaban ini berasal dari mode mock karena API produksi belum dikonfigurasi. Struktur aplikasi sudah siap memakai endpoint backend melalui environment variable tanpa mengekspos API key di frontend.${fileNote}`;
}

function escapeForCode(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', ' ');
}
