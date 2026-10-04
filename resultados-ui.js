(() => {
  'use strict';

  const TSE_BASE = 'https://resultados.tse.jus.br/oficial';
  const ELECTION = '6259';
  const UF = 'mg';
  const REFRESH_MS = 60_000;
  let refreshTimer = null;
  let requestSeq = 0;

  const viewEl = () => document.querySelector('#view');
  const active = () => document.querySelector('.tab.active')?.dataset.view === 'resultados';
  const pad = (v, n) => String(v).padStart(n, '0');
  const resultUrl = cargo => `${TSE_BASE}/ele2026/${ELECTION}/dados/${UF}/${UF}-c${pad(cargo,4)}-e${pad(ELECTION,6)}-u.json`;
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
  const cargoCode = label => /Federal/i.test(label) ? 6 : 7;
  const cargoLabel = code => code === 6 ? 'Deputados federais' : 'Deputados estaduais';

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
    if (t.includes('eleit')) return 'result-status-ok';
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
          <div class="live-heading"><span class="result-live-dot"></span><h2>Resultados dos candidatos monitorados</h2></div>
          <p>Votação oficial do TSE para deputado federal e estadual em Minas Gerais.</p>
        </div>
        <button class="result-refresh" id="resultRefresh" type="button">Atualizar agora</button>
      </div>
      <div class="result-summary" id="resultSummary">
        <div class="result-summary-card"><span>Fonte</span><strong>TSE • Resultados 2026</strong><small>Dados oficiais em tempo real</small></div>
        <div class="result-summary-card"><span>Apuração</span><strong>Carregando…</strong><small>Minas Gerais</small></div>
        <div class="result-summary-card"><span>Atualização</span><strong>Carregando…</strong><small>Atualização automática a cada 60 s</small></div>
      </div>
      <div id="resultContent" class="result-loading">
        <div class="result-spinner"></div>
        <p>Consultando os arquivos oficiais do TSE…</p>
      </div>
      <div class="note result-note">Os números são parciais enquanto a totalização não estiver concluída e podem mudar a cada atualização. A situação “Eleito”, “Eleito por QP”, “Suplente” ou equivalente é exibida somente quando informada pelo próprio TSE.</div>
    `;
    document.querySelector('#resultRefresh')?.addEventListener('click', () => loadResults(true));
  }

  function candidateRow(monitored, found) {
    const cargo = /Federal/i.test(monitored.cargo) ? 'Federal' : 'Estadual';
    if (!found) {
      return `<article class="result-candidate result-missing">
        <div class="result-person"><div class="avatar large">${safe(monitored.nome.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</div><div><strong>${safe(monitored.nome)}</strong><small>${safe(monitored.partido)} • ${cargo} • ${safe(monitored.numero)}</small></div></div>
        <div class="result-votes"><span>Votos</span><strong>—</strong><small>Candidatura não localizada no arquivo atual</small></div>
        <div class="result-share"><span>Percentual</span><strong>—</strong></div>
        <div class="result-state"><span class="result-status result-status-off">Não localizado</span></div>
      </article>`;
    }
    return `<article class="result-candidate">
      <div class="result-person"><div class="avatar large">${safe(monitored.nome.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</div><div><strong>${safe(monitored.nome)}</strong><small>${safe(found.partido || monitored.partido)} • ${cargo} • ${safe(found.numero)}</small></div></div>
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
        <div class="result-progress-wrap">
          <div class="result-progress-label"><span>Seções totalizadas</span><strong>${fmtPct(result.secoesPct)}</strong></div>
          <div class="result-progress"><i style="width:${Math.max(0,Math.min(100,result.secoesPct))}%"></i></div>
        </div>
      </div>
      <div class="result-list">${rows}</div>
    </section>`;
  }

  async function fetchCargo(code) {
    const url = `${resultUrl(code)}?t=${Date.now()}`;
    const res = await fetch(url, {cache:'no-store'});
    if (!res.ok) throw new Error(`TSE respondeu HTTP ${res.status} para o cargo ${code}`);
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
      const [federal, estadual] = await Promise.all([fetchCargo(6), fetchCargo(7)]);
      if (seq !== requestSeq || !active()) return;
      const monitored = window.DASH_DATA?.regional || [];
      const federalMon = monitored.filter(x => cargoCode(x.cargo) === 6);
      const estadualMon = monitored.filter(x => cargoCode(x.cargo) === 7);
      const overallPct = Math.min(federal.secoesPct || 0, estadual.secoesPct || 0) || Math.max(federal.secoesPct || 0, estadual.secoesPct || 0);
      const generated = federal.geradoEm || estadual.geradoEm || '—';
      const final = federal.final && estadual.final;
      const summary = document.querySelector('#resultSummary');
      if (summary) summary.innerHTML = `
        <div class="result-summary-card"><span>Fonte</span><strong>TSE • Resultados 2026</strong><small>Eleição estadual 6259 • MG</small></div>
        <div class="result-summary-card"><span>Seções totalizadas</span><strong>${fmtPct(overallPct)}</strong><small>${final ? 'Totalização final' : 'Apuração em andamento'}</small></div>
        <div class="result-summary-card"><span>Arquivo gerado pelo TSE</span><strong>${safe(generated)}</strong><small>Atualização automática a cada 60 s</small></div>`;
      if (content) {
        content.className = 'result-content';
        content.innerHTML = `${groupMarkup(6,federal,federalMon)}${groupMarkup(7,estadual,estadualMon)}`;
      }
    } catch (err) {
      console.error(err);
      if (seq !== requestSeq || !active()) return;
      if (content) {
        content.className = 'result-error';
        content.innerHTML = `<h3>Não foi possível ler o TSE diretamente</h3><p>${safe(err.message || err)}</p><p>Você ainda pode acompanhar a apuração no portal oficial enquanto tentamos novamente.</p><div class="result-error-actions"><button class="result-refresh" id="resultRetry" type="button">Tentar novamente</button><a href="https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6259/uf/mg/cargo/6/vis/nominal/resultados" target="_blank" rel="noopener">Abrir Resultados TSE</a></div>`;
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
