import { route, httpErr, redis, getUser, normEmail, checkPassword, createSession, limitAttempts, clientIp } from './_lib.js';
// Entra na conta em qualquer aparelho.
export default route(async (b, req) => {
  const email = normEmail(b.email);
  if (!email) throw httpErr(400, 'Digite um e-mail válido.');
  await limitAttempts(`rl:login:${email}`, 8, 900);
  await limitAttempts(`rl:loginip:${clientIp(req)}`, 30, 900);
  const uid = await redis('GET', 'email:' + email);
  const u = uid ? await getUser(uid) : null;
  if (!u || !checkPassword(b.password, u.passHash)) throw httpErr(401, 'E-mail ou senha incorretos.');
  return { token: await createSession(uid) };
});
