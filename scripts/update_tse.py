#!/usr/bin/env python3
"""Sincroniza a camada oficial do painel com o conjunto Candidatos 2026 do TSE."""
import csv
import io
import json
import re
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_JS = ROOT / "data.js"
OUT = ROOT / "official-data.json"
CKAN = "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=candidatos-2026"


def norm(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def monitored_names():
    text = DATA_JS.read_text(encoding="utf-8")
    return sorted(set(re.findall(r"nome:'([^']+)'", text)))


def resource_url():
    r = requests.get(CKAN, timeout=30)
    r.raise_for_status()
    resources = r.json()["result"]["resources"]
    candidates = []
    for item in resources:
        label = norm((item.get("name") or "") + " " + (item.get("description") or ""))
        fmt = norm(item.get("format") or "")
        if "CANDIDAT" in label and "BENS" not in label and "COMPLEMENT" not in label:
            score = 0
            if "CSV" in fmt or str(item.get("url", "")).lower().endswith((".csv", ".zip")):
                score += 10
            if norm(item.get("name")) == "CANDIDATOS":
                score += 20
            candidates.append((score, item["url"]))
    if not candidates:
        raise RuntimeError("Recurso principal de candidatos não encontrado no CKAN do TSE")
    return sorted(candidates, reverse=True)[0][1]


def decode_bytes(blob):
    for enc in ("utf-8-sig", "latin-1", "cp1252"):
        try:
            return blob.decode(enc)
        except UnicodeDecodeError:
            pass
    return blob.decode("latin-1", errors="replace")


def csv_texts(blob):
    if blob[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            for name in zf.namelist():
                if name.lower().endswith(".csv"):
                    yield name, decode_bytes(zf.read(name))
    else:
        yield "candidatos.csv", decode_bytes(blob)


def parse_rows(text):
    sample = text[:10000]
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","
    return csv.DictReader(io.StringIO(text), delimiter=delimiter)


def pick(row, *keys):
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return str(row[key]).strip()
    return ""


def make_record(row):
    return {
        "nomeUrna": pick(row, "NM_URNA_CANDIDATO", "NM_URNA_CANDIDATA"),
        "nomeCompleto": pick(row, "NM_CANDIDATO", "NM_CANDIDATA"),
        "numero": pick(row, "NR_CANDIDATO", "NR_CANDIDATA"),
        "partido": pick(row, "SG_PARTIDO"),
        "cargo": pick(row, "DS_CARGO"),
        "uf": pick(row, "SG_UF"),
        "situacao": pick(row, "DS_SITUACAO_CANDIDATURA", "DS_SITUACAO_CANDIDATO", "DS_SITUACAO"),
        "detalhe": pick(row, "DS_SITUACAO_CANDIDATO_URNA", "DS_DETALHE_SITUACAO_CAND", "DS_DETALHE_SITUACAO_CANDIDATURA"),
        "sqCandidato": pick(row, "SQ_CANDIDATO", "SQ_CANDIDATA"),
    }


def main():
    names = monitored_names()
    targets = {norm(n): n for n in names}
    url = resource_url()
    response = requests.get(url, timeout=120)
    response.raise_for_status()

    found = {}
    all_rows = 0
    for _, text in csv_texts(response.content):
        for row in parse_rows(text):
            all_rows += 1
            urna = norm(pick(row, "NM_URNA_CANDIDATO", "NM_URNA_CANDIDATA"))
            full = norm(pick(row, "NM_CANDIDATO", "NM_CANDIDATA"))
            for key, display in targets.items():
                if key == urna or key == full or (len(key) >= 8 and (key in urna or key in full)):
                    rec = make_record(row)
                    prev = found.get(display)
                    preferred = rec["uf"] in {"MG", "BR"}
                    if prev is None or preferred:
                        found[display] = rec

    payload = {
        "source": "Tribunal Superior Eleitoral — Dados Abertos, Candidatos 2026",
        "dataset": "https://dadosabertos.tse.jus.br/dataset/candidatos-2026",
        "resource": url,
        "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "rowsRead": all_rows,
        "matched": len(found),
        "monitored": len(names),
        "candidates": found,
        "notFound": [name for name in names if name not in found],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"TSE: {len(found)}/{len(names)} nomes localizados; {all_rows} linhas lidas")


if __name__ == "__main__":
    main()
