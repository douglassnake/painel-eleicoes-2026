/* Mercado preditivo do pleito presidencial brasileiro (Polymarket).
 * Probabilidades IMPLÍCITAS EM PREÇOS DE CONTRATOS, não votos, pesquisas, apuração ou estimativas MC-2T.
 * Leitura pública apenas — sem negociação, carteira, chaves ou endpoints de escrita.
 * Fonte primária: https://gamma-api.polymarket.com/events/slug/brazil-presidential-election
 */
(() => {
  'use strict';
  const API='https://gamma-api.polymarket.com/events/slug/brazil-presidential-election';
  const EVENT='https://polymarket.com/event/brazil-presidential-election';
  const CACHE_MS=5*60*1000;
  const REFRESH_MS=10*60*1000;
  let memo=null, memoAt=0, pending=null;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalized=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const percent=n=>(n*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
  function unpack(value) {
    if(Array.isArray(value))return value;
    if(typeof value==='string'){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return []}}
    return [];
  }
  function yes(market) {
    const labels=unpack(market.outcomes), prices=unpack(market.outcomePrices);
    if(labels.length!==prices.length || !labels.length) return null;
    const index=labels.findIndex(label=>normalized(label)==='yes'||normalized(label)==='sim');
    if(index<0)return null;
    const value=Number(prices[index]);
    return Number.isFinite(value)&&value>=0&&value<=1?value:null;
  }
  function extract(payload) {
    const event=Array.isArray(payload)?payload[0]:payload;
    if(!event||event.slug!=='brazil-presidential-election'||!Array.isArray(event.markets))
      throw Error('Evento eleitoral esperado não localizado na resposta.');
    if(event.closed===true)throw Error('O mercado está encerrado; consulte os resultados oficiais do TSE.');
    const candidates=[
      {id:'flavio',name:'Flávio Bolsonaro',party:'PL',cls:'candidate-flavio'},
      {id:'lula',name:'Lula',party:'PT',cls:'candidate-lula'}
    ];
    const entries=candidates.map(candidate=>{
      const found=event.markets
        .filter(m=>{
          const label=normalized([m.groupItemTitle,m.question,m.slug].filter(Boolean).join(' '));
          return candidate.id==='flavio'
            ?/flavio\s+bolsonaro/.test(label)
            :/(?:luiz\s+inacio\s+lula|(?:^|\W)lula(?:\W|$))/.test(label);
        })
        .map(m=>({...candidate,price:yes(m),sourceMarket:m}))
        .filter(m=>m.price!==null && m.sourceMarket.closed!==true)
        .sort((a,b)=>{
          const score=m=>normalized(m.sourceMarket.groupItemTitle||'').includes(m.id==='flavio'?'flavio bolsonaro':'lula')?1:0;
          return score(b)-score(a);
        });
      if(!found.length)throw Error('Preço de contrato eleitoral não identificado: '+candidate.name);
      return {id:candidate.id,name:candidate.name,party:candidate.party,cls:candidate.cls,price:found[0].price};
    });
    return {entries,volume: Number(event.volume)||null, updatedAt:event.updatedAt||null, slug:event.slug, url:EVENT};
  }
  async function getData(force=false) {
    if(!force && memo && Date.now()-memoAt<CACHE_MS)return memo;
    if(pending)return pending;
    pending=(async()=>{
      const ctl=new AbortController();
      const timeout=setTimeout(()=>ctl.abort(),11000);
      try{
        const response=await fetch(API,{mode:'cors',cache:'no-store',signal:ctl.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw Error('API Polymarket: HTTP '+response.status);
        const data=extract(await response.json());
        memo=data;memoAt=Date.now();
        return data;
      }finally{clearTimeout(timeout);}
    })();
    try{return await pending}finally{pending=null}
  }
  function template() {
    return '<section class="card poly-election" aria-label="Indicador de mercado preditivo da Polymarket">'+
      '<div class="poly-heading"><div><span class="poly-kicker">MERCADO PREDITIVO / ELEIÇÃO PRESIDENCIAL 2026</span>'+
      '<h3>Polymarket · preços de vitória</h3>'+
      '<p>Preços de contratos negociados no mercado. <strong>Não são intenção de voto, dados do TSE nem resultado do simulador.</strong></p></div>'+
      '<span class="poly-label">MERCADO · FONTE EXTERNA</span></div>'+
      '<div class="poly-message" data-poly-status role="status" aria-live="polite">Consultando diretamente os preços da Polymarket…</div>'+
      '<div data-poly-entries></div>'+
      '<div class="poly-footer"><span data-poly-updated></span>'+
      '<button type="button" data-poly-refresh>Atualizar cotação</button>'+
      '<a href="'+EVENT+'" target="_blank" rel="noopener noreferrer">Abrir fonte na Polymarket ↗</a></div>'+
      '<p class="poly-disclaimer">Probabilidade implícita aproximada derivada dos preços de contratos “Sim”. As cotações podem oscilar, refletir spreads e liquidez e não precisam somar exatamente 100%. Acesso somente informativo; não há recomendação ou mecanismo de aposta.</p>'+
      '</section>';
  }
  function mount(holder) {
    if(!holder)return;
    holder.innerHTML=template();
    let live=true;
    const status=holder.querySelector('[data-poly-status]');
    const area=holder.querySelector('[data-poly-entries]');
    const updated=holder.querySelector('[data-poly-updated]');
    const button=holder.querySelector('[data-poly-refresh]');
    let seq=0;
    async function refresh(force=false) {
      const current=++seq;
      button.disabled=true;
      status.textContent='Consultando mercado diretamente…';
      try{
        const data=await getData(force);
        if(!live||!holder.isConnected||seq!==current)return;
        area.innerHTML='<div class="poly-prices">'+data.entries.map(c=>
          '<div class="poly-candidate '+c.cls+'"><div class="poly-candidate-label"><strong>'+safe(c.name)+'</strong>'+
          '<small>'+safe(c.party)+' · preço implícito de vitória</small></div><div class="poly-value">'+percent(c.price)+'</div>'+
          '<div class="poly-track" aria-hidden="true"><i style="width:'+Math.max(0,Math.min(100,c.price*100))+'%"></i></div></div>'
        ).join('')+'</div>';
        status.textContent='Mercado consultado · não é pesquisa eleitoral';
        const now=new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'});
        updated.textContent='Consulta recebida em '+now+' (Brasília)';
      }catch(e){
        if(!live||!holder.isConnected||seq!==current)return;
        area.replaceChildren();
        updated.textContent='Sem cotação verificada nesta consulta';
        status.textContent='Cotação indisponível: '+(e.name==='AbortError'?'tempo limite da consulta.':String(e.message||'falha de acesso.'))+
          ' Consulte o mercado na fonte. Nenhum preço anterior foi apresentado como atual.';
      }finally{if(live&&holder.isConnected&&seq===current)button.disabled=false;}
    }
    button.addEventListener('click',()=>refresh(true));
    refresh();
    // Não duplicar consulta frequente quando o módulo não estiver mais na página.
    const timer=setInterval(()=>{
      if(!holder.isConnected){clearInterval(timer);live=false;return;}
      if(document.visibilityState==='hidden')return;
      refresh(true);
    },REFRESH_MS);
  }
  window.PolymarketElection={mount,extract,api:API,url:EVENT};
})();