#!/usr/bin/env python3
"""Cruza os candidatos atuais com candidaturas/votações de 2022 e 2024."""
import csv, io, json, re, unicodedata, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
OFFICIAL=ROOT/'official-data.json'; OUT=ROOT/'election-history.json'
API='https://dadosabertos.tse.jus.br/api/3/action/package_show?id='
UA={'User-Agent':'painel-eleicoes-2026/2.0'}

def norm(v):
    v=unicodedata.normalize('NFKD',str(v or ''))
    return re.sub(r'[^A-Z0-9]+',' ',''.join(c for c in v if not unicodedata.combining(c)).upper()).strip()

def decode(b):
    for e in ('utf-8-sig','latin-1','cp1252'):
        try:return b.decode(e)
        except UnicodeDecodeError:pass
    return b.decode('latin-1',errors='replace')

def csv_texts(blob):
    if blob[:2]==b'PK':
      with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for n in z.namelist():
          if n.lower().endswith('.csv'):yield decode(z.read(n))
    else:yield decode(blob)

def rows(text):
    d=';' if text[:10000].count(';')>=text[:10000].count(',') else ','
    return csv.DictReader(io.StringIO(text),delimiter=d)

def pick(r,*ks):
    for k in ks:
      if r.get(k) not in (None,''):return str(r[k]).strip()
    return ''

def resource(package,need,exclude=()):
    rs=requests.get(API+package,headers=UA,timeout=40).json()['result']['resources']
    for x in rs:
      label=norm((x.get('name') or '')+' '+(x.get('description') or ''))
      if all(norm(n) in label for n in need) and not any(norm(e) in label for e in exclude):return x['url']
    raise RuntimeError(f'Recurso não localizado em {package}: {need}')

def download(url,timeout=300):
    r=requests.get(url,headers=UA,timeout=timeout);r.raise_for_status();return r.content

def current_keys():
    o=json.loads(OFFICIAL.read_text(encoding='utf-8'))
    db=o.get('database',[])
    keys={}
    for x in db:
      name=norm(x.get('nomeCompleto')); birth=x.get('dataNascimento','')
      if name: keys[(name,birth)]=x.get('sqCandidato')
    return db,keys

def prior_candidates(year,current):
    url=resource(f'candidatos-{year}',('CANDIDATOS',),('COMPLEMENT','BENS','COLIG'))
    blob=download(url)
    by_current={}
    loose={norm(x.get('nomeCompleto')):x.get('sqCandidato') for x in current if x.get('nomeCompleto')}
    for txt in csv_texts(blob):
      for r in rows(txt):
        full=norm(pick(r,'NM_CANDIDATO','NM_CANDIDATA')); birth=pick(r,'DT_NASCIMENTO')
        cur=None
        for x in current:
          if norm(x.get('nomeCompleto'))==full and (not birth or not x.get('dataNascimento') or x.get('dataNascimento')==birth):
            cur=x.get('sqCandidato');break
        if not cur and full in loose:cur=loose[full]
        if cur:
          by_current[cur]={'priorSq':pick(r,'SQ_CANDIDATO','SQ_CANDIDATA'),'cargo':pick(r,'DS_CARGO'),'partido':pick(r,'SG_PARTIDO'),
                           'numero':pick(r,'NR_CANDIDATO','NR_CANDIDATA'),'nomeUrna':pick(r,'NM_URNA_CANDIDATO','NM_URNA_CANDIDATA')}
    return by_current,url

def votes(year,prior):
    url=resource(f'resultados-{year}',('VOTACAO','NOMINAL','MUNICIPIO','ZONA'))
    wanted={v['priorSq']:k for k,v in prior.items() if v.get('priorSq')}
    totals=defaultdict(int); muni=defaultdict(lambda:defaultdict(int))
    blob=download(url,600)
    for txt in csv_texts(blob):
      for r in rows(txt):
        if pick(r,'NR_TURNO') not in ('','1'):continue
        sq=pick(r,'SQ_CANDIDATO')
        cur=wanted.get(sq)
        if not cur:continue
        try:q=int(float(pick(r,'QT_VOTOS_NOMINAIS','QT_VOTOS') or 0))
        except:q=0
        totals[cur]+=q
        m=pick(r,'NM_MUNICIPIO')
        if m:muni[cur][m]+=q
    out={}
    for cur,meta in prior.items():
      top=sorted(muni[cur].items(),key=lambda kv:kv[1],reverse=True)[:8]
      out[cur]={**meta,'votos':totals[cur],'topMunicipios':[{'municipio':m,'votos':v} for m,v in top]}
    return out,url

def main():
    current,_=current_keys(); result={}; sources={}
    for year in (2022,2024):
      prior,curl=prior_candidates(year,current)
      hist,vurl=votes(year,prior)
      sources[str(year)]={'candidatos':curl,'votacao':vurl}
      for cur,h in hist.items():result.setdefault(cur,{})[str(year)]=h
      print(year,len(hist),'históricos localizados')
    payload={'source':'Tribunal Superior Eleitoral — Dados Abertos','checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
             'years':[2022,2024],'sources':sources,'byCandidate':result}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
if __name__=='__main__':main()
