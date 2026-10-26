/* Observatório Eleitoral Municipal 2028: fatos verificáveis, sem projeções fabricadas. */
(() => {
  'use strict';

  const db = window.Municipal2028Data;
  if (!db) throw new Error('Dados municipais não carregados.');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));

  const fmt = number => Number(number).toLocaleString('pt-BR');
  const datePT = iso => new Intl.DateTimeFormat('pt-BR', {
    day:'2-digit', month:'long', year:'numeric', timeZone:'UTC'
  }).format(new Date(iso + 'T12:00:00Z'));

  function validateHistoricalEntry(row) {
    if (!row || typeof row !== 'object') return false;
    if (![2020, 2024].includes(row.year)) return false;
    if (!['prefeito','vereador'].includes(row.office)) return false;
    if (row.round !== 1 && row.round !== 2) return false;
    if (row.office === 'vereador' && row.round !== 1) return false;
    if (!db.municipalities.some(m => m.ibge === row.ibge)) return false;
    if (typeof row.candidate !== 'string' || !row.candidate.trim()) return false;
    if (typeof row.party !== 'string' || !row.party.trim()) return false;
    if (!Number.isSafeInteger(row.votes) || row.votes < 0) return false;
    if (typeof row.sourceUrl !== 'string') return false;
    try {
      const u = new URL(row.sourceUrl);
      if (u.protocol !== 'https:') return false;
      return u.hostname === 'tse.jus.br' ||
        u.hostname.endsWith('.tse.jus.br') ||
        u.hostname === 'tre-mg.jus.br' ||
        u.hostname.endsWith('.tre-mg.jus.br');
    } catch { return false; }
  }

  function availableResults(ibge, year, office) {
    return db.historicalResults.filter(row =>
      row.ibge === ibge && row.year === year &&
      (!office || row.office === office) && validateHistoricalEntry(row)
    );
  }

  function sourceLink(url, label) {
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a>';
  }

  function notice(title, message) {
    return '<div class="empty-state"><strong>' + esc(title) +
      '</strong><p>' + esc(message) + '</p></div>';
  }

  function cityLabel(city) {
    return city.name + ' · ' + city.uf;
  }

  function overview(city) {
    return '<div class="section-header"><p>VISÃO GERAL / ELEIÇÕES MUNICIPAIS</p><h2>' +
      esc(cityLabel(city)) + '</h2><span>Comparação entre ciclos municipais; informações de 2028 serão incorporadas quando forem oficialmente disponibilizadas.</span></div>' +
      '<div class="dashboard-grid">' +
      '<article class="info-card"><span class="eyebrow">EXECUTIVO MUNICIPAL</span><h3>Prefeito e vice-prefeito</h3><p>Eleição majoritária. A possibilidade de segundo turno depende do eleitorado e do resultado do primeiro turno.</p></article>' +
      '<article class="info-card"><span class="eyebrow">LEGISLATIVO MUNICIPAL</span><h3>Vereadores</h3><p>Eleição proporcional: a distribuição das cadeiras considera a votação dos partidos e federações, além das regras legais.</p></article>' +
      '<article class="info-card"><span class="eyebrow">SÉRIE HISTÓRICA</span><h3>2020 → 2024 → 2028</h3><p>Importação prevista de votos oficiais por candidato, partido, município e zona, sem misturar pesquisas com resultados.</p></article>' +
      '</div><div class="data-status"><h3>Situação das bases eleitorais</h3><div class="status-rows">' +
      '<span><b>2020</b><small>Aguardando importação oficial do TSE</small></span>' +
      '<span><b>2024</b><small>Aguardando importação oficial do TSE</small></span>' +
      '<span><b>2028</b><small>Eleição futura: não existem resultados apurados</small></span></div></div>';
  }

  function historical(city) {
    return '<div class="section-header"><p>2004–2024 / ARQUIVOS OFICIAIS DO TSE</p><h2>Histórico de ' +
      esc(city.name) + '</h2><span>Todos os candidatos a prefeito e vereador nas seis eleições municipais mais recentes, com suas votações, situações oficiais e padrões descritivos.</span></div>' +
      '<div id="historySixMount" aria-live="polite"><p role="status">Carregando os dados oficiais…</p></div>';
  }

  function office(city, kind) {
    const prefeito = kind === 'prefeito';
    const title = prefeito ? 'Prefeitura' : 'Câmara Municipal';
    return '<div class="section-header"><p>ELEIÇÕES 2028 / ' +
      (prefeito ? 'MAJORITÁRIA' : 'PROPORCIONAL') + '</p><h2>' + title + ' de ' +
      esc(city.name) + '</h2><span>' + (prefeito ?
        'Acompanhar registros de candidatura, chapas e votos oficiais.' :
        'Acompanhar candidaturas, partidos/federações, votos e distribuição oficial de cadeiras.') +
      '</span></div>' + notice('Candidaturas de 2028 ainda não cadastradas',
        'O painel não presume filiações, pré-candidaturas, chapas, votos ou resultados. Os registros oficiais serão incorporados quando disponíveis.') +
      '<div class="info-card"><h3>Critério de apuração</h3><p>' +
      (prefeito ?
        'Vence a candidatura com a maioria dos votos válidos, conforme o regime majoritário aplicável ao município.' :
        'O voto nominal não basta para determinar as vagas: também importam os votos de legenda, os quocientes, a distribuição das sobras e as decisões da Justiça Eleitoral.') +
      '</p></div>';
  }

  function sources(city) {
    return '<div class="section-header"><p>TRANSPARÊNCIA / FONTES</p><h2>Origem e qualidade dos dados</h2><span>Separação obrigatória entre informação histórica, registro eleitoral, pesquisa e resultado.</span></div>' +
      '<div class="source-grid">' +
      '<article class="info-card"><h3>Resultados 2020 e 2024</h3><p>Votação histórica, por município, candidatura e zona.</p>' +
      sourceLink(db.sources.tseResults,'Resultados do TSE') + '</article>' +
      '<article class="info-card"><h3>Dados abertos 2024</h3><p>Arquivos CSV oficiais para importar os dados históricos.</p>' +
      sourceLink(db.sources.tseOpenData,'Dados Abertos do TSE') + '</article>' +
      '<article class="info-card"><h3>Regras e calendário</h3><p>Consultar a publicação das resoluções e prazos aplicáveis a 2028.</p>' +
      sourceLink(db.sources.tseCalendar,'Calendário eleitoral') + '</article>' +
      '<article class="info-card"><h3>Cadastro territorial</h3><p>Código IBGE ' + esc(city.ibge) + ', referência para cruzamento de bases.</p>' +
      sourceLink(city.ibgeUrl,'IBGE: '+city.name) + '</article></div>' +
      '<p class="footnote">Este observatório é independente, sem vínculo com candidaturas, partidos, institutos, campanhas ou com a Justiça Eleitoral. Não apresenta resultados de 2028 antes da divulgação oficial.</p>';
  }

  const sections = {
    'visao-geral': overview,
    'historico': historical,
    'prefeito': city => office(city, 'prefeito'),
    'vereadores': city => office(city, 'vereadores'),
    'fontes': sources
  };

  function renderPage(ibge, section) {
    const city = db.municipalities.find(m => m.ibge === ibge);
    if (!city) throw new Error('Município não cadastrado.');
    if (!Object.hasOwn(sections, section)) throw new Error('Seção inexistente.');
    return sections[section](city);
  }

  function mount() {
    const root = document.getElementById('municipal2028App');
    if (!root) return;
    const picker = document.getElementById('municipalityPicker');
    const viewport = document.getElementById('municipal2028View');
    if (!picker || !viewport) return;
    picker.innerHTML = db.municipalities.map(city =>
      '<option value="' + esc(city.ibge) + '">' + esc(cityLabel(city)) + '</option>'
    ).join('');
    const query = new URLSearchParams(location.search);
    const initial = query.get('municipio');
    if (db.municipalities.some(m => m.ibge === initial)) picker.value = initial;
    let section = 'visao-geral';

    function repaint() {
      const city = db.municipalities.find(m => m.ibge === picker.value);
      viewport.innerHTML = renderPage(city.ibge, section);
      if (section === 'historico') window.MunicipalHistorySix?.mount(viewport.querySelector('#historySixMount'), city.ibge);
      document.getElementById('selectedMunicipality').textContent = cityLabel(city);
      document.querySelectorAll('[data-section]').forEach(btn => {
        const selected = btn.dataset.section === section;
        btn.classList.toggle('selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
      });
    }

    picker.addEventListener('change', repaint);
    document.querySelectorAll('[data-section]').forEach(btn =>
      btn.addEventListener('click', () => { section = btn.dataset.section; repaint(); })
    );
    const date = document.getElementById('firstRoundDate');
    if (date) date.textContent = datePT(db.election.firstRound);
    const second = document.getElementById('secondRoundDate');
    if (second) second.textContent = datePT(db.election.secondRound);
    repaint();
  }

  window.Municipal2028 = Object.freeze({
    validateHistoricalEntry, availableResults, renderPage, datePT
  });
  if (typeof document !== 'undefined') mount();
})();