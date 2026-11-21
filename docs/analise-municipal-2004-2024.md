# Auditoria histórica das eleições municipais — 2004 a 2024

**Municípios:** Guarda-Mor, Vazante e Paracatu (MG)  
**Período:** 2004, 2008, 2012, 2016, 2020, 2024 (eleições ordinárias, 1º turno)  
**Fonte primária:** [Portal de Dados Abertos do Tribunal Superior Eleitoral](https://dadosabertos.tse.jus.br/)  
**Conjunto reproduzível:** arquivos JSON em `municipais-2028/historico/candidates-AAAA.json`, `analysis.json), com URL de download, SHA-256 da origem e discriminação dos votos por zona eleitoral.

## 1. Cobertura e auditoria

| Ano | Candidaturas a prefeito | Candidaturas a vereador | Total | Vereadores com situação de eleito |
|---:|---:|---:|---:|---:|
| 2004 | 6 | 167 | 173 | 28 |
| 2008 | 9 | 195 | 204 | 28 |
| 2012 | 8 | 340 | 348 | 37 |
| 2016 | 6 | 351 | 357 | 37 |
| 2020 | 13 | 464 | 477 | 37 |
| 2024 | 11 | 445 | 456 | 37 |
| **Total** | **53** | **1.962** | **2.015** | **204** |

São **2.015 registros de candidatura**, não 2.015 pessoas únicas. Uma mesma pessoa pode aparecer em vários ciclos. Identificadores pessoais privados não foram incluídos.

O teste automático confirmou **18 prefeitos eleitos**, **204 registros de vereadores eleitos** e a distribuição de vagas de cada município, em todos os seis anos. Em 2004 e 2008, a situação oficial `MÉDIA` foi classificada como eleito por média, diferentemente das séries mais recentes, que usam `ELEITO POR MÉDIA`.

## 2. Prefeitos eleitos — dados oficiais

### Guarda-Mor — MG

| Ano | Candidatura eleita | Partido | Votos válidos nominais | Participação nos votos válidos |
|---:|---|---|---:|---:|
| 2004 | Doutor Clênio | PSDB | 2.225 | 51,58% |
| 2008 | Gilmar da Cooperativa | PMDB | 2.721 | 60,97% |
| 2012 | Edgar | PSDB | 2.462 | 50,67% |
| 2016 | Edgar | PSDB | 3.752 | 100,00% |
| 2020 | Zé Betio | PSDB | 2.882 | 63,19% |
| 2024 | Zé Betio | PSD | 2.576 | 48,34% |

**Observação:** em 2016 houve apenas uma candidatura a prefeito no arquivo filtrado; o percentual de 100% não significa que todos os eleitores tenham votado nela.

### Vazante — MG

| Ano | Candidatura eleita | Partido | Votos válidos nominais | Participação nos votos válidos |
|---:|---|---|---:|---:|
| 2004 | Dr. Jacques | PP | 8.421 | 67,58% |
| 2008 | Orlando Fialho | PP | 6.450 | 52,22% |
| 2012 | Dr. Jose Benedito | PHS | 6.719 | 51,78% |
| 2016 | Jacques Soares Guimarães | PSD | 7.860 | 58,22% |
| 2020 | Jacques Soares Guimarães | PSD | 7.742 | 64,28% |
| 2024 | Gabriel Rosa | PSD | 9.487 | 85,38% |

**Divergência explicada com o arquivo primário:** em 2024, José Benedito (Solidariedade) recebeu 1.854 votos nominais, mas o TSE registrou os 1.854 como `Anulado` e **zero votos válidos** para a candidatura. Os votos válidos nominais a prefeito somam 11.111 (9.487 para Gabriel Rosa e 1.624 para Debora Rabelo). Portanto, 9.487 / 11.111 = 85,38%. Incluir também os 1.854 anulados no denominador produz 73,17%, uma base conceitualmente diferente. O observatório mantém **ambos os campos** para transparência, sem reaproveitar indevidamente votos anulados como válidos.

### Paracatu — MG

| Ano | Candidatura eleita | Partido | Votos válidos nominais | Participação nos votos válidos |
|---:|---|---|---:|---:|
| 2004 | Vasquinho | PMDB | 25.669 | 60,27% |
| 2008 | Vasquinho | PMDB | 26.334 | 57,23% |
| 2012 | Olavo Conde | PSDB | 21.162 | 43,38% |
| 2016 | Olavo Conde | PSDB | 24.584 | 54,32% |
| 2020 | Igor Santos | DEM | 14.614 | 32,29% |
| 2024 | Igor Santos | UNIÃO | 40.976 | 82,34% |

## 3. Padrões históricos verificáveis

| Indicador descritivo | Guarda-Mor | Vazante | Paracatu |
|---|---:|---:|---:|
| Transições consecutivas com o mesmo nome completo de prefeito eleito (de 5) | 2 | 1 | 3 |
| Transições com a mesma sigla partidária vencedora (de 5) | 2 | 3 | 2 |
| Eleições em que candidato a vereador não eleito obteve mais votos nominais que algum eleito (de 6) | 3 | 6 | 6 |
| Cadeiras de vereador somadas nas seis eleições | 54 | 62 | 88 |
| Eleições a prefeito com apenas uma candidatura registrada no conjunto | 1 | 0 | 0 |

Em **15 das 18 disputas municipais de vereador**, algum candidato não eleito recebeu mais votos individuais que ao menos um eleito. Esse padrão decorre da necessidade de considerar o sistema proporcional e a situação oficial de totalização; não se deve ordenar os vereadores eleitos apenas pelos votos nominais.

A correspondência de nomes completos entre eleições **não é prova de identidade individual**, especialmente após mudança de nome. Da mesma forma, as alterações `DEM` → `UNIÃO` ou `PMDB` → `MDB` não demonstram, por si, mudança de filiação ou posicionamento pessoal: alterações e reorganizações partidárias devem ser analisadas separadamente.

## 4. Perfis históricos dos eleitos

Nos **18 registros de prefeito eleito**, todos apresentam gênero masculino na fonte. O nível de instrução informado se distribui em 10 com superior completo, 5 com ensino fundamental completo e 3 com ensino médio completo.

Nos **204 registros de vereadores eleitos**, 179 informam gênero masculino e 25 feminino (12,25% de registros femininos). Esses números descrevem registros das três cidades e seis eleições; não são uma medida nacional nem explicam causalmente os resultados.

A idade na posse não está presente em todos os anos e candidaturas, razão pela qual o observatório deve informar o número de registros com informação disponível antes de calcular médias.

## 5. Limitações e próximos dados

- **Já coletados:** registro e número de urna dos candidatos, sigla e coligação, situação de totalização, cargo, município, votos nominais e válidos, destinos dos votos (quando disponíveis), votação por zona, escolaridade, ocupação, gênero, idade na posse quando informada e documentação da origem.
- **Não coletados nesta etapa:** declarações completas de bens, receitas/despesas de campanha, votos de legenda, eleitorado/comparecimento, votos por seção e histórico de decisões judiciais após a extração. Esses blocos precisam de importadores e auditorias específicos.
- Os dados descrevem o resultado **registrado nos arquivos TSE no momento da extração**, que pode ser retificado; não constituem comprovação de quem efetivamente tomou posse ou concluiu mandato.
- Os indicadores não são estimativas de probabilidade nem previsões de eleições futuras.
- A validação independe de sites de terceiros e é repetível com `python3 scripts/import_tse_municipal_6cycles.py --year ANO`, `python3 scripts/analyze_tse_municipal_6cycles.py` e `node scripts/check_tse_municipal_six_data.js`. As fontes podem ser atualizadas pelo TSE.

> **Publicação:** branch de desenvolvimento `feature/observatorio-municipal-2028`, sem merge/deploy do painel de 2026.
