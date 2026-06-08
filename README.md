# Bitcoin Iniciantes — versão otimizada

Reestruturação do arquivo único `index otimizar.html` (≈120 KB, tudo embutido) em um projeto
modular, mais rápido e mais confiável — com foco especial em desempenho no mobile.

## Estrutura

```
Otimização Site Bitcoiniciantes/
├── index.html                  HTML limpo e semântico (sem CSS/JS inline)
├── assets/
│   ├── css/
│   │   ├── main.css            layout, navegação, seções, formulário, FAQ, footer
│   │   └── widgets.css         estilos dos 6 widgets
│   └── js/
│       ├── config.js           endpoints, chaves e CDNs num só lugar
│       ├── utils.js            formatação, fetch com timeout/retry, lazy-load
│       ├── main.js             menu, FAQ, formulário e orquestração dos widgets
│       └── widgets/
│           ├── btc-ticker.js   cotação BTC ao vivo (hero)
│           ├── fear-greed.js   índice de medo & ganância
│           ├── mempool.js      taxas de transação
│           ├── sif.js          simulador de independência financeira (offline)
│           ├── dca.js          simulador DCA (Chart.js sob demanda)
│           └── mural.js        mural de sentimentos (Firebase sob demanda)
├── index otimizar.html         arquivo original (mantido como referência)
└── README.md
```

## O que mudou e por quê

### Desempenho (principalmente no mobile)
- **Lazy-load dos widgets**: cada widget só carrega seu JS e dispara APIs/WebSocket quando
  entra na viewport (`IntersectionObserver`). Antes, os 6 widgets disparavam tudo no load.
- **Chart.js e Firebase sob demanda**: libs pesadas só baixam quando o usuário chega no
  simulador DCA ou no mural. Antes carregavam sempre.
- **Google Analytics no fim do body** com `async`, sem bloquear a renderização inicial.
- **CSS e JS externos**: permitem cache do navegador entre páginas/visitas. Antes, 120 KB
  re-baixados a cada carregamento.
- **`preconnect`** para fontes e Binance, acelerando a primeira conexão.

### Confiabilidade
- **`fetchJSON` com timeout + retry**: requisições que travam são abortadas e retentadas,
  em vez de ficar presas no "—" para sempre.
- **Falhas isoladas**: um widget que falha não derruba os outros.
- **Fontes corrigidas**: `DM Mono` (usada nos números) agora é realmente carregada.

### Manutenção
- **Código sem duplicação**: formatação de moeda e fetch centralizados em `utils.js`.
- **Configuração única**: trocar a chave do Formspree, do Firebase ou um endpoint é feito
  só em `config.js`.

## Como rodar

Por usar caminhos relativos e `fetch`, sirva via HTTP (não abra com `file://`):

```bash
# Python
python -m http.server 8000
# depois acesse http://localhost:8000
```

## Observações de segurança
- As chaves do Firebase e do Formspree são públicas por natureza (client-side). A proteção
  real do mural deve ser feita por **regras de segurança no Firebase Realtime Database**.
- O widget MSTR depende de um proxy CORS público (`allorigins.win`), que pode ficar
  indisponível — por isso falha de forma silenciosa, sem quebrar o card.
