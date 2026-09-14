# Deploy em uma VPS (simulação)

Este guia cobre como rodar o CLKThingsManager numa VPS única via Docker
Compose. É um roteiro para a fase de simulação — não foi executado neste
ambiente, então valide cada passo na sua própria VPS.

## 1. Pré-requisitos na VPS

- Docker + Docker Compose plugin instalados.
- Um domínio (ou subdomínio) apontando para o IP da VPS, se for expor via
  HTTPS — necessário para o redirect OAuth do Spotify funcionar com uma URL
  pública estável.
- Portas 80/443 liberadas no firewall (se for usar um reverse proxy com TLS).

## 2. Clonar o projeto e configurar o `.env`

```bash
git clone <seu-repo> clk-things-manager
cd clk-things-manager
cp .env.example .env
```

Tudo (frontend + API) fica atrás de um único nginx reverse proxy interno
(`proxy/nginx.conf`, serviço `proxy`, porta 18080) — `/api` e `/device` vão
pro backend, o resto vai pro frontend. Por isso `PUBLIC_BASE_URL` e
`FRONTEND_URL` devem ser o **mesmo** valor: o endereço público do proxy.

Preencha no `.env`:

- `PUBLIC_BASE_URL` **e** `FRONTEND_URL` com a mesma URL pública real (ex:
  `https://clk.seu-dominio.com`) — é a mesma origem para os dois.
- `SPOTIFY_REDIRECT_URI` com essa mesma URL + `/api/v1/providers/spotify/callback`.
- Gere segredos únicos para produção — **não reutilize os do `.env.example`
  nem os usados em desenvolvimento**:
  ```bash
  openssl rand -base64 32   # JWT_ACCESS_SECRET
  openssl rand -base64 32   # OAUTH_STATE_SECRET
  openssl rand -base64 32   # ENCRYPTION_KEY
  ```
- `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`/`SPOTIFY_REDIRECT_URI` — ver
  `docs/spotify-setup.md` (a Redirect URI cadastrada no Spotify deve ser a
  URL pública da VPS, não `localhost`).

**Backup separado da `ENCRYPTION_KEY`**: guarde-a fora do backup do banco
(ex: um gerenciador de segredos, ou pelo menos um arquivo separado, criptografado,
fora da VPS). Perdê-la torna todos os tokens de provedores salvos
irrecuperáveis — os usuários precisariam reconectar todas as contas.

## 3. Subir os serviços

```bash
docker compose up -d --build
```

Isso builda a API e o frontend, sobe o Postgres, roda `prisma migrate
deploy` automaticamente (ver `command:` do serviço `app` em
`docker-compose.yml`) e inicia tudo — o ponto de entrada único é o serviço
`proxy`, na porta 18080 do host.

Verifique:
```bash
docker compose ps
docker compose logs -f app
curl http://localhost:18080/health
```

## 4. TLS (recomendado: Caddy)

O `proxy` interno (nginx) já unifica frontend + API numa origem só, mas não
faz TLS. Não incluído neste repositório para manter o Compose simples — mas
recomendado antes de expor publicamente. Exemplo mínimo de `Caddyfile`
rodando na própria VPS (fora ou dentro do Compose, como preferir), na
frente do nosso `proxy`:

```
clk.seu-dominio.com {
    reverse_proxy localhost:18080
}
```

Caddy provisiona certificado Let's Encrypt automaticamente. Depois disso,
`PUBLIC_BASE_URL` **e** `FRONTEND_URL` no `.env` devem ser
`https://clk.seu-dominio.com`.

## 5. Backups

- **Banco de dados**: `docker compose exec db pg_dump -U clk clk_things_manager > backup.sql`
  — agende isso via cron.
- **`ENCRYPTION_KEY`**: backup manual e separado, conforme nota acima.
- **`.env`** inteiro: contém todos os segredos — trate como credencial
  sensível, nunca commite.

## 6. Atualizando para uma nova versão

```bash
git pull
docker compose up -d --build
```

O `prisma migrate deploy` no comando de start do serviço `app` aplica
migrations pendentes automaticamente antes de iniciar o servidor.

## Checklist de fumaça pós-deploy

- [ ] `curl https://clk.seu-dominio.com/health` retorna `{"status":"ok"}`.
- [ ] Registrar um usuário via `POST /api/v1/auth/register` funciona.
- [ ] Login funciona e retorna um `accessToken`.
- [ ] Cadastrar um dispositivo via `POST /api/v1/devices` retorna `serial` +
      `secret`.
- [ ] `GET /device/v1/status` com o secret do dispositivo retorna 200; com um
      secret errado retorna 401.
- [ ] Fluxo `/api/v1/providers/spotify/connect` → autorizar no Spotify →
      redireciona de volta com sucesso.
