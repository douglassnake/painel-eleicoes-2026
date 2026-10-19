/* Identidade cromática das candidaturas PRESIDENCIAIS — apenas apresentação. */
(() => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function classFor(nome, numero, cargo) {
    // Números 13/22 de outros cargos NÃO devem receber estas cores.
    const office = normalize(cargo);
    if (office !== '1' && office !== 'presidente' && office !== 'presidencia') return '';
    const n = String(numero ?? '').trim();
    const name = normalize(nome);
    if (n === '22' || name === 'flavio bolsonaro' || name.startsWith('flavio bolsonaro ')) return 'candidate-flavio';
    if (n === '13' || name === 'lula' || name.startsWith('luiz inacio lula')) return 'candidate-lula';
    return '';
  }
  window.PresidentialColors = Object.freeze({classFor});
})();
