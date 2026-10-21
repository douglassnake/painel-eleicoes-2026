/* Série cronológica por instituto, sem médias, interpolação ou previsão.
 * Duas métricas independentes: votos totais / votos válidos publicados.
 */
(() => {
  'use strict';
  const institutes=['Veritá','PoderData/AYA','GERP','Datafolha','Real Time Big Data','Alfa Inteligência','Meio/Ideia','Palver'];
  const colors={flavio:'#35d47d',lula:'#ff6269'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel=iso=>iso.split('-').reverse().join('/');
  const fmt=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
  const source=()=>window.PresidentialPollEvolution;

  function buildChart(inst,rows,mode){
    const W=720,H=260,offsetX=52,offsetY=27,plotWidth=626,plotHeight=182;
    const ymin=40,ymax=56,low=Date.parse(mode==='totais'?'2026-08-20T12:00:00Z':'2026-10-01T12:00:00Z');
    const high=Date.parse('2026-10-21T12:00:00Z');
    const ticks=mode==='totais'
      ?[['2026-08-20','20/08'],['2026-09-01','01/09'],['2026-09-15','15/09'],['2026-10-01','01/10'],['2026-10-21','21/10']]
      :[['2026-10-01','01/10'],['2026-10-07','07/10'],['2026-10-13','13/10'],['2026-10-21','21/10']];
    const x=date=>offsetX+(Date.parse(date+'T12:00:00Z')-low)/(high-low)*plotWidth;
    const y=val=>offsetY+plotHeight-(val-ymin)/(ymax-ymin)*plotHeight;
    const axis=[40,44,48,52,56].map(value=>
      '<g><line x1="'+offsetX+'" y1="'+y(value)+'" x2="'+(offsetX+plotWidth)+'" y2="'+y(value)+
      '" class="evo-grid-line"/><text x="'+(offsetX-10)+'" y="'+(y(value)+4)+
      '" text-anchor="end" class="evo-axis-text">'+value+'%</text></g>').join('');
    const xticks=ticks.map(([date,label])=>
      '<g><line x1="'+x(date)+'" y1="'+(offsetY+plotHeight)+'" x2="'+x(date)+'" y2="'+(offsetY+plotHeight+4)+'" class="evo-tick"/>'+
      '<text x="'+x(date)+'" y="'+(H-22)+'" text-anchor="middle" class="evo-axis-text">'+label+'</text></g>').join('');
    const lines=['flavio','lula'].map(candidate=>{
      const stroke=colors[candidate];
      const pts=rows.map(r=>[x(r.data),y(r[candidate])]);
      const path=pts.length>1?'<path d="'+pts.map(([px,py],i)=>(i?'L':'M')+px.toFixed(1)+' '+py.toFixed(1)).join(' ')+
        '" fill="none" stroke="'+stroke+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>':'';
      const dots=rows.map((r,index)=>
        '<circle cx="'+pts[index][0].toFixed(1)+'" cy="'+pts[index][1].toFixed(1)+'" r="5" fill="'+stroke+
        '" stroke="#0a1325" stroke-width="2"><title>'+esc(inst)+' · '+dateLabel(r.data)+' · '+
        (candidate==='flavio'?'Flávio Bolsonaro':'Lula')+': '+fmt(r[candidate])+'</title></circle>').join('');
      return '<g>'+path+dots+'</g>';
    }).join('');
    return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(inst)+', evolução dos percentuais de intenção de voto ('+
      (mode==='totais'?'votos totais':'votos válidos')+'). Flávio em verde, Lula em vermelho.">'+axis+xticks+lines+'</svg>';
  }

  function chartCard(inst,rows,mode){
    const sorted=[...rows].sort((a,b)=>a.data.localeCompare(b.data));
    const latest=sorted[sorted.length-1];
    const last=latest
      ?'<div class="evo-latest"><span>Último ponto · '+dateLabel(latest.data)+'</span><strong class="candidate-flavio">Flávio '+fmt(latest.flavio)+'</strong><strong class="candidate-lula">Lula '+fmt(latest.lula)+'</strong></div>'
      :'<span class="evo-empty">Sem dados verificados nesta modalidade.</span>';
    return '<article class="evo-institute-card"><div class="evo-card-head"><div><h4>'+esc(inst)+'</h4><small>'+
      sorted.length+' levantamento'+(sorted.length===1?'':'s')+' nesta base</small></div>'+last+'</div>'+
      (sorted.length?'<div class="evo-chart-scroller">'+buildChart(inst,sorted,mode)+'</div>':
       '<p class="evo-none">Nenhum percentual publicado nessa base foi identificado para o período selecionado.</p>')+
      (sorted.length===1?'<p class="evo-plot-caveat">Apenas um levantamento: o ponto não representa uma tendência temporal.</p>':'')+
      '</article>';
  }

  function shell(){
    const d=source();
    return '<section class="card presidential-evolution" aria-labelledby="pollEvolutionTitle">'+
      '<div class="evo-heading"><div><span class="sim-eyebrow">20 AGO – 21 OUT 2026 / PESQUISAS DE SEGUNDO TURNO</span>'+
      '<h3 id="pollEvolutionTitle">Evolução das pesquisas por instituto</h3>'+
      '<p>Veritá, PoderData/AYA, GERP e Datafolha. Cada ponto é um levantamento divulgado, com data e fonte identificadas. Sem médias entre institutos.</p></div>'+
      '<span class="evo-stamp">HISTÓRICO · 2 MESES</span></div>'+
      '<div class="evo-controls"><label for="evoMetric">Comparar base de percentuais<select id="evoMetric">'+
      '<option value="totais">Votos totais · agosto a outubro</option>'+
      '<option value="validos">Votos válidos publicados · outubro</option></select></label>'+
      '<fieldset class="evo-filter-set"><legend>Mostrar institutos</legend>'+
      institutes.map(x=>'<label><input type="checkbox" data-evo-inst="'+esc(x)+'" checked><span>'+esc(x)+'</span></label>').join('')+
      '</fieldset></div>'+
      '<div class="evo-legend"><span><i class="evo-green"></i>Flávio Bolsonaro (PL)</span>'+
      '<span><i class="evo-red"></i>Lula (PT)</span></div>'+
      '<div id="evoSummary" class="evo-summary" aria-live="polite"></div>'+
      '<div id="evoGraphs" class="evo-graphs"></div>'+
      '<details class="evo-details"><summary>Consultar todos os levantamentos utilizados, datas e fontes</summary>'+
      '<div class="evo-table-scroller"><table><thead><tr><th>Divulgação</th><th>Instituto</th>'+
      '<th>Flávio</th><th>Lula</th><th>Margem</th><th>Origem</th></tr></thead><tbody id="evoTableBody"></tbody></table></div></details>'+
      '<div class="evo-method"><strong>Como interpretar:</strong> o gráfico de <em>votos totais</em> inclui brancos, nulos e indecisos no denominador; '+
      'o de <em>votos válidos</em> apresenta exclusivamente percentuais que os veículos identificaram como votos válidos. '+
      'Essas bases não são misturadas. O desenho liga somente coletas sucessivas de um mesmo instituto: não há pesquisas diárias, '+
      'interpolação estatística ou média agregada. As datas referem-se à divulgação, não necessariamente à coleta. '+
      'Margens de erro não estão representadas graficamente e as diferenças podem estar dentro delas. '+
      'Isso é histórico de pesquisas, não apuração nem previsão do resultado. '+
      esc(d.metadata.fonteStatus)+'</div></section>';
  }

  function mount(root){
    const d=source();
    if(!root||!d)return;
    root.innerHTML=shell();
    const selected=new Set(institutes);
    const select=root.querySelector('#evoMetric');
    const container=root.querySelector('#evoGraphs');
    const table=root.querySelector('#evoTableBody');
    const summary=root.querySelector('#evoSummary');
    function update(){
      const base=select.value;
      const rec=d.records.filter(p=>p.base===base && selected.has(p.instituto))
        .sort((a,b)=>a.data.localeCompare(b.data)||a.instituto.localeCompare(b.instituto));
      summary.textContent=rec.length+' levantamentos, '+selected.size+' instituto(s) selecionado(s) · '+
        (base==='totais'?'percentuais de votos totais':'percentuais de votos válidos publicados')+'.';
      container.innerHTML=selected.size
        ?institutes.filter(inst=>selected.has(inst))
          .map(inst=>chartCard(inst,rec.filter(p=>p.instituto===inst),base)).join('')
        :'<p class="evo-none">Selecione ao menos um instituto para visualizar o gráfico.</p>';
      table.innerHTML=rec.length?rec.map(p=>
        '<tr><td>'+dateLabel(p.data)+'</td><th scope="row">'+esc(p.instituto)+'</th>'+
        '<td class="candidate-flavio">'+fmt(p.flavio)+'</td>'+
        '<td class="candidate-lula">'+fmt(p.lula)+'</td>'+
        '<td>'+('±'+Number(p.margemErroPp).toLocaleString('pt-BR')+' p.p.')+'</td>'+
        '<td><a href="'+esc(p.fonteUrl)+'" target="_blank" rel="noopener noreferrer">Fonte ↗</a></td></tr>'
      ).join(''):'<tr><td colspan="6">Nenhum estudo para a seleção atual.</td></tr>';
    }
    select.addEventListener('change',update);
    root.querySelectorAll('[data-evo-inst]').forEach(input=>input.addEventListener('change',()=>{
      if(input.checked)selected.add(input.dataset.evoInst);
      else selected.delete(input.dataset.evoInst);
      update();
    }));
    update();
  }
  window.PresidentialEvolutionUI={mount};
})();