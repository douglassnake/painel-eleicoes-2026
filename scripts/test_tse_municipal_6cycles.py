#!/usr/bin/env python3
"""Unit tests for official historical TSE importer without network access."""
import csv
import hashlib
import importlib.util
import io
import json
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import patch

root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("tse_importer",root/"import_tse_municipal_6cycles.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def make_zip(kind,year):
    buffer=io.BytesIO()
    cols=["SG_UF","SG_UE","NM_UE","CD_MUNICIPIO","NM_MUNICIPIO",
          "NR_TURNO","CD_TIPO_ELEICAO","DS_ELEICAO","CD_CARGO","DS_CARGO",
          "SQ_CANDIDATO","NR_CANDIDATO","NM_CANDIDATO","NM_URNA_CANDIDATO",
          "SG_PARTIDO","DS_SIT_TOT_TURNO","QT_VOTOS_NOMINAIS","QT_VOTOS_NOMINAIS_VALIDOS",
          "NR_ZONA","DS_GENERO","DS_GRAU_INSTRUCAO","NR_CPF_CANDIDATO","NM_EMAIL"]
    output=io.StringIO()
    writer=csv.DictWriter(output,fieldnames=cols,delimiter=";",lineterminator="\n")
    writer.writeheader()
    for code,city in mod.MUNICIPALITIES.items():
        for sq,office,ballot,valid,status in (
            (1,"11","PREFEITA EXEMPLO",100,"ELEITO"),
            (2,"11","OPONENTE EXEMPLO",50,"NÃO ELEITO"),
            (3,"13","VEREADORA EXEMPLO",35,"ELEITO POR MÉDIA"),
            (4,"13","SUPLENTE EXEMPLO",40,"SUPLENTE")
        ):
            writer.writerow({
                "SG_UF":"MG","SG_UE":code,"NM_UE":city["name"],"CD_MUNICIPIO":code,
                "NM_MUNICIPIO":city["name"],"NR_TURNO":"1","CD_TIPO_ELEICAO":"1",
                "DS_ELEICAO":"Eleições Municipais","CD_CARGO":office,
                "DS_CARGO":"Prefeito" if office=="11" else "Vereador",
                "SQ_CANDIDATO":str(sq),"NR_CANDIDATO":str(100+sq),
                "NM_CANDIDATO":ballot,"NM_URNA_CANDIDATO":ballot,
                "SG_PARTIDO":"PART","DS_SIT_TOT_TURNO":status,
                "QT_VOTOS_NOMINAIS":valid,"QT_VOTOS_NOMINAIS_VALIDOS":valid,
                "NR_ZONA":1,"DS_GENERO":"FEMININO","DS_GRAU_INSTRUCAO":"SUPERIOR COMPLETO",
                "NR_CPF_CANDIDATO":"12345678901","NM_EMAIL":"not-exported@example.org"
            })
    with zipfile.ZipFile(buffer,"w",zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{kind}_{year}_MG.csv",output.getvalue().encode("latin-1"))
    return buffer.getvalue()

def fake_download(kind,year):
    data=make_zip(kind,year)
    store=tempfile.TemporaryFile()
    store.write(data)
    store.seek(0)
    return store,{"url":mod.get_url(kind,year),"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)}

def main():
    assert mod.ordinary({"NR_TURNO":"1","CD_TIPO_ELEICAO":"1"})
    assert not mod.ordinary({"NR_TURNO":"2","CD_TIPO_ELEICAO":"1"})
    assert not mod.ordinary({"NR_TURNO":"1","CD_TIPO_ELEICAO":"2"})
    assert mod.norm("Guarda-Mor")=="GUARDAMOR"
    assert mod.city_code({"SG_UF":"MG","SG_UE":"45713","NM_UE":"Guarda-Mor"})=="45713"
    assert mod.elected("ELEITO POR MÉDIA")
    assert not mod.elected("NÃO ELEITO")
    try:
        mod.int_or_zero("-1")
        assert False,"Negative values must be rejected"
    except ValueError:
        pass
    with tempfile.TemporaryDirectory() as temp:
        with patch.object(mod,"download",side_effect=fake_download):
            for year in mod.YEARS:
                obj=mod.extract(year,temp)
                assert len(obj["municipalities"])==3
                for city in obj["municipalities"]:
                    assert city["audit"]["eligibleForSummary"]
                    assert city["audit"]["electedMayors"]==1
                    assert city["audit"]["electedCouncil"]==1
                    assert city["audit"]["candidates"]==4
                    for cand in city["candidates"]:
                        assert "NR_CPF_CANDIDATO" not in cand
                        assert "NM_EMAIL" not in cand
                        assert "DT_NASCIMENTO" not in cand
        spec2=importlib.util.spec_from_file_location("tse_analysis",root/"analyze_tse_municipal_6cycles.py")
        analysis=importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(analysis)
        result=analysis.study(temp)
        assert len(result["municipalities"])==3
        for city in result["municipalities"]:
            assert len(city["cycles"])==6
            assert city["historicalPatterns"]["councilNonElectedOutpolledElectedCycles"]==6
            assert city["cycles"][0]["mayor"]["shareValidPct"]==66.67
    print("UNIT_TEST_OK all six TSE fixture years, office statuses, votes, candidate privacy and analytic model")

if __name__=="__main__":main()
