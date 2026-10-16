// Guarda o app no aparelho para abrir mesmo sem internet.
const CACHE='meu-caixa-v5';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/icon-maskable-512.png','/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(req.mode==='navigate'){ // página: tenta a rede (versão nova), cai no cache se offline
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('/index.html',cp));return r}).catch(()=>caches.match('/index.html')));return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{
    if(r.ok&&(url.origin===location.origin||url.host.endsWith('fonts.googleapis.com')||url.host.endsWith('fonts.gstatic.com'))){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}
    return r;
  })));
});
