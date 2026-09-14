# Script de deploy (`deploy.ps1`)

`deploy.ps1`, na raiz do projeto, empacota o repositório, envia via SCP para
um servidor remoto (o seu, na rede local ou onde for) e sobe/atualiza via
`docker compose up -d --build`. **Não é versionado de propósito** (está no
`.gitignore`) — é específico do seu ambiente, não faz parte do código do
projeto. Se você clonar o repo em outra máquina, crie esse arquivo de novo
(o conteúdo fica documentado aqui) ou copie de onde ele foi gerado.

## Pré-requisitos

- Windows com OpenSSH Client habilitado (`ssh`, `scp`, `tar` — todos nativos
  no Windows 10/11, nada extra pra instalar).
- O servidor remoto com Docker + Docker Compose plugin instalados, acessível
  por SSH, e o usuário SSH no grupo `docker` (`sudo usermod -aG docker
  <usuario>` no servidor, uma vez só — sem isso, `docker compose` falha com
  "permission denied ... /var/run/docker.sock").
- Seu `.env` local precisa existir e estar preenchido (copie
  `.env.example` se ainda não tiver) — ele **vai junto no pacote enviado**,
  veja a nota abaixo.

## `.env`: o local é a fonte da verdade

De propósito, para simplificar (isso é pensado para um servidor de teste,
não uma VPS de produção com segredos que não podem se misturar): o `.env`
**local** vai dentro do pacote enviado, e cada deploy **sobrescreve** o
`.env` do servidor com ele. Não tem geração de segredo nem `.env` separado
no servidor.

Consequência: `PUBLIC_BASE_URL`/`SPOTIFY_REDIRECT_URI` no seu `.env` local
provavelmente apontam pra `localhost` — isso não afeta registro, login ou
cadastro de dispositivos no servidor remoto, só o fluxo de conectar o
Spotify (que precisa de uma URL alcançável de fora, ver
`docs/external-access-ngrok.md` se for testar isso). `DATABASE_URL` não
importa o que está no `.env` — o `docker-compose.yml` já força o valor
correto (`db:5432`) via `environment:`, então nunca quebra por causa disso.

## Uso

```powershell
.\deploy.ps1
```

O script pergunta, na hora:
- Host/IP do servidor
- Usuário SSH
- Porta SSH (Enter = 22)
- Diretório remoto (Enter = `~/clk-things-manager`)

A **senha** não é pedida pelo script — é o próprio `ssh`/`scp` do Windows
que pede (prompt nativo do OpenSSH), na hora de conectar. Isso evita guardar
a senha em qualquer variável do script. Ela é pedida **mais de uma vez**
(uma pro SCP, outra(s) pro(s) comando(s) SSH) — não usamos multiplexação de
conexão (`ControlMaster`/`ControlPath`) porque o suporte disso no OpenSSH do
Windows é instável e pode até quebrar a conexão (`getsockname failed: Not a
socket`). Não é erro, só digite a senha de novo quando pedir.

## O que ele faz

1. Empacota o projeto num `.tar.gz` (em `%TEMP%`) — o `.env` local vai
   junto; exclui só `node_modules`, `.git`, `dist` e build do PlatformIO.
2. Envia esse `.tar.gz` por SCP para `/tmp/` no servidor.
3. Via SSH, extrai no diretório remoto, roda `docker compose down` (limpa
   qualquer container de um deploy anterior — protege contra "port is
   already allocated" se algo não subiu limpo da vez passada) e depois
   `docker compose up -d --build` — isso serve tanto pro primeiro deploy
   quanto pra atualizar um já existente. Custa alguns segundos de downtime
   a cada deploy (para tudo antes de recriar), mesmo quando nada mudou.
4. Roda `docker compose ps` pra você conferir que subiu.

Se o seu `.env` **local** tiver `NGROK_AUTHTOKEN` preenchido, o script
detecta isso sozinho e inclui `docker-compose.ngrok.yml` em todos os
comandos acima automaticamente — o túnel sobe/atualiza junto, sem precisar
rodar nada à parte depois (mostra "NGROK_AUTHTOKEN encontrado..." no
início da execução quando isso acontece).

Rodar o script de novo depois de alterar código é a forma de "atualizar" —
não tem um comando separado para isso.

## Ambiente de desenvolvimento vs "normal"

O `docker-compose.yml` sozinho já é o que o script sobe no servidor (modo
"normal": builda a imagem final, roda o `dist/` compilado). Para
desenvolvimento local com hot-reload (código rodando direto do
`backend/src/` via `tsx watch`, sem rebuildar a imagem a cada mudança), use
o overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

O ngrok continua num overlay totalmente separado
(`docker-compose.ngrok.yml`, ver `docs/external-access-ngrok.md`), pra não
misturar com nem o modo normal nem o dev.
