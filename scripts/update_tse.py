#!/usr/bin/env python3
"""Sincroniza candidatos 2026 e patrimônio declarado com os Dados Abertos do TSE."""
import csv, io, json, re, unicodedata, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
DATA_JS=ROOT/'data.js'; OUT=ROOT/'official-data.json'
DATASET='https://dadosabertos.tse.jus.br/dataset/candidatos-2026'
CAND_URL='https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip'
BENS_URL='https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip'
UA={'User-Agent':'painel-eleicoes-2026/2.1'}

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

def nfloat(v):
    s=str(v or '').strip().replace('.','').replace(',','.')
    try:return float(s)
    except:return 0.0

def monitored_names():
    t=DATA_JS.read_text(encoding='utf-8')
    return sorted(set(re.findall(r"nome:'([^']+)'",t)))

def rec(r):
    return {'nomeUrna':pick(r,'NM_URNA_CANDIDATO','NM_URNA_CANDIDATA'),'nomeCompleto':pick(r,'NM_CANDIDATO','NM_CANDIDATA'),
      'numero':pick(r,'NR_CANDIDATO','NR_CANDIDATA'),'partido':pick(r,'SG_PARTIDO'),'federacao':pick(r,'NM_FEDERACAO','DS_COMPOSICAO_FEDERACAO'),
      'cargo':pick(r,'DS_CARGO'),'uf':pick(r,'SG_UF'),'situacao':pick(r,'DS_SITUACAO_CANDIDATURA','DS_SITUACAO_CANDIDATO','DS_SITUACAO'),
      'detalhe':pick(r,'DS_SITUACAO_CANDIDATO_URNA','DS_DETALHE_SITUACAO_CAND','DS_DETALHE_SITUACAO_CANDIDATURA'),
      'sqCandidato':pick(r,'SQ_CANDIDATO','SQ_CANDIDATA'),'genero':pick(r,'DS_GENERO'),'dataNascimento':pick(r,'DT_NASCIMENTO'),
      'idadePosse':pick(r,'NR_IDADE_DATA_POSSE'),'ocupacao':pick(r,'DS_OCUPACAO'),'instrucao':pick(r,'DS_GRAU_INSTRUCAO'),
      'municipioNascimento':pick(r,'NM_MUNICIPIO_NASCIMENTO'),'ufNascimento':pick(r,'SG_UF_NASCIMENTO'),'corRaca':pick(r,'DS_COR_RACA'),'estadoCivil':pick(r,'DS_ESTADO_CIVIL')}

def in_scope(x):
    c=norm(x['cargo']);uf=norm(x['uf'])
    if 'PRESIDENTE' in c and 'VICE' not in c:return True
    if uf!='MG':return False
    return any(k in c for k in ('GOVERNADOR','SENADOR','DEPUTADO FEDERAL','DEPUTADO ESTADUAL')) and 'VICE' not in c and 'SUPLENTE' not in c

def get(url,timeout=240):
    r=requests.get(url,headers=UA,timeout=timeout);r.raise_for_status()
    if not r.content:raise RuntimeError(f'Recurso vazio: {url}')
    return r.content

def main():
    assets=defaultdict(float);asset_count=defaultdict(int)
    for txt in csv_texts(get(BENS_URL)):
      for r in rows(txt):
        sq=pick(r,'SQ_CANDIDATO','SQ_CANDIDATA')
        if sq:assets[sq]+=nfloat(pick(r,'VR_BEM_CANDIDATO','VR_BEM'));asset_count[sq]+=1
    database=[];total_rows=0
    for txt in csv_texts(get(CAND_URL)):
      for r in rows(txt):
        total_rows+=1;x=rec(r)
        if not in_scope(x):continue
        x['patrimonio']=round(assets.get(x['sqCandidato'],0.0),2);x['qtdBens']=asset_count.get(x['sqCandidato'],0);database.append(x)
    database.sort(key=lambda x:(norm(x['cargo']),norm(x['partido']),norm(x['nomeUrna'] or x['nomeCompleto'])))
    mon=monitored_names();targets={norm(n):n for n in mon};found={}
    for x in database:
      urna,full=norm(x['nomeUrna']),norm(x['nomeCompleto'])
      for k,d in targets.items():
        if k==urna or k==full or (len(k)>=8 and (k in urna or k in full)):
          if d not in found or x['uf']=='MG':found[d]=x
    counts=defaultdict(int)
    for x in database:counts[x['cargo']]+=1
    payload={'source':'Tribunal Superior Eleitoral — Dados Abertos','dataset':DATASET,'candidateResource':CAND_URL,'assetsResource':BENS_URL,
      'checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'rowsRead':total_rows,'databaseCount':len(database),
      'countsByCargo':dict(sorted(counts.items())),'database':database,'matched':len(found),'monitored':len(mon),'candidates':found,'notFound':[n for n in mon if n not in found]}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'TSE: {len(database)} candidatos; patrimônio agregado; {len(found)}/{len(mon)} monitorados')
if __name__=='__main__':main()
