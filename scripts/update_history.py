#!/usr/bin/env python3
"""Cruza candidatos atuais de MG com candidaturas e votação nominal de 2022 e 2024.

O processamento usa streaming dos ZIPs/CSVs para evitar MemoryError em arquivos grandes.
Se arquivos históricos estiverem em imports/, eles são priorizados; caso contrário, são
baixados temporariamente do TSE.
"""
import csv, json, re, tempfile, unicodedata, zipfile
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
OFFICIAL=ROOT/'official-data.json'; OUT=ROOT/'election-history.json'; IMPORTS=ROOT/'imports'
UA={'User-Agent':'painel-eleicoes-2026/2.2'}
CAND_URL={
  2022:'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip',
  2024:'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip'
}
VOTE_URL={
  2022:'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip',
  2024:'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip'
}

def norm(v):
    v=unicodedata.normalize('NFKD',str(v or ''))
    return re.sub(r'[^A-Z0-9]+',' ',''.join(c for c in v if not unicodedata.combining(c)).upper()).strip()

def pick(r,*ks):
    for k in ks:
        if r.get(k) not in (None,''):return str(r[k]).strip()
    return ''

def current_db():
    db=json.loads(OFFICIAL.read_text(encoding='utf-8')).get('database',[])
    # Histórico desta rotina é focado em candidatos atuais de Minas Gerais.
    return [x for x in db if norm(x.get('uf'))=='MG']

def current_indexes(current):
    exact=defaultdict(list); loose=defaultdict(list)
    for x in current:
        name=norm(x.get('nomeCompleto')); birth=str(x.get('dataNascimento') or '').strip()
        if not name:continue
        exact[(name,birth)].append(x.get('sqCandidato'))
        loose[name].append(x.get('sqCandidato'))
    return exact,loose

def local_path(year,kind):
    if kind=='cand': return IMPORTS/f'consulta_cand_{year}.zip'
    return IMPORTS/f'votacao_candidato_munzona_{year}.zip'

@contextmanager
def resource(year,kind):
    local=local_path(year,kind)
    if local.exists():
        print(f'{year} {kind}: usando arquivo local {local.name}')
        yield local
        return
    url=CAND_URL[year] if kind=='cand' else VOTE_URL[year]
    print(f'{year} {kind}: baixando recurso oficial do TSE...')
    tmp=tempfile.NamedTemporaryFile(prefix=f'tse_{year}_{kind}_',suffix='.zip',delete=False)
    tmp_path=Path(tmp.name); tmp.close()
    try:
        with requests.get(url,headers=UA,timeout=1200,stream=True) as r:
            r.raise_for_status()
            with tmp_path.open('wb') as f:
                for chunk in r.iter_content(chunk_size=1024*1024):
                    if chunk:f.write(chunk)
        yield tmp_path
    finally:
        try:tmp_path.unlink(missing_ok=True)
        except:pass

def relevant_members(z,year):
    names=[n for n in z.namelist() if n.lower().endswith('.csv')]
    mg=[n for n in names if re.search(fr'_{year}_MG\.csv$',n,re.I)]
    return mg or names

def iter_rows(zip_path,year):
    with zipfile.ZipFile(zip_path) as z:
        members=relevant_members(z,year)
        print(f'{year}: processando {len(members)} CSV(s) relevante(s)')
        for name in members:
            with z.open(name) as raw:
                # Arquivos eleitorais do TSE usam ';' e normalmente Latin-1/Windows-1252.
                import io
                text=io.TextIOWrapper(raw,encoding='latin-1',errors='replace',newline='')
                reader=csv.DictReader(text,delimiter=';')
                for row in reader:
                    yield row

def prior_candidates(year,current):
    exact,loose=current_indexes(current); by_current={}
    with resource(year,'cand') as path:
        for r in iter_rows(path,year):
            full=norm(pick(r,'NM_CANDIDATO','NM_CANDIDATA')); birth=pick(r,'DT_NASCIMENTO')
            if not full:continue
            matches=exact.get((full,birth),[])
            if not matches and len(loose.get(full,[]))==1:matches=loose[full]
            if not matches:continue
            for cur in matches:
                by_current[cur]={'priorSq':pick(r,'SQ_CANDIDATO','SQ_CANDIDATA'),'cargo':pick(r,'DS_CARGO'),'partido':pick(r,'SG_PARTIDO'),
                  'numero':pick(r,'NR_CANDIDATO','NR_CANDIDATA'),'nomeUrna':pick(r,'NM_URNA_CANDIDATO','NM_URNA_CANDIDATA')}
    return by_current

def votes(year,prior):
    wanted={v['priorSq']:k for k,v in prior.items() if v.get('priorSq')}
    totals=defaultdict(int); muni=defaultdict(lambda:defaultdict(int))
    if not wanted:return {}
    with resource(year,'vote') as path:
        for r in iter_rows(path,year):
            if pick(r,'NR_TURNO') not in ('','1'):continue
            cur=wanted.get(pick(r,'SQ_CANDIDATO'))
            if not cur:continue
            try:q=int(float(pick(r,'QT_VOTOS_NOMINAIS','QT_VOTOS') or 0))
            except (TypeError,ValueError):q=0
            totals[cur]+=q
            m=pick(r,'NM_MUNICIPIO')
            if m:muni[cur][m]+=q
    out={}
    for cur,meta in prior.items():
        top=sorted(muni[cur].items(),key=lambda kv:kv[1],reverse=True)[:8]
        out[cur]={**meta,'votos':totals[cur],'topMunicipios':[{'municipio':m,'votos':v} for m,v in top]}
    return out

def main():
    IMPORTS.mkdir(exist_ok=True)
    current=current_db(); result={}; sources={}
    print(f'Histórico: {len(current)} candidatos atuais de MG em análise')
    for year in (2022,2024):
        prior=prior_candidates(year,current); hist=votes(year,prior)
        sources[str(year)]={'candidatos':CAND_URL[year],'votacao':VOTE_URL[year],'scope':'MG'}
        for cur,h in hist.items():result.setdefault(cur,{})[str(year)]=h
        print(f'{year}: {len(hist)} candidaturas históricas localizadas')
    payload={'source':'Tribunal Superior Eleitoral — Dados Abertos','checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
      'years':[2022,2024],'scope':'MG','sources':sources,'byCandidate':result}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'Histórico concluído para {len(result)} candidatos atuais')
if __name__=='__main__':main()
