---
title: Commits e PRs
description: Regras para simular trabalho em time grande.
---

# Commits e PRs

O objetivo e treinar um fluxo parecido com empresas que trabalham com times, auditoria e CI/CD.

## Regras sugeridas

- Criar branch por desafio.
- Usar conventional commits.
- Abrir PR com descricao clara.
- Relacionar issue, evidencia e criterio de aceite.
- Corrigir feedback sem apagar historico importante.

## Exemplo

```bash
git checkout -b feat/order-healthcheck
git commit -m "feat(order): add healthcheck endpoint"
git push origin feat/order-healthcheck
```

O PR deve explicar o que mudou, como testar e qual evidencia foi gerada.
