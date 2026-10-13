(() => {
  'use strict';

  const TSE_BASE='https://resultados.tse.jus.br/oficial';
  const ELECTION=6257;
  const MAP_W=940, MAP_H=760, PAD=18;
  const CACHE_KEY='painel2026.brmap.president';
  const LIVE_TTL=2*60*1000, FINAL_TTL=24*60*60*1000;

  const UFS=[
    ['AC','12','Norte'],['AL','27','Nordeste'],['AP','16','Norte'],['AM','13','Norte'],
    ['BA','29','Nordeste'],['CE','23','Nordeste'],['DF','53','Centro-Oeste'],['ES','32','Sudeste'],
    ['GO','52','Centro-Oeste'],['MA','21','Nordeste'],['MT','51','Centro-Oeste'],['MS','50','Centro-Oeste'],
    ['MG','31','Sudeste'],['PA','15','Norte'],['PB','25','Nordeste'],['PR','41','Sul'],
    ['PE','26','Nordeste'],['PI','22','Nordeste'],['RJ','33','Sudeste'],['RN','24','Nordeste'],
    ['RS','43','Sul'],['RO','11','Norte'],['RR','14','Norte'],['SC','42','Sul'],
    ['SP','35','Sudeste'],['SE','28','Nordeste'],['TO','17','Norte']
  ].map(([uf,ibge,regiao])=>({uf,ibge,regiao}));

  const byIbge=new Map(UFS.map(x=>[x.ibge,x]));
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtInt=n=>new Intl.NumberFormat('pt-BR').format(Number(n||0));
  const fmtPct=n=>`${Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const digits=v=>parseInt(String(v??'').replace(/\D/g,''),10)||0;
  const decimal=v=>{const s=String(v??'').trim();if(!s)return 0;const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(n)?n:0;};

  let state={geo:null,results:new Map(),paths:new Map(),selected:null};

  function urlFor(uf){
    const u=uf.toLowerCase();
    return `${TSE_BASE}/ele2026/${ELECTION}/dados/${u}/${u}-c0001-e006257-u.json`;
  }

  function normalize(json){
    const cargo=json?.carg?.[0]||{};
    const rows=[];
    for(const agr of cargo.agr||[])for(const par of agr.par||[])for(const c of par.cand||[])rows.push({
      numero:String(c.n||''),nome:c.nmu||c.nm||'',partido:par.sg||'',
      votos:digits(c.vap),pct:decimal(c.pvap)
    });
    rows.sort((a,b)=>b.votos-a.votos||a.nome.localeCompare(b.nome,'pt-BR'));
    const top=rows[0]||null,second=rows[1]||null;
    return {rows,top,second,margem:top&&second?Math.max(0,top.pct-second.pct):0,final:String(json?.tf||json?.f||'').toLowerCase()==='s',secoes:decimal(json?.s?.pst)};
  }

  function colorFor(name){
    const known={
      'FLAVIO BOLSONARO':'#3767f0','FLÁVIO BOLSONARO':'#3767f0',
      'LULA':'#ef3d46'
    };
    const key=String(name||'').toUpperCase();
    if(known[key])return known[key];
    let h=0;for(const ch of key)h=(h*31+ch.charCodeAt(0))>>>0;
    return `hsl(${(h%300)+20} 72% 54%)`;
  }

  function getCache(){
    try{
      const raw=localStorage.getItem(CACHE_KEY);if(!raw)return null;
      const x=JSON.parse(raw),ttl=x.final?FINAL_TTL:LIVE_TTL;
      if(!x.at||Date.now()-x.at>ttl)return null;
      return x;
    }catch(_){return null}
  }
  function setCache(items,final){
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({items,final,at:Date.now()}))}catch(_){}
  }

  async function fetchJSON(url,cache='no-store'){
    const r=await fetch(url,{cache});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();
  }

  async function loadGeo(){
    return fetchJSON('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF','force-cache');
  }

  function featureCode(f){
    const vals=[f?.id,...Object.values(f?.properties||{})].map(v=>String(v??''));
    return vals.find(v=>/^\d{2}$/.test(v))||vals.map(v=>v.match(/(?:^|\D)(\d{2})(?:\D|$)/)?.[1]).find(Boolean)||'';
  }
  function coords(geom,cb){
    const walk=a=>{if(!Array.isArray(a))return;if(typeof a[0]==='number'&&typeof a[1]==='number'){cb(a[0],a[1]);return;}for(const x of a)walk(x)};
    walk(geom?.coordinates);
  }
  function projector(geo){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const f of geo.features||[])coords(f.geometry,(x,y)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});
    const s=Math.min((MAP_W-PAD*2)/(maxX-minX),(MAP_H-PAD*2)/(maxY-minY));
    const ox=(MAP_W-(maxX-minX)*s)/2,oy=(MAP_H-(maxY-minY)*s)/2;
    return (x,y)=>[ox+(x-minX)*s,MAP_H-(oy+(y-minY)*s)];
  }
  function ringPath(r,p){return r.map((pt,i)=>{const [x,y]=p(pt[0],pt[1]);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`}).join(' ')+' Z'}
  function geoPath(g,p){
    if(!g)return '';
    if(g.type==='Polygon')return (g.coordinates||[]).map(r=>ringPath(r,p)).join(' ');
    if(g.type==='MultiPolygon')return (g.coordinates||[]).flatMap(poly=>poly.map(r=>ringPath(r,p))).join(' ');
    return '';
  }
  function centroid(g,p){
    let sx=0,sy=0,n=0;coords(g,(x,y)=>{const q=p(x,y);sx+=q[0];sy+=q[1];n++});
    return n?[sx/n,sy/n]:[0,0];
  }

  function shell(){
    return `<section class="br-election-card" id="brElectionCard">
      <div class="br-election-head">
        <div>
          <p class="br-election-kicker">PRESIDÊNCIA • BRASIL</p>
          <h3>Mapa do resultado por estado</h3>
          <p>Mostra o candidato mais votado em cada unidade da Federação e a diferença para o segundo colocado.</p>
        </div>
        <div class="br-election-status"><span id="brMapStatusDot"></span><strong id="brMapStatus">Carregando TSE…</strong></div>
      </div>
      <div class="br-election-layout">
        <div class="br-map-stage">
          <svg id="brElectionSvg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Mapa do resultado presidencial por estado">
            <g id="brStatesLayer"></g><g id="brLabelsLayer"></g>
          </svg>
          <div class="br-map-tooltip" id="brMapTooltip" hidden></div>
        </div>
        <aside class="br-map-side">
          <div class="br-map-detail" id="brMapDetail"><span>Brasil</span><strong>Selecione um estado</strong><small>Clique no mapa para ver o resultado estadual.</small></div>
          <div class="br-map-panel">
            <h4>Por região</h4>
            <div id="brRegionSummary"></div>
          </div>
          <div class="br-map-panel">
            <h4>Estados liderados</h4>
            <div id="brLeaderSummary"></div>
          </div>
          <div class="br-map-source">Fonte eleitoral: arquivos oficiais de totalização do TSE. Malha geográfica: IBGE.</div>
        </aside>
      </div>
    </section>`;
  }

  function inject(){
    const view=document.querySelector('#view');
    const summary=view?.querySelector('#resultSummary');
    if(!view||!summary||view.querySelector('#brElectionCard'))return;
    const mg=view.querySelector('#electionMapCard');
    if(mg)mg.insertAdjacentHTML('beforebegin',shell()); else summary.insertAdjacentHTML('afterend',shell());
    bootstrap().catch(fatal);
  }

  async function bootstrap(){
    state.geo=await loadGeo();
    renderBase();
    const cached=getCache();
    if(cached?.items){
      for(const x of cached.items)state.results.set(x.uf,x);
      paintAll();summaries();setStatus('Dados em cache',true);return;
    }
    await loadResults();
  }

  function renderBase(){
    const layer=document.querySelector('#brStatesLayer'),labels=document.querySelector('#brLabelsLayer');
    if(!layer||!labels)return;
    const p=projector(state.geo),paths=[],texts=[];
    for(const f of state.geo.features||[]){
      const code=featureCode(f),meta=byIbge.get(code);if(!meta)continue;
      paths.push(`<path class="br-state" data-uf="${meta.uf}" d="${geoPath(f.geometry,p)}"></path>`);
      const [cx,cy]=centroid(f.geometry,p);
      texts.push(`<text class="br-state-label" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" data-label-uf="${meta.uf}">${meta.uf}</text>`);
    }
    layer.innerHTML=paths.join('');labels.innerHTML=texts.join('');
    state.paths=new Map([...layer.querySelectorAll('.br-state')].map(el=>[el.dataset.uf,el]));
    layer.querySelectorAll('.br-state').forEach(el=>{
      el.addEventListener('mouseenter',ev=>tooltip(el.dataset.uf,ev));
      el.addEventListener('mousemove',positionTooltip);
      el.addEventListener('mouseleave',hideTooltip);
      el.addEventListener('click',()=>select(el.dataset.uf));
    });
    labels.querySelectorAll('.br-state-label').forEach(el=>el.addEventListener('click',()=>select(el.dataset.labelUf)));
  }

  async function loadResults(){
    const queue=UFS.slice();let done=0,allFinal=true;
    const worker=async()=>{
      while(queue.length){
        const meta=queue.shift();
        try{
          const j=await fetchJSON(urlFor(meta.uf));
          const r=normalize(j),item={...meta,...r};
          state.results.set(meta.uf,item);allFinal=allFinal&&!!r.final;paint(item);
        }catch(_){state.results.set(meta.uf,{...meta,error:true});allFinal=false}
        done++;setStatus(`TSE ${done}/27`,false);if(done%3===0)summaries();
      }
    };
    await Promise.all(Array.from({length:4},worker));
    const items=[...state.results.values()].filter(x=>!x.error);setCache(items,allFinal);
    paintAll();summaries();setStatus(allFinal?'Totalização estadual final':'Carga concluída',true);
  }

  function paint(r){
    const el=state.paths.get(r.uf);if(!el||!r.top)return;
    el.style.fill=colorFor(r.top.nome);el.classList.add('has-result');
  }
  function paintAll(){for(const r of state.results.values())paint(r)}

  function aggregate(items){
    const votes=new Map(),totalValid=items.reduce((s,r)=>s+(r.rows||[]).reduce((a,x)=>a+x.votos,0),0);
    for(const r of items)for(const x of r.rows||[])votes.set(x.nome,(votes.get(x.nome)||0)+x.votos);
    const rows=[...votes].map(([nome,votos])=>({nome,votos,pct:totalValid?votos/totalValid*100:0})).sort((a,b)=>b.votos-a.votos);
    return rows;
  }

  function summaries(){
    const regionEl=document.querySelector('#brRegionSummary'),leaderEl=document.querySelector('#brLeaderSummary');
    if(regionEl){
      const regs=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
      regionEl.innerHTML=regs.map(reg=>{
        const items=[...state.results.values()].filter(x=>x.regiao===reg&&x.rows);
        const a=aggregate(items),top=a[0];
        return `<div class="br-region-row"><span>${reg}</span><div>${top?`<i style="background:${colorFor(top.nome)}"></i><strong>${safe(top.nome)}</strong><small>${fmtPct(top.pct)}</small>`:'<small>Carregando…</small>'}</div></div>`;
      }).join('');
    }
    if(leaderEl){
      const counts=new Map();
      for(const r of state.results.values())if(r.top){
        const x=counts.get(r.top.nome)||{nome:r.top.nome,partido:r.top.partido,n:0};x.n++;counts.set(r.top.nome,x);
      }
      leaderEl.innerHTML=[...counts.values()].sort((a,b)=>b.n-a.n).map(x=>`<div class="br-leader-row"><i style="background:${colorFor(x.nome)}"></i><div><strong>${safe(x.nome)}</strong><small>${safe(x.partido)} • ${x.n} UF${x.n===1?'':'s'}</small></div></div>`).join('')||'<small>Carregando…</small>';
    }
  }

  function detail(r){
    if(!r)return '<span>Brasil</span><strong>Selecione um estado</strong>';
    if(r.error)return `<span>${r.uf}</span><strong>Resultado indisponível</strong><small>O arquivo estadual não foi carregado nesta tentativa.</small>`;
    return `<span>${r.uf} • ${safe(r.regiao)}</span>
      <div class="br-detail-winner"><i style="background:${colorFor(r.top?.nome)}"></i><div><strong>${safe(r.top?.nome||'—')}</strong><small>${safe(r.top?.partido||'')} • ${safe(r.top?.numero||'')}</small></div></div>
      <div class="br-detail-grid">
        <div><span>Votos</span><strong>${fmtInt(r.top?.votos)}</strong></div>
        <div><span>Percentual</span><strong>${fmtPct(r.top?.pct)}</strong></div>
        <div><span>Margem</span><strong>${fmtPct(r.margem)}</strong></div>
        <div><span>2º colocado</span><strong>${safe(r.second?.nome||'—')}</strong></div>
      </div>`;
  }
  function select(uf){
    state.selected=uf;for(const [id,el] of state.paths)el.classList.toggle('is-selected',id===uf);
    const d=document.querySelector('#brMapDetail');if(d)d.innerHTML=detail(state.results.get(uf)||UFS.find(x=>x.uf===uf));
  }
  function tooltip(uf,ev){
    const tip=document.querySelector('#brMapTooltip'),r=state.results.get(uf),meta=UFS.find(x=>x.uf===uf);if(!tip||!meta)return;
    tip.innerHTML=r?.top?`<strong>${uf}</strong><span>${safe(r.top.nome)} • ${fmtPct(r.top.pct)}</span><small>Margem ${fmtPct(r.margem)}</small>`:`<strong>${uf}</strong><span>Carregando resultado…</span>`;
    tip.hidden=false;positionTooltip(ev);
  }
  function positionTooltip(ev){
    const tip=document.querySelector('#brMapTooltip'),stage=document.querySelector('.br-map-stage');if(!tip||!stage||tip.hidden)return;
    const rect=stage.getBoundingClientRect();tip.style.left=`${Math.min(rect.width-190,Math.max(8,ev.clientX-rect.left+12))}px`;tip.style.top=`${Math.min(rect.height-70,Math.max(8,ev.clientY-rect.top+12))}px`;
  }
  function hideTooltip(){const tip=document.querySelector('#brMapTooltip');if(tip)tip.hidden=true}
  function setStatus(label,ok){const el=document.querySelector('#brMapStatus'),dot=document.querySelector('#brMapStatusDot');if(el)el.textContent=label;if(dot)dot.classList.toggle('done',!!ok)}
  function fatal(err){console.error(err);const c=document.querySelector('#brElectionCard');if(c)c.innerHTML=`<div class="br-map-fatal"><h3>Mapa do Brasil indisponível</h3><p>${safe(err?.message||err)}</p><small>Os resultados oficiais e o mapa de Minas Gerais continuam disponíveis.</small></div>`}

  const obs=new MutationObserver(()=>{if(document.querySelector('.tab.active')?.dataset.view==='resultados')setTimeout(inject,60)});
  const view=document.querySelector('#view');if(view)obs.observe(view,{childList:true,subtree:true});
  document.querySelectorAll('.tab[data-view="resultados"]').forEach(b=>b.addEventListener('click',()=>setTimeout(inject,180)));
  if(document.querySelector('.tab.active')?.dataset.view==='resultados')setTimeout(inject,180);
})();