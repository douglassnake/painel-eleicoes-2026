/* MC-2T v1 • Cenários ilustrativos dos percentuais nas pesquisas presidenciais.
 * NÃO é previsão eleitoral nem probabilidade de vitória.
 * Entradas: somente levantamentos publicados em presidential-surveys.js.
 * Cada pesquisa entra com o mesmo peso. Não combina microdados não disponíveis.
 */
(() => {
  'use strict';
  const VERSION='MC-2T v1.0';
  const SEED=20261019;
  const DEFAULT_DRAWS=200000;
  const DEFAULT_SHOCK95=2;
  function validate(studies) {
    if (!Array.isArray(studies) || !studies.length) throw Error('Selecione ao menos uma pesquisa.');
    const ids=new Set();
    return studies.map(p=>{
      if (!p.id || ids.has(p.id)) throw Error('Pesquisa ausente ou duplicada.');
      ids.add(p.id);
      for(const key of ['flavio','lula','margemErroPp','amostra']){
        if(!Number.isFinite(p[key])) throw Error('Campo inválido: '+key);
      }
      if (p.flavio<0 || p.flavio>100 || p.lula<0 || p.lula>100 ||
          Math.abs(p.flavio+p.lula-100)>0.25 || p.margemErroPp<=0 ||
          p.margemErroPp>15 || p.amostra<100)
        throw Error('Valores incompatíveis com votos válidos ou ficha técnica.');
      return p;
    }).sort((a,b)=>a.id.localeCompare(b.id));
  }
  function generator(seed) {
    let state=seed>>>0;
    const uniform=()=>{
      state^=state<<13;state^=state>>>17;state^=state<<5;
      return ((state>>>0)+0.5)/4294967296;
    };
    let extra=null;
    return function normal(){
      if(extra!==null){const next=extra;extra=null;return next;}
      const r=Math.sqrt(-2*Math.log(uniform()));
      const theta=2*Math.PI*uniform();
      extra=r*Math.sin(theta);
      return r*Math.cos(theta);
    };
  }
  const quantile=(sorted,p)=>{
    const index=p*(sorted.length-1),a=Math.floor(index),t=index-a;
    return sorted[a]+((sorted[Math.min(sorted.length-1,a+1)]-sorted[a])*t);
  };
  function simulate(input,options={}) {
    const polls=validate(input),draws=options.draws??DEFAULT_DRAWS;
    const common95=options.commonShock95??DEFAULT_SHOCK95;
    const seed=options.seed??SEED;
    if(!Number.isInteger(draws)||draws<1000||draws>DEFAULT_DRAWS)
      throw Error('Quantidade de cenários fora da faixa 1.000 a 200.000.');
    if(!Number.isFinite(common95)||common95<0||common95>5)
      throw Error('Choque comum entre 0 e 5 pontos percentuais.');
    const center=polls.reduce((sum,p)=>sum+p.flavio,0)/polls.length;
    const sampleSigma=polls.map(p=>p.margemErroPp/1.96);
    const shockSigma=common95/1.96;
    const normal=generator(seed);
    const values=new Float64Array(draws);
    for(let i=0;i<draws;i++){
      let sum=0;
      for(let j=0;j<polls.length;j++)sum+=polls[j].flavio+normal()*sampleSigma[j];
      // Uma perturbação COMUM (todas as pesquisas) é usada só como
      // teste de sensibilidade hipotético, não erro estimado de dados reais.
      const shift=shockSigma?normal()*shockSigma:0;
      values[i]=Math.min(100,Math.max(0,sum/polls.length+shift));
    }
    values.sort();
    const q05=quantile(values,.05),q50=quantile(values,.5),q95=quantile(values,.95);
    const low=Math.max(0,Math.floor(quantile(values,.005))-0.5);
    const high=Math.min(100,Math.ceil(quantile(values,.995))+0.5);
    const binCount=24,step=(high-low)/binCount || 1;
    const histogram=Array.from({length:binCount},(_,index)=>({
      from:low+index*step,to:low+(index+1)*step,count:0
    }));
    for(let i=0;i<values.length;i++){
      const ix=Math.max(0,Math.min(binCount-1,Math.floor((values[i]-low)/step)));
      histogram[ix].count++;
    }
    return {
      version:VERSION,seed,draws,sourceIds:polls.map(p=>p.id),
      studies:polls.length,commonShock95:common95,
      centerFlavio:center,centerLula:100-center,centerDifference:2*center-100,
      pollMinFlavio:Math.min(...polls.map(p=>p.flavio)),
      pollMaxFlavio:Math.max(...polls.map(p=>p.flavio)),
      band90Flavio:[q05,q95],band90Lula:[100-q95,100-q05],
      medianFlavio:q50,medianLula:100-q50,histogram
    };
  }
  window.PresidentRunoffSimulation=Object.freeze({
    VERSION,SEED,DEFAULT_DRAWS,DEFAULT_SHOCK95,simulate
  });
})();