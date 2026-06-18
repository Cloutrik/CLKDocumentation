---
title: Qualidade
description: Criterios usados para provar qualidade na CLOUTRIK.
---

# Qualidade comprovada

Na CLOUTRIK, qualidade nao e opiniao solta. Ela precisa aparecer como evidencia.

## Quality gates

Um desafio pode exigir:

- Lint sem erro.
- Testes automatizados.
- Coverage minimo.
- Build reproduzivel.
- Revisao de codigo.
- Checklist de seguranca.
- Documentacao atualizada.

## Score de qualidade

O score representa a saude da entrega. Um exemplo:

| Criterio | Peso |
| --- | ---: |
| Testes passando | 25 |
| Coverage | 20 |
| Revisao aprovada | 20 |
| Observabilidade | 20 |
| Documentacao | 15 |

O ranking pode usar esse score como base para evitar que quantidade de PRs valha mais que entrega bem feita.
