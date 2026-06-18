---
title: CI/CD
description: Como os pipelines validam qualidade e publicacao.
---

# CI/CD

CI/CD e a esteira que transforma contribuicao em evidencia.

## Pipeline minimo

```yaml
name: quality-gates

on:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
      - run: npm run build
```

Na CLOUTRIK, um pipeline verde pode gerar XP, mas somente quando o desafio tambem cumpre os criterios definidos.
