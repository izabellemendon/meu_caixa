import { route, auth, putUser, cleanSummary, rateLimit, writeMessage, sendWhatsApp, httpErr } from './_lib.js';
// Chamado pelo app quando aparece um aviso novo (perto do limite, atingiu, passou).
export default route(async (b) => {
  const u = await auth(b);
  if (!u.optIn || !u.phone) return { sent: false };
  const alerts = (Array.isArray(b.alerts) ? b.alerts : []).slice(0, 5)
    .map(a => ({ t: String(a.t || '').slice(0, 120), b: String(a.b || '').slice(0, 240), lv: String(a.lv || '') }))
    .filter(a => a.t);
  if (!alerts.length) throw httpErr(400, 'Nenhum aviso para enviar.');
  const s = cleanSummary(b.summary); if (s) { u.summary = s; u.updatedAt = Date.now(); }
  await rateLimit(u.phone);
  await sendWhatsApp(u.phone, await writeMessage('alert', u, { alerts }), u.name);
  await putUser(u);
  return { sent: true };
});
