import { route, httpErr, validUid, getUser, putUser, sha, newToken, normPhone, phoneAllowed, cleanSummary, rateLimit, writeMessage, sendWhatsApp } from './_lib.js';
// Cadastra ou atualiza nome, número e frequência. Manda as boas-vindas na primeira vez que um número é cadastrado.
export default route(async (b) => {
  if (!validUid(b.uid)) throw httpErr(400, 'Identificação inválida.');
  let u = await getUser(b.uid), token = null;
  if (u) { if (!b.token || u.tokenHash !== sha(b.token)) throw httpErr(401, 'Não autorizado.'); }
  else { token = newToken(); u = { uid: b.uid, tokenHash: sha(token), createdAt: Date.now() }; }

  const phone = b.phone ? normPhone(b.phone) : null;
  if (b.phone && !phone) throw httpErr(400, 'Número inválido. Use DDD + número.');
  if (phone && !phoneAllowed(phone)) throw httpErr(403, 'Este número não está autorizado neste servidor (ALLOWED_PHONES).');

  Object.assign(u, {
    name: String(b.name || '').trim().slice(0, 40),
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
  return { token, welcomed, error };
});
