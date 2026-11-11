#!/usr/bin/env python3
"""Diagnose official TSE archive formats without committing raw voter/candidate datasets."""
from __future__ import annotations
import csv, io, os, pathlib, re, sys, tempfile, urllib.request, zipfile

YEARS=(2004,2024)
KINDS=("consulta_cand","votacao_candidato_munzona")
BASE="https://cdn.tse.jus.br/estatistica/sead/odsele"
TARGETS=("GUARDA-MOR","VAZANTE","PARACATU")

def run():
    for year in YEARS:
        for kind in KINDS:
            url=f"{BASE}/{kind}/{kind}_{year}.zip"
            print(f"BEGIN {year} {kind}: {url}",flush=True)
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ElectoralDataAudit/1.0)"})
                with urllib.request.urlopen(req,timeout=45) as response, tempfile.TemporaryFile() as store:
                    total=0
                    while True:
                        block=response.read(2**20)
                        if not block:break
                        total+=len(block)
                        if total>800*2**20: raise RuntimeError("Archive too large for diagnostic (>800 MiB)")
                        store.write(block)
                    store.seek(0)
                    print("ARCHIVE_BYTES",total,flush=True)
                    with zipfile.ZipFile(store) as z:
                        files=[i for i in z.infolist() if i.filename.lower().endswith(".csv")]
                        print("CSV_FILES",len(files),"MG",[(f.filename,f.file_size) for f in files if re.search(r"_MG\.csv$",f.filename,re.I)][:4],"SAMPLE",[(f.filename,f.file_size) for f in files[:3]],flush=True)
                        matches=[f for f in files if re.search(r"_MG\.csv$",f.filename,re.I)]
                        if not matches: matches=files[:1]
                        for entry in matches[:1]:
                            with z.open(entry) as raw:
                                txt=io.TextIOWrapper(raw,encoding="latin-1",errors="replace",newline="")
                                reader=csv.DictReader(txt,delimiter=";")
                                print("HEADERS",list(reader.fieldnames or ()),flush=True)
                                found=0
                                for index,row in enumerate(reader):
                                    mun=str(row.get("NM_MUNICIPIO",row.get("NM_MUNICIPIO_CANDIDATURA", ""))).upper()
                                    if any(t in mun for t in TARGETS):
                                        print("MATCH",year,kind,index,
                                              {k:row.get(k) for k in ("SG_UF","NM_MUNICIPIO","SG_UE","CD_MUNICIPIO","CD_MUNICIPIO_IBGE","NR_TURNO","DS_CARGO","CD_CARGO","NR_CANDIDATO","NM_URNA_CANDIDATO","SQ_CANDIDATO","QT_VOTOS_NOMINAIS","DS_SIT_TOT_TURNO","DS_SITUACAO_CANDIDATURA","SG_PARTIDO") if k in row},flush=True)
                                        found+=1
                                        if found>=3: break
                                    if index>6000000: break
                                print("SAMPLE_MATCH_COUNT",found,flush=True)
            except Exception as exc:
                print("DIAGNOSTIC_FAILED",year,kind,type(exc).__name__,str(exc)[:280],flush=True)
                raise
    print("SOURCE_DIAGNOSTIC_COMPLETE",flush=True)

if __name__=="__main__":run()
