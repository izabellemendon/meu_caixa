// Funções compartilhadas pelas rotas da API (arquivos com "_" não viram rota no Vercel).
import crypto from 'node:crypto';

/* ---------------- banco (Upstash Redis via REST) ---------------- */
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

export async function redis(...cmd) {
  if (!R_URL || !R_TOK) throw httpErr(503, 'Banco de dados não configurado. Adicione o Upstash Redis no Vercel (veja o README).');
  const r = await fetch(R_URL, { method: 'POST', headers: { Authorization: `Bearer ${R_TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}
export async function getUser(uid) { const v = await redis('GET', 'user:' + uid); return v ? JSON.parse(v) : null; }
export async function putUser(u) { await redis('SET', 'user:' + u.uid, JSON.stringify(u)); await redis('SADD', 'users', u.uid); }

/* ---------------- segurança ---------------- */
export const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
export const newToken = () => crypto.randomBytes(24).toString('hex');
export const validUid = uid => /^[a-z0-9]{8,40}$/i.test(String(uid || ''));

export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}
export function phoneAllowed(phone) {
  const list = (process.env.ALLOWED_PHONES || '').split(',').map(normPhone).filter(Boolean);
  return list.length === 0 || list.includes(phone);
}
// sessões: cada aparelho que entra na conta recebe um token próprio (vale 180 dias)
const SESSION_TTL = 60 * 60 * 24 * 180;
export async function createSession(uid) {
  const t = newToken();
  await redis('SET', 'sess:' + sha(t), uid, 'EX', SESSION_TTL);
  return t;
}
export async function endSession(token) { if (token) await redis('DEL', 'sess:' + sha(token)); }
export async function auth(body) {
  const t = String(body.token || '');
  if (t.length < 20) throw httpErr(401, 'Entre na sua conta de novo.');
  const uid = await redis('GET', 'sess:' + sha(t));
  if (!uid) throw httpErr(401, 'Sua sessão expirou. Entre na sua conta de novo.');
  const u = await getUser(uid);
  if (!u) throw httpErr(401, 'Conta não encontrada.');
  return u;
}

/* ---------------- senhas ---------------- */
export function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(p), salt, 32).toString('hex');
}
export function checkPassword(p, stored) {
  const [salt, h] = String(stored || '').split(':');
  if (!salt || !h) return false;
  const a = crypto.scryptSync(String(p), salt, 32), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const normEmail = e => { const v = String(e || '').trim().toLowerCase(); return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(v) ? v : null; };
export async function limitAttempts(key, max, windowSec) {
  const n = await redis('INCR', key); if (n === 1) await redis('EXPIRE', key, windowSec);
  if (n > max) throw httpErr(429, 'Muitas tentativas. Espere alguns minutos e tente de novo.');
}
export const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'ip';

// limite de mensagens por número e no total, para ninguém usar o servidor para mandar spam
export async function rateLimit(phone) {
  const day = new Date().toISOString().slice(0, 10);
  const perPhone = Number(process.env.MAX_MSGS_PER_PHONE_DAY || 12);
  const global = Number(process.env.MAX_MSGS_TOTAL_DAY || 60);
  const k1 = `rl:p:${phone}:${day}`, k2 = `rl:all:${day}`;
  const n1 = await redis('INCR', k1); if (n1 === 1) await redis('EXPIRE', k1, 172800);
  const n2 = await redis('INCR', k2); if (n2 === 1) await redis('EXPIRE', k2, 172800);
  if (n1 > perPhone) throw httpErr(429, 'Limite diário de mensagens para este número atingido. Amanhã volta ao normal.');
  if (n2 > global) throw httpErr(429, 'Limite diário de mensagens do servidor atingido.');
}
export function cleanSummary(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const j = JSON.stringify(s);
  if (j.length > 20000) throw httpErr(413, 'Resumo grande demais.');
  return JSON.parse(j);
}

/* ---------------- rotas ---------------- */
export function route(fn, { get = false } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST' && !(get && req.method === 'GET')) { res.status(405).json({ error: 'Método não permitido.' }); return; }
      let body = req.body || {};
      if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { throw httpErr(400, 'JSON inválido.'); } }
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(await fn(body, req));
    } catch (e) {
      if (!e.status) console.error(e);
      res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro interno no servidor.' });
    }
  };
}

/* ---------------- IA (Claude) ---------------- */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const SYSTEM = `Você é a assistente do app "Meu Caixa do Mês", um controle de gastos pessoal.
Escreva mensagens de WhatsApp em português do Brasil: calorosas, diretas e curtas (no máximo 900 caracteres).
Regras:
- Use SOMENTE os números dos dados fornecidos. Nunca invente, arredonde de forma enganosa ou estime valores.
- Dinheiro no formato R$ 1.234,56. Porcentagens como 85%.
- Formatação do WhatsApp: *negrito* para números importantes e listas com "•". Nada de markdown com # ou **.
- No máximo 2 emojis na mensagem toda.
- Não recomende investimentos, empréstimos ou produtos financeiros.
- Se "dadosDeExemplo" for true, avise numa frase curta que os números são de exemplo.
- Responda apenas com o texto da mensagem, sem comentários antes ou depois.`;

const brl = v => (typeof v === 'number' ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FREQ_TXT = { semanal: 'toda segunda-feira', diario: 'todo dia', avisos: 'só quando você chegar perto do limite, atingir ou passar dele' };

function prompt(kind, u, extra) {
  const dados = JSON.stringify(u.summary || {}, null, 1);
  const nome = u.name || 'você';
  if (kind === 'welcome') return `Escreva a mensagem de boas-vindas para ${nome}, que acabou de cadastrar o WhatsApp no app.
Explique em poucas linhas o que vai receber: avisos quando chegar a ${u.summary?.avisarEmPct ?? 80}% do limite de uso, ao atingir e ao passar dele; e relatórios ${FREQ_TXT[u.freq] || FREQ_TXT.semanal}.
Se os dados tiverem limite do mês maior que zero, cite o limite e quanto já foi usado. Diga que para parar é só desmarcar a opção em Ajustes no app.
Dados atuais:\n${dados}`;
  if (kind === 'alert') return `Escreva um aviso curto (até 4 linhas) para ${nome} sobre estes alertas que acabaram de acontecer:
${(extra.alerts || []).map(a => `- ${a.t}: ${a.b}`).join('\n')}
Diga o que aconteceu, a porcentagem e quanto ainda resta (ou quanto passou). Termine com uma sugestão prática de uma linha.
Dados atuais:\n${dados}`;
  return `Escreva o relatório ${u.freq === 'diario' ? 'diário' : 'da semana'} para ${nome}. Inclua, nesta ordem e só se o dado existir:
1. Limite de uso do mês, quanto gastou e a porcentagem, e quanto ainda resta.
2. Dinheiro livre até o próximo pagamento e quanto dá para gastar por dia.
3. Cada cartão: quanto sobrou de limite e, se tiver limite de uso, a porcentagem usada.
4. Quanto guardou no mês comparado com a meta, e o total guardado.
Termine com uma dica curta baseada nos números. Se "atualizadoEm" tiver mais de 2 dias, diga que os números são da última vez que o app foi aberto.
Dados atuais:\n${dados}`;
}

function fallback(kind, u, extra) {
  const s = u.summary || {}, nome = u.name || '';
  if (kind === 'welcome') return `Olá${nome ? ', ' + nome : ''}! Boas-vindas ao *Meu Caixa do Mês*.\n\nVocê vai receber avisos quando chegar a ${s.avisarEmPct ?? 80}% do seu limite de uso, ao atingir e ao passar dele, e relatórios ${FREQ_TXT[u.freq] || FREQ_TXT.semanal}.\n\nPara parar, desmarque a opção em Ajustes no app.`;
  if (kind === 'alert') return (extra.alerts || []).map(a => `*${a.t}*\n${a.b}`).join('\n\n');
  const cards = (s.cartoes || []).map(c => `• ${c.nome}: sobrou *${brl(c.sobrou)}*${c.pctLimiteUso != null ? ` · ${c.pctLimiteUso}% do limite de uso` : ''}`).join('\n');
  return [`*Resumo de ${s.mes || 'este mês'}*`,
    s.limiteMes ? `Gastou *${brl(s.gastoMes)}* de ${brl(s.limiteMes)} (${s.pctLimite}%). Resta *${brl(s.restaLimite)}*.` : `Gastou *${brl(s.gastoMes)}* este mês.`,
    `Livre até o pagamento: *${brl(s.dinheiroLivre)}* (${brl(s.podeGastarPorDia)} por dia, ${s.diasAtePagamento} dias).`,
    cards ? `Cartões:\n${cards}` : '',
    `Guardado no mês: *${brl(s.guardadoMes)}*${s.metaGuardarMes ? ` de ${brl(s.metaGuardarMes)}` : ''}. Total guardado: ${brl(s.totalGuardado)}.`
  ].filter(Boolean).join('\n\n');
}

export async function writeMessage(kind, u, extra = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback(kind, u, extra);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: prompt(kind, u, extra) }] })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || 'IA ' + r.status);
    const t = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return t || fallback(kind, u, extra);
  } catch (e) { console.error('IA:', e.message); return fallback(kind, u, extra); }
}

/* ---------------- WhatsApp ---------------- */
const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
export function whatsappConfigured() {
  const e = process.env;
  if (PROVIDER === 'meta') return !!(e.META_PHONE_NUMBER_ID && e.META_ACCESS_TOKEN);
  if (PROVIDER === 'evolution') return !!(e.EVOLUTION_URL && e.EVOLUTION_INSTANCE && e.EVOLUTION_API_KEY);
  if (PROVIDER === 'zapi') return !!(e.ZAPI_INSTANCE && e.ZAPI_TOKEN);
  return false;
}
export async function sendWhatsApp(phone, text, name) {
  if (!whatsappConfigured()) throw httpErr(503, 'WhatsApp não configurado no servidor (veja o README).');
  if (PROVIDER === 'meta') return sendMeta(phone, text, name);
  if (PROVIDER === 'evolution') return sendEvolution(phone, text);
  return sendZapi(phone, text);
}
async function sendMeta(phone, text, name) {
  const e = process.env;
  const url = `https://graph.facebook.com/${e.META_GRAPH_VERSION || 'v21.0'}/${e.META_PHONE_NUMBER_ID}/messages`;
  let payload;
  if (e.META_TEMPLATE_NAME) {
    // mensagens iniciadas pela empresa precisam de um template aprovado; o texto da IA vai na variável {{2}} (sem quebras de linha)
    const flat = text.replace(/\s*\n+\s*/g, ' • ').replace(/\s{4,}/g, ' ').slice(0, 1000);
    payload = { type: 'template', template: { name: e.META_TEMPLATE_NAME, language: { code: e.META_TEMPLATE_LANG || 'pt_BR' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: (name || 'tudo bem').slice(0, 40) }, { type: 'text', text: flat }] }] } };
  } else {
    payload = { type: 'text', text: { body: text.slice(0, 4000) } }; // só entrega se a pessoa falou com o número nas últimas 24h
  }
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${e.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, ...payload }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw httpErr(502, 'O WhatsApp (Meta) recusou a mensagem: ' + (j?.error?.message || r.status));
  return { id: j?.messages?.[0]?.id };
}
async function sendEvolution(phone, text) {
  const e = process.env;
  const r = await fetch(`${e.EVOLUTION_URL.replace(/\/$/, '')}/message/sendText/${e.EVOLUTION_INSTANCE}`, {
    method: 'POST', headers: { apikey: e.EVOLUTION_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ number: phone, text }) });
  if (!r.ok) throw httpErr(502, 'A Evolution API recusou a mensagem (' + r.status + ').');
  return r.json().catch(() => ({}));
}
async function sendZapi(phone, text) {
  const e = process.env;
  const headers = { 'Content-Type': 'application/json' };
  if (e.ZAPI_CLIENT_TOKEN) headers['Client-Token'] = e.ZAPI_CLIENT_TOKEN;
  const r = await fetch(`https://api.z-api.io/instances/${e.ZAPI_INSTANCE}/token/${e.ZAPI_TOKEN}/send-text`, {
    method: 'POST', headers, body: JSON.stringify({ phone, message: text }) });
  if (!r.ok) throw httpErr(502, 'A Z-API recusou a mensagem (' + r.status + ').');
  return r.json().catch(() => ({}));
}
