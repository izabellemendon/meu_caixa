import { route, httpErr, auth, putUser, normPhone, phoneAllowed, cleanSummary, rateLimit, writeMessage, sendWhatsApp } from './_lib.js';
// Salva nome, número e frequência do WhatsApp da conta. Manda as boas-vindas na primeira vez que um número é cadastrado.
export default route(async (b) => {
  const u = await auth(b);
  const phone = b.phone ? normPhone(b.phone) : null;
  if (b.phone && !phone) throw httpErr(400, 'Número inválido. Use DDD + número.');
  if (phone && !phoneAllowed(phone)) throw httpErr(403, 'Este número não está autorizado neste servidor (ALLOWED_PHONES).');
  Object.assign(u, {
    name: String(b.name || u.name || '').trim().slice(0, 40),
    phone,
    freq: ['diario', 'semanal', 'avisos'].includes(b.freq) ? b.freq : 'semanal',
    optIn: !!b.optIn && !!phone,
    summary: cleanSummary(b.summary) || u.summary || null,
    updatedAt: Date.now()
  });
  let welcomed = false, error = null;
  if (u.optIn && u.welcomedPhone !== phone) {
    try {
      await rateLimit(phone);
      await sendWhatsApp(phone, await writeMessage('welcome', u), u.name);
      u.welcomedPhone = phone; welcomed = true;
    } catch (e) { error = e.status ? e.message : 'Não foi possível enviar a mensagem agora.'; if (!e.status) console.error(e); }
  }
  await putUser(u);
  return { welcomed, error };
});
