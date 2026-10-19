/* Pesquisas presidenciais 2026 • segundo turno
 * SÉRIE DE INTENÇÃO DE VOTO, não apuração do TSE.
 * Fontes jornalísticas datadas; o registro informado aguarda conferência no PesqEle.
 * Nunca somar ou fazer média simples de estudos com métodos distintos.
 */
(() => {
  'use strict';
  const entries = [
  {
    "id": "2026-10-19-atlas",
    "instituto": "AtlasIntel/Bloomberg",
    "divulgacao": "2026-10-19",
    "coletaInicio": "2026-10-13",
    "coletaFim": "2026-10-18",
    "amostra": 4998,
    "margemErroPp": 1,
    "confianca": 95,
    "metodo": "Recrutamento digital",
    "registroInformado": "BR-02418/2026",
    "registroConferidoNoPesqEle": false,
    "flavio": 51.1,
    "lula": 48.9,
    "fonteTitulo": "CNN Brasil, 19/10/2026",
    "fonteUrl": "https://www.cnnbrasil.com.br/eleicoes/atlas-flavio-tem-511-dos-votos-validos-no-2o-turno-lula-489/"
  },
  {
    "id": "2026-10-19-poderdata",
    "instituto": "PoderData/AYA",
    "divulgacao": "2026-10-19",
    "coletaInicio": "2026-10-16",
    "coletaFim": "2026-10-18",
    "amostra": 3000,
    "margemErroPp": 1.8,
    "confianca": 95,
    "metodo": "Entrevistas por telefone",
    "registroInformado": "BR-02586/2026",
    "registroConferidoNoPesqEle": false,
    "flavio": 52,
    "lula": 48,
    "fonteTitulo": "CNN Brasil, 19/10/2026",
    "fonteUrl": "https://www.cnnbrasil.com.br/eleicoes/poderdata-aya-flavio-tem-52-dos-votos-validos-no-2o-turno-lula-48/"
  },
  {
    "id": "2026-10-19-nexus",
    "instituto": "Nexus/BTG Pactual",
    "divulgacao": "2026-10-19",
    "coletaInicio": "2026-10-16",
    "coletaFim": "2026-10-18",
    "amostra": 2002,
    "margemErroPp": 2,
    "confianca": 95,
    "metodo": "Entrevistas por telefone",
    "registroInformado": "BR-04499/2026",
    "registroConferidoNoPesqEle": false,
    "flavio": 50.3,
    "lula": 49.7,
    "fonteTitulo": "CNN Brasil, 19/10/2026",
    "fonteUrl": "https://www.cnnbrasil.com.br/eleicoes/nexus-btg-flavio-tem-503-dos-votos-validos-no-2o-turno-lula-497/"
  },
  {
    "id": "2026-10-17-verita",
    "instituto": "Instituto Veritá",
    "divulgacao": "2026-10-17",
    "coletaInicio": "2026-10-12",
    "coletaFim": "2026-10-16",
    "amostra": 15554,
    "margemErroPp": 1,
    "confianca": 95,
    "metodo": "Entrevistas automatizadas com reconhecimento de voz",
    "registroInformado": "BR-01107/2026",
    "registroConferidoNoPesqEle": false,
    "flavio": 51.1,
    "lula": 48.9,
    "fonteTitulo": "Exame, 17/10/2026",
    "fonteUrl": "https://exame.com/brasil/pesquisa-que-mais-acertou-no-1o-turno-mostra-flavio-bolsonaro-com-511-e-lula-489-no-2o/"
  }
];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const decimal = value => Number(value).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const number = value => new Intl.NumberFormat('pt-BR').format(value);
  const date = iso => iso.split('-').reverse().join('/');
  function face(name,numero,partido) {
    const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(a=>a[0]).join('');
    return '<div class="s2-face '+window.PresidentialColors.classFor(name,numero,1)+'">'+
      '<div class="candidate-photo photo-sm" data-candidate-photo data-name="'+esc(name)+
      '" data-number="'+esc(numero)+'" data-cargo="1" data-uf="BR" data-photo-alt="Retrato de '+esc(name)+'"><span>'+esc(initials)+'</span></div>'+
      '<div><strong>'+esc(name)+'</strong><small>'+esc(partido)+' · '+esc(numero)+'</small></div></div>';
  }
  function result(name,val,numero) {
    return '<div class="s2-result '+window.PresidentialColors.classFor(name,numero,1)+'"><span>'+esc(name)+'</span><strong>'+decimal(val)+'%</strong>'+
      '<div class="s2-progress" aria-hidden="true"><i style="width:'+Math.max(0,Math.min(100,val))+'%"></i></div></div>';
  }
  function surveyRow(s) {
    return '<article class="s2-survey" data-survey-id="'+esc(s.id)+'">'+
      '<div class="s2-meta"><strong>'+esc(s.instituto)+'</strong><span>Divulgação: '+date(s.divulgacao)+'</span>'+
      '<span>Entrevistas: '+date(s.coletaInicio)+' a '+date(s.coletaFim)+'</span>'+
      '<span>Amostra: '+number(s.amostra)+' · margem: ±'+decimal(s.margemErroPp)+' p.p. · confiança: '+s.confianca+'%</span></div>'+
      '<div class="s2-values">'+result('Flávio Bolsonaro (PL)',s.flavio,'22')+result('Lula (PT)',s.lula,'13')+'</div>'+
      '<div class="s2-source"><span>'+esc(s.metodo)+'</span><small>Registro informado: '+esc(s.registroInformado)+'</small>'+
      '<a href="'+esc(s.fonteUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(s.fonteTitulo)+' ↗</a></div>'+
      '</article>';
  }
  function build(full) {
    const list=full?entries:entries.filter(s=>s.divulgacao==='2026-10-19');
    return '<section class="card s2-board" aria-label="Pesquisas presidenciais de segundo turno">'+
      '<div class="s2-title"><div><p class="s2-eyebrow">PESQUISAS DE INTENÇÃO DE VOTO · 2º TURNO · BRASIL</p>'+
      '<h3>'+(full?'Histórico de pesquisas por instituto':'Pesquisas publicadas em 19/10/2026')+'</h3>'+
      '<p>Percentuais de votos válidos. Os levantamentos são independentes e não representam votos apurados.</p></div>'+
      '<span class="s2-count">'+list.length+' levantamentos</span></div>'+
      '<div class="s2-portraits">'+face('Flávio Bolsonaro','22','PL')+face('Lula','13','PT')+'</div>'+
      '<div class="s2-rows">'+list.map(surveyRow).join('')+'</div>'+
      '<p class="s2-disclaimer"><strong>Leitura responsável:</strong> pesquisas coletadas em dias distintos, por métodos diferentes; não somar, agregar nem comparar variações como se fossem amostras iguais. Os registros foram informados pelas publicações jornalísticas, sem conferência direta individual no PesqEle. A apuração oficial tem seção própria.</p>'+
      (!full?'<p class="s2-archive-label">Arquivo anterior: Veritá, 17/10/2026, preservado na aba Presidência.</p>':'')+
      '</section>';
  }
  window.SecondRoundPolls={entries,compact:()=>build(false),full:()=>build(true)};
})();