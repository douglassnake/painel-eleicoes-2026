#!/usr/bin/env python3
"""Cruza candidatos atuais com candidaturas e votação nominal de 2022 e 2024."""
import csv, io, json, re, unicodedata, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
OFFICIAL=ROOT/'official-data.json'; OUT=ROOT/'election-history.json'
UA={'User-Agent':'painel-eleicoes-2026/2.1'}
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

def decode(b):
    for e in ('utf-8-sig','latin-1','cp1252'):
        try:return b.decode(e)
        except UnicodeDecodeError:pass
    return b.decode('latin-1',errors='replace')

def csv_texts(blob):
    if blob[:2]!=b'PK':raise RuntimeError('O TSE não retornou o ZIP esperado')
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for n in z.namelist():
            if n.lower().endswith('.csv'):yield decode(z.read(n))

def rows(text):
    d=';' if text[:10000].count(';')>=text[:10000].count(',') else ','
    return csv.DictReader(io.StringIO(text),delimiter=d)

def pick(r,*ks):
    for k in ks:
        if r.get(k) not in (None,''):return str(r[k]).strip()
    return ''

def download(url,timeout=900):
    r=requests.get(url,headers=UA,timeout=timeout);r.raise_for_status()
    if not r.content:raise RuntimeError(f'Recurso vazio: {url}')
    return r.content

def current_db():
    return json.loads(OFFICIAL.read_text(encoding='utf-8')).get('database',[])

def current_indexes(current):
    exact=defaultdict(list); loose=defaultdict(list)
    for x in current:
        name=norm(x.get('nomeCompleto')); birth=x.get('dataNascimento','')
        if not name:continue
        exact[(name,birth)].append(x.get('sqCandidato'))
        loose[name].append(x.get('sqCandidato'))
    return exact,loose

def prior_candidates(year,current):
    exact,loose=current_indexes(current); by_current={}
    blob=download(CAND_URL[year])
    for txt in csv_texts(blob):
        for r in rows(txt):
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
    blob=download(VOTE_URL[year])
    for txt in csv_texts(blob):
        for r in rows(txt):
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
    current=current_db(); result={}; sources={}
    for year in (2022,2024):
        prior=prior_candidates(year,current); hist=votes(year,prior)
        sources[str(year)]={'candidatos':CAND_URL[year],'votacao':VOTE_URL[year]}
        for cur,h in hist.items():result.setdefault(cur,{})[str(year)]=h
        print(f'{year}: {len(hist)} candidaturas históricas localizadas')
    payload={'source':'Tribunal Superior Eleitoral — Dados Abertos','checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
      'years':[2022,2024],'sources':sources,'byCandidate':result}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'Histórico concluído para {len(result)} candidatos atuais')
if __name__=='__main__':main()
