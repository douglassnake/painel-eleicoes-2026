#!/usr/bin/env python3
"""Recalcula o modelo regional do Painel Eleitoral 2026.

Monte Carlo v3 (ITR):
- preserva a estrutura probabilística simplificada do v2;
- usa parâmetros-base de voto e corte por partido/cargo;
- incorpora um ajuste territorial conservador derivado do ITR;
- atualiza patrimônio/partido/número dos monitorados a partir da base TSE;
- grava model-results.json com auditoria dos parâmetros e atualiza data.js.

IMPORTANTE: este modelo NÃO simula integralmente o sistema proporcional brasileiro.
Os cortes por partido/federação são proxies de competitividade e não substituem
quociente eleitoral, distribuição de sobras, votação total da legenda/federação
ou posição interna real de cada candidato.
"""
import json
import math
import random
import re
import unicodedata
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_JS = ROOT / 'data.js'
OFFICIAL = ROOT / 'official-data.json'
HISTORY = ROOT / 'election-history.json'
OUT = ROOT / 'model-results.json'

SIMULATIONS = 200_000
SEED = 20261004

# Parâmetros-base do Monte Carlo v2, em milhares de votos.
BASE = {
    'Dr. Julio Mundim': (70, 32),
    'Greyce Elias': (105, 28),
    'Gladston Gabriel': (55, 28),
    'José Eustáquio': (65, 28),
    'Igor Santos': (80, 32),
    'Ju Almeida': (30, 21),
    'Cabo Santana': (35, 23),
    'Clesle Siqueira': (25, 18),
    'João Paulo Nagashi': (25, 20),
    'Silva Brasil': (25, 20),
    'Bosco': (68, 17),
    'Elismar Prado': (78, 18),
    'Raul Belém': (70, 18),
    'Maria Clara Marra': (45, 15),
    'Fernando Breno': (42, 19),
    'Marli Ribeiro': (38, 14),
    'Lud Falcão': (65, 17),
}

FEDERAL_CUTOFF = {
    'PL': (60, 15), 'MDB': (65, 16), 'REPUBLICANOS': (65, 17),
    'UNIAO': (65, 17), 'PSDB': (75, 18), 'MISSAO': (95, 22),
}
STATE_CUTOFF = {
    'PSD': (45, 11), 'PL': (40, 10), 'REPUBLICANOS': (42, 11),
    'PSDB': (48, 12), 'PRD': (48, 13),
}


def norm(v):
    s = unicodedata.normalize('NFKD', str(v or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c)).upper()
    return re.sub(r'[^A-Z0-9]+', ' ', s).strip()


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def log_norm(v, max_v):
    return math.log1p(max(0.0, float(v))) / math.log1p(max_v) if max_v > 0 else 0.0


def read_regional(text):
    m = re.search(r"regional:\s*\[(.*?)\]\s*,\s*governador:", text, re.S)
    if not m:
        raise RuntimeError('Bloco regional não encontrado em data.js')
    block = m.group(1)
    rows = []
    for obj in re.findall(r"\{[^{}]*\}", block):
        def s(key, default=''):
            mm = re.search(rf"{re.escape(key)}:'([^']*)'", obj)
            return mm.group(1) if mm else default
        def num(key, default=None):
            mm = re.search(rf"{re.escape(key)}:([0-9.]+|null)", obj)
            if not mm or mm.group(1) == 'null': return default
            return float(mm.group(1))
        rows.append({
            'raw': obj,
            'nome': s('nome'), 'cargo': s('cargo'), 'partido': s('partido'),
            'numero': s('numero'), 'base': s('base'),
            'prob_old': num('prob', 0.0),
        })
    return rows


def choose_history(hist):
    if hist.get('2022'):
        return 2022, hist['2022']
    if hist.get('2024'):
        return 2024, hist['2024']
    return None, None


