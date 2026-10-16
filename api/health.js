import { route, whatsappConfigured } from './_lib.js';
// O app chama esta rota para saber se está rodando com servidor (Vercel) e o que já foi configurado.
export default route(async () => ({
  ok: true,
  storage: !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)),
  whatsapp: whatsappConfigured(),
  ai: !!process.env.ANTHROPIC_API_KEY
}), { get: true });
