#!/usr/bin/env python3
"""Gera base nacional de candidatos a governador a partir dos arquivos oficiais do TSE."""
import csv, io, json, re, unicodedata, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
IMPORTS=ROOT/'imports'
CAND=IMPORTS/'consulta_cand_2026.zip'
BENS=IMPORTS/'bem_candidato_2026.zip'
OUT=ROOT/'governadores-data.json'
DATASET='https://dadosabertos.tse.jus.br/dataset/candidatos-2026'

MISSING={'#NE','#NULO','#N/A','N/A','NA','-1','-3','NULL','NONE'}

def norm(v):
    v=unicodedata.normalize('NFKD',str(v or ''))
    return re.sub(r'[^A-Z0-9]+',' ',''.join(c for c in v if not unicodedata.combining(c)).upper()).strip()

def clean(v):
    s=str(v or '').strip()
    return '' if s.upper() in MISSING else s

def decode(b):
    for enc in ('utf-8-sig','latin-1','cp1252'):
        try:return b.decode(enc)
        except UnicodeDecodeError:pass
    return b.decode('latin-1',errors='replace')

def csv_texts(path):
    blob=path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for name in z.namelist():
            if name.lower().endswith('.csv'):
                yield decode(z.read(name))

def rows(text):
    d=';' if text[:10000].count(';')>=text[:10000].count(',') else ','
    return csv.DictReader(io.StringIO(text),delimiter=d)

def pick(r,*keys):
    for k in keys:
        v=clean(r.get(k))
        if v:return v
    return ''

def nfloat(v):
    s=clean(v)
    if not s:return 0.0
    s=s.replace('.','').replace(',','.')
    try:return float(s)
    except:return 0.0

def main():
    if not CAND.exists():
        raise SystemExit('Arquivo imports/consulta_cand_2026.zip não encontrado')

    assets=defaultdict(float); qtd=defaultdict(int)
    if BENS.exists():
        for txt in csv_texts(BENS):
            for r in rows(txt):
                sq=pick(r,'SQ_CANDIDATO','SQ_CANDIDATA')
                if sq:
                    valor=clean(r.get('VR_BEM_CANDIDATO') or r.get('VR_BEM'))
                    if valor:
                        assets[sq]+=nfloat(valor);qtd[sq]+=1

    # O ZIP do TSE pode conter arquivos consolidados e arquivos por UF.
    # SQ_CANDIDATO é a chave oficial usada para eliminar registros repetidos.
    governors_by_sq={}
    for txt in csv_texts(CAND):
        for r in rows(txt):
            if norm(pick(r,'DS_CARGO'))!='GOVERNADOR':continue
            sq=pick(r,'SQ_CANDIDATO','SQ_CANDIDATA')
            if not sq:continue
            situacao=pick(r,'DS_SITUACAO_CANDIDATURA','DS_SITUACAO_CANDIDATO','DS_SITUACAO')
            federacao=pick(r,'NM_FEDERACAO','DS_COMPOSICAO_FEDERACAO')
            governors_by_sq[sq]={
                'uf':pick(r,'SG_UF'),
                'nomeUrna':pick(r,'NM_URNA_CANDIDATO','NM_URNA_CANDIDATA'),
                'nomeCompleto':pick(r,'NM_CANDIDATO','NM_CANDIDATA'),
                'numero':pick(r,'NR_CANDIDATO','NR_CANDIDATA'),
                'partido':pick(r,'SG_PARTIDO'),
                'federacao':federacao,
                'situacao':situacao or 'Não informado',
                'detalhe':pick(r,'DS_SITUACAO_CANDIDATO_URNA','DS_DETALHE_SITUACAO_CAND'),
                'sqCandidato':sq,
                'genero':pick(r,'DS_GENERO'),
                'ocupacao':pick(r,'DS_OCUPACAO'),
                'patrimonio':round(assets[sq],2) if sq in assets else None,
                'qtdBens':qtd.get(sq)
            }

    governors=list(governors_by_sq.values())
    governors.sort(key=lambda x:(x['uf'], norm(x['nomeUrna'] or x['nomeCompleto'])))
    by_uf=defaultdict(int)
    for x in governors:by_uf[x['uf']]+=1
    payload={
        'source':'Tribunal Superior Eleitoral — Dados Abertos',
        'dataset':DATASET,
        'checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
        'count':len(governors),
        'countsByUF':dict(sorted(by_uf.items())),
        'candidates':governors
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'Governadores: {len(governors)} candidaturas únicas em {len(by_uf)} UFs')

if __name__=='__main__':main()
