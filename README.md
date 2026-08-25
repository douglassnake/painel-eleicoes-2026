# Painel Eleições 2026 — Minas Gerais

Dashboard estático e responsivo para acompanhar as Eleições 2026, com foco em:

- Presidência da República;
- Governo de Minas Gerais;
- Senado Federal por Minas Gerais;
- candidatos a deputado federal e estadual ligados ao Noroeste de Minas e Alto Paranaíba;
- patrimônio declarado, votação anterior e probabilidades de um modelo Monte Carlo para o grupo regional.

## Aviso importante

Este projeto é **independente e apartidário**. Não representa candidato, partido, instituto de pesquisa ou a Justiça Eleitoral.

As probabilidades exibidas para deputados são **estimativas condicionais de modelo**, não intenção de voto e não previsão oficial. O sistema proporcional depende do desempenho de partidos/federações e das regras de distribuição de cadeiras.

## Fontes

- Tribunal Superior Eleitoral — Dados Abertos 2026: https://dadosabertos.tse.jus.br/dataset/candidatos-2026
- TSE / DivulgaCandContas
- Pesquisas eleitorais registradas no TSE
- Fontes jornalísticas usadas apenas como interfaces de consulta dos registros oficiais e pesquisas

## Estrutura

```text
index.html
styles.css
data.js
app.js
.github/workflows/pages.yml
```

## Rodar localmente

Basta abrir `index.html` no navegador. Para um servidor local:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Publicar no GitHub Pages

1. Envie os arquivos para a branch `main`.
2. No GitHub, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, escolha **GitHub Actions**.
4. O workflow incluído em `.github/workflows/pages.yml` fará o deploy.

## Atualização dos dados

Neste MVP os dados ficam centralizados em `data.js`. Isso facilita auditoria e atualização manual. A próxima versão pode automatizar a ingestão dos CSVs do TSE e de pesquisas registradas.
