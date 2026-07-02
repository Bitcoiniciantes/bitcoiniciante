// Substitua a sua função de busca antiga por esta:
async function carregarHistorico() {
  try {
    // Busca o arquivo gerado pelo GitHub Action
    const response = await fetch('./dados/historico_dca.json');
    const historicoCompleto = await response.json();
    return historicoCompleto;
  } catch (e) {
    showError("Erro ao carregar os dados históricos.");
    return null;
  }
}

// Quando o usuário clicar em Simular:
async function executarSimulacao() {
  const historico = await carregarHistorico();
  if (!historico) return;

  // Pegue as datas digitadas pelo usuário no HTML
  const startDate = $('dca-start').value; 
  const endDate = $('dca-end').value;

  // Filtra apenas os meses que o usuário escolheu
  const dadosFiltrados = historico.filter(item => item.mes >= startDate && item.mes <= endDate);

  // ... (Aqui continua o seu código normal que monta o Chart.js e calcula o lucro) ...
}
