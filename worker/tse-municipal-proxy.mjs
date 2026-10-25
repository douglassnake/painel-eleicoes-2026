/**
 * Cloudflare Worker proxy for TSE public election results (no credentials).
 * Configure ALLOWED_ORIGIN and deploy separately from GitHub Pages.
 * Only election 6258 EA12 and municipal EA20 JSON paths are permitted.
 */
const TSE='https://resultados.tse.jus.br/oficial/ele2026/6258/';
const MUNICIPAL=/^dados\/([a-z]{2})\/\1\d{5}-c0001-e006258-u\.json$/;
const CONFIG='config/mun-e006258-cm.json';
export default {
  async fetch(request,env,ctx){
    const origin=request.headers.get('Origin')||'';
    const allowed=String(env.ALLOWED_ORIGIN||'');
    const cors=origin===allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    if(origin&&origin!==allowed)return new Response('Origin not allowed',{status:403});
    const u=new URL(request.url),path=u.pathname.replace(/^\/+/, '');
    if(path!==CONFIG&&!MUNICIPAL.test(path))return new Response('Not found',{status:404,headers:cors});
    const upstream=new URL(path,TSE);
    const cacheKey=new Request(upstream.toString(),{method:'GET'});
    const cache=caches.default;
    const cached=await cache.match(cacheKey);
    if(cached){const h=new Headers(cached.headers);Object.entries(cors).forEach(([k,v])=>h.set(k,v));return new Response(cached.body,{status:cached.status,headers:h});}
    try{
      const response=await fetch(upstream,{headers:{'Accept':'application/json'},redirect:'follow',signal:AbortSignal.timeout(15000)});
      if(!response.ok)return new Response('TSE unavailable',{status:502,headers:cors});
      const body=await response.text();
      if(body.length>8000000)return new Response('Payload too large',{status:502,headers:cors});
      JSON.parse(body);
      const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60',...cors});
      const result=new Response(body,{status:200,headers});
      ctx.waitUntil(cache.put(cacheKey,new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60'}})));
      return result;
    }catch{return new Response('TSE request failed',{status:502,headers:cors});}
  }
};
