(() => {
  'use strict';

  const TSE_BASE = 'https://resultados.tse.jus.br/oficial';
  const ELECTION_PRES = 6257;
  const ELECTION_STATE = 6259;
  const UF = 'mg';
  const IBGE_STATE = '31';
  const CACHE_PREFIX = 'painel2026.map.';
  const FINAL_TTL = 24 * 60 * 60 * 1000;
  const LIVE_TTL = 2 * 60 * 1000;
  const WORKERS = 5;
  const MAP_W = 980;
  const MAP_H = 780;
  const PAD = 18;

  let state = {
    office: 'presidente',
    municipios: [],
    geo: null,
    results: new Map(),
    paths: new Map(),
    selected: null,
    loading: false,
    cancelled: false,
    generation: 0
  };

  const safe = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtInt = n => new Intl.NumberFormat('pt-BR').format(Number(n || 0));
  const fmtPct = n => `${Number(n || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
  const digits = v => parseInt(String(v ?? '').replace(/\D/g,''),10) || 0;
  const decimal = v => {
    const s=String(v??'').trim();
    if(!s) return 0;
    const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);
    return Number.isFinite(n)?n:0;
  };
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  function officeConfig(key=state.office){
    if(key==='governador') return {label:'Governador de MG',cargo:3,election:ELECTION_STATE};
    return {label:'Presidente em MG',cargo:1,election:ELECTION_PRES};
  }

  function resultUrl(mun,key=state.office){
    const cfg=officeConfig(key);
    const code=String(mun.tse).padStart(5,'0');
    return `${TSE_BASE}/ele2026/${cfg.election}/dados/${UF}/${UF}${code}-c${String(cfg.cargo).padStart(4,'0')}-e${String(cfg.election).padStart(6,'0')}-u.json`;
  }

  function normalizeResult(json){
    const cargo=json?.carg?.[0]||{};
    const rows=[];
    for(const agr of cargo.agr||[]){
      for(const par of agr.par||[]){
        for(const c of par.cand||[]){
          rows.push({
            numero:String(c.n||''),
            nome:c.nmu||c.nm||'',
            partido:par.sg||'',
            votos:digits(c.vap),
            pct:decimal(c.pvap),
            situacao:c.st||''
          });
        }
      }
    }
    rows.sort((a,b)=>b.votos-a.votos || a.nome.localeCompare(b.nome,'pt-BR'));
    const top=rows[0]||null, second=rows[1]||null;
    return {
      top, second,
      margem:top&&second?Math.max(0,top.pct-second.pct):0,
      final:String(json?.tf||json?.f||'').toLowerCase()==='s' || String(json?.and||'').toLowerCase()==='f',
      secoes:decimal(json?.s?.pst),
      geradoEm:[json?.dg,json?.hg].filter(Boolean).join(' ')
    };
  }

  function colorFor(name){
    const s=String(name||'');
    let h=0;
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    const hue=(h%300)+20;
    return `hsl(${hue} 72% 54%)`;
  }

  function cacheKey(key){ return CACHE_PREFIX+key; }
  function getCache(key){
    try{
      const raw=localStorage.getItem(cacheKey(key));
      if(!raw) return null;
      const x=JSON.parse(raw);
      const ttl=x.final?FINAL_TTL:LIVE_TTL;
      if(!x.at || Date.now()-x.at>ttl) return null;
      return x;
    }catch(_){ return null; }
  }
  function setCache(key,payload){
    try{ localStorage.setItem(cacheKey(key),JSON.stringify({...payload,at:Date.now()})); }catch(_){}
  }

  async function fetchJSON(url,opts={}){
    const r=await fetch(url,{cache:opts.cache||'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function loadMunicipios(){
    const url=`${TSE_BASE}/ele2026/${ELECTION_STATE}/config/mun-e${String(ELECTION_STATE).padStart(6,'0')}-cm.json`;
    const j=await fetchJSON(url,{cache:'force-cache'});
    const abr=(j?.abr||[]).find(x=>String(x.cd||'').toUpperCase()==='MG');
    if(!abr) throw new Error('Lista de municípios de MG não localizada no TSE.');
    return (abr.mu||[]).map(x=>({
      tse:String(x.cd||'').padStart(5,'0'),
      ibge:String(x.cdi||''),
      nome:x.nm||''
    })).filter(x=>x.tse&&x.ibge&&x.nome);
  }

  async function loadGeo(){
    const url=`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${IBGE_STATE}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`;
    return fetchJSON(url,{cache:'force-cache'});
  }

  function featureIbge(f){
    const vals=[f?.id,...Object.values(f?.properties||{})].map(v=>String(v??''));
    return vals.find(v=>/^31\d{5}$/.test(v)) || vals.find(v=>/^\d{7}$/.test(v)) || '';
  }

  function coordEach(geom,cb){
    if(!geom) return;
    const walk=a=>{
      if(!Array.isArray(a)) return;
      if(typeof a[0]==='number' && typeof a[1]==='number'){cb(a[0],a[1]);return;}
      for(const x of a) walk(x);
    };
    walk(geom.coordinates);
  }

  function makeProjector(geo){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const f of geo.features||[]){
      coordEach(f.geometry,(x,y)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);});
    }
    const sx=(MAP_W-PAD*2)/(maxX-minX), sy=(MAP_H-PAD*2)/(maxY-minY), s=Math.min(sx,sy);
    const ox=(MAP_W-(maxX-minX)*s)/2, oy=(MAP_H-(maxY-minY)*s)/2;
    return (x,y)=>[ox+(x-minX)*s, MAP_H-(oy+(y-minY)*s)];
  }

  function ringPath(ring,proj){
    return ring.map((p,i)=>{const [x,y]=proj(p[0],p[1]);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+' Z';
  }

  function geometryPath(geom,proj){
    if(!geom) return '';
    if(geom.type==='Polygon') return (geom.coordinates||[]).map(r=>ringPath(r,proj)).join(' ');
    if(geom.type==='MultiPolygon') return (geom.coordinates||[]).flatMap(poly=>poly.map(r=>ringPath(r,proj))).join(' ');
    return '';
  }

  function shell(){
    return `
      <section class="election-map-card" id="electionMapCard">
        <div class="election-map-head">
          <div>
            <p class="election-map-kicker">MAPA ELEITORAL • MINAS GERAIS</p>
            <h3>Resultado por município</h3>
            <p>Cada município é colorido pelo candidato mais votado. A margem representa a diferença entre o 1º e o 2º colocado naquele município.</p>
          </div>
          <div class="election-map-controls">
            <button type="button" class="map-office active" data-office="presidente">Presidente</button>
            <button type="button" class="map-office" data-office="governador">Governador</button>
          </div>
        </div>
        <div class="map-toolbar">
          <div class="map-search-wrap">
            <input id="mapMunicipioSearch" list="mapMunicipiosList" placeholder="Buscar município de MG…" autocomplete="off">
            <datalist id="mapMunicipiosList"></datalist>
          </div>
          <div class="map-progress-block">
            <div class="map-progress-label"><span id="mapProgressText">Preparando mapa…</span><strong id="mapProgressPct">0%</strong></div>
            <div class="map-progress-track"><i id="mapProgressBar"></i></div>
          </div>
        </div>
        <div class="election-map-layout">
          <div class="election-map-stage">
            <svg id="mgElectionMap" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Mapa eleitoral de Minas Gerais por município">
              <g id="mgMunicipiosLayer"></g>
            </svg>
            <div class="map-tooltip" id="mapTooltip" hidden></div>
          </div>
          <aside class="map-side">
            <div class="map-detail" id="mapDetail">
              <span class="map-detail-label">Selecione um município</span>
              <strong>Passe o mouse ou clique no mapa.</strong>
              <small>Os dados vêm diretamente dos arquivos oficiais de totalização do TSE.</small>
            </div>
            <div class="map-legend-block">
              <div class="map-side-title">Municípios liderados</div>
              <div id="mapLegend" class="map-legend"><div class="map-legend-empty">Carregando resultados…</div></div>
            </div>
            <div class="map-source-note">Fonte eleitoral: Tribunal Superior Eleitoral (TSE). Malha municipal: IBGE. Cores são apenas categorias visuais e não representam identidade oficial de partidos.</div>
          </aside>
        </div>
      </section>`;
  }

  function inject(){
    const view=document.querySelector('#view');
    const summary=view?.querySelector('#resultSummary');
    if(!view||!summary||view.querySelector('#electionMapCard')) return;
    summary.insertAdjacentHTML('afterend',shell());
    bindControls();
    bootstrap().catch(showFatal);
  }

  function bindControls(){
    document.querySelectorAll('.map-office').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const office=btn.dataset.office;
        if(office===state.office) return;
        state.office=office;
        document.querySelectorAll('.map-office').forEach(x=>x.classList.toggle('active',x===btn));
        loadOffice(office);
      });
    });
    const input=document.querySelector('#mapMunicipioSearch');
    input?.addEventListener('change',()=>{
      const q=input.value.trim().toLocaleLowerCase('pt-BR');
      const m=state.municipios.find(x=>x.nome.toLocaleLowerCase('pt-BR')===q) ||
              state.municipios.find(x=>x.nome.toLocaleLowerCase('pt-BR').includes(q));
      if(m) selectMunicipio(m.ibge,true);
    });
  }

  async function bootstrap(){
    const [municipios,geo]=await Promise.all([loadMunicipios(),loadGeo()]);
    state.municipios=municipios;
    state.geo=geo;
    const dl=document.querySelector('#mapMunicipiosList');
    if(dl) dl.innerHTML=municipios.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(m=>`<option value="${safe(m.nome)}"></option>`).join('');
    renderBaseMap();
    await loadOffice(state.office);
  }

  function renderBaseMap(){
    const layer=document.querySelector('#mgMunicipiosLayer');
    if(!layer||!state.geo) return;
    const proj=makeProjector(state.geo);
    const byIbge=new Map(state.municipios.map(m=>[m.ibge,m]));
    const html=[];
    for(const f of state.geo.features||[]){
      const ibge=featureIbge(f);
      const m=byIbge.get(ibge);
      if(!m) continue;
      html.push(`<path class="mg-municipio" data-ibge="${safe(ibge)}" data-tse="${safe(m.tse)}" data-name="${safe(m.nome)}" d="${geometryPath(f.geometry,proj)}"></path>`);
    }
    layer.innerHTML=html.join('');
    state.paths=new Map([...layer.querySelectorAll('.mg-municipio')].map(el=>[el.dataset.ibge,el]));
    layer.querySelectorAll('.mg-municipio').forEach(el=>{
      el.addEventListener('mouseenter',ev=>showTooltip(el.dataset.ibge,ev));
      el.addEventListener('mousemove',ev=>positionTooltip(ev));
      el.addEventListener('mouseleave',hideTooltip);
      el.addEventListener('click',()=>selectMunicipio(el.dataset.ibge,false));
    });
  }

  function resetMap(){
    state.results=new Map();
    state.selected=null;
    for(const el of state.paths.values()){
      el.style.fill='rgba(83,111,137,.18)';
      el.classList.remove('is-selected','has-result');
    }
    const detail=document.querySelector('#mapDetail');
    if(detail) detail.innerHTML='<span class="map-detail-label">Selecione um município</span><strong>Passe o mouse ou clique no mapa.</strong><small>Os resultados serão preenchidos progressivamente.</small>';
    updateLegend();
  }

  async function loadOffice(key){
    const generation=++state.generation;
    state.cancelled=false;
    state.loading=true;
    resetMap();
    const cached=getCache(key);
    if(cached?.items){
      for(const x of cached.items) state.results.set(x.ibge,x);
      paintAll();
      setProgress(state.results.size,state.municipios.length,cached.final?'Totalização final • dados em cache':'Dados recentes em cache');
      state.loading=false;
      return;
    }

    const queue=state.municipios.slice();
    let done=0, allFinal=true;
    setProgress(0,queue.length,'Consultando TSE por município…');

    const worker=async()=>{
      while(queue.length && generation===state.generation){
        const m=queue.shift();
        try{
          const json=await fetchJSON(resultUrl(m,key),{cache:'no-store'});
          const r=normalizeResult(json);
          const item={...m,...r};
          state.results.set(m.ibge,item);
          allFinal=allFinal && !!r.final;
          paintMunicipio(item);
        }catch(_){
          state.results.set(m.ibge,{...m,error:true});
          allFinal=false;
        }
        done++;
        if(done%4===0 || done===state.municipios.length){
          setProgress(done,state.municipios.length,'Consultando TSE por município…');
          updateLegend();
        }
        await sleep(45);
      }
    };
    await Promise.all(Array.from({length:WORKERS},worker));
    if(generation!==state.generation) return;
    const items=[...state.results.values()].filter(x=>!x.error);
    setCache(key,{final:allFinal,items});
    setProgress(done,state.municipios.length,allFinal?'Totalização municipal concluída':'Carga concluída • alguns arquivos podem estar em atualização');
    updateLegend();
    state.loading=false;
  }

  function paintMunicipio(item){
    const el=state.paths.get(item.ibge);
    if(!el||!item.top) return;
    el.style.fill=colorFor(item.top.nome);
    el.classList.add('has-result');
  }

  function paintAll(){
    for(const item of state.results.values()) paintMunicipio(item);
    updateLegend();
  }

  function setProgress(done,total,label){
    const pct=total?Math.round(done/total*100):0;
    const txt=document.querySelector('#mapProgressText');
    const p=document.querySelector('#mapProgressPct');
    const bar=document.querySelector('#mapProgressBar');
    if(txt) txt.textContent=`${label} ${fmtInt(done)}/${fmtInt(total)}`;
    if(p) p.textContent=`${pct}%`;
    if(bar) bar.style.width=`${pct}%`;
  }

  function updateLegend(){
    const counts=new Map();
    for(const r of state.results.values()){
      if(!r.top) continue;
      const k=r.top.nome;
      const cur=counts.get(k)||{nome:k,partido:r.top.partido,count:0,color:colorFor(k)};
      cur.count++;
      counts.set(k,cur);
    }
    const arr=[...counts.values()].sort((a,b)=>b.count-a.count);
    const el=document.querySelector('#mapLegend');
    if(!el) return;
    if(!arr.length){el.innerHTML='<div class="map-legend-empty">Carregando resultados…</div>';return;}
    el.innerHTML=arr.slice(0,8).map(x=>`<div class="map-legend-row"><i style="background:${x.color}"></i><div><strong>${safe(x.nome)}</strong><small>${safe(x.partido||'')} • ${fmtInt(x.count)} município${x.count===1?'':'s'}</small></div></div>`).join('');
  }

  function detailHTML(r){
    if(!r) return '<span class="map-detail-label">Sem dados</span>';
    if(r.error) return `<span class="map-detail-label">${safe(r.nome)}</span><strong>Resultado não disponível</strong><small>O arquivo municipal do TSE não pôde ser carregado nesta tentativa.</small>`;
    if(!r.top) return `<span class="map-detail-label">${safe(r.nome)}</span><strong>Sem votos válidos localizados</strong>`;
    return `
      <span class="map-detail-label">${safe(r.nome)}</span>
      <div class="map-winner">
        <i style="background:${colorFor(r.top.nome)}"></i>
        <div><strong>${safe(r.top.nome)}</strong><small>${safe(r.top.partido)} • ${safe(r.top.numero)}</small></div>
      </div>
      <div class="map-detail-grid">
        <div><span>Votos</span><strong>${fmtInt(r.top.votos)}</strong></div>
        <div><span>Percentual</span><strong>${fmtPct(r.top.pct)}</strong></div>
        <div><span>Margem</span><strong>${fmtPct(r.margem)}</strong></div>
        <div><span>2º colocado</span><strong>${r.second?safe(r.second.nome):'—'}</strong></div>
      </div>
      <small>${r.final?'Totalização municipal final':'Arquivo municipal em atualização'}${r.geradoEm?' • '+safe(r.geradoEm):''}</small>`;
  }

  function selectMunicipio(ibge,scroll){
    state.selected=ibge;
    for(const [id,el] of state.paths) el.classList.toggle('is-selected',id===ibge);
    const r=state.results.get(ibge) || state.municipios.find(x=>x.ibge===ibge);
    const detail=document.querySelector('#mapDetail');
    if(detail) detail.innerHTML=detailHTML(r);
    const input=document.querySelector('#mapMunicipioSearch');
    if(input&&r?.nome) input.value=r.nome;
    if(scroll) state.paths.get(ibge)?.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});
  }

  function showTooltip(ibge,ev){
    const tip=document.querySelector('#mapTooltip');
    if(!tip) return;
    const m=state.results.get(ibge) || state.municipios.find(x=>x.ibge===ibge);
    if(!m) return;
    tip.innerHTML=m.top
      ? `<strong>${safe(m.nome)}</strong><span>${safe(m.top.nome)} • ${fmtPct(m.top.pct)}</span><small>Margem ${fmtPct(m.margem)}</small>`
      : `<strong>${safe(m.nome)}</strong><span>Carregando resultado…</span>`;
    tip.hidden=false;
    positionTooltip(ev);
  }
  function positionTooltip(ev){
    const tip=document.querySelector('#mapTooltip'), stage=document.querySelector('.election-map-stage');
    if(!tip||!stage||tip.hidden) return;
    const rect=stage.getBoundingClientRect();
    tip.style.left=`${Math.min(rect.width-210,Math.max(10,ev.clientX-rect.left+14))}px`;
    tip.style.top=`${Math.min(rect.height-90,Math.max(10,ev.clientY-rect.top+14))}px`;
  }
  function hideTooltip(){
    const tip=document.querySelector('#mapTooltip'); if(tip) tip.hidden=true;
  }

  function showFatal(err){
    console.error(err);
    const card=document.querySelector('#electionMapCard');
    if(card) card.innerHTML=`<div class="map-fatal"><h3>Mapa municipal indisponível</h3><p>${safe(err?.message||err)}</p><small>Os demais resultados do painel continuam funcionando normalmente.</small></div>`;
  }

  const observer=new MutationObserver(()=>{
    const active=document.querySelector('.tab.active')?.dataset.view==='resultados';
    if(active) inject();
  });
  const view=document.querySelector('#view');
  if(view) observer.observe(view,{childList:true,subtree:true});
  document.querySelectorAll('.tab[data-view="resultados"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(inject,80)));
  if(document.querySelector('.tab.active')?.dataset.view==='resultados') setTimeout(inject,80);
})();