# Eleições municipais 2028 — plano de evolução

**Estado:** MVP isolado em `municipais-2028/`, sem publicação.
**Diretriz:** preservar a plataforma e o histórico de 2026; nunca renomear dados de 2026 como se fossem de 2028.

## Objetivo

Observatório independente para consultar prefeito/vice, vereadores e a evolução eleitoral municipal. Recorte inicial: Guarda-Mor, Vazante e Paracatu (MG). A estrutura deve permitir outras UFs sem criar dependências de 2026.

## Marcos eleitorais

- 1º turno: **01/10/2028**, primeiro domingo de outubro.
- 2º turno, se aplicável: **29/10/2028**, último domingo de outubro.
- Prazos de registro, convenções, propaganda, pesquisas e prestação de contas: **aguardar resoluções/calendário do TSE de 2028**; não reutilizar automaticamente datas de 2024.
- Prefeito: sistema majoritário. Segundo turno apenas onde houver mais de 200 mil eleitores e necessidade decorrente da votação, conforme a legislação vigente.
- Vereador: sistema proporcional. Não inferir vagas por mera ordem de votos individuais; conferir legenda/federação, quocientes, sobras e situação do candidato.

Referências: [TSE, resultados históricos](https://www.tse.jus.br/eleicoes/resultados-eleicoes), [TSE, calendário](https://www.tse.jus.br/eleicoes/calendario-eleitoral/calendario-eleitoral), [TSE, dados abertos 2024](https://dadosabertos.tse.jus.br/dataset/resultados-2024).

## Fonte de verdade

1. **IBGE:** nomes e códigos de 7 dígitos. Município = (UF, código IBGE). O código do município no TSE é distinto; cruzá-los usando tabela oficial, nunca por correspondência presumida.
2. **TSE 2020 e 2024:** resultados de candidatos a prefeito e vereador, votos de legenda, presença, abstenção, brancos/nulos, zona e seção quando oferecidos pela fonte. Registrar URL, data de obtenção, ano, cargo, turno, código TSE e código IBGE.
3. **TSE/DivulgaCandContas 2028:** apenas após disponibilidade oficial, com data de atualização e situação de candidatura.
4. **PesqEle 2028:** pesquisas identificadas por instituto, registro, campo, amostra, método, nível de confiança e margem; **nunca** misturar com votos apurados.
5. **TSE apuração 2028:** só integrar depois de verificar formatos reais publicados. O formato EA12/EA20 da eleição anterior não autoriza presumir caminhos, códigos ou a disponibilidade para 2028.

## Contratos de dados propostos

- `municipality`: `uf`, `ibge`, `name`, `tseCode` (somente com conferência oficial), `checkedAt`.
- `election`: `year`, `office`, `round`, `status` (`historical`, `upcoming`, `counting`, `finalized`), `sourceUrl`.
- `candidate`: `year`, `ibge`, `office`, `party`, `candidateId`, `name`, `registrationStatus`, `checkedAt`, `sourceUrl`.
- `result`: `year`, `ibge`, `tseCode`, `office`, `round`, `candidateId`, `votes`, `sectionCount`, `validVotes`, `sourceUrl`, `retrievedAt`.
- `poll`: `year`, `ibge`, `institute`, `registration`, `fieldStart`, `fieldEnd`, `sample`, `method`, `margin`, `sourceUrl`, `checkedAt`.

O MVP contém somente metadados territoriais verificáveis e registros vazios, com validador para futuras linhas históricas. O esquema acima é planejamento, não promessa de dados já importados.

## Etapas

- [x] Preservar o painel de 2026 sem alterar `main` ou Pages.
- [x] Criar página responsiva própria para 2028, seletor municipal e seções separadas para prefeitura, câmara, histórico e fontes.
- [x] Cadastrar códigos IBGE verificados de Guarda-Mor (**3128600**), Vazante (**3171006**) e Paracatu (**3147006**).
- [x] Bloquear apresentação de votos e candidatos fictícios no protótipo.
- [x] Adicionar testes de schema, calendário, fontes e navegação.
- [ ] Importar oficialmente a série histórica 2020/2024 para os três municípios, com conferência de votos válidos, legenda e candidatos.
- [ ] Acrescentar séries por município, zona e seção e visualizações territoriais, sem inferência de voto individual.
- [ ] Acrescentar filiação, registro de candidatura e financiamento declarados oficialmente para o ciclo 2028.
- [ ] Incorporar pesquisas somente com fonte, contexto metodológico e registro identificado.
- [ ] Integrar apuração municipal ao vivo **apenas** quando os arquivos de 2028 estiverem publicados e validados.
- [ ] Auditar permissões, performance, acessibilidade e integração ao menu principal.
- [ ] Publicar somente mediante autorização explícita.

## Critérios de aceitação

Uma tela que não tem dados oficiais deve informar a ausência deles. Votos, institutos, filiação e situação eleitoral nunca devem ser inventados, deduzidos de dados anteriores ou rotulados como oficiais antes da verificação da fonte. O projeto é informativo e não deve oferecer segmentação de eleitores, persuasão individual ou divulgação enviesada de candidaturas.
