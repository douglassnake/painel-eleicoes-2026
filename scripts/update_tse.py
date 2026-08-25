#!/usr/bin/env python3
"""Sincroniza o banco oficial do painel com Candidatos 2026 do TSE.

Escopo público do dashboard:
- todos os candidatos a Presidente;
- todos os candidatos de MG a Governador, Senador, Deputado Federal e Deputado Estadual;
- destaque adicional para os nomes monitorados no data.js.
"""
import csv
import io
import json
import re
import unicodedata
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_JS = ROOT / "data.js"
OUT = ROOT / "official-data.json"
DATASET_URL = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026"
RESOURCE_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip"
TARGET_CARGOS = {
    "PRESIDENTE",
    "GOVERNADOR",
    "SENADOR",
    "DEPUTADO FEDERAL",
    "DEPUTADO ESTADUAL",
}


def norm(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def monitored_names():
    text = DATA_JS.read_text(encoding="utf-8")
    return sorted(set(re.findall(r"nome:'([^']+)'", text)))


def decode_bytes(blob):
    for enc in ("utf-8-sig", "latin-1", "cp1252"):
        try:
            return blob.decode(enc)
        except UnicodeDecodeError:
            pass
    return blob.decode("latin-1", errors="replace")


def csv_texts(blob):
    if blob[:2] != b"PK":
        raise RuntimeError("O recurso do TSE não retornou o ZIP esperado")
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        for name in zf.namelist():
            if name.lower().endswith(".csv"):
                yield name, decode_bytes(zf.read(name))


def parse_rows(text):
    sample = text[:10000]
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","
    return csv.DictReader(io.StringIO(text), delimiter=delimiter)


def pick(row, *keys):
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return str(row[key]).strip()
    return ""


def to_int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def make_record(row):
    return {
        "nomeUrna": pick(row, "NM_URNA_CANDIDATO", "NM_URNA_CANDIDATA"),
        "nomeCompleto": pick(row, "NM_CANDIDATO", "NM_CANDIDATA"),
        "numero": pick(row, "NR_CANDIDATO", "NR_CANDIDATA"),
        "partido": pick(row, "SG_PARTIDO"),
        "federacao": pick(row, "NM_FEDERACAO", "SG_FEDERACAO"),
        "cargo": pick(row, "DS_CARGO"),
        "uf": pick(row, "SG_UF"),
        "situacao": pick(row, "DS_SITUACAO_CANDIDATURA", "DS_SITUACAO_CANDIDATO", "DS_SITUACAO"),
        "detalhe": pick(row, "DS_SITUACAO_CANDIDATO_URNA", "DS_DETALHE_SITUACAO_CAND", "DS_DETALHE_SITUACAO_CANDIDATURA"),
        "sqCandidato": pick(row, "SQ_CANDIDATO", "SQ_CANDIDATA"),
        "genero": pick(row, "DS_GENERO"),
        "dataNascimento": pick(row, "DT_NASCIMENTO"),
        "idadePosse": to_int(pick(row, "NR_IDADE_DATA_POSSE")),
        "ocupacao": pick(row, "DS_OCUPACAO"),
        "grauInstrucao": pick(row, "DS_GRAU_INSTRUCAO"),
        "municipioNascimento": pick(row, "NM_MUNICIPIO_NASCIMENTO"),
        "ufNascimento": pick(row, "SG_UF_NASCIMENTO"),
        "corRaca": pick(row, "DS_COR_RACA"),
        "estadoCivil": pick(row, "DS_ESTADO_CIVIL"),
    }


def in_scope(rec):
    cargo = norm(rec["cargo"])
    uf = norm(rec["uf"])
    if cargo not in TARGET_CARGOS:
        return False
    if cargo == "PRESIDENTE":
        return True
    return uf == "MG"


def candidate_key(rec):
    return rec["sqCandidato"] or "|".join([
        norm(rec["uf"]), norm(rec["cargo"]), rec["numero"], norm(rec["nomeCompleto"] or rec["nomeUrna"])
    ])


def match_score(key, rec):
    urna = norm(rec["nomeUrna"])
    full = norm(rec["nomeCompleto"])
    if key == urna or key == full:
        score = 100
    elif len(key) >= 8 and (key in urna or key in full):
        score = 60
    else:
        return -1
    if norm(rec["uf"]) == "MG":
        score += 5
    if norm(rec["cargo"]) == "PRESIDENTE":
        score += 4
    return score


def main():
    names = monitored_names()
    targets = {norm(n): n for n in names}
    response = requests.get(RESOURCE_URL, timeout=180, headers={"User-Agent": "painel-eleicoes-2026/2.0"})
    response.raise_for_status()

    found = {}
    scores = {}
    database = {}
    all_rows = 0

    for _, text in csv_texts(response.content):
        for row in parse_rows(text):
            all_rows += 1
            rec = make_record(row)
            if not rec["nomeUrna"] and not rec["nomeCompleto"]:
                continue

            if in_scope(rec):
                database[candidate_key(rec)] = rec

            for key, display in targets.items():
                score = match_score(key, rec)
                if score > scores.get(display, -1):
                    scores[display] = score
                    found[display] = rec

    records = sorted(
        database.values(),
        key=lambda x: (norm(x["cargo"]), norm(x["partido"]), norm(x["nomeUrna"] or x["nomeCompleto"]))
    )
    cargo_counts = Counter(r["cargo"] or "Não informado" for r in records)
    party_counts = Counter(r["partido"] or "Não informado" for r in records)

    payload = {
        "source": "Tribunal Superior Eleitoral — Dados Abertos, Candidatos 2026",
        "dataset": DATASET_URL,
        "resource": RESOURCE_URL,
        "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "rowsRead": all_rows,
        "scope": "Presidência nacional + Governador, Senado, Deputado Federal e Deputado Estadual em Minas Gerais",
        "totalCandidates": len(records),
        "countsByCargo": dict(sorted(cargo_counts.items())),
        "countsByParty": dict(sorted(party_counts.items())),
        "database": records,
        "matched": len(found),
        "monitored": len(names),
        "candidates": found,
        "notFound": [name for name in names if name not in found],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"TSE: banco com {len(records)} candidaturas no escopo; "
        f"{len(found)}/{len(names)} nomes monitorados localizados; {all_rows} linhas lidas"
    )


if __name__ == "__main__":
    main()
