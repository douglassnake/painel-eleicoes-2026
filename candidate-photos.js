(() => {
  'use strict';

  const OFFICIAL_DATA_URL = 'official-data.json';
  const DIVULGA_BASE = 'https://divulgacandcontas.tse.jus.br/divulga/rest/v1';
  const ELECTION_ID = '20322002026';
  const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
  const CACHE_PREFIX = 'painel2026.photo.';
  const CACHE_TTL_OK = 30 * 24 * 60 * 60 * 1000;
  const CACHE_TTL_MISS = 7 * 24 * 60 * 60 * 1000;
  let officialPromise = null;

  const norm = v => String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

  const cargoCode = label => {
    const t = norm(label);
    if (t.includes('PRESIDENTE')) return 1;
    if (t.includes('GOVERNADOR')) return 3;
    if (t.includes('SENADOR')) return 5;
    if (t.includes('DEPUTADO FEDERAL')) return 6;
    if (t.includes('DEPUTADO ESTADUAL')) return 7;
    return 0;
  };

  async function loadOfficial() {
    if (!officialPromise) {
      officialPromise = fetch(OFFICIAL_DATA_URL + '?photo=1', {cache:'no-store'})
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    }
    return officialPromise;
  }

  function findCandidate(official, meta) {
    const db = official?.database || [];
    const code = Number(meta.cargo || 0);
    const uf = String(meta.uf || (code === 1 ? 'BR' : 'MG')).toUpperCase();
    const number = String(meta.numero || '').trim();
    const name = norm(meta.nome);
    let hit = db.find(c => {
      const ccode = cargoCode(c.cargo);
      const cuf = ccode === 1 ? 'BR' : String(c.uf || '').toUpperCase();
      return ccode === code && cuf === uf && String(c.numero || '').trim() === number;
    });
    if (!hit && name) {
      hit = db.find(c => {
        const ccode = cargoCode(c.cargo);
        const cuf = ccode === 1 ? 'BR' : String(c.uf || '').toUpperCase();
        return ccode === code && cuf === uf && [c.nomeUrna, c.nomeCompleto].some(v => norm(v) === name);
      });
    }
    return hit || null;
  }

  function absolutePhoto(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return 'https:' + s;
    if (s.startsWith('/')) return 'https://divulgacandcontas.tse.jus.br' + s;
    return s;
  }

  function readCache(sq) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + sq);
      if (!raw) return undefined;
      const x = JSON.parse(raw);
      const ttl = x.url ? CACHE_TTL_OK : CACHE_TTL_MISS;
      if (!x.at || Date.now() - x.at > ttl) return undefined;
      return x.url || null;
    } catch (_) { return undefined; }
  }

  function writeCache(sq, url) {
    try { localStorage.setItem(CACHE_PREFIX + sq, JSON.stringify({url:url || '', at:Date.now()})); } catch (_) {}
  }

  async function fetchWithTimeout(url, ms=5000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, {cache:'force-cache', signal:ctrl.signal}); }
    finally { clearTimeout(timer); }
  }

  async function divulgaPhoto(candidate, meta) {
    const sq = String(candidate?.sqCandidato || '').trim();
    if (!sq) return '';
    const uf = String(meta.uf || (Number(meta.cargo) === 1 ? 'BR' : 'MG')).toUpperCase();
    const url = `${DIVULGA_BASE}/candidatura/buscar/2026/${encodeURIComponent(uf)}/${ELECTION_ID}/candidato/${encodeURIComponent(sq)}`;
    try {
      const r = await fetchWithTimeout(url, 4500);
      if (!r.ok) return '';
      const j = await r.json();
      return absolutePhoto(j?.fotoUrl || j?.urlFoto || '');
    } catch (_) { return ''; }
  }

  async function commonsPhoto(candidate) {
    const sq = String(candidate?.sqCandidato || '').trim();
    if (!sq) return '';
    const params = new URLSearchParams({
      action:'query',
      generator:'search',
      gsrsearch:sq,
      gsrnamespace:'6',
      gsrlimit:'6',
      prop:'imageinfo',
      iiprop:'url',
      iiurlwidth:'240',
      format:'json',
      origin:'*'
    });
    try {
      const r = await fetchWithTimeout(`${COMMONS_API}?${params}`, 5500);
      if (!r.ok) return '';
      const j = await r.json();
      const pages = Object.values(j?.query?.pages || {});
      const exact = pages.find(p => String(p.title || '').includes(sq)) || pages[0];
      const info = exact?.imageinfo?.[0];
      return info?.thumburl || info?.url || '';
    } catch (_) { return ''; }
  }

  async function resolve(meta) {
    // Retratos de 2026 já conferidos para o segundo turno presidencial.
    // A identificação exige cargo, UF e número; outros cargos seguem o TSE.
    if (Number(meta.cargo) === 1 && String(meta.uf || 'BR').toUpperCase() === 'BR') {
      const match = (window.DASH_DATA?.presidenciaSegundoTurno?.candidatos || [])
        .find(c => String(c.numero) === String(meta.numero));
      if (match?.fotoUrl) return absolutePhoto(match.fotoUrl);
    }
    const official = await loadOfficial();
    const candidate = findCandidate(official, meta);
    if (!candidate) return '';
    const direct = absolutePhoto(candidate.fotoUrl);
    if (direct) return direct;

    const sq = String(candidate.sqCandidato || '').trim();
    if (!sq) return '';
    const cached = readCache(sq);
    if (cached !== undefined) return cached || '';

    let url = await divulgaPhoto(candidate, meta);
    if (!url) url = await commonsPhoto(candidate);
    writeCache(sq, url);
    return url;
  }

  function applyPhoto(el, url) {
    if (!url || !el?.isConnected) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = el.getAttribute('data-photo-alt') || 'Foto de candidatura';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => { img.remove(); el.classList.remove('has-photo'); }, {once:true});
    el.classList.add('has-photo');
    el.prepend(img);
  }

  async function hydrate(root=document) {
    const nodes = [...root.querySelectorAll('[data-candidate-photo]:not([data-photo-loaded])')];
    const queue = nodes.slice();
    const workers = Array.from({length:Math.min(4, queue.length)}, async () => {
      while (queue.length) {
        const el = queue.shift();
        if (!el) break;
        el.setAttribute('data-photo-loaded','1');
        const meta = {
          nome: el.getAttribute('data-name') || '',
          numero: el.getAttribute('data-number') || '',
          cargo: Number(el.getAttribute('data-cargo') || 0),
          uf: el.getAttribute('data-uf') || ''
        };
        const url = await resolve(meta);
        if (url) applyPhoto(el, url);
      }
    });
    await Promise.all(workers);
  }

  window.CandidatePhotos = {hydrate, resolve};
})();