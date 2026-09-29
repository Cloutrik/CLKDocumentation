# CLKCheckOrder

App de família/moradores pra escanear produtos no mercado (código de barras
+ OCR de etiqueta), cruzar com a lista de compras, acompanhar o valor total
em tempo real e manter uma lista compartilhada do que está faltando em casa
— inclusive por um bot de Telegram com voz.

- [Arquitetura](./arquitetura.md) — componentes, fluxos, decisões técnicas
- [Banco de dados](./banco-de-dados.md) — schema Prisma, entidades e relações
- [Evolução do projeto](./evolucao.md) — histórico de decisões e por quê

## Visão geral rápida

| Componente | Tecnologia | Papel |
|---|---|---|
| App mobile/web | Flutter (Android + Web) | Escaneia produtos, mostra lista de compras e total da compra |
| Backend | Node.js + Express + Prisma | API única consumida pelo app, pelo bot e (indiretamente) pelo Telegram |
| Postgres | Postgres 16 | Dados relacionais (usuários, lares, produtos, listas, sessões de compra) |
| Chatbot | Python + python-telegram-bot | Gerencia "itens em falta em casa" por texto ou voz no Telegram |
| Ollama (externo) | llama3.2:1b | LLM self-hosted usado pelo chatbot pra extrair item/quantidade do texto |

Repositório único (monorepo) com quatro pastas de primeiro nível:
`backend/`, `mobile/`, `chatbot/`, `web/` (build estático do Flutter Web,
gerado por `flutter build web` — não é código-fonte próprio).
