/* Interface de intenção de voto. Não consulta/edita a totalização oficial do TSE. */
(() => {
  'use strict';
  const data=()=>window.DASH_DATA?.presidenciaSegundoTurno;
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const count=n=>new Intl.NumberFormat('pt-BR').format(n);
  function photo(c) {
    const initials=c.nome.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('');
    return `<div class="candidate-photo photo-md" data-candidate-photo data-name="${safe(c.nome)}" data-number="${safe(c.numero)}" data-cargo="1" data-uf="BR" data-photo-alt="Foto oficial de candidatura de ${safe(c.nome)}"><span>${safe(initials)}</span></div>`;
  }
  function card(){
    const p=data();
    if(!p || !Array.isArray(p.candidatos))return '';
    return `<article class="card verita-card" aria-label="Pesquisa Veritá para presidente no segundo turno">
      <div class="card-title-row"><div><p class="verita-kicker">PESQUISA DE INTENÇÃO DE VOTO · 2º TURNO · BRASIL</p><h3>Pesquisa Veritá — 17/10/2026</h3><p class="muted">Percentuais de votos válidos. Entrevistas entre 12 e 16 de outubro.</p></div></div>
      <div class="verita-candidates">${p.candidatos.map(c=>`<div class="verita-person">${photo(c)}<div class="verita-info"><strong>${safe(c.nome)}</strong><small>${safe(c.partido)} · ${safe(c.numero)}</small><div class="verita-track" role="img" aria-label="${safe(c.nome)}: ${pct(c.poll)} por cento dos votos válidos na pesquisa"><i style="width:${Math.max(0,Math.min(100,Number(c.poll)))}%"></i></div></div><b class="verita-percent">${pct(c.poll)}%</b></div>`).join('')}</div>
      <div class="verita-facts"><span><strong>${count(p.amostra)}</strong> entrevistas</span><span><strong>±${pct(p.margemErro)} p.p.</strong> margem informada</span><span><strong>${p.confianca}%</strong> confiança</span><span><strong>${safe(p.registroInformado)}</strong> registro informado</span></div>
      <p class="verita-warning"><strong>Pesquisa eleitoral, não resultado oficial do TSE.</strong> Os percentuais descrevem a intenção de voto no período da coleta e não representam previsão de vitória. Registro TSE citado pela reportagem, ainda não confirmado diretamente na fonte primária.</p>
      <p class="source-line">Fonte consultada: <a href="${safe(p.fonteUrl)}" target="_blank" rel="noopener noreferrer">${safe(p.fonte)} ↗</a> · ${safe(p.metodo)}.</p>
      <p class="verita-photo-credit">Fotos dos candidatos: ${p.candidatos.map(c=>`<a href="${safe(c.fotoFonte||'#')}" target="_blank" rel="noopener noreferrer">${safe(c.nome)} — ${safe(c.fotoAutor||'Fonte não informada')} (${safe(c.fotoLicenca||'licença não informada')})</a>`).join(' · ')}. Exibidas com recorte automático, sem alterações no conteúdo da fotografia.</p>
    </article>`;
  }
  function render(target){
    const p=data();
    if(!target || !p)return;
    const prior=(window.DASH_DATA?.presidente||[]).filter(x=>x.poll!=null);
    target.innerHTML=`<div class="section-title"><div><h2>Presidência da República · 2º turno</h2><p>Levantamentos nacionais divulgados em 17 e 19 de outubro de 2026, organizados por instituto e metodologia.</p></div><span class="model-pill">SONDAGEM · NÃO APURAÇÃO</span></div>
      ${window.SecondRoundPolls?.full()||card()}
      <details class="verita-archive"><summary>Ver o detalhamento do Instituto Veritá — 17/10/2026</summary>${card()}</details>
      <details class="verita-archive"><summary>Ver pesquisa anterior do primeiro turno (setembro de 2026)</summary>
        <div class="card"><p class="muted">Dados históricos da pesquisa de 1º turno. Não representam o segundo turno nem o resultado oficial da eleição.</p>
        <div class="poll">${prior.map(x=>`<div class="poll-line"><div class="poll-name"><strong>${safe(x.nome)}</strong><small>${safe(x.partido)} · ${safe(x.numero)}</small></div><div class="poll-track"><div class="poll-fill" style="width:${Number(x.poll)}%"></div></div><div class="poll-value">${Number(x.poll)}%</div></div>`).join('')}</div>
        <p class="source-line">${safe(window.DASH_DATA?.pollSources?.presidente)}</p></div>
      </details>`;
    window.CandidatePhotos?.hydrate(target);
  }
  function mountSpotlight(){
    const mount=document.getElementById('presidentialSpotlightCard');
    if(!mount)return;
    mount.innerHTML=window.SecondRoundPolls?.compact() || card() || '<p class="spotlight-placeholder">Pesquisa presidencial indisponível no momento.</p>';
    window.CandidatePhotos?.hydrate(mount);
    document.getElementById('spotlightOpenPresidency')?.addEventListener('click',()=>{
      const tab=document.querySelector('.tab[data-view="presidente"]');
      if(!tab)return;
      tab.click();
      document.getElementById('view')?.scrollIntoView({
        behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
        block:'start'
      });
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',mountSpotlight,{once:true});
  }else{
    mountSpotlight();
  }
  window.PresidentialPoll={card,render,mountSpotlight};
})();
