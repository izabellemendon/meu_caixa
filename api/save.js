import { route, auth, redis, putUser, cleanSummary, httpErr } from './_lib.js';
// Guarda todos os dados da conta. Chamado pelo app a cada alteração.
export default route(async (b) => {
  const u = await auth(b);
  const st = b.state;
  if (!st || typeof st !== 'object' || Array.isArray(st)) throw httpErr(400, 'Dados inválidos.');
  const json = JSON.stringify({ state: st, updatedAt: Date.now() });
  if (json.length > 900000) throw httpErr(413, 'Seus dados passaram do tamanho máximo. Apague movimentações antigas.');
  await redis('SET', 'data:' + u.uid, json);
  const s = cleanSummary(b.summary);
  if (s) { u.summary = s; u.updatedAt = Date.now(); }
  const p = st.profile || {};
  if (p.name && !u.name) u.name = String(p.name).slice(0, 40);
  await putUser(u);
  return { ok: true };
});
