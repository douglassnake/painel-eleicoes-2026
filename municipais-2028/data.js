/* Cadastro inicial: apenas identidades territoriais verificadas no IBGE.
   Resultados e candidaturas eleitorais permanecem vazios até importação oficial. */
(() => {
  'use strict';
  window.Municipal2028Data = Object.freeze({
    election: Object.freeze({
      year: 2028,
      firstRound: '2028-10-01',
      secondRound: '2028-10-29',
      note: 'Datas calculadas pela regra legal; acompanhar eventual calendário e alterações do TSE.'
    }),
    municipalities: Object.freeze([
      Object.freeze({ibge:'3128600',name:'Guarda-Mor',uf:'MG',ibgeUrl:'https://www.ibge.gov.br/cidades-e-estados/mg/guarda-mor.html'}),
      Object.freeze({ibge:'3171006',name:'Vazante',uf:'MG',ibgeUrl:'https://www.ibge.gov.br/cidades-e-estados/mg/vazante.html'}),
      Object.freeze({ibge:'3147006',name:'Paracatu',uf:'MG',ibgeUrl:'https://www.ibge.gov.br/cidades-e-estados/mg/paracatu.html'})
    ]),
    // Não inserir números estimados, pré-candidaturas ou pesquisas não verificadas.
    // Registros históricos devem ter fonte oficial, data, cargo e turno.
    historicalResults: Object.freeze([]),
    sources: Object.freeze({
      tseResults: 'https://www.tse.jus.br/eleicoes/resultados-eleicoes',
      tseOpenData: 'https://dadosabertos.tse.jus.br/dataset/resultados-2024',
      tseCalendar: 'https://www.tse.jus.br/eleicoes/calendario-eleitoral/calendario-eleitoral',
      ibgeMunicipalities: 'https://www.ibge.gov.br/explica/codigos-dos-municipios.php'
    })
  });
})();