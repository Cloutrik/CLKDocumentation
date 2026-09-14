# Acesso externo com ngrok

Serve para validar o backend rodando na VPS (ou até na sua máquina) a partir
de fora, sem precisar configurar DNS/TLS ainda — útil para testar o fluxo
OAuth do Spotify de ponta a ponta (o Spotify não aceita `redirect_uri` para
um IP privado, mas aceita uma URL `https://...ngrok-free.app`).

## 1. Conta e authtoken

1. Crie uma conta em https://dashboard.ngrok.com (tem plano grátis).
2. Copie seu authtoken em https://dashboard.ngrok.com/get-started/your-authtoken.
3. No `.env` do projeto, preencha:
   ```
   NGROK_AUTHTOKEN=seu-token-aqui
   ```

## 2. (Recomendado) domínio estático gratuito

Sem isso, a URL pública muda a cada vez que o container do ngrok reinicia —
o que obriga reconfigurar `PUBLIC_BASE_URL`/`SPOTIFY_REDIRECT_URI` toda vez.
O ngrok oferece 1 domínio estático gratuito por conta:

1. Acesse https://dashboard.ngrok.com/domains e reserve um domínio (algo como
   `algo-aleatorio.ngrok-free.app`).
2. No `.env` (a URL **completa**, com `https://` — é assim que o próprio
   dashboard do ngrok mostra o comando hoje):
   ```
   NGROK_URL=https://algo-aleatorio.ngrok-free.app
   ```

## 3. Subir o túnel junto com o resto da stack

```bash
docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d
```

Isso sobe `db` + `app` + `frontend` + `proxy` normalmente e adiciona um
serviço `ngrok` apontando para `proxy:80` — o proxy (`proxy/nginx.conf`) é
quem decide se cada requisição vai pro backend (`/api`, `/device`) ou pro
frontend (o resto), então uma URL só do ngrok serve tudo, sem CORS.

Veja a URL pública:
- Dashboard local do ngrok: http://localhost:4040
- Ou nos logs: `docker compose logs ngrok`

## 4. Apontar a API e o frontend para a URL pública

Com a URL do ngrok em mãos (ex: `https://algo-aleatorio.ngrok-free.app`):

1. No `.env`, atualize (o **mesmo** valor nos dois — é a mesma origem,
   através do proxy):
   ```
   PUBLIC_BASE_URL=https://algo-aleatorio.ngrok-free.app
   FRONTEND_URL=https://algo-aleatorio.ngrok-free.app
   SPOTIFY_REDIRECT_URI=https://algo-aleatorio.ngrok-free.app/api/v1/providers/spotify/callback
   ```
2. Atualize a Redirect URI cadastrada no Spotify Developer Dashboard para o
   mesmo valor (ver `docs/spotify-setup.md`).
3. Rebuilde e reinicie (o frontend precisa reconstruir, não só reiniciar —
   embora com caminhos relativos ele nem dependa mais dessas variáveis, o
   `app` ainda usa `PUBLIC_BASE_URL`/`FRONTEND_URL` pra CORS e OAuth):
   ```bash
   docker compose up -d --build
   ```

## 5. Validar de fora

```bash
curl https://algo-aleatorio.ngrok-free.app/health
```

E repita o roteiro de `docs/deployment-vps.md` (registrar usuário, login,
cadastrar dispositivo, `/device/v1/status`, conectar Spotify) usando a URL do
ngrok em vez de `localhost`.

## Encerrando

```bash
docker compose -f docker-compose.yml -f docker-compose.ngrok.yml down
```

(Isso não afeta o `docker-compose.yml` principal — o overlay do ngrok é
totalmente opcional e feito para não interferir no que você já roda hoje.)
