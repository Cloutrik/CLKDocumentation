# Evolução do projeto

Histórico de decisões — o "por quê" por trás de escolhas que não são óbvias
só de ler o código atual. Para o estado técnico atual, ver
[arquitetura](./arquitetura.md); aqui é o diário de bordo.

## Origem

Ideia inicial: app Android (Flutter, focado em Android mas pensado pra
também rodar em iOS) que usa OCR/leitura de código de barras pra identificar
produtos no mercado, buscar preço e info nutricional, cruzar contra uma
lista de compras compartilhada, mostrar o total acumulado em tempo real e
avisar sobre item a mais/a menos na finalização. Em paralelo, um segundo
uso do mesmo dado: lista de "o que está faltando em casa", compartilhada
entre os moradores/família de um mesmo lar.

## OCR e leitura de código de barras: da tentativa única ao botão duplo

Primeira versão tentava decidir sozinha se a imagem capturada era um
código de barras ou uma etiqueta de texto. Na prática, o usuário precisava
escolher — e o fluxo original só deixava escanear (código de barras) *ou*
ler (OCR), nunca os dois de propósito na mesma tentativa. Corrigido pra
dois botões explícitos na mesma tela, deixando o usuário escolher o modo
antes de apontar a câmera, em vez de a UI "advinhar" e errar.

Bug relacionado: o nome do produto reconhecido por OCR às vezes saía como
uma sequência sem sentido (ex: `6430 abkeekde`) mesmo quando o texto bruto
reconhecido continha o nome real ("água sanitária com cloro ativo") em
outra linha — a heurística de "qual linha é o nome" pegava a linha errada.
Corrigido ajustando a heurística (hoje em
`mobile/lib/services/text_heuristics.dart`) e mostrando o texto bruto do
OCR ao lado do campo de nome editável no diálogo de confirmação, pra o
usuário corrigir manualmente quando a heurística errar — sem isso, o erro
silencioso (nome errado gravado sem revisão) era pior que pedir confirmação.

## Cosmos API: aceitar uma cota apertada em troca de cobertura

Open Food Facts só cobre alimentos — código de barras de item de limpeza,
higiene, etc. não retornava nada. Avaliado e aprovado explicitamente pelo
usuário: adicionar a **Cosmos API** (Bluesoft, base brasileira de GTIN)
como fonte primária, com Open Food Facts como fallback (só quando a Cosmos
não tem token configurado ou não acha o produto). Trade-off aceito
conscientemente: o plano gratuito da Cosmos é de **10 requisições por mês**
— severamente limitado, mas aceito por ora porque resolve o problema real
(cobertura de categoria) e o cache local (`Product.barcode`, global entre
lares) minimiza o número de consultas repetidas.

## Frontend web: escolha deliberada pelo caminho mais difícil

Sem Mac/conta Apple Developer disponível pra gerar um app iOS nativo, mas
com necessidade real de uso no iPhone. Como o app já era Flutter, compilar
pra web (`flutter build web`) resolvia sem precisar de Mac — mas duas
dependências usadas (`google_mlkit_barcode_scanning`,
`google_mlkit_text_recognition`) só existem pra Android/iOS, sem
implementação web.

Apresentadas duas opções: esconder o scanner na versão web (só cadastro
manual) ou manter o scanner **totalmente funcional** também na web via
câmera do navegador + OCR processado no backend — mais trabalho de
implementação. **Escolhida a segunda**, explicitamente, mesmo sendo a
opção mais trabalhosa — o scanner é o motivo de existir do app; uma versão
web sem ele seria um produto diferente. Resultado: `mobile_scanner`
(detecção de código de barras via `BarcodeDetector` do navegador) no lado
cliente, Tesseract.js (WASM) rodando no backend como substituto do OCR
on-device do ML Kit — ver [arquitetura](./arquitetura.md#scanner-mobile-vs-web).

## Roteamento em produção: de prefixos avulsos a `/checkorder` + `/checkorder/api`

Versão intermediária usava prefixos soltos (`/clk-check-order` pra API,
depois cogitado `/clk-check-order-app` pro frontend web) — descartado antes
de ir pra produção ao perceber que `/clk-check-order-app` colide por prefixo
de string com `/clk-check-order` nas regras do Traefik (`PathPrefix` é
literal, não teria como as duas rotas conviverem sem ambiguidade).
Resolvido primeiro com `/clkcheckorder-web` (sem colisão), depois
substituído de vez pelo esquema atual e mais legível: raiz `/checkorder` cai
no frontend, `/checkorder/api` (mais específico, prioridade maior no
Traefik) cai no backend. Qualquer mudança nesse prefixo exige reinstalar o
APK no tablet, porque a URL do backend é embutida no binário (não é
configurável em runtime) — confirmado e aceito ao trocar de esquema.

## Chatbot do Telegram: reaproveitando o ByteGasto

Modelado a partir do projeto irmão **ByteGasto** (assistente pessoal de
gastos, também via Telegram) — mesma stack de base: `python-telegram-bot`
(long polling, sem precisar de webhook público), Whisper local pra
transcrição de voz, e o **mesmo** servidor Ollama self-hosted
(`192.168.18.31:11434`, modelo `llama3.2:1b`) que o ByteGasto já usa — por
decisão explícita do usuário ("o resto de informação do olama pode usar o
mesmo do outro"), não uma segunda instância paralela.

### O ajuste de NLU pra modelo pequeno

Reportado: uma frase composta ("está faltando 4 litros de óleo e um saco
de arroz de 5kg", dois itens/unidades diferentes) não era entendida, e o
bot parecia mais lento que o ByteGasto. Diagnosticado empiricamente
(testes diretos contra o Ollama real, não só inspeção de código) que o
design original — um prompt de schema JSON abstrato pedindo pra o modelo
de 1B parâmetros decidir a ação **e** extrair múltiplos itens ao mesmo
tempo — não era confiável: o modelo chegava a ecoar literalmente
placeholders do prompt em vez de substituir por valores reais, e
frequentemente classificava tudo como "listar" independente da entrada.

Corrigido com abordagem híbrida (`chatbot/src/llm_agent.py`):
classificação de ação por regras determinísticas em Python
(regex/palavras-chave), LLM usado só pra extração — mais estreita e onde
o modelo pequeno é confiável — de produto(s) e quantidade(s). Isso também
resolve o "parece mais lento": `listar` e `desconhecido` agora não fazem
nenhuma chamada ao LLM (resposta imediata), diferente do design anterior
que sempre ia ao modelo independente da ação.

## CI/CD e documentação centralizada

Seguindo o mesmo padrão já em uso nos projetos irmãos
(`CLKOrchestratorJob`, `CLKCast`): publicação de imagens Docker Hub via
GitHub Actions a cada push em `main`/tag, build e release do APK Android
automatizado, e sincronização da pasta `docs/` deste projeto pra um site
central de documentação (Docusaurus, repositório `CLKDocumentation`) via
`DocsSyncCLI` — em vez de cada projeto manter sua documentação isolada e
sem descoberta cruzada.

## Pendências conhecidas

- **Google Sign-In**: instruções de configuração (criar projeto no Google
  Cloud Console, gerar OAuth Client ID web, SHA-1 do keystore de debug)
  já repassadas; falta o usuário colar o Client ID resultante em
  `mobile/lib/config/google_config.dart` e `backend/.env`
  (`GOOGLE_CLIENT_ID`) — sem isso, o botão de login com Google mostra um
  aviso em vez de autenticar.
- **Cota da Cosmos API**: 10 requisições/mês no plano gratuito — aceito
  por ora; upgrade de plano é uma decisão futura, não uma pendência técnica.
