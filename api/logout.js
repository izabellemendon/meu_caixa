import { route, endSession } from './_lib.js';
export default route(async (b) => { await endSession(String(b.token || '')); return { ok: true }; });
