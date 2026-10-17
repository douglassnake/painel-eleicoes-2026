#!/usr/bin/env python3
"""Preflight da versão estática do Painel Eleitoral 2026."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            if a["id"] in self.ids:
                raise AssertionError(f"ID HTML duplicado: {a['id']}")
            self.ids.add(a["id"])
        if tag == "script" and a.get("src"):
            self.paths.append(a["src"])
        if tag == "link" and a.get("rel") == "stylesheet":
            self.paths.append(a["href"])

def css_balanced(source):
    # Retira comentários e cadeias antes da conferência estrutural.
    source = re.sub(r"/\*[\s\S]*?\*/", "", source)
    source = re.sub(r'''(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')''', '""', source)
    opened = 0
    for char in source:
        if char == "{":
            opened += 1
        elif char == "}":
            opened -= 1
            if opened < 0:
                return False
    return opened == 0

html = (ROOT / "index.html").read_text(encoding="utf-8")
assert '<body class="theme-craft">' in html, "Novo tema não está ativo"
assert 'href="craft-theme.css"' in html, "CSS Craft ausente no index"
assert 'href="vice-theme.css"' not in html, "Tema anterior ainda ativo"
assert all((ROOT / name).exists() for name in ("vice-theme.css", "atari-theme.css"))

parser = Assets()
parser.feed(html)
missing = [path for path in parser.paths if not (ROOT / path).is_file()]
assert not missing, f"Recursos HTML ausentes: {missing}"
assert {"navegacao", "view", "kpis", "independencia"} <= parser.ids

css = (ROOT / "craft-theme.css").read_text(encoding="utf-8")
assert css_balanced(css), "CSS Craft com blocos desbalanceados"
assert css.count("body.theme-craft") > 35, "Camada Craft incompleta"

resultados = (ROOT / "resultados-ui.js").read_text(encoding="utf-8")
assert all(x in resultados for x in ("presidente", "governador", "senado", "deputados", "TSE_BASE")), "Filtros ou fonte TSE ausentes"
assert all((ROOT / name).is_file() for name in ("brasil-map.js", "resultados-map.js", "pos-eleicao.js", "candidate-photos.js"))

print(f"OK: {len(parser.paths)} recursos vinculados, {len(parser.ids)} IDs e CSS Craft validado.")

# Pesquisas são armazenadas separadamente da apuração TSE.
data = (ROOT / "data.js").read_text(encoding="utf-8")
assert "presidenciaSegundoTurno:" in data
assert "BR-01107/2026" in data and "51.1" in data and "48.9" in data
assert (ROOT / "presidential-poll.js").is_file()
assert "PresidentialPoll.render(view)" in (ROOT / "app.js").read_text(encoding="utf-8")
assert "PresidentialPoll?.card()" in (ROOT / "resultados-ui.js").read_text(encoding="utf-8")
print("OK: pesquisa Veritá de 2º turno isolada da apuração oficial.")

# O destaque de Presidente aparece antes de todos os outros indicadores e seções.
assert html.index('id="presidentialSpotlight"') < html.index('id="kpis"') < html.index('id="navegacao"')
assert html.index('data-view="presidente"') < html.index('data-view="overview"')
assert html.count('data-view="presidente"') == 1
poll_js = (ROOT / "presidential-poll.js").read_text(encoding="utf-8")
assert "mountSpotlight" in poll_js and "CandidatePhotos?.hydrate(mount)" in poll_js
app_js = (ROOT / "app.js").read_text(encoding="utf-8")
overview_block = app_js.split('function overview(){',1)[1].split('function majorSnapshot(',1)[0]
assert overview_block.index("Disputas majoritárias") < overview_block.index("Ranking Monte Carlo")
assert overview_block.index("majorSnapshot('Presidência") < overview_block.index("majorSnapshot('Governo de MG")
print("OK: destaque presidencial antes das outras disputas, mantendo as fontes diferenciadas.")

# Retratos reais dos presidenciáveis e rastreabilidade das licenças.
assert "2026_FLAVIO_BOLSONARO_CANDIDATO_PRESIDENTE_TSE_" in data
assert "08.08.2026_-_FOTOS_OFICIAIS_-_55450293419.jpg" in data
assert "CC BY 4.0" in data and "CC BY-SA 4.0" in data
assert "fotoAutor" in data and "fotoFonte" in data
candidate_photos = (ROOT / "candidate-photos.js").read_text(encoding="utf-8")
assert "presidenciaSegundoTurno?.candidatos" in candidate_photos
assert "Number(meta.cargo) === 1" in candidate_photos
assert "classList.remove('has-photo')" in candidate_photos
assert "verita-photo-credit" in (ROOT / "presidential-poll.js").read_text(encoding="utf-8")
assert "snapshot-candidate" in app_js and "candidatePhoto(x.nome,x.numero" in app_js
print("OK: fotos e créditos reais em destaque, Presidência, resultados e resumo.")