def compute_itr(rows, official, history):
    prelim = []
    monitored = official.get('candidates', {})
    by_cand = history.get('byCandidate', {})
    for r in rows:
        off = monitored.get(r['nome'])
        hist = None; year = None
        if off:
            year, hist = choose_history(by_cand.get(str(off.get('sqCandidato')), {}))
        nr = (hist or {}).get('regioes', {}).get('Noroeste de MG', {'votos': 0, 'percentual': 0})
        ap = (hist or {}).get('regioes', {}).get('Alto Paranaiba', {'votos': 0, 'percentual': 0})
        prelim.append({**r, 'official': off, 'hist': hist, 'year': year,
                       'nr': nr, 'ap': ap,
                       'regional_votes': float(nr.get('votos', 0) or 0) + float(ap.get('votos', 0) or 0),
                       'regional_share': float(nr.get('percentual', 0) or 0) + float(ap.get('percentual', 0) or 0)})
    with_hist = [x for x in prelim if x['hist']]
    max_regional = max([1.0] + [x['regional_votes'] for x in with_hist])
    max_muni = max([1.0] + [float(x['hist'].get('municipiosComVotos', 0) or 0) for x in with_hist])
    for x in prelim:
        if not x['hist']:
            x['itr'] = None
            continue
        share = clamp(x['regional_share'] / 100.0)
        volume = log_norm(x['regional_votes'], max_regional)
        reach = log_norm(float(x['hist'].get('municipiosComVotos', 0) or 0), max_muni)
        dispersion = clamp(1 - float(x['hist'].get('concentracaoTop3', 0) or 0) / 100.0)
        x['itr'] = 100 * (0.45 * share + 0.30 * volume + 0.15 * reach + 0.10 * dispersion)
    return prelim


def cutoff_for(cargo, partido):
    p = norm(partido)
    if 'FEDERAL' in norm(cargo):
        for k, v in FEDERAL_CUTOFF.items():
            if norm(k) in p: return (*v, 12)
        return 70, 18, 12
    for k, v in STATE_CUTOFF.items():
        if norm(k) in p: return (*v, 8)
    return 45, 12, 8


def definitive_inactive(status):
    s = norm(status)
    if any(k in s for k in ('RENUNCIA', 'CANCELADO', 'CANCELADA', 'FALECIDO', 'FALECIDA')):
        return True
    if 'INDEFERIDO' in s and 'RECURSO' not in s and 'PRAZO RECURSAL' not in s:
        return True
    return False


def simulate(row, rng):
    mu, sd = BASE.get(row['nome'], (max(25, (row['regional_votes'] or 0) / 1000 * 2.0), 22))
    itr = row['itr']
    year = row['year']
    # Ajuste conservador: no máximo ±15% na média com histórico legislativo de 2022;
    # e ±9% quando a evidência vem apenas da eleição local de 2024.
    if itr is None:
        territorial_weight = 0.0
    elif year == 2022:
        territorial_weight = 0.30
    else:
        territorial_weight = 0.18
    centered = 0.0 if itr is None else clamp((itr - 50.0) / 50.0, -1.0, 1.0)
    mu_adj = max(1.0, mu * (1.0 + territorial_weight * 0.5 * centered))

    off = row.get('official') or {}
    status = off.get('situacao', '')
    cut_mu, cut_sd, min_votes = cutoff_for(row['cargo'], off.get('partido') or row['partido'])
    if definitive_inactive(status):
        return 0.0, mu, mu_adj, sd, cut_mu, cut_sd, min_votes, territorial_weight

    wins = 0
    for _ in range(SIMULATIONS):
        votes = max(0.0, rng.gauss(mu_adj, sd))
        cutoff = max(float(min_votes), rng.gauss(cut_mu, cut_sd))
        if votes >= cutoff:
            wins += 1
    p = 100.0 * wins / SIMULATIONS
    return p, mu, mu_adj, sd, cut_mu, cut_sd, min_votes, territorial_weight


