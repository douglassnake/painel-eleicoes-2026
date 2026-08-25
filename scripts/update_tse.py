#!/usr/bin/env python3
"""Sincroniza o banco 2026 via API oficial DivulgaCandContas do TSE.

O CDN de Dados Abertos bloqueia alguns IPs de GitHub Actions (HTTP 403).
Por isso a carga principal usa a API REST consumida pelo próprio DivulgaCand.
A lista completa é carregada para MG + Presidência; detalhes e bens são
consultados apenas para o conjunto monitorado, evitando sobrecarga no TSE.
"""
import json, re, time, unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
DATA_JS=ROOT/'data.js'; OUT=ROOT/'official-data.json'
DATASET='https://dadosabertos.tse.jus.br/dataset/candidatos-2026'
API='https://divulgacandcontas.tse.jus.br/divulga/rest/v1'
ELECTION_ID='20322002026'
SCOPES=[('BR',1),('MG',3),('MG',5),('MG',6),('MG',7)]
CARGO_FALLBACK={1:'PRESIDENTE',3:'GOVERNADOR',5:'SENADOR',6:'DEPUTADO FEDERAL',7:'DEPUTADO ESTADUAL'}
UA={
 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
 'Accept':'application/json, text/plain, */*',
 'Referer':'https://divulgacandcontas.tse.jus.br/divulga/'
}

def norm(v):
    v=unicodedata.normalize('NFKD',str(v or ''))
    return re.sub(r'[^A-Z0-9]+',' ',''.join(c for c in v if not unicodedata.combining(c)).upper()).strip()

def monitored_names():
    t=DATA_JS.read_text(encoding='utf-8')
    return sorted(set(re.findall(r"nome:'([^']+)'",t)))

def iso_from_epoch(v):
    try:return datetime.fromtimestamp(int(v)/1000,timezone.utc).isoformat().replace('+00:00','Z')
    except:return None

def session():
    s=requests.Session();s.headers.update(UA);return s

def get_json(s,url,tries=4):
    last=None
    for i in range(tries):
        try:
            r=s.get(url,timeout=90,allow_redirects=True)
            if r.status_code==429:
                time.sleep(2.0*(i+1));continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last=e
            time.sleep(0.8*(i+1))
    raise RuntimeError(f'Falha ao consultar {url}: {last}')

def list_url(uf,cargo):
    return f'{API}/candidatura/listar/2026/{uf}/{ELECTION_ID}/{cargo}/candidatos'

def detail_url(uf,candidate_id):
    return f'{API}/candidatura/buscar/2026/{uf}/{ELECTION_ID}/candidato/{candidate_id}'

def val(d,*keys):
    for k in keys:
        v=d.get(k)
        if v not in (None,''):return v
    return None

def record(c,uf,cargo_code):
    partido=c.get('partido') or {}; cargo=c.get('cargo') or {}
    return {
      'nomeUrna':val(c,'nomeUrna','nm_URNA') or '',
      'nomeCompleto':val(c,'nomeCompleto','nm_CANDIDATO') or '',
      'numero':str(val(c,'numero','nr_CANDIDATO') or ''),
      'partido':val(partido,'sigla') or val(c,'sg_PARTIDO') or '',
      'federacao':val(c,'nomeColigacao') or '',
      'cargo':val(cargo,'nome') or val(c,'ds_CARGO') or CARGO_FALLBACK[cargo_code],
      'uf':val(c,'ufCandidatura') or uf,
      'situacao':val(c,'descricaoSituacao','descricaoSituacaoCandidato','situacaoCandidato','stRegistro') or 'Não informado',
      'detalhe':val(c,'descricaoTotalizacao') or '',
      'sqCandidato':str(val(c,'id','sq_CANDIDATO') or ''),
      'genero':val(c,'descricaoSexo') or '',
      'dataNascimento':iso_from_epoch(val(c,'dataDeNascimento')),
      'idadePosse':None,
      'ocupacao':val(c,'ocupacao') or '',
      'instrucao':val(c,'grauInstrucao') or '',
      'municipioNascimento':val(c,'nomeMunicipioNascimento') or '',
      'ufNascimento':val(c,'sgUfNascimento') or '',
      'corRaca':val(c,'descricaoCorRaca') or '',
      'estadoCivil':val(c,'descricaoEstadoCivil') or '',
      'patrimonio':None,'qtdBens':None,'fotoUrl':val(c,'fotoUrl') or '',
      'ultimaAtualizacao':iso_from_epoch(val(c,'dataUltimaAtualizacao')),
      'eleicoesAnteriores':[]
    }

