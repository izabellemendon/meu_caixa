import { route, auth, putUser, cleanSummary } from './_lib.js';
// Guarda o resumo mais recente dos números (usado nos relatórios automáticos).
export default route(async (b) => {
  const u = await auth(b);
  const s = cleanSummary(b.summary);
  if (s) { u.summary = s; u.updatedAt = Date.now(); await putUser(u); }
  return { ok: true };
});
