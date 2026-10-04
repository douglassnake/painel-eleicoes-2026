(() => {
  'use strict';

  const TSE_BASE = 'https://resultados.tse.jus.br/oficial';
  const ELECTION_FEDERAL = '6257';
  const ELECTION_STATE = '6259';
  const REFRESH_MS = 60_000;
  let refreshTimer = null;
  let requestSeq = 0;

  const viewEl = () => document.querySelector('#view');
  const active = () => document.querySelector('.tab.active')?.dataset.view === 'resultados';
  const pad = (v, n) => String(v).padStart(n, '0');
  const resultUrl = (election, uf, cargo) => `${TSE_BASE}/ele2026/${election}/dados/${uf}/${uf}-c${pad(cargo,4)}-e${pad(election,6)}-u.json`;
  const fmtInt = n => new Intl.NumberFormat('pt-BR').format(Number(n || 0));
  const fmtPct = n => `${Number(n || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
  const safe = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const onlyDigits = v => parseInt(String(v ?? '').replace(/\D/g,''), 10) || 0;
  const decimal = v => {
    const s = String(v ?? '').trim();
    if (!s) return 0;
    const n = Number(s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s);
    return Number.isFinite(n) ? n : 0;
  };
  const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const cargoCode = label => /Federal/i.test(label) ? 6 : 7;
  const cargoLabel = code => code === 6 ? 'Deputados federais monitorados' : 'Deputados estaduais monitorados';

  function normalize(json) {
    const cargo = json?.carg?.[0] || {};
    const rows = [];
    for (const agr of cargo.agr || []) {
      for (const par of agr.par || []) {
        for (const c of par.cand || []) {
          rows.push({
            numero: String(c.n || ''),
            nome: c.nmu || c.nm || '',
            partido: par.sg || '',
            votos: onlyDigits(c.vap),
            pct: decimal(c.pvap),
            situacao: c.st || '',
            eleitoFlag: String(c.e || '').toLowerCase(),
            ordem: onlyDigits(c.seq)
          });
        }
      }
    }
    rows.sort((a,b) => b.votos - a.votos || a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
    return {
      rows,
      secoesPct: decimal(json?.s?.pst),
      secoesTotal: onlyDigits(json?.s?.ts),
      secoesApuradas: onlyDigits(json?.s?.st),
      geradoEm: [json?.dg, json?.hg].filter(Boolean).join(' '),
      final: String(json?.tf || '').toLowerCase() === 's',
      cargoNome: cargo.nmn || ''
    };
  }

  function statusClass(text, eleitoFlag) {
    const t = String(text || '').toLowerCase();
    if (t.includes('eleit') || t.includes('2º turno') || t.includes('2o turno') || t.includes('segundo turno')) return 'result-status-ok';
    if (t.includes('suplente')) return 'result-status-warn';
    if (t.includes('não eleito') || t.includes('nao eleito')) return 'result-status-off';
    if (eleitoFlag === 's') return 'result-status-ok';
    return 'result-status-live';
  }

  function statusText(text, eleitoFlag) {
    if (text) return text;
    if (eleitoFlag === 's') return 'Eleito';
    return 'Em apuração';
  }

  function renderSkeleton() {
    const view = viewEl();
    if (!view) return;
    view.innerHTML = `
      <div class="section-title result-title">
        <div>
          <div class="live-heading"><span class="result-live-dot"></span><h2>Resultados oficiais ao vivo</h2></div>
          <p>Presidente do Brasil, Governador de Minas Gerais, Senado por MG e candidatos regionais a deputado.</p>
        </div>
        <button class="result-refresh" id="resultRefresh" type="button">Atualizar agora</button>
      </div>
      <div class="result-summary" id="resultSummary">
        <div class="result-summary-card"><span>Fonte</span><strong>TSE • Resultados 2026</strong><small>Arquivos oficiais de totalização</small></div>
        <div class="result-summary-card"><span>Presidência</span><strong>Carregando…</strong><small>Brasil</small></div>
        <div class="result-summary-card"><span>Minas Gerais</span><strong>Carregando…</strong><small>Governador, Senado e deputados</small></div>
        <div class="result-summary-card"><span>Atualização</span><strong>Carregando…</strong><small>Automática a cada 60 s</small></div>
      </div>
      <div id="resultContent" class="result-loading">
        <div class="result-spinner"></div>
        <p>Consultando os arquivos oficiais do TSE…</p>
      </div>
      <div class="note result-note">Os números são parciais enquanto a totalização não estiver concluída e podem mudar a cada atualização. Situações como “Eleito”, “2º turno”, “Eleito por QP” ou “Suplente” são reproduzidas somente quando informadas pelo próprio TSE.</div>
    `;
    document.querySelector('#resultRefresh')?.addEventListener('click', () => loadResults(true));
  }

  function candidateRow(monitored, found) {
    const cargo = /Federal/i.test(monitored.cargo) ? 'Federal' : 'Estadual';
    if (!found) {
      return `<article class="result-candidate result-missing">
        <div class="result-person"><div class="avatar large">${safe(initials(monitored.nome))}</div><div><strong>${safe(monitored.nome)}</strong><small>${safe(monitored.partido)} • ${cargo} • ${safe(monitored.numero)}</small></div></div>
        <div class="result-votes"><span>Votos</span><strong>—</strong><small>Candidatura não localizada no arquivo atual</small></div>
        <div class="result-share"><span>Percentual</span><strong>—</strong></div>
        <div class="result-state"><span class="result-status result-status-off">Não localizado</span></div>
      </article>`;
    }
    return `<article class="result-candidate">
      <div class="result-person"><div class="avatar large">${safe(initials(monitored.nome))}</div><div><strong>${safe(monitored.nome)}</strong><small>${safe(found.partido || monitored.partido)} • ${cargo} • ${safe(found.numero)}</small></div></div>
      <div class="result-votes"><span>Votos</span><strong>${fmtInt(found.votos)}</strong><small>votos nominais</small></div>
      <div class="result-share"><span>% dos válidos</span><strong>${fmtPct(found.pct)}</strong></div>
      <div class="result-state"><span class="result-status ${statusClass(found.situacao, found.eleitoFlag)}">${safe(statusText(found.situacao, found.eleitoFlag))}</span></div>
    </article>`;
  }

  function groupMarkup(code, result, monitored) {
    const byNumber = new Map(result.rows.map(r => [String(r.numero), r]));
    const rows = monitored.map(m => candidateRow(m, byNumber.get(String(m.numero)))).join('');
    return `<section class="result-group">
      <div class="result-group-head">
        <div><h3>${cargoLabel(code)}</h3><p>${monitored.length} candidaturas acompanhadas pelo painel</p></div>
        ${progressMarkup(result)}
      </div>
      <div class="result-list">${rows}</div>
    </section>`;
  }

  function progressMarkup(result) {
    return `<div class="result-progress-wrap">
      <div class="result-progress-label"><span>Seções totalizadas</span><strong>${fmtPct(result.secoesPct)}</strong></div>
      <div class="result-progress"><i style="width:${Math.max(0,Math.min(100,result.secoesPct))}%"></i></div>
    </div>`;
  }

  function majorCandidateRow(row, position) {
    return `<div class="result-major-row">
      <span class="result-major-pos">${position}</span>
      <div class="result-major-person">
        <div class="avatar sm">${safe(initials(row.nome))}</div>
        <div><strong>${safe(row.nome)}</strong><small>${safe(row.partido)} • ${safe(row.numero)}</small></div>
      </div>
      <div class="result-major-votes"><strong>${fmtInt(row.votos)}</strong><small>${fmtPct(row.pct)}</small></div>
      <div class="result-major-status"><span class="result-status ${statusClass(row.situacao, row.eleitoFlag)}">${safe(statusText(row.situacao, row.eleitoFlag))}</span></div>
    </div>`;
  }

  function majorMarkup(title, subtitle, result, tseUrl) {
    return `<section class="result-major-card">
      <div class="result-major-head">
        <div><h3>${safe(title)}</h3><p>${safe(subtitle)}</p></div>
        <a href="${safe(tseUrl)}" target="_blank" rel="noopener">TSE ↗</a>
      </div>
      ${progressMarkup(result)}
      <div class="result-major-list">
        ${result.rows.map((row,i) => majorCandidateRow(row,i+1)).join('') || '<div class="empty">Nenhum resultado disponível.</div>'}
      </div>
      <div class="result-major-foot"><span>Arquivo TSE: ${safe(result.geradoEm || '—')}</span><strong>${result.final ? 'Totalização final' : 'Apuração em andamento'}</strong></div>
    </section>`;
  }

  async function fetchResult(election, uf, cargo) {
    const url = `${resultUrl(election, uf, cargo)}?t=${Date.now()}`;
    const res = await fetch(url, {cache:'no-store'});
    if (!res.ok) throw new Error(`TSE respondeu HTTP ${res.status} para ${uf.toUpperCase()} / cargo ${cargo}`);
    return normalize(await res.json());
  }

  async function loadResults(force=false) {
    if (!active()) return;
    const seq = ++requestSeq;
    const content = document.querySelector('#resultContent');
    const button = document.querySelector('#resultRefresh');
    if (button) { button.disabled = true; button.textContent = 'Atualizando…'; }
    if (force && content) content.classList.add('is-refreshing');
    try {
      const [presidente, governador, senador, federal, estadual] = await Promise.all([
        fetchResult(ELECTION_FEDERAL, 'br', 1),
        fetchResult(ELECTION_STATE, 'mg', 3),
        fetchResult(ELECTION_STATE, 'mg', 5),
        fetchResult(ELECTION_STATE, 'mg', 6),
        fetchResult(ELECTION_STATE, 'mg', 7)
      ]);
      if (seq !== requestSeq || !active()) return;

      const monitored = window.DASH_DATA?.regional || [];
      const federalMon = monitored.filter(x => cargoCode(x.cargo) === 6);
      const estadualMon = monitored.filter(x => cargoCode(x.cargo) === 7);
      const mgResults = [governador, senador, federal, estadual];
      const mgPct = Math.min(...mgResults.map(x => x.secoesPct || 0));
      const latestGenerated = [presidente, governador, senador, federal, estadual].map(x => x.geradoEm).filter(Boolean).sort().slice(-1)[0] || '—';
      const summary = document.querySelector('#resultSummary');
      if (summary) summary.innerHTML = `
        <div class="result-summary-card"><span>Fonte</span><strong>TSE • Resultados 2026</strong><small>Arquivos oficiais de totalização</small></div>
        <div class="result-summary-card"><span>Presidência • Brasil</span><strong>${fmtPct(presidente.secoesPct)}</strong><small>${presidente.final ? 'Totalização final' : 'Seções totalizadas'}</small></div>
        <div class="result-summary-card"><span>Minas Gerais</span><strong>${fmtPct(mgPct)}</strong><small>Menor percentual entre os cargos exibidos</small></div>
        <div class="result-summary-card"><span>Último arquivo TSE</span><strong>${safe(latestGenerated)}</strong><small>Atualização automática a cada 60 s</small></div>`;

      if (content) {
        content.className = 'result-content';
        content.innerHTML = `
          <div class="result-section-label"><h3>Disputas majoritárias</h3><p>Resultados oficiais, sem projeção do painel.</p></div>
          <div class="result-major-grid">
            ${majorMarkup('Presidente da República', 'Brasil • 1º turno', presidente, 'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6257/uf/br/cargo/1/vis/nominal/resultados')}
            ${majorMarkup('Governador de Minas Gerais', 'Minas Gerais • 1º turno', governador, 'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6259/uf/mg/cargo/3/vis/nominal/resultados')}
            ${majorMarkup('Senado Federal por MG', 'Minas Gerais • 2 vagas', senador, 'https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6259/uf/mg/cargo/5/vis/nominal/resultados')}
          </div>
          <div class="result-section-label result-deputies-label"><h3>Candidatos regionais monitorados</h3><p>Votação nominal para deputado federal e estadual em Minas Gerais.</p></div>
          ${groupMarkup(6,federal,federalMon)}
          ${groupMarkup(7,estadual,estadualMon)}`;
      }
    } catch (err) {
      console.error(err);
      if (seq !== requestSeq || !active()) return;
      if (content) {
        content.className = 'result-error';
        content.innerHTML = `<h3>Não foi possível ler o TSE diretamente</h3><p>${safe(err.message || err)}</p><p>Você ainda pode acompanhar a apuração no portal oficial enquanto tentamos novamente.</p><div class="result-error-actions"><button class="result-refresh" id="resultRetry" type="button">Tentar novamente</button><a href="https://resultados.tse.jus.br/oficial/app/index.html" target="_blank" rel="noopener">Abrir Resultados TSE</a></div>`;
        document.querySelector('#resultRetry')?.addEventListener('click',()=>loadResults(true));
      }
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Atualizar agora'; }
      content?.classList.remove('is-refreshing');
    }
  }

  function openResults() {
    renderSkeleton();
    loadResults();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (active()) loadResults(); }, REFRESH_MS);
  }

  document.querySelectorAll('.tab[data-view="resultados"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(openResults, 0));
  });
})();