def enrich(rec,d):
    rec.update({
      'genero':val(d,'descricaoSexo') or rec['genero'],
      'ocupacao':val(d,'ocupacao') or rec['ocupacao'],
      'instrucao':val(d,'grauInstrucao') or rec['instrucao'],
      'municipioNascimento':val(d,'nomeMunicipioNascimento') or rec['municipioNascimento'],
      'ufNascimento':val(d,'sgUfNascimento') or rec['ufNascimento'],
      'corRaca':val(d,'descricaoCorRaca') or rec['corRaca'],
      'estadoCivil':val(d,'descricaoEstadoCivil') or rec['estadoCivil'],
      'fotoUrl':val(d,'fotoUrl') or rec['fotoUrl'],
      'detalhe':val(d,'descricaoTotalizacao') or rec['detalhe'],
      'situacao':val(d,'descricaoSituacao','descricaoSituacaoCandidato') or rec['situacao'],
    })
    bens=d.get('bens') or []
    total=d.get('totalDeBens')
    if total is None and bens:
        try:total=sum(float(b.get('valor') or 0) for b in bens)
        except:total=None
    rec['patrimonio']=round(float(total),2) if total is not None else None
    rec['qtdBens']=len(bens) if isinstance(bens,list) else None
    rec['eleicoesAnteriores']=d.get('eleicoesAnteriores') or []
    rec['reeleicao']=d.get('st_REELEICAO')
    rec['cnpjCampanha']=d.get('cnpjcampanha')
    return rec

def match_monitored(database,names):
    targets={norm(n):n for n in names};found={}
    for x in database:
        urna,full=norm(x['nomeUrna']),norm(x['nomeCompleto'])
        for k,display in targets.items():
            if k==urna or k==full or (len(k)>=8 and (k in urna or k in full)):
                if display not in found or x['uf']=='MG':found[display]=x
    return found

def main():
    s=session();database=[];errors=[]
    for uf,cargo in SCOPES:
        try:
            payload=get_json(s,list_url(uf,cargo))
            cand=payload.get('candidatos',[]) if isinstance(payload,dict) else []
            database.extend(record(c,uf,cargo) for c in cand)
            print(f'{uf}/{cargo}: {len(cand)} candidatos')
        except Exception as e:
            errors.append(f'{uf}/{cargo}: {e}')
            print('ERRO',errors[-1])
        time.sleep(.35)
    if not database:
        raise RuntimeError('Nenhuma lista de candidatos pôde ser carregada pela API do DivulgaCand')

    names=monitored_names();found=match_monitored(database,names)
    # Detalhes/bens somente do conjunto monitorado: reduz carga e risco de bloqueio.
    enriched=0
    for display,x in list(found.items()):
        if not x.get('sqCandidato'):continue
        try:
            d=get_json(s,detail_url(x['uf'] or 'MG',x['sqCandidato']),tries=3)
            enrich(x,d);enriched+=1
        except Exception as e:
            errors.append(f'detalhe {display}: {e}')
        time.sleep(.18)

    database.sort(key=lambda x:(norm(x['cargo']),norm(x['partido']),norm(x['nomeUrna'] or x['nomeCompleto'])))
    counts=defaultdict(int)
    for x in database:counts[x['cargo']]+=1
    payload={
      'source':'Tribunal Superior Eleitoral — DivulgaCandContas','dataset':DATASET,'apiBase':API,'electionId':ELECTION_ID,
      'checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'databaseCount':len(database),
      'countsByCargo':dict(sorted(counts.items())),'database':database,'matched':len(found),'monitored':len(names),
      'enrichedMonitored':enriched,'candidates':found,'notFound':[n for n in names if n not in found],
      'syncStatus':'ok' if not errors else 'partial','assetsSyncStatus':'monitorados','errors':errors[:30]
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'DivulgaCand: {len(database)} candidatos; {len(found)}/{len(names)} monitorados; {enriched} detalhados; erros={len(errors)}')
if __name__=='__main__':main()
