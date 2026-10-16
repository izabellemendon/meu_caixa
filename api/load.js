import { route, auth, redis } from './_lib.js';
// Devolve todos os dados da conta (cartões, gastos, entradas, guardado, ajustes).
export default route(async (b) => {
  const u = await auth(b);
  const raw = await redis('GET', 'data:' + u.uid);
  if (!raw) return { state: null };
  const d = JSON.parse(raw);
  return { state: d.state, updatedAt: d.updatedAt };
});
