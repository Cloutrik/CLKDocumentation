# Manual de instalação e funcionamento — CLKCast

Este manual cobre o ciclo completo: subir o backend/painel, cadastrar
conteúdo, e instalar o app numa TV (ou num TV box) — incluindo como
simular um TV box na sua própria máquina antes de mexer num dispositivo
de verdade.

## 1. Visão geral

O CLKCast tem três partes que rodam de forma independente:

1. **Backend + painel** (`docker-compose.yml`, na raiz) — API, banco,
   storage de mídia e a interface web de administração. Roda num servidor
   (ou na sua máquina, pra testar) e fica de pé o tempo todo.
2. **App Android TV** (`android/`) — o player que roda em cada TV/TV box,
   instalado uma vez por dispositivo.
3. **Headwind MDM** (`hmdm/`) — opcional, facilita instalar/atualizar o
   app nas TVs remotamente. Sem ele, a instalação é manual (via ADB).

## 2. Requisitos

- Docker + Docker Compose (pro backend/painel/HMDM)
- Android Studio ou só o `adb`/`gradlew` (pra buildar e instalar o app)
- Um TV box/TV com Android (ou o emulador — ver seção 7) com depuração
  USB habilitada, se for instalar via ADB

## 3. Subindo o backend

```bash
cp .env.example .env   # ajuste os valores antes de produção
docker compose up -d --build postgres backend frontend minio
```

- Painel: `http://localhost:8080`
- API: `http://localhost:8000`

**Importante pra usar com TVs de verdade (não só testando na mesma
máquina):** troque `MINIO_PUBLIC_URL` no `.env` pro IP real do servidor
na rede (ex: `http://192.168.1.50:9000`) — as TVs precisam alcançar essa
URL pra baixar fotos/vídeos, e `localhost` só funciona a partir da própria
máquina que roda o Docker.

⚠️ **Isso também vale testando no emulador** (seção 8), não só em TV
física — já aconteceu neste projeto: com `MINIO_PUBLIC_URL=localhost`, o
vídeo tocava normal no navegador do painel mas ficava com **tela preta**
no app (erro `unexpected end of stream` no ExoPlayer/logcat), porque
`localhost` de dentro do emulador/dispositivo não aponta pro host. A
correção é usar o IP da rede Wi-Fi/Ethernet real da máquina (ex:
`192.168.x.x`, veja com `ipconfig`/`ifconfig`) em vez de `localhost` —
funciona tanto do navegador do host quanto do emulador quanto de uma TV
física. Se você já tinha cadastrado conteúdo antes de fazer essa troca,
as URLs antigas continuam salvas erradas no banco — corrija na mão
(`UPDATE content SET url = replace(url, 'http://localhost:9000',
'http://SEU-IP:9000');` direto no Postgres) ou edite cada item pelo
painel.

## 4. Primeiro acesso ao painel

1. Acesse `http://localhost:8080` (ou o IP do servidor) — vai cair na
   tela de login.
2. Entre com `ADMIN_USERNAME`/`ADMIN_PASSWORD` do `.env` (default
   `admin`/`clkcast`).

## 5. Cadastro de conteúdo, grupos e TVs

1. **Conteúdo** — cadastre fotos, vídeos ou URLs (upload de arquivo ou
   colar uma URL já hospedada).
2. **Grupos** (opcional) — agrupe TVs que devem exibir o mesmo conteúdo.
3. **TVs** — cada TV aparece sozinha na lista (com status "Aguardando
   pareamento") *depois* que o app abre nela pela primeira vez (ver seção
   6). Pra vincular, o jeito mais simples é clicar no botão **"Vincular"**
   na própria linha e salvar um nome — não precisa digitar nenhum código
   quando é só uma TV pendente por vez. Se tiver várias TVs pendentes ao
   mesmo tempo e precisar garantir qual é qual, use o botão "Vincular por
   código" (o código de 6 dígitos aparece na tela da TV específica).
4. Atribua conteúdo à TV específica e/ou ao grupo dela — a playlist final
   é a mescla dos dois, ordenada.

## 6. Instalando o app numa TV

### 6.1. Build do APK

```bash
cd android
./gradlew assembleDebug
```

