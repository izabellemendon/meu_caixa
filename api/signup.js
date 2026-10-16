import crypto from 'node:crypto';
import { route, httpErr, redis, putUser, normEmail, hashPassword, createSession, limitAttempts, clientIp } from './_lib.js';
// Cria a conta (e-mail + senha) e já devolve uma sessão.
export default route(async (b, req) => {
  const email = normEmail(b.email);
  if (!email) throw httpErr(400, 'Digite um e-mail válido.');
  const pass = String(b.password || '');
  if (pass.length < 6 || pass.length > 200) throw httpErr(400, 'A senha precisa ter pelo menos 6 caracteres.');
  await limitAttempts(`rl:signup:${clientIp(req)}`, 10, 3600);
  const uid = crypto.randomBytes(12).toString('hex');
  const ok = await redis('SET', 'email:' + email, uid, 'NX');
  if (ok !== 'OK') throw httpErr(409, 'Já existe uma conta com este e-mail. Toque em "Já tenho conta" para entrar.');
  await putUser({ uid, email, passHash: hashPassword(pass), name: String(b.name || '').trim().slice(0, 40), createdAt: Date.now() });
  return { token: await createSession(uid) };
});
