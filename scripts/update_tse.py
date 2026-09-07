#!/usr/bin/env python3
"""Sincroniza candidatos 2026.

Prioridade:
1) arquivos oficiais baixados manualmente em imports/;
2) API DivulgaCand como fallback.
Isso contorna bloqueios HTTP 403 do TSE em acessos automatizados.
"""
import csv, io, json, re, time, unicodedata, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
DATA_JS=ROOT/'data.js'; OUT=ROOT/'official-data.json'; IMPORTS=ROOT/'imports'
DATASET='https://dadosabertos.tse.jus.br/dataset/candidatos-2026'
CAND_FILE=IMPORTS/'consulta_cand_2026.zip'; BENS_FILE=IMPORTS/'bem_candidato_2026.zip'
API='https://divulgacandcontas.tse.jus.br/divulga/rest/v1'; ELECTION_ID='20322002026'
SCOPES=[('BR',1),('MG',3),('MG',5),('MG',6),('MG',7)]
CARGO_FALLBACK={1:'PRESIDENTE',3:'GOVERNADOR',5:'SENADOR',6:'DEPUTADO FEDERAL',7:'DEPUTADO ESTADUAL'}
UA={'User-Agent':'Mozilla/5.0 Chrome/151 Safari/537.36','Accept':'application/json, text/plain, */*','Referer':'https://divulgacandcontas.tse.jus.br/divulga/'}
MISSING={'#NE','#NULO','#N/A','N/A','NA','-1','-3','NULL','NONE'}

# Apelidos do painel que podem diferir do nome de urna/nome civil publicado pelo TSE.
MONITORED_ALIASES={
    'Cleitinho Azevedo':['Cleitinho','Cleiton Gontijo de Azevedo'],
    'Gabriel':['Gabriel Sousa Marques de Azevedo','Gabriel Azevedo'],
    'Ana Luiza do MLB':['Ana Luiza Cardoso de Macedo','Ana Luiza'],
    'Marco Antônio Superman':['Marco Antonio Moreira da Costa','Marco Antonio'],
    'Veterinário Wilson Grassi':['Wilson Grassi'],
    'Augusto Cury':['Escritor Augusto Cury'],
    'Ben Mendes':['Benoni Benjamin Cardoso Mendes'],
    'Professor Túlio Lopes':['Tulio Cesar Dias Lopes'],
    'Rafael Duda':['Rafael Ribeiro de Avila'],
    'Tião Pessoa':['Sebastiao de Oliveira Pessoa'],
    'Victória Mello Vic':['Victoria de Fatima de Mello'],
    'Jordano Metalúrgico':['Jordano Carvalho dos Santos'],
    'Fidélis Alcântara':['Fidelis Oliveira Alcantara'],
    'Juíz Ramon Moreira':['Ramon Moreira'],
    'Manoel Carvalho':['Manoel Teodoro Pereira de Carvalho Filho'],
    'Carlin Moura':['Carlos Magno de Moura Soares'],
}

def norm(v):
    v=unicodedata.normalize('NFKD',str(v or ''))
    return re.sub(r'[^A-Z0-9]+',' ',''.join(c for c in v if not unicodedata.combining(c)).upper()).strip()

def clean(v):
    s=str(v or '').strip()
    return '' if s.upper() in MISSING else s

def monitored_names():
    t=DATA_JS.read_text(encoding='utf-8')
    return sorted(set(re.findall(r"nome:'([^']+)'",t)))

def decode(b):
    for e in ('utf-8-sig','latin-1','cp1252'):
        try:return b.decode(e)
        except UnicodeDecodeError:pass
    return b.decode('latin-1',errors='replace')

def csv_texts(path):
    blob=path.read_bytes()
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
        v=clean(r.get(k))
        if v:return v
    return ''

def nfloat(v):
    s=clean(v)
    if not s:return 0.0
    s=s.replace('.','').replace(',','.')
    try:return float(s)
    except:return 0.0

def iso_from_epoch(v):
    try:return datetime.fromtimestamp(int(v)/1000,timezone.utc).isoformat().replace('+00:00','Z')
    except:return None

