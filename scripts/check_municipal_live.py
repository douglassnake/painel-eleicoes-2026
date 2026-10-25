#!/usr/bin/env python3
"""Live smoke test: TSE EA12, municipal EA20 and IBGE. No publishing."""
import json, urllib.request, urllib.error
BASE="https://resultados.tse.jus.br/oficial/ele2026/6258"
def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"PainelEleicoes2026-validation/1.0"})
    with urllib.request.urlopen(req,timeout=25) as response:
        return json.load(response), dict(response.headers)
config,headers=get(BASE+"/config/mun-e006258-cm.json")
ufs=config.get("abr",[])
mg=next((x for x in ufs if str(x.get("cdabr",x.get("cd",""))).lower()=="mg"),None)
assert mg and mg.get("mu"),"EA12 MG not found"
cities=mg["mu"]
city=next((x for x in cities if str(x.get("cdi"))=="3106200"),None)
assert city, "Belo Horizonte IBGE ID absent from EA12"
code=str(city["cd"]).zfill(5)
assert len(code)==5 and code.isdigit()
url=f"{BASE}/dados/mg/mg{code}-c0001-e006258-u.json"
votes,h=get(url)
assert str(votes.get("ele"))=="6258" and str(votes.get("t"))=="2"
assert any(str(c.get("cd"))=="1" for c in votes.get("carg",[]))
print("LIVE SMOKE OK:",len(cities),"MG municipalities; sample",city.get("nm"),code)
try:
    localities,_=get("https://servicodados.ibge.gov.br/api/v1/localidades/estados/31/municipios")
    assert any(str(m.get("id"))=="3106200" for m in localities)
    print("IBGE locality API OK:",len(localities),"municipalities")
except Exception as exc:
    print("IBGE locality API unavailable (non-blocking):",str(exc))
print("TSE CORS header:",h.get("Access-Control-Allow-Origin","absent"))
