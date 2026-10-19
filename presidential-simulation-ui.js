/* Interface interativa de sensibilidade estatística MC-2T.
 * Não transforma pesquisa em apuração, прогнозóstico ou chance de vitória.
 */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  const pp=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.';
  const fmt=new Intl.NumberFormat('pt-BR');
  const studies=()=>window.SecondRoundPolls?.entries||[];
  const model=()=>window.PresidentRunoffSimulation;
  function teaser(){
    const rows=studies();
    if(!rows.length)return '';
    const f=rows.reduce((sum,p)=>sum+p.flavio,0)/rows.length;
    return '<section class="card sim-teaser"><div><span class="sim-eyebrow">MC-2T v1 / ANÁLISE ESTATÍSTICA</span>'+
      '<h3>Simulações do segundo turno</h3>'+
      '<p>'+rows.length+' pesquisas · '+fmt.format(200000)+' cenários de sensibilidade reproduzíveis, com margem declarada e choque hipotético ajustável.</p>'+
      '<p><strong>Centro descritivo:</strong> <span class="candidate-flavio">'+pct(f)+' Flávio</span> · <span class="candidate-lula">'+pct(100-f)+' Lula</span>. '+
      'Média simples, sem estimativa de vitória.</p></div>'+
      '<button type="button" class="text-btn" data-go="presidente">Abrir simulador ↗</button></section>';
  }
  function shell(){
    const rows=studies();
    return '<section class="card pres-sim" id="presSimulation" aria-labelledby="presSimTitle">'+
      '<div class="pres-sim-heading"><div><span class="sim-eyebrow">MC-2T v1 · CENÁRIOS ESTATÍSTICOS</span>'+
      '<h3 id="presSimTitle">Simulações do segundo turno</h3>'+
      '<p>Modelo independente do Monte Carlo v3/ITR dos deputados. Interpreta somente a dispersão de pesquisas publicadas, não o resultado futuro da eleição.</p></div>'+
      '<span class="pres-sim-stamp">200.000 CENÁRIOS</span></div>'+
      '<div class="pres-sim-form"><fieldset><legend>Pesquisas consideradas (mesmo peso por estudo)</legend>'+
      '<div class="pres-sim-poll-list">'+rows.map(p=>
        '<label class="pres-sim-poll"><input type="checkbox" data-sim-poll="'+esc(p.id)+'" checked>'+
        '<span>'+esc(p.instituto)+'<small>'+p.divulgacao.split('-').reverse().join('/')+
        ' · '+fmt.format(p.amostra)+' entrevistas · ±'+p.margemErroPp.toLocaleString('pt-BR')+' p.p.</small></span></label>'
      ).join('')+'</div></fieldset>'+
      '<div class="pres-sim-settings"><label for="presSimShock">Choque comum hipotético <strong id="presSimShockValue">±2,0 p.p.</strong></label>'+
      '<input type="range" id="presSimShock" min="0" max="4" step="0.5" value="2" aria-describedby="presSimShockHelp">'+
      '<p id="presSimShockHelp">Sensibilidade adicional com escala de 95%. Não é margem calculada ou erro histórico comprovado.</p>'+
      '<button type="button" id="presSimRun">Recalcular os 200.000 cenários</button></div></div>'+
      '<p id="presSimStatus" class="pres-sim-status" role="status" aria-live="polite">Preparando cálculo…</p>'+
      '<div id="presSimResult"></div>'+
      '<details class="pres-sim-method"><summary>Fórmulas, hipóteses e limitações do modelo</summary>'+
      '<div class="pres-sim-formulas"><p><strong>Centro descritivo:</strong> média aritmética dos percentuais de votos válidos publicados pelos institutos selecionados. O peso de cada pesquisa é 1/n, independentemente da amostra; não equivale a uma pesquisa agregada oficial.</p>'+
      '<p><strong>Dispersão simulada por estudo:</strong> para cada pesquisa i, uma perturbação normal de média zero e desvio padrão igual à margem de erro informada dividida por 1,96. Este procedimento pressupõe normalidade e independência que podem não valer integralmente, sobretudo para levantamentos digitais e telefônicos.</p>'+
      '<p><strong>Choque comum de sensibilidade:</strong> mesma perturbação normal acrescentada à média de cada iteração, com desvio padrão igual ao parâmetro ajustável dividido por 1,96. É uma hipótese de estresse escolhida pelo usuário, não estimativa validada de viés ou mudança de intenção de voto.</p>'+
      '<p><strong>200.000 cenários:</strong> gerador pseudoaleatório determinístico com semente 20261019 e distribuição normal por Box–Muller. Faixas de 90% são quantis 5% e 95% dos cenários gerados, não intervalos preditivos da eleição.</p>'+
      '<p><strong>Limitações:</strong> não estima participação eleitoral, votos futuros, migração de eleitores, indecisos, não resposta, dependência entre institutos, viés sistemático, diferenças metodológicas ou probabilidade de vitória. As fontes jornalísticas citam registros no TSE, ainda sem verificação individual no PesqEle. As simulações não modificam os dados oficiais do TSE.</p></div></details>'+
      '</section>';
  }
  function draw(target,result){
    const max=Math.max(1,...result.histogram.map(b=>b.count));
    const center=result.centerFlavio;
    const graphic=result.histogram.map(b=>
      '<div class="pres-sim-bar" style="height:'+((b.count/max)*100).toFixed(2)+'%" title="'+
      pct(b.from)+'–'+pct(b.to)+': '+fmt.format(b.count)+' cenários"></div>'
    ).join('');
    const commonText=result.commonShock95.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
    target.innerHTML='<div class="pres-sim-metrics">'+
      '<div><span>Pesquisas utilizadas</span><strong>'+result.studies+'</strong><small>Institutos com peso igual</small></div>'+
      '<div class="candidate-flavio"><span>Centro: Flávio Bolsonaro</span><strong>'+pct(center)+'</strong><small>Média simples das pesquisas</small></div>'+
      '<div class="candidate-lula"><span>Centro: Lula</span><strong>'+pct(result.centerLula)+'</strong><small>Complemento dos votos válidos</small></div>'+
      '<div><span>Diferença central (Flávio − Lula)</span><strong>'+pp(result.centerDifference)+'</strong><small>Estatística descritiva, não previsão</small></div></div>'+
      '<div class="pres-sim-intervals">'+
      '<div class="pres-sim-band candidate-flavio"><span>Flávio Bolsonaro · faixa central de 90% dos cenários</span><strong>'+
      pct(result.band90Flavio[0])+' – '+pct(result.band90Flavio[1])+'</strong></div>'+
      '<div class="pres-sim-band candidate-lula"><span>Lula · faixa central de 90% dos cenários</span><strong>'+
      pct(result.band90Lula[0])+' – '+pct(result.band90Lula[1])+'</strong></div></div>'+
      '<div class="pres-sim-chart-wrap"><div class="pres-sim-chart-title"><strong>Distribuição ilustrativa da média das pesquisas — Flávio (%)</strong>'+
      '<small>Histogramas não representam votos apurados nem probabilidades de vitória.</small></div>'+
      '<div class="pres-sim-histogram" role="img" aria-label="Distribuição de '+fmt.format(result.draws)+' cenários simulados, com faixa central de 90% de '+
      pct(result.band90Flavio[0])+' a '+pct(result.band90Flavio[1])+' para a média de intenção de voto de Flávio Bolsonaro">'+
      graphic+'</div><div class="pres-sim-chart-axis"><span>'+pct(result.histogram[0].from)+'</span><span>'+
      pct(center)+' (centro)</span><span>'+pct(result.histogram[result.histogram.length-1].to)+'</span></div></div>'+
      '<p class="pres-sim-disclaimer"><strong>Interpretação:</strong> '+fmt.format(result.draws)+
      ' cenários condicionais, choque hipotético ±'+commonText+' p.p. e semente '+result.seed+
      '. O intervalo de 90% descreve a distribuição artificial do modelo e <strong>não</strong> tem 90% de chance de conter o resultado da eleição.</p>';
  }
  function mount(root){
    if(!root)return;
    const api=model(),list=studies();
    if(!api||!list.length){root.innerHTML='<div class="note">Dados ou simulador indisponíveis.</div>';return;}
    root.innerHTML=shell();
    const status=root.querySelector('#presSimStatus');
    const output=root.querySelector('#presSimResult');
    const button=root.querySelector('#presSimRun');
    const range=root.querySelector('#presSimShock');
    const label=root.querySelector('#presSimShockValue');
    let token=0;
    function start(){
      const chosen=[...root.querySelectorAll('[data-sim-poll]:checked')].map(e=>
        list.find(p=>p.id===e.dataset.simPoll)
      ).filter(Boolean);
      if(!chosen.length){status.textContent='Selecione ao menos uma pesquisa para simular.';output.innerHTML='';return;}
      const thisRun=++token;
      button.disabled=true;
      status.textContent='Recalculando '+fmt.format(api.DEFAULT_DRAWS)+' cenários com '+chosen.length+' estudo(s)…';
      // Aguarda o próximo ciclo de renderização antes do cálculo para manter o UI responsivo.
      setTimeout(()=>{
        if(thisRun!==token)return;
        try{
          const result=api.simulate(chosen,{draws:api.DEFAULT_DRAWS,
            commonShock95:Number(range.value),seed:api.SEED});
          if(thisRun!==token)return;
          draw(output,result);
          status.textContent='Cálculo concluído · '+result.version+
            ' · '+chosen.length+' pesquisa(s) · '+fmt.format(result.draws)+' cenários reproduzíveis.';
        }catch(e){
          if(thisRun===token){output.innerHTML='';status.textContent='Não foi possível simular: '+String(e.message||e);}
        }finally{if(thisRun===token)button.disabled=false;}
      },20);
    }
    range.addEventListener('input',()=>{label.textContent='±'+Number(range.value).toLocaleString('pt-BR',{minimumFractionDigits:1})+' p.p.';});
    range.addEventListener('change',start);
    button.addEventListener('click',start);
    root.querySelectorAll('[data-sim-poll]').forEach(c=>c.addEventListener('change',start));
    start();
  }
  window.PresidentialSimulationUI={mount,teaser};
})();