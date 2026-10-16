import { redis, getUser, putUser, writeMessage, sendWhatsApp, rateLimit } from './_lib.js';
// O Vercel chama esta rota todo dia às 12:00 UTC (8h em Manaus, 9h em Brasília) — veja "crons" no vercel.json.
// "diario" recebe todo dia; "semanal" recebe às segundas; "avisos" só recebe os avisos de limite.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) { res.status(401).json({ error: 'Não autorizado.' }); return; }
  const today = new Date().toISOString().slice(0, 10), monday = new Date().getUTCDay() === 1;
  const ids = (await redis('SMEMBERS', 'users')) || [];
  const out = { sent: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    try {
      const u = await getUser(id);
      const due = u && u.optIn && u.phone && u.summary && u.lastReport !== today &&
        (u.freq === 'diario' || (u.freq === 'semanal' && monday)) &&
        Date.now() - (u.updatedAt || 0) < 35 * 864e5; // não manda relatório de dados com mais de 35 dias
      if (!due) { out.skipped++; continue; }
      await rateLimit(u.phone);
      await sendWhatsApp(u.phone, await writeMessage('report', u), u.name);
      u.lastReport = today; await putUser(u); out.sent++;
    } catch (e) { console.error('cron', id, e.message); out.failed++; }
  }
  res.status(200).json(out);
}