def format_pt_date(dt):
    months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    return f"{dt.day} {months[dt.month-1]} {dt.year}"


def update_object(raw, row, probability):
    off = row.get('official') or {}
    partido = off.get('partido') or row['partido']
    numero = str(off.get('numero') or row['numero'])
    patrimonio = off.get('patrimonio')
    out = raw
    out = re.sub(r"partido:'[^']*'", f"partido:'{partido}'", out, count=1)
    out = re.sub(r"numero:'[^']*'", f"numero:'{numero}'", out, count=1)
    if patrimonio is not None:
        out = re.sub(r"patrimonio:(?:[0-9.]+|null)", f"patrimonio:{float(patrimonio):.2f}", out, count=1)
    out = re.sub(r"prob:[0-9.]+", f"prob:{probability:.1f}", out, count=1)
    return out


def main():
    if not OFFICIAL.exists() or not HISTORY.exists():
        raise SystemExit('official-data.json/election-history.json ausente. Rode as etapas TSE e histórico primeiro.')
    text = DATA_JS.read_text(encoding='utf-8')
    official = json.loads(OFFICIAL.read_text(encoding='utf-8'))
    history = json.loads(HISTORY.read_text(encoding='utf-8'))
    rows = compute_itr(read_regional(text), official, history)
    rng = random.Random(SEED)

    results = []
    replacements = {}
    for row in rows:
        p, mu, mu_adj, sd, c_mu, c_sd, min_v, tw = simulate(row, rng)
        replacements[row['raw']] = update_object(row['raw'], row, p)
        off = row.get('official') or {}
        results.append({
            'nome': row['nome'], 'cargo': row['cargo'], 'partido': off.get('partido') or row['partido'],
            'numero': str(off.get('numero') or row['numero']), 'situacaoTSE': off.get('situacao'),
            'probV2': round(float(row['prob_old'] or 0), 1), 'probV3': round(p, 1),
            'itr': None if row['itr'] is None else round(row['itr'], 2), 'historicoUsado': row['year'],
            'muBaseMil': round(mu, 3), 'muAjustadoMil': round(mu_adj, 3), 'desvioMil': sd,
            'corteMedioMil': c_mu, 'corteDesvioMil': c_sd, 'minimoMil': min_v,
            'pesoTerritorial': tw,
        })
        print(f"{row['nome']}: v2={row['prob_old']:.1f}% -> v3={p:.1f}% | ITR={row['itr'] if row['itr'] is not None else 'N/D'}")

    for old, new in replacements.items():
        text = text.replace(old, new, 1)
    now = datetime.now()
    text = re.sub(r"updatedAt:\s*'[^']*'", f"updatedAt: '{format_pt_date(now)}'", text, count=1)
    text = re.sub(r"model:\s*'[^']*'", "model: 'Monte Carlo v3 (ITR)'", text, count=1)
    text = re.sub(r"simulations:\s*\d+", f"simulations: {SIMULATIONS}", text, count=1)
    DATA_JS.write_text(text, encoding='utf-8')

    payload = {
        'model': 'Monte Carlo v3 (ITR)', 'generatedAt': now.isoformat(), 'simulations': SIMULATIONS,
        'seed': SEED,
        'disclaimer': 'Modelo simplificado por limiar. Não simula integralmente a distribuição proporcional de cadeiras, quociente eleitoral, sobras ou posição real na lista/federação.',
        'itrFormula': {'participacaoRegional': 0.45, 'volumeRegional': 0.30, 'alcanceMunicipal': 0.15, 'dispersao': 0.10},
        'territorialAdjustment': {'2022': 'até ±15% na média de votos', '2024': 'até ±9% na média de votos', 'semHistorico': 'sem ajuste'},
        'results': sorted(results, key=lambda x: x['probV3'], reverse=True),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Monte Carlo v3 concluído: {len(results)} candidatos, {SIMULATIONS:,} simulações por candidato.')

if __name__ == '__main__':
    main()
