#!/usr/bin/env python3
"""Descriptive analysis of TSE-confirmed mayor and council winners (2004–2024)."""
import json
import statistics
from collections import Counter
from pathlib import Path

YEARS=(2004,2008,2012,2016,2020,2024)
CITY_CODES=("3128600","3171006","3147006")

def canonical(name):
    import re,unicodedata
    value=unicodedata.normalize("NFKD",str(name or ""))
    return re.sub(r"[^A-Z0-9]","",''.join(ch for ch in value if not unicodedata.combining(ch)).upper())

def is_elected(status):
    return canonical(status).startswith("ELEITO") or canonical(status)=="MEDIA"

def safe_ratio(n,d):
    return round(100*n/d,2) if d>0 else None

def study(folder):
    years={}
    for year in YEARS:
        path=Path(folder)/f"candidates-{year}.json"
        obj=json.loads(path.read_text(encoding="utf-8"))
        if obj.get("year")!=year or obj.get("schemaVersion")!=1:
            raise ValueError("Unexpected file/schema " + str(path))
        cities={city["ibge"]:city for city in obj["municipalities"]}
        if set(cities)!=set(CITY_CODES):
            raise ValueError("Missing municipalities in " + str(path))
        years[year]=cities

    output={
        "schemaVersion":1,
        "source":"TSE / resultado oficial; análise descritiva não preditiva",
        "sourceYears":list(YEARS),
        "municipalities":[],
        "methodNotes":[
            "Votos válidos nominais de prefeito: soma de votos válidos informados para os candidatos; não equipara votos brancos, nulos ou anulados a votos válidos.",
            "Eleitos somente por situação oficial de totalização ('ELEITO', 'ELEITO POR QP', 'ELEITO POR MÉDIA'); não pela maior votação individual.",
            "Correspondências históricas de nomes completos são apenas indicadores de recorrência nominal; não identificam de forma conclusiva pessoas, mandatos ou alterações de nome.",
            "O universo consiste em seis eleições ordinárias para três municípios. Proporções não preveem eleições futuras.",
            "Mudanças de sigla podem decorrer de reorganizações, fusões, incorporações ou filiações. Diferenças nominais não bastam para atribuir mudança de filiação."
        ]
    }
    for ibge in CITY_CODES:
        cycles=[]
        for year in YEARS:
            city=years[year][ibge]
            if not city["audit"]["eligibleForSummary"]:
                raise ValueError(f"Winner status invalid for {ibge} {year}")
            cands=city["candidates"]
            mayors=[c for c in cands if c["office"]=="prefeito"]
            council=[c for c in cands if c["office"]=="vereador"]
            winners=[c for c in mayors if is_elected(c["status"])]
            if len(winners)!=1:
                raise ValueError(f"Mayor election not unique {ibge} {year}")
            winner=winners[0]
            council_elected=[c for c in council if is_elected(c["status"])]
            council_nonelected=[c for c in council if not is_elected(c["status"])]
            min_elected=min((c["votes"] for c in council_elected if c["votes"] is not None), default=None)
            max_nonelected=max((c["votes"] for c in council_nonelected if c["votes"] is not None), default=None)
            mayor_votes=sum(c["votes"] or 0 for c in mayors)
            runner_up=max((c["votes"] or 0 for c in mayors if c["key"]!=winner["key"]),default=0)
            cycles.append({
                "year":year,
                "mayor":{
                    "candidateId":winner["tseCandidateId"],"fullName":winner["fullName"],
                    "ballotName":winner["ballotName"],"party":winner["party"],"votes":winner["votes"],
                    "shareValidPct":safe_ratio(winner["votes"] or 0,mayor_votes),
                    "runnerUpVotes":runner_up,"marginVotes":(winner["votes"] or 0)-runner_up,
                    "hasOpponent":len(mayors)>1
                },
                "mayorCandidateCount":len(mayors),
                "councilCandidateCount":len(council),
                "councilElectedCount":len(council_elected),
                "councilParties":dict(sorted(Counter(c["party"] for c in council_elected if c.get("party")).items())),
                "councilLowestElectedVotes":min_elected,
                "councilHighestNonElectedVotes":max_nonelected,
                "councilNonElectedOutpolledElected":bool(min_elected is not None and max_nonelected is not None and max_nonelected>min_elected),
                "councilElectedByStatus":dict(sorted(Counter(c["status"] for c in council_elected).items())),
                "councilGenderElected":dict(sorted(Counter(c["gender"] for c in council_elected if c.get("gender")).items())),
                "councilEducationElected":dict(sorted(Counter(c["education"] for c in council_elected if c.get("education")).items()))
            })

        repeats=[]
        for last,cur in zip(cycles,cycles[1:]):
            former,later=last["mayor"],cur["mayor"]
            same=bool(former.get("fullName") and later.get("fullName") and canonical(former["fullName"])==canonical(later["fullName"]))
            repeats.append({
                "from":last["year"],"to":cur["year"],
                "sameFullName":same,
                "sameParty":bool(former["party"] and former["party"]==later["party"]),
                "partyBefore":former["party"],"partyAfter":later["party"],
                "winnerMarginShiftVotes":later["marginVotes"]-former["marginVotes"]
            })
        output["municipalities"].append({
            "ibge":ibge,"name":years[2024][ibge]["name"],"uf":"MG",
            "cycles":cycles,
            "historicalPatterns":{
                "consecutiveMayorWinnerSameFullName":sum(int(x["sameFullName"]) for x in repeats),
                "consecutiveMayorWinnerSameParty":sum(int(x["sameParty"]) for x in repeats),
                "mayorWinnerSameNamePairs":repeats,
                "councilNonElectedOutpolledElectedCycles":sum(int(c["councilNonElectedOutpolledElected"]) for c in cycles),
                "uncontestedMayorCycles":sum(int(not c["mayor"]["hasOpponent"]) for c in cycles),
                "averageMayorWinningVoteSharePct":round(statistics.mean(c["mayor"]["shareValidPct"] for c in cycles if c["mayor"]["shareValidPct"] is not None),2)
            }
        })
    return output

def main():
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",default="municipais-2028/historico")
    parser.add_argument("--output",default="municipais-2028/historico/analysis.json")
    args=parser.parse_args()
    result=study(args.input)
    target=Path(args.output)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    for city in result["municipalities"]:
        p=city["historicalPatterns"]
        print("ANALYSIS",city["name"],"consecutive matched full names",p["consecutiveMayorWinnerSameFullName"],"same party",p["consecutiveMayorWinnerSameParty"],"council high-vote not elected years",p["councilNonElectedOutpolledElectedCycles"],flush=True)
        for c in city["cycles"]:
            print("ELECTED",city["name"],c["year"],c["mayor"]["ballotName"],c["mayor"]["votes"],c["mayor"]["shareValidPct"],flush=True)
    print("ANALYSIS_FILE",target,flush=True)

if __name__=="__main__":main()