Gera `android/app/build/outputs/apk/debug/app-debug.apk`. Antes de
buildar, confira `CLKCAST_API_BASE_URL` em `android/gradle.properties` —
precisa apontar pro IP real do backend (não `10.0.2.2`, que só funciona
em emulador).

> O build `assembleDebug` serve pra testes/simulação interna. Antes de
> distribuir de verdade (ex: via Headwind MDM em produção), gere um build
> assinado (`assembleRelease` + keystore) — isso ainda não está
> configurado neste projeto.

### 6.2. Opção A — instalação manual via ADB (mais simples, poucas TVs)

Com a TV/TV box na mesma rede e depuração USB/rede habilitada:

```bash
adb connect <ip-da-tv>:5555      # se for ADB via rede
adb install app-debug.apk
```

Abra o app na TV — ela aparece sozinha na lista do painel como
"Aguardando pareamento". Clique em "Vincular" na linha dela, dê um nome,
salve. Pronto — a TV já começa a puxar a playlist.

Essa é a via recomendada pro **TV box sem câmera** (a maioria) — não dá
pra usar o QR code de enrollment do Headwind MDM sem câmera (ver seção
7.4).

### 6.3. Opção B — via Headwind MDM (escala, várias TVs)

Ver seção 7 — o HMDM permite empurrar o APK remotamente pra várias TVs de
uma vez e manter modo kiosk, mas o enrollment inicial de um dispositivo
sem câmera também precisa de um passo manual (instalar o agente do HMDM
como APK comum, não por QR).

## 7. Headwind MDM (opcional)

### 7.1. Subindo

```bash
docker compose up -d hmdm-postgres hmdm-server
```

Primeira subida demora ~4-5min (baixa o `.war`). Depois de confirmar que
subiu certo, edite `docker-compose.yml`: `FORCE_RECONFIGURE` de `"true"`
pra `"false"` e reinicie (`docker compose up -d hmdm-server`) — sem isso,
todo restart volta a demorar os mesmos 4-5min à toa.

### 7.2. Configuração pra rede real

No `.env`, ajuste antes de usar com TVs de verdade:

```
HMDM_BASE_DOMAIN=<ip-do-servidor>    # não localhost
HMDM_LOCAL_IP=<ip-do-servidor-se-atras-de-nat>
```

### 7.3. Acesso e primeiro login

`http://<ip-do-servidor>/` (porta 80). Login `admin`/`admin` — força
troca de senha no primeiro acesso.

### 7.4. Enrollment de um dispositivo — dois métodos

