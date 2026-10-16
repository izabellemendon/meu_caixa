import { route, auth, putUser, cleanSummary, rateLimit, writeMessage, sendWhatsApp, httpErr } from './_lib.js';
// Botão "Enviar relatório agora".
export default route(async (b) => {
  const u = await auth(b);
  if (!u.optIn || !u.phone) throw httpErr(400, 'Ative as mensagens no WhatsApp em Ajustes.');
  const s = cleanSummary(b.summary); if (s) { u.summary = s; u.updatedAt = Date.now(); }
  await rateLimit(u.phone);
  await sendWhatsApp(u.phone, await writeMessage('report', u), u.name);
  u.lastReport = new Date().toISOString().slice(0, 10);
  await putUser(u);
  return { sent: true };
});
