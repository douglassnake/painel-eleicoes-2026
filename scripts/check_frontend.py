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
# Confere o recorte atual sem modificar a pesquisa nem seus valores.
assert "registroInformado:'BR-06070/2026'" in data
assert "registroConferidoNaFontePrimaria:false" in data
assert "divulgacao:'2026-10-23'" in data
assert "poll:51.3" in data and "poll:48.7" in data
assert (ROOT / "presidential-poll.js").is_file()
assert "PresidentialPoll.render(view)" in (ROOT / "app.js").read_text(encoding="utf-8")
assert "PresidentialPoll?.card()" not in (ROOT / "resultados-ui.js").read_text(encoding="utf-8")  # Quadro compacto somente no primeiro destaque
print("OK: pesquisa Veritá de 2º turno isolada da apuração oficial.")

# O destaque de Presidente aparece antes de todos os outros indicadores e seções.
assert html.index('id="navegacao"') < html.index('id="presidentialSpotlight"') < html.index('id="kpis"')
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

# Ranking IMD é módulo independente e tem assets próprios.
assert html.count('data-view="competitividade"') == 1
assert html.index('data-view="presidente"') < html.index('data-view="competitividade"')
assert html.index('src="competitividade-data.js"') < html.index('src="competitividade-ui.js"') < html.index('src="app.js"')
assert all((ROOT / asset).is_file() for asset in ("competitividade-data.js","competitividade-ui.js","competitividade.css","scripts/check_competitiveness.js"))
assert css_balanced((ROOT / "competitividade.css").read_text(encoding="utf-8"))
assert "Competitiveness2026.render(view)" in app_js
assert "Competitiveness2026?.overviewCard()" in app_js
print("OK: módulo IMD 2026 e integração ao painel eleitoral validados.")

# Apuração presidencial oficial 2º turno, isolada de pesquisas.
assert html.count('data-view="apuracao-2t"') == 1
assert html.index('data-view="presidente"') < html.index('data-view="apuracao-2t"') < html.index('data-view="overview"')
assert html.index('src="apuracao-2t.js"') < html.index('src="app.js"')
assert (ROOT / "apuracao-2t.js").is_file()
assert (ROOT / "apuracao-2t.css").is_file()
assert (ROOT / "scripts/check_runoff.js").is_file()
assert css_balanced((ROOT / "apuracao-2t.css").read_text(encoding="utf-8"))
assert "Runoff2026.render(view)" in app_js
runoff = (ROOT / "apuracao-2t.js").read_text(encoding="utf-8")
assert "ele2026/6258/dados" in runoff and "c0001-e006258-u.json" in runoff
assert "parseOfficial" in runoff and "cache:'no-store'" in runoff
assert "pesquisas de opinião não são utilizadas" in runoff
print("OK: apuração 2º turno via TSE JSON, sem dados de pesquisas ou simulações.")

# Menu de dados movido ao topo e sincronizado com seleção nativa no celular.
assert html.index('id="topDataNav"') < html.index('<header id="inicio"')
assert html.index('id="navegacao"') < html.index('id="presidentialSpotlight"')
assert html.count('id="navegacao"') == 1 and html.count('id="dataNavSelect"') == 1
assert html.count('data-view="') == 13
assert html.index('src="top-navigation.js"') > html.index('src="pos-eleicao.js"')
assert 'body.theme-craft .top-data-nav' in css and 'position:sticky' in css
assert 'body.theme-craft .top-data-nav-select select' in css
assert '@media(max-width:760px)' in css
assert (ROOT / "top-navigation.js").is_file()
nav_js = (ROOT / "top-navigation.js").read_text(encoding="utf-8")
assert "select.addEventListener('change'" in nav_js and "tab.click()" in nav_js
assert "MutationObserver" in nav_js and "view.scrollIntoView" in nav_js
assert 'href="#view">Explorar o painel' in html
for mod in ("app.js","official-ui.js","territorial.js","governadores-ui.js"):
    assert "window.scrollTo({top:0,behavior:'smooth'});" not in (ROOT / mod).read_text(encoding="utf-8")
print("OK: menu fixo no topo, 13 seções, navegação iPhone e rolagem ajustada.")

# Pesquisas por instituto de 17/10 e 19/10 separadas dos votos oficiais.
assert (ROOT / "presidential-surveys.js").is_file()
assert (ROOT / "scripts/check_surveys.js").is_file()
assert html.index('src="data.js"') < html.index('src="presidential-surveys.js"') < html.index('src="presidential-poll.js"')
assert "SecondRoundPolls?.full()" in poll_js and "SecondRoundPolls?.compact()" in poll_js
assert "SecondRoundPolls?.compact()" not in app_js
assert "SecondRoundPolls?.compact()" not in resultados
assert poll_js.count("SecondRoundPolls?.compact()") == 1
assert 'presidentialSpotlightCard' in poll_js
assert "PresidentialSimulationUI?.teaser()" in app_js
print("OK: pesquisas em quadro compacto somente no destaque inicial, sem duplicação na Visão geral ou em Resultados ao vivo.")
assert "body.theme-craft .s2-board" in css
print("OK: quadro de pesquisas por instituto, fontes e registros separado da apuração TSE.")