O HMDM suporta dois métodos de enrollment (confirmado na documentação
oficial, [h-mdm.com/quick-start](https://h-mdm.com/quick-start/)):

- **QR code** (padrão): em Configurações, clique no ícone de QR da
  configuração desejada, e na TV toque 6x na tela de boas-vindas inicial
  pra abrir o modo de provisionamento — **precisa de câmera**.
- **APK comum** (alternativa oficial pra dispositivos sem câmera): baixe
  o agente do HMDM como um APK normal e instale via ADB, igual à seção
  6.2. Isso NÃO dá Device Owner completo ao HMDM (algumas garantias de
  bloqueio/kiosk ficam mais fracas que via QR), mas ainda permite gerenciar
  o dispositivo.

**A maioria dos TV boxes não tem câmera** — planeje usar o método via APK
comum, não o QR code.

### 7.5. Ainda falta fazer (não testado)

- Subir o APK do CLKCast em "Aplicativos" no HMDM e vincular a uma
  Configuration, pra ele empurrar automaticamente pras TVs.
- Configurar modo kiosk restringindo a TV só ao app do CLKCast.
- Testar o enrollment via APK comum (seção 7.4) numa TV/emulador real.
- HTTPS real (hoje só `PROTOCOL=http`, ok pra rede local).

## 8. Simulando um TV box na sua máquina

Dá sim pra simular sem precisar de hardware — e do jeito mais realista
possível, já que emuladores Android também não têm câmera de verdade por
padrão, então o teste reproduz exatamente a limitação real (seção 7.4:
precisa instalar via APK comum, não QR).

### 8.1. Emulador Android TV (recomendado)

O Android Studio/SDK já usado neste projeto suporta criar um dispositivo
virtual (AVD) com uma imagem de sistema **Android TV** (interface
Leanback, controle por D-pad em vez de touch) — mais fiel a um TV box
real que um emulador de celular comum.

Passos (via Android Studio, mais simples que linha de comando):

1. Abra o **Device Manager** no Android Studio.
2. "Create Device" → categoria **TV** → escolha um perfil (ex: "Android
   TV (1080p)").
3. Escolha uma imagem de sistema Android TV (baixa automaticamente se
   não tiver — o download é grande, ~1GB).
4. Inicie o emulador.
5. Instale o app: `adb install app-debug.apk` (o emulador já aparece
   como device no `adb devices`).
6. Configure `CLKCAST_API_BASE_URL=http://10.0.2.2:8000/` antes de
   buildar — `10.0.2.2` é como o emulador acessa o `localhost` da sua
   máquina.

**✅ Validado neste projeto** com um AVD Android TV real (`android-36;
android-tv;x86_64`, 1920x1080, sem câmera, D-pad): o app renderizou em
tela cheia no formato correto de TV (não o layout vertical de celular),
o fluxo completo funcionou — registro (`POST /devices/register`), exibição
do código de pareamento, polling de status, e a transição pra tela de
player assim que o dispositivo foi vinculado pelo painel (heartbeat +
manifest disparados corretamente). Sem problemas encontrados.

### 8.2. Testando o Headwind MDM com o emulador

Como o emulador não tem câmera de verdade (mesma limitação de um TV box),
o teste do enrollment via HMDM reproduziria fielmente a seção 7.4: você
instalaria o agente do HMDM via `adb install` (não por QR), o que é
exatamente o método que vai usar no TV box real depois. Isso significa
que validar no emulador primeiro é um bom ensaio pra depois repetir no
hardware real sem surpresas. **Ainda não testado** — o teste feito neste
projeto validou o app do CLKCast no emulador de TV, mas não o enrollment
via HMDM propriamente (precisa subir o `hmdm-server`, que fica parado por
padrão, e repetir os passos da seção 7 apontando pro dispositivo do
emulador).

### 8.3. Sem Android Studio (linha de comando, sem `avdmanager`)

Se `cmdline-tools`/`avdmanager` não estiverem instalados (comum em setups
só com o SDK, sem Android Studio completo), dá pra criar o AVD na unha:

1. Baixe a imagem de sistema direto do Google (substitua a versão se
   necessário — confira em `sys-img/android-tv/sys-img2-3.xml` no
   [repositório de imagens](https://dl.google.com/android/repository/sys-img/android-tv/sys-img2-3.xml)):
   ```bash
   curl -LO https://dl.google.com/android/repository/sys-img/android-tv/x86_64-36_r04.zip
   unzip x86_64-36_r04.zip -d "$ANDROID_HOME/system-images/android-36/android-tv/"
   ```
2. Crie `~/.android/avd/<Nome>.ini` e `~/.android/avd/<Nome>.avd/config.ini`
   manualmente — use um AVD existente como modelo e ajuste
   `hw.lcd.width/height` pra `1920`/`1080`, `hw.dPad=yes`,
   `hw.camera.back=none`/`hw.camera.front=none` (TV não tem câmera),
   `tag.id=android-tv`, e `image.sysdir.1` apontando pra pasta baixada no
   passo 1.
3. `emulator.exe -avd <Nome> -no-snapshot` pra iniciar.

Foi assim que o teste desta seção foi feito neste projeto (sem
`avdmanager` disponível no ambiente).

## 9. Troubleshooting

- **Backend não sobe na primeira vez** (`Connection refused` no log):
  o Postgres ainda não tinha terminado de iniciar. O `restart:
  unless-stopped` do compose reinicia o backend automaticamente até
  conseguir conectar — espere alguns segundos e confira `docker compose
  ps`.
- **QR code do HMDM não abre / erro de conexão**: confira se
  `HMDM_BASE_DOMAIN` bate com a porta que o serviço está exposto (a
  porta 80 é proposital — ver `hmdm/README.md`).
- **TV não aparece na lista depois de instalar o app**: confira se
  `CLKCAST_API_BASE_URL` no app aponta pro IP certo do backend, e se a
  TV está na mesma rede/consegue alcançar essa URL (teste abrindo
  `http://<ip>:8000/health` num navegador na própria TV, se possível).
