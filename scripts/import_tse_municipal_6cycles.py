#!/usr/bin/env python3
"""Extract six ordinary municipal election cycles from official TSE ZIPs.

Only public, election-related candidate fields are retained. Private identifiers,
birth dates, CPF, voter registration, phone, email and addresses are discarded.
The source archives are never committed.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import re
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

YEARS = (2004, 2008, 2012, 2016, 2020, 2024)
TSE_BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele"
MUNICIPALITIES = {
    "45713": {"name": "Guarda-Mor", "ibge": "3128600", "uf": "MG"},
    "54194": {"name": "Vazante", "ibge": "3171006", "uf": "MG"},
    "49395": {"name": "Paracatu", "ibge": "3147006", "uf": "MG"},
}
OFFICES = {"11": "prefeito", "13": "vereador"}
PUBLIC_FIELDS = {
    "fullName": "NM_CANDIDATO",
    "ballotName": "NM_URNA_CANDIDATO",
    "ballotNumber": "NR_CANDIDATO",
    "party": "SG_PARTIDO",
    "partyName": "NM_PARTIDO",
    "coalition": "NM_COLIGACAO",
    "coalitionParties": "DS_COMPOSICAO_COLIGACAO",
    "federation": "SG_FEDERACAO",
    "gender": "DS_GENERO",
    "education": "DS_GRAU_INSTRUCAO",
    "occupation": "DS_OCUPACAO",
    "maritalStatus": "DS_ESTADO_CIVIL",
    "ageAtTakingOffice": "NR_IDADE_DATA_POSSE",
    "registrationStatus": "DS_SITUACAO_CANDIDATURA",
}
CANDIDATE_EXCLUDE = {"#NE", "#NULO", "", "NÃO INFORMADO", "NAO INFORMADO"}

def norm(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    return re.sub(r"[^A-Z0-9]+", "", "".join(x for x in text if not unicodedata.combining(x)).upper())

BY_NAME = {norm(m["name"]): code for code, m in MUNICIPALITIES.items()}

def city_code(row):
    if str(row.get("SG_UF", "")).upper() != "MG":
        return None
    code = str(row.get("SG_UE") or row.get("CD_MUNICIPIO") or "").strip()
    city = norm(row.get("NM_UE") or row.get("NM_MUNICIPIO"))
    if code in MUNICIPALITIES:
        if city and city not in BY_NAME:
            raise ValueError("TSE municipality identifier/name mismatch: " + code + " " + city)
        return code
    return BY_NAME.get(city)

def ordinary(row):
    if str(row.get("NR_TURNO", "1")).strip() != "1":
        return False
    if str(row.get("CD_TIPO_ELEICAO", "2")).strip() not in ("", "2"):
        return False
    if "SUPLEMENTAR" in norm(row.get("DS_ELEICAO", "")) or "SUPLEMENTAR" in norm(row.get("NM_TIPO_ELEICAO", "")):
        return False
    return True

def office_of(row):
    return OFFICES.get(str(row.get("CD_CARGO", "")).strip())

def safe_field(value):
    text = str(value or "").strip()
    return None if text.upper() in CANDIDATE_EXCLUDE else text

def int_or_zero(value):
    if value in (None, "", "#NE", "#NULO"):
        return 0
    number = int(str(value))
    if number < 0:
        raise ValueError("Negative vote count")
    return number

def election_status(raw):
    text = str(raw or "").strip()
    return safe_field(text)

def elected(status):
    return norm(status).startswith("ELEITO")

def get_url(kind, year):
    if year not in YEARS or kind not in ("consulta_cand", "votacao_candidato_munzona"):
        raise ValueError("Unknown TSE source")
    return f"{TSE_BASE}/{kind}/{kind}_{year}.zip"

def download(kind, year):
    url = get_url(kind, year)
    for attempt in range(3):
        store = tempfile.TemporaryFile()
        sha = hashlib.sha256()
        size = 0
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (compatible; ElectionHistoryResearch/1.0)"}
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > 600 * 1024 * 1024:
                        raise ValueError("Archive above 600 MiB maximum: " + url)
                    sha.update(chunk)
                    store.write(chunk)
            store.seek(0)
            if not zipfile.is_zipfile(store):
                raise ValueError("Official download was not a ZIP: " + url)
            store.seek(0)
            print(f"DOWNLOADED {year} {kind}: {size} bytes SHA256={sha.hexdigest()}", flush=True)
            return store, {"url": url, "sha256": sha.hexdigest(), "bytes": size}
        except (OSError, urllib.error.URLError, TimeoutError) as exc:
            store.close()
            if attempt == 2:
                raise
            print("RETRY", year, kind, type(exc).__name__, str(exc)[:180], flush=True)
            time.sleep(3 * (attempt + 1))
        except Exception:
            store.close()
            raise

def rows_in_mg(store, kind, year):
    with zipfile.ZipFile(store) as archive:
        selected = [
            info for info in archive.infolist()
            if info.filename.lower().endswith(f"_{year}_mg.csv") and
            info.filename.lower().startswith(kind)
        ]
        if len(selected) != 1:
            raise ValueError(f"Expected a single MG CSV for {kind} {year}: {len(selected)}")
        if selected[0].file_size > 150 * 1024 * 1024:
            raise ValueError("Unpacked MG CSV too large")
        with archive.open(selected[0]) as source:
            text = io.TextIOWrapper(source, encoding="latin-1", errors="strict", newline="")
            reader = csv.DictReader(text, delimiter=";")
            cols = set(reader.fieldnames or ())
            mandatory = {"SG_UF", "SG_UE", "CD_CARGO", "NR_CANDIDATO", "SQ_CANDIDATO", "DS_SIT_TOT_TURNO"}
            if kind == "votacao_candidato_munzona":
                mandatory |= {"QT_VOTOS_NOMINAIS", "CD_MUNICIPIO", "NR_ZONA"}
            else:
                mandatory |= {"NM_CANDIDATO", "NM_UE"}
            if mandatory - cols:
                raise ValueError(f"Missing TSE fields {mandatory - cols} in {selected[0].filename}")
            for row in reader:
                city = city_code(row)
                office = office_of(row)
                if city and office and ordinary(row):
                    yield city, office, row

def candidate_key(city, office, sq, nr):
    sq = str(sq or "").strip()
    nr = str(nr or "").strip()
    if sq and sq not in ("#NE", "#NULO", "-1"):
        return f"{city}:{office}:sq:{sq}"
    if nr.isdigit():
        return f"{city}:{office}:nr:{nr}"
    raise ValueError("Missing candidate identity")

def extract(year, out_dir):
    if year not in YEARS:
        raise ValueError("Not one of the last six municipal elections")
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    candidates, votes = {}, {}
    diagnostics = Counter()
    provenance = {}
    for kind in ("consulta_cand", "votacao_candidato_munzona"):
        store, source_meta = download(kind, year)
        try:
            count = 0
            for city, office, row in rows_in_mg(store, kind, year):
                count += 1
                if kind == "consulta_cand":
                    key = candidate_key(city, office, row.get("SQ_CANDIDATO"), row.get("NR_CANDIDATO"))
                    if key in candidates:
                        diagnostics["duplicate_candidate_record"] += 1
                        raise ValueError("Duplicate TSE candidate key " + key)
                    record = {
                        "key": key,
                        "municipalityIbge": MUNICIPALITIES[city]["ibge"],
                        "tseMunicipality": city,
                        "year": year,
                        "office": office,
                        "tseCandidateId": safe_field(row.get("SQ_CANDIDATO")),
                        "status": election_status(row.get("DS_SIT_TOT_TURNO")),
                        "votes": None,
                        "votesNominal": None,
                        "zones": [],
                    }
                    for dest, field in PUBLIC_FIELDS.items():
                        record[dest] = safe_field(row.get(field))
                    candidates[key] = record
                else:
                    key = candidate_key(city, office, row.get("SQ_CANDIDATO"), row.get("NR_CANDIDATO"))
                    vote_group = votes.setdefault(key, {
                        "votes": 0, "votesNominal": 0, "zones": {},
                        "status": None, "ballotNumber": safe_field(row.get("NR_CANDIDATO")),
                        "ballotName": safe_field(row.get("NM_URNA_CANDIDATO")),
                        "fullName": safe_field(row.get("NM_CANDIDATO")),
                        "party": safe_field(row.get("SG_PARTIDO")),
                        "office": office, "city": city,
                    })
                    total = int_or_zero(row.get("QT_VOTOS_NOMINAIS"))
                    valid = int_or_zero(row.get("QT_VOTOS_NOMINAIS_VALIDOS", total))
                    if valid > total:
                        raise ValueError("Valid votes greater than reported nominal votes")
                    zone = str(row.get("NR_ZONA", "")).strip()
                    vote_group["votes"] += valid
                    vote_group["votesNominal"] += total
                    existing_zone = vote_group["zones"].setdefault(zone, {"zone": zone, "votes": 0, "nominal": 0})
                    existing_zone["votes"] += valid
                    existing_zone["nominal"] += total
                    status = election_status(row.get("DS_SIT_TOT_TURNO"))
                    if status:
                        if vote_group["status"] and vote_group["status"] != status:
                            raise ValueError("Inconsistent TSE result status for " + key)
                        vote_group["status"] = status
            diagnostics[kind + "_scoped_rows"] = count
            provenance[kind] = {**source_meta, "mgCsv": f"{kind}_{year}_MG.csv", "matchedRows": count}
        finally:
            store.close()

    for key, group in votes.items():
        if key not in candidates:
            diagnostics["voted_without_candidate_metadata"] += 1
            record = {
                "key": key,
                "municipalityIbge": MUNICIPALITIES[group["city"]]["ibge"],
                "tseMunicipality": group["city"],
                "year": year, "office": group["office"],
                "tseCandidateId": key.split(":")[-1],
                "status": group["status"], "metadataMissing": True,
                "fullName": group["fullName"],
                "ballotName": group["ballotName"],
                "ballotNumber": group["ballotNumber"],
                "party": group["party"],
            }
            candidates[key] = record
        record = candidates[key]
        record["status"] = group["status"] or record["status"]
        record["votes"] = group["votes"]
        record["votesNominal"] = group["votesNominal"]
        record["zones"] = sorted(group["zones"].values(), key=lambda row: row["zone"])
        if not record.get("ballotName"):
            record["ballotName"] = group["ballotName"]
        if not record.get("party"):
            record["party"] = group["party"]
        if not record.get("fullName"):
            record["fullName"] = group["fullName"]

    result = {
        "schemaVersion": 1,
        "year": year,
        "generatedAt": started,
        "source": "Tribunal Superior Eleitoral / Portal de Dados Abertos",
        "provenance": provenance,
        "municipalities": [],
        "diagnostics": dict(diagnostics),
    }
    for tse_code, city in MUNICIPALITIES.items():
        rows = sorted(
            [record for record in candidates.values() if record["tseMunicipality"] == tse_code],
            key=lambda r: (r["office"], -(r["votes"] or 0), r["ballotNumber"] or "")
        )
        mayor = [r for r in rows if r["office"] == "prefeito"]
        council = [r for r in rows if r["office"] == "vereador"]
        elected_mayor = [r for r in mayor if elected(r["status"])]
        elected_council = [r for r in council if elected(r["status"])]
        audit = {
            "candidates": len(rows), "mayorCandidates": len(mayor),
            "councilCandidates": len(council),
            "withVoteData": sum(r["votes"] is not None for r in rows),
            "electedMayors": len(elected_mayor),
            "electedCouncil": len(elected_council),
            "nominalVotesMayor": sum(r["votesNominal"] or 0 for r in mayor),
            "validVotesMayor": sum(r["votes"] or 0 for r in mayor),
            "validVotesCouncilNominal": sum(r["votes"] or 0 for r in council),
            "eligibleForSummary": len(elected_mayor) == 1 and len(elected_council) > 0,
        }
        result["municipalities"].append({**city, "tseCode": tse_code, "audit": audit, "candidates": rows})
        print(f"{year} {city['name']} {audit}", flush=True)
        for winner in elected_mayor:
            print("MAYOR_OFFICIAL", year, city["name"], winner["ballotName"], winner["party"], winner["votes"], flush=True)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    target = out / f"candidates-{year}.json"
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("GENERATED", target, target.stat().st_size, flush=True)
    if any(not m["audit"]["eligibleForSummary"] for m in result["municipalities"]):
        raise ValueError("Some municipal winners are not officially validated; do not publish aggregate")
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, choices=YEARS, required=True)
    parser.add_argument("--output", default="municipais-2028/historico")
    args = parser.parse_args()
    extract(args.year, args.output)
