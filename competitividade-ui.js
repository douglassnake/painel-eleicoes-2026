/* Ranking de competitividade mundial: seção socioeconômica separada do módulo eleitoral. */
(() => {
  'use strict';
  const dataset = () => window.IMD_WCR_2026;
  const brFormat = new Intl.NumberFormat('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const formatIndex = n => brFormat.format(n);
  const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const regionNames = {
    all:'Todas as regiões',
    americas:'Américas',
    asia_pacifico:'Ásia-Pacífico',
    emea:'Europa, Oriente Médio e África'
  };
  function overviewCard() {
    const d = dataset();
    if (!d) return '';
    const brazil = d.economias.find(e => e.nome === 'Brasil');
    if (!brazil) return '';
    return '<article class="card imd-teaser">' +
      '<div class="imd-teaser-heading"><div><span class="imd-eyebrow">CONTEXTO GLOBAL / IMD 2026</span>' +
      '<h3>Competitividade mundial</h3><p>Ranking de 70 economias — indicador socioeconômico independente das pesquisas e resultados eleitorais.</p></div>' +
      '<div class="imd-teaser-score"><strong>' + brazil.posicao + 'º <small>/ 70</small></strong><span>Brasil no ranking</span></div></div>' +
      '<div class="imd-teaser-foot"><span>Índice do Brasil: ' + formatIndex(brazil.indice) + ' · Publicação: junho de 2026</span>' +
      '<button type="button" class="text-btn" data-go="competitividade">Explorar ranking ↗</button></div>' +
      '</article>';
  }
  function render(root) {
    const d = dataset();
    if (!root) return;
    if (!d || d.economias?.length !== 70) {
      root.innerHTML = '<div class="card" role="alert">Não foi possível carregar a base IMD 2026.</div>';
      return;
    }
    const brazil = d.economias.find(e => e.nome === 'Brasil');
    const americas = d.economias.filter(e => e.regiao === 'americas');
    const brazilRegionRank = americas.findIndex(e => e.nome === 'Brasil') + 1;
    const delta = d.brasil2025Posicao - brazil.posicao;
    const topTen = d.economias.slice(0,10);
    const state = {region:'all', search:'', expanded:false};

    const kpi = (label,value,detail,extra) =>
      '<div class="imd-metric ' + (extra || '') + '"><span>' + html(label) + '</span>' +
      '<strong>' + html(value) + '</strong><small>' + html(detail) + '</small></div>';

    const chart = topTen.map(e =>
      '<div class="imd-chart-row"><span class="imd-chart-rank">' + e.posicao + 'º</span>' +
      '<span class="imd-chart-name">' + html(e.nome) + '</span>' +
      '<span class="imd-chart-track"><i style="width:' + Math.min(100, Math.max(0,e.indice)) + '%"></i></span>' +
      '<strong>' + formatIndex(e.indice) + '</strong></div>'
    ).join('');

    root.innerHTML =
      '<div class="section-title imd-section-title"><div><span class="imd-eyebrow">PANORAMA ECONÔMICO / BRASIL E MUNDO</span>' +
      '<h2>Competitividade mundial</h2><p>World Competitiveness Ranking 2026, do IMD World Competitiveness Center. Classificação publicada em 18/06/2026.</p>' +
      '</div><span class="model-pill">IMD · EDIÇÃO 2026</span></div>' +
      '<section class="imd-metrics" aria-label="Resumo mundial de competitividade">' +
      kpi('Economias avaliadas', String(d.economias.length), 'Edição 2026') +
      kpi('1ª colocação', d.economias[0].nome, 'Índice: ' + formatIndex(d.economias[0].indice)) +
      kpi('Brasil no mundo', brazil.posicao + 'º de 70', '9º nas Américas', 'imd-brazil-metric') +
      kpi('Brasil · 2025 → 2026', delta + ' posições', d.brasil2025Posicao + 'º (2025) → ' + brazil.posicao + 'º (2026)') +
      '</section>' +
      '<div class="imd-panels">' +
      '<article class="card imd-chart-card"><div class="imd-card-heading"><span class="imd-eyebrow">DESTAQUES / TOP 10</span><h3>Dez primeiras economias</h3><p>Índices normalizados para visualização comparativa.</p></div>' +
      '<div class="imd-chart" role="img" aria-label="Dez primeiras posições do ranking de competitividade 2026">' + chart + '</div></article>' +
      '<article class="card imd-brazil-card"><span class="imd-eyebrow">RECORTE NACIONAL</span><h3>Brasil</h3>' +
      '<strong class="imd-brazil-position">' + brazil.posicao + 'º<span> / 70</span></strong>' +
      '<div class="imd-brazil-index"><span>Índice comparativo</span><strong>' + formatIndex(brazil.indice) + '</strong></div>' +
      '<div class="imd-brazil-track" aria-hidden="true"><i style="width:' + brazil.indice + '%"></i></div>' +
      '<div class="imd-brazil-stats"><span><strong>' + brazilRegionRank + 'º</strong> nas Américas</span>' +
      '<span><strong>' + d.brasil2025Posicao + 'º</strong> em 2025</span>' +
      '<span><strong>' + Math.abs(delta) + '</strong> posições de queda</span></div>' +
      '<button type="button" class="imd-brazil-action" id="imdBrazilFocus">Localizar Brasil na lista ↗</button>' +
      '</article></div>' +
      '<section class="card imd-data-panel" aria-labelledby="imdFullListTitle">' +
      '<div class="imd-data-heading"><div><span class="imd-eyebrow">CLASSIFICAÇÃO COMPLETA / 2026</span><h3 id="imdFullListTitle">Ranking das 70 economias</h3>' +
      '<p>Busque por economia ou selecione um agrupamento regional.</p></div><span class="imd-index-tag">Índice 0–100</span></div>' +
      '<div class="imd-controls"><label class="imd-search-label" for="imdSearch">Pesquisar economia' +
      '<input type="search" id="imdSearch" autocomplete="off" placeholder="Ex.: Brasil, Singapura, Chile"></label>' +
      '<button type="button" id="imdReset" class="imd-reset" hidden>Limpar filtros</button></div>' +
      '<div class="imd-region-filters" role="group" aria-label="Filtrar economias por região">' +
      Object.keys(regionNames).map(code =>
        '<button type="button" data-imd-region="' + code + '" aria-pressed="' + (code === 'all' ? 'true':'false') + '">' + regionNames[code] + '</button>'
      ).join('') + '</div>' +
      '<p class="imd-count" id="imdCount" role="status" aria-live="polite"></p>' +
      '<div class="imd-table-scroll"><table class="imd-table"><thead><tr>' +
      '<th scope="col">Posição mundial</th><th scope="col">Economia</th>' +
      '<th scope="col">Região IMD</th><th scope="col">Índice</th></tr></thead>' +
      '<tbody id="imdTableBody"></tbody></table></div>' +
      '<button type="button" id="imdToggle" class="imd-show-more"></button>' +
      '</section>' +
      '<div class="note imd-methodology"><strong>Sobre os dados:</strong> índices normalizados (0 a 100) publicados para representar graficamente as posições relativas. ' +
      'Não significam pontuação absoluta, avaliação de candidatos ou resultado eleitoral. ' +
      'O IMD compara economias, incluindo regiões econômicas que não são países soberanos. ' +
      'Os quatro fatores do estudo são desempenho econômico, eficiência governamental, eficiência empresarial e infraestrutura. ' +
      'Não há atualização automática: este é o recorte oficial de junho de 2026. ' +
      '<a href="' + html(d.fontes.ranking) + '" target="_blank" rel="noopener noreferrer">Resultados oficiais do IMD ↗</a> · ' +
      '<a href="' + html(d.fontes.relatorio) + '" target="_blank" rel="noopener noreferrer">Tabelas e relatório ↗</a> · ' +
      '<a href="' + html(d.fontes.metodologia) + '" target="_blank" rel="noopener noreferrer">Metodologia ↗</a>.</div>';

    const input = root.querySelector('#imdSearch');
    const toggle = root.querySelector('#imdToggle');
    const tableBody = root.querySelector('#imdTableBody');

    function drawRows() {
      const search = normalize(state.search).trim();
      const matched = d.economias.filter(e =>
        (state.region === 'all' || e.regiao === state.region) &&
        (!search || normalize(e.nome).includes(search))
      );
      const shown = state.expanded ? matched : matched.slice(0,20);
      tableBody.innerHTML = shown.length ? shown.map(e =>
        '<tr' + (e.nome === 'Brasil' ? ' class="imd-table-brazil"':'') + '>' +
        '<td><span class="imd-table-rank">' + e.posicao + 'º</span></td>' +
        '<th scope="row">' + html(e.nome) + (e.nome === 'Brasil' ? ' <span class="imd-br-tag">BR</span>':'') + '</th>' +
        '<td class="imd-table-region">' + html(regionNames[e.regiao]) + '</td>' +
        '<td class="imd-table-score"><span>' + formatIndex(e.indice) + '</span><i role="presentation" style="width:' + e.indice + '%"></i></td>' +
        '</tr>'
      ).join('') : '<tr><td colspan="4" class="imd-no-results">Nenhuma economia encontrada com os filtros atuais.</td></tr>';
      root.querySelector('#imdCount').textContent = 'Mostrando ' + shown.length + ' de ' + matched.length +
        ' economias encontradas (' + d.economias.length + ' no total).';
      toggle.hidden = matched.length <= 20;
      toggle.textContent = state.expanded ? 'Mostrar apenas 20 resultados ↑' : 'Mostrar as ' + matched.length + ' economias encontradas ↓';
      root.querySelector('#imdReset').hidden = !state.search && state.region === 'all';
      root.querySelectorAll('[data-imd-region]').forEach(button => {
        const active = button.dataset.imdRegion === state.region;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active',active);
      });
    }

    input.addEventListener('input', () => {
      state.search = input.value;
      state.expanded = false;
      drawRows();
    });
    root.querySelectorAll('[data-imd-region]').forEach(button => button.addEventListener('click', () => {
      state.region = button.dataset.imdRegion;
      state.expanded = false;
      drawRows();
    }));
    toggle.addEventListener('click', () => {
      state.expanded = !state.expanded;
      drawRows();
    });
    root.querySelector('#imdReset').addEventListener('click', () => {
      state.region = 'all';
      state.search = '';
      state.expanded = false;
      input.value = '';
      drawRows();
      input.focus();
    });
    root.querySelector('#imdBrazilFocus').addEventListener('click', () => {
      state.region = 'all';
      state.search = 'Brasil';
      state.expanded = false;
      input.value = state.search;
      drawRows();
      root.querySelector('.imd-data-panel').scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth',
        block: 'start'
      });
    });
    drawRows();
  }
  window.Competitiveness2026 = {render,overviewCard};
})();