def in_scope_csv(r):
    cargo=norm(pick(r,'DS_CARGO')); uf=norm(pick(r,'SG_UF'))
    if cargo=='PRESIDENTE':return True
    if uf!='MG':return False
    return cargo in ('GOVERNADOR','SENADOR','DEPUTADO FEDERAL','DEPUTADO ESTADUAL')

def csv_record(r,assets,asset_count):
    sq=pick(r,'SQ_CANDIDATO','SQ_CANDIDATA')
    return {'nomeUrna':pick(r,'NM_URNA_CANDIDATO','NM_URNA_CANDIDATA'),'nomeCompleto':pick(r,'NM_CANDIDATO','NM_CANDIDATA'),
      'numero':pick(r,'NR_CANDIDATO','NR_CANDIDATA'),'partido':pick(r,'SG_PARTIDO'),'federacao':pick(r,'NM_FEDERACAO','DS_COMPOSICAO_FEDERACAO'),
      'cargo':pick(r,'DS_CARGO'),'uf':pick(r,'SG_UF'),'situacao':pick(r,'DS_SITUACAO_CANDIDATURA','DS_SITUACAO_CANDIDATO','DS_SITUACAO') or 'Não informado',
      'detalhe':pick(r,'DS_SITUACAO_CANDIDATO_URNA','DS_DETALHE_SITUACAO_CAND'),'sqCandidato':sq,'genero':pick(r,'DS_GENERO'),
      'dataNascimento':pick(r,'DT_NASCIMENTO'),'idadePosse':pick(r,'NR_IDADE_DATA_POSSE'),'ocupacao':pick(r,'DS_OCUPACAO'),
      'instrucao':pick(r,'DS_GRAU_INSTRUCAO'),'municipioNascimento':pick(r,'NM_MUNICIPIO_NASCIMENTO'),'ufNascimento':pick(r,'SG_UF_NASCIMENTO'),
      'corRaca':pick(r,'DS_COR_RACA'),'estadoCivil':pick(r,'DS_ESTADO_CIVIL'),'patrimonio':round(assets.get(sq,0.0),2) if sq in assets else None,
      'qtdBens':asset_count.get(sq) if sq in asset_count else None,'fotoUrl':'','ultimaAtualizacao':None,'eleicoesAnteriores':[]}

def asset_key(r,sq):
    return (sq,
            pick(r,'NR_ORDEM_BEM_CANDIDATO','NR_ORDEM_BEM'),
            pick(r,'DS_BEM_CANDIDATO','DS_BEM'),
            clean(r.get('VR_BEM_CANDIDATO') or r.get('VR_BEM')))

def load_local():
    if not CAND_FILE.exists():return None
    assets=defaultdict(float);asset_count=defaultdict(int);seen_assets=set()
    if BENS_FILE.exists():
        for txt in csv_texts(BENS_FILE):
            for r in rows(txt):
                sq=pick(r,'SQ_CANDIDATO','SQ_CANDIDATA')
                if not sq:continue
                key=asset_key(r,sq)
                if key in seen_assets:continue
                seen_assets.add(key)
                valor=clean(r.get('VR_BEM_CANDIDATO') or r.get('VR_BEM'))
                if valor:
                    assets[sq]+=nfloat(valor);asset_count[sq]+=1
    db_by_sq={};read=0
    for txt in csv_texts(CAND_FILE):
        for r in rows(txt):
            read+=1
            if not in_scope_csv(r):continue
            rec=csv_record(r,assets,asset_count);sq=rec.get('sqCandidato')
            if sq:db_by_sq[sq]=rec
    db=list(db_by_sq.values())
    print(f'Arquivos locais TSE: {len(db)} candidatos únicos em escopo; {read} linhas lidas')
    return db,read,'arquivo-local',BENS_FILE.exists()

def val(d,*keys):
    for k in keys:
        v=d.get(k)
        if v not in (None,''):return v
    return None

