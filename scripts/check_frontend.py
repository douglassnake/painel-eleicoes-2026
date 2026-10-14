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