# Identidade visual presidencial consistente em todas as abas, sem colorir outros cargos.
color_css = ROOT / "presidential-colors.css"
color_js = ROOT / "presidential-colors.js"
assert color_css.is_file() and color_js.is_file()
assert (ROOT / "scripts/check_candidate_colors.js").is_file()
assert css_balanced(color_css.read_text(encoding="utf-8"))
assert html.index('href="presidential-colors.css"') > html.index('href="apuracao-2t.css"')
assert html.index('src="data.js"') < html.index('src="presidential-colors.js"') < html.index('src="presidential-surveys.js"')
assert "PresidentialColors.classFor" in (ROOT / "presidential-surveys.js").read_text(encoding="utf-8")
assert "PresidentialColors.classFor" in poll_js
assert "PresidentialColors.classFor" in app_js
assert "PresidentialColors.classFor" in resultados
assert "PresidentialColors.classFor" in runoff
print("OK: cores dos presidenciáveis em todos os módulos, sem alteração na contagem de votos.")

# MC-2T v1 é módulo de cenários de pesquisas, distinto do Monte Carlo v3/ITR e do TSE.
sim_files=("presidential-simulation.js","presidential-simulation-ui.js","presidential-simulation.css","scripts/check_president_simulation.js")
assert all((ROOT / f).is_file() for f in sim_files)
assert css_balanced((ROOT / "presidential-simulation.css").read_text(encoding="utf-8"))
assert html.index('src="presidential-surveys.js"') < html.index('src="presidential-simulation.js"') < html.index('src="presidential-simulation-ui.js"') < html.index('src="presidential-poll.js"')
assert html.index('href="presidential-simulation.css"') > html.index('href="presidential-colors.css"')
assert 'PresidentialSimulationUI?.mount(' in poll_js
assert 'id="presidential-simulation-mount"' in poll_js
assert 'PresidentialSimulationUI?.teaser()' in app_js
sim_engine=(ROOT / "presidential-simulation.js").read_text(encoding="utf-8")
sim_ui=(ROOT / "presidential-simulation-ui.js").read_text(encoding="utf-8")
assert 'DEFAULT_DRAWS=200000' in sim_engine and 'SEED=20261019' in sim_engine
assert 'não' in sim_ui.lower() and 'probabilidade de vitória' in sim_ui.lower()
assert 'window.Runoff2026' not in sim_engine
print("OK: MC-2T separado da apuração oficial e do Monte Carlo v3/ITR.")

# Evolução histórica por instituto de 20/08 a 20/10/2026.
evo_assets=("presidential-evolution-data.js","presidential-evolution-ui.js","presidential-evolution.css","scripts/check_presidential_evolution.js")
assert all((ROOT / f).is_file() for f in evo_assets)
assert css_balanced((ROOT / "presidential-evolution.css").read_text(encoding="utf-8"))
assert html.index('src="presidential-surveys.js"') < html.index('src="presidential-evolution-data.js"') < html.index('src="presidential-evolution-ui.js"') < html.index('src="presidential-poll.js"')
assert 'PresidentialEvolutionUI?.mount(' in poll_js
assert 'poll-evolution-mount' in poll_js
assert 'PresidentialSimulationUI?.mount(' in poll_js
assert html.count('id="presidentialSpotlightCard"') == 1
assert 'SecondRoundPolls?.compact()' not in app_js
assert 'SecondRoundPolls?.compact()' not in resultados
print("OK: histórico de quatro institutos por base independente, sem duplicar o destaque de pesquisas.")

# Atualização de 20 e 21 de outubro — votos válidos e totais segregados.
survey_file=(ROOT / "presidential-surveys.js").read_text(encoding="utf-8")
evolution_file=(ROOT / "presidential-evolution-data.js").read_text(encoding="utf-8")
assert "2026-10-21-meio-ideia" in survey_file
assert "2026-10-20-realtime" in survey_file
assert "2026-10-20-alfa" in survey_file
assert "2026-10-21-palver" in survey_file
assert "totalEntries" in survey_file and "entra no MC-2T" in survey_file
assert '"windowEnd":"2026-10-23"' in evolution_file
assert '"lastVerified":"2026-10-23"' in evolution_file
print("OK: pesquisas de 20–21/10 com denominadores separados.")

# Tracking GERP de 20/10 sem atribuir registro de 21/10 e Polymarket separada.
assert "2026-10-20-gerp-tracking" in (ROOT / "presidential-surveys.js").read_text(encoding="utf-8")
assert "Não informado para esta rodada" in (ROOT / "presidential-surveys.js").read_text(encoding="utf-8")
assert all((ROOT / name).is_file() for name in ("polymarket-election.js","polymarket-election.css","scripts/check_polymarket.js"))
assert css_balanced((ROOT / "polymarket-election.css").read_text(encoding="utf-8"))
assert html.index('src="polymarket-election.js"') < html.index('src="presidential-poll.js"')
assert 'PolymarketElection?.mount(' in poll_js
assert 'polymarket-president-detail' in poll_js and 'polymarket-president-spotlight' in poll_js
poly = (ROOT / "polymarket-election.js").read_text(encoding="utf-8")
assert "gamma-api.polymarket.com/events/slug/brazil-presidential-election" in poly
assert "Não são intenção de voto" in poly
assert "Nenhum preço anterior foi apresentado como atual" in poly
print("OK: mercado preditivo isolado do TSE e pesquisas, GERP rastreável.")
