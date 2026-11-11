# Proxy de resultados municipais do TSE

O navegador não recebe `Access-Control-Allow-Origin` do endpoint EA20 do TSE (verificado em execução GitHub Actions em 25/10/2026). Por isso, a página estática não deve consultar o TSE diretamente.

## Implantação independente (Cloudflare Worker)

1. Criar um Worker Cloudflare com o conteúdo de `worker/tse-municipal-proxy.mjs`.
2. Configurar a variável `ALLOWED_ORIGIN` com a origem exata do painel, por exemplo `https://<usuario>.github.io` (sem barra final).
3. Publicar o Worker. O endpoint aceita somente `GET /config/mun-e006258-cm.json` e `GET /dados/{uf}/{uf}{codigoTSE}-c0001-e006258-u.json`.
4. Configurar antes do carregamento de `runoff-municipal-2026.js`: `window.MUNICIPAL_TSE_PROXY_BASE = 'https://SEU-WORKER.workers.dev';`.
5. Testar a cidade de Belo Horizonte, código IBGE `3106200`, código eleitoral EA12 `41238`, verificando total de seções, votos e timestamp.
6. Confirmar permissões de CORS, limites de requisições, comportamento sob indisponibilidade do TSE e consulta pelo navegador antes de liberar a seção publicamente.

Sem essa configuração, a interface informa que a consulta municipal está indisponível, sem inventar resultados. O Worker possui cache de 60 segundos e valida os caminhos solicitados, mas não foi implantado. Nenhuma credencial deve ser adicionada ao repositório.

A malha cartográfica do IBGE também apresentou timeout no teste remoto; testar a disponibilidade do serviço ou providenciar malhas estáticas de origem verificada antes de publicar.