def api_record(c,uf,cargo_code):
    partido=c.get('partido') or {}; cargo=c.get('cargo') or {}
    return {'nomeUrna':val(c,'nomeUrna','nm_URNA') or '','nomeCompleto':val(c,'nomeCompleto','nm_CANDIDATO') or '',
      'numero':str(val(c,'numero','nr_CANDIDATO') or ''),'partido':val(partido,'sigla') or val(c,'sg_PARTIDO') or '',
      'federacao':val(c,'nomeColigacao') or '','cargo':val(cargo,'nome') or val(c,'ds_CARGO') or CARGO_FALLBACK[cargo_code],
      'uf':val(c,'ufCandidatura') or uf,'situacao':val(c,'descricaoSituacao','descricaoSituacaoCandidato','situacaoCandidato','stRegistro') or 'Não informado',
      'detalhe':val(c,'descricaoTotalizacao') or '','sqCandidato':str(val(c,'id','sq_CANDIDATO') or ''),'genero':val(c,'descricaoSexo') or '',
      'dataNascimento':iso_from_epoch(val(c,'dataDeNascimento')),'idadePosse':None,'ocupacao':val(c,'ocupacao') or '',
      'instrucao':val(c,'grauInstrucao') or '','municipioNascimento':val(c,'nomeMunicipioNascimento') or '','ufNascimento':val(c,'sgUfNascimento') or '',
      'corRaca':val(c,'descricaoCorRaca') or '','estadoCivil':val(c,'descricaoEstadoCivil') or '','patrimonio':None,'qtdBens':None,
      'fotoUrl':val(c,'fotoUrl') or '','ultimaAtualizacao':iso_from_epoch(val(c,'dataUltimaAtualizacao')),'eleicoesAnteriores':[]}

def load_api():
    s=requests.Session();s.headers.update(UA);db_by_sq={};errors=[]
    for uf,cargo in SCOPES:
        url=f'{API}/candidatura/listar/2026/{uf}/{ELECTION_ID}/{cargo}/candidatos'
        try:
            r=s.get(url,timeout=40);r.raise_for_status();p=r.json();cand=p.get('candidatos',[]) if isinstance(p,dict) else []
            for c in cand:
                rec=api_record(c,uf,cargo);sq=rec.get('sqCandidato')
                if sq:db_by_sq[sq]=rec
            print(f'{uf}/{cargo}: {len(cand)} candidatos')
        except Exception as e:errors.append(f'{uf}/{cargo}: {e}');print('ERRO',errors[-1])
        time.sleep(.2)
    if not db_by_sq:raise RuntimeError('TSE bloqueou a API e não há arquivo local em imports/')
    db=list(db_by_sq.values())
    return db,len(db),'api',False

def names_for_target(display):
    vals=[display,*MONITORED_ALIASES.get(display,[])]
    return [norm(v) for v in vals if norm(v)]

def match_monitored(database,names):
    found={}
    for display in names:
        keys=names_for_target(display)
        candidates=[]
        for x in database:
            urna,full=norm(x.get('nomeUrna')),norm(x.get('nomeCompleto'))
            score=0
            for k in keys:
                if k==urna or k==full:score=max(score,4)
                elif len(k)>=8 and (k in urna or k in full):score=max(score,3)
                elif len(urna)>=8 and urna in k:score=max(score,2)
            if score:candidates.append((score,x))
        if candidates:
            candidates.sort(key=lambda p:(p[0],1 if norm(p[1].get('uf'))=='MG' else 0),reverse=True)
            found[display]=candidates[0][1]
    return found

def main():
    IMPORTS.mkdir(exist_ok=True)
    loaded=load_local()
    if loaded is None:loaded=load_api()
    database,rows_read,mode,assets_ok=loaded
    database.sort(key=lambda x:(norm(x['cargo']),norm(x['partido']),norm(x['nomeUrna'] or x['nomeCompleto'])))
    names=monitored_names();found=match_monitored(database,names);counts=defaultdict(int)
    for x in database:counts[x['cargo']]+=1
    not_found=[n for n in names if n not in found]
    payload={'source':'Tribunal Superior Eleitoral — Dados Abertos/DivulgaCand','dataset':DATASET,'checkedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
      'syncMode':mode,'rowsRead':rows_read,'databaseCount':len(database),'countsByCargo':dict(sorted(counts.items())),'database':database,
      'matched':len(found),'monitored':len(names),'candidates':found,'notFound':not_found,
      'syncStatus':'ok','assetsSyncStatus':'ok' if assets_ok else 'indisponivel'}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'Banco gerado: {len(database)} candidatos únicos; {len(found)}/{len(names)} monitorados; modo={mode}')
    if not_found:print('Monitorados não localizados:', ' | '.join(not_found))
if __name__=='__main__':main()
