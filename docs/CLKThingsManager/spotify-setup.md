# Configurando um app no Spotify Developer Dashboard

Necessário para a Fase 3 (conectar contas Spotify) funcionar.

1. Acesse https://developer.spotify.com/dashboard e faça login com sua conta
   Spotify.
2. Clique em **"Create app"**.
   - **App name**: qualquer nome (ex: "CLKThingsManager Dev").
   - **App description**: qualquer descrição.
   - **Redirect URI**: cole exatamente o valor de `SPOTIFY_REDIRECT_URI` do seu
     `.env` — por padrão em desenvolvimento local via `docker compose up`
     (passa pelo proxy único, porta 18080):
     ```
     http://localhost:18080/api/v1/providers/spotify/callback
     ```
     Se estiver rodando o backend standalone (`npm run dev` em `backend/`,
     sem o proxy), use a porta 3000 direto. Em produção (VPS), use a URL
     pública real, ex: `https://seu-dominio.com/api/v1/providers/spotify/callback`.
   - **Which API/SDKs are you planning to use?**: marque "Web API".
3. Aceite os termos e crie o app.
4. Na página do app criado, clique em **"Settings"** para ver:
   - **Client ID** → copie para `SPOTIFY_CLIENT_ID` no `.env`.
   - **Client secret** → clique em "View client secret", copie para
     `SPOTIFY_CLIENT_SECRET` no `.env`.
5. Confirme que `SPOTIFY_REDIRECT_URI` no `.env` é **idêntica**, caractere por
   caractere, à Redirect URI cadastrada no dashboard — o Spotify rejeita a
   troca de código se não for exatamente igual.

## Modo de desenvolvimento (importante)

Apps novos no Spotify Developer Dashboard ficam em **modo de desenvolvimento**,
o que significa que só usuários explicitamente adicionados como testadores
conseguem autorizar o app. Para adicionar um usuário de teste:

1. Na página do app, vá em **"User Management"**.
2. Adicione o e-mail da conta Spotify que você vai usar para testar.

Para liberar o app para qualquer usuário Spotify, é necessário solicitar
**"Extended Quota Mode"** no dashboard — não é necessário para a simulação
local/VPS deste projeto.

## Testando o fluxo

Com o backend rodando e um usuário já registrado/logado no CLKThingsManager:

1. Faça login para obter o `accessToken`.
2. Chame (com `Authorization: Bearer <accessToken>`):
   ```
   GET {PUBLIC_BASE_URL}/api/v1/providers/spotify/connect
   ```
   Isso retorna `{"authorizeUrl": "..."}` (não é mais um redirect direto —
   a rota exige o header, que uma navegação de página inteira do browser
   não consegue mandar; ver `frontend/src/api/providers.ts` para o fluxo
   completo: fetch autenticado → `window.location.href = authorizeUrl`).
   Para testar manualmente via curl, copie o valor de `authorizeUrl` e cole
   no navegador.
3. Você será redirecionado para a tela de autorização do Spotify. Aceite.
4. O Spotify redireciona de volta para `.../providers/spotify/callback`, que
   troca o código por tokens e redireciona para
   `{FRONTEND_URL}/providers/connected?provider=spotify`.
5. Confirme com `GET /api/v1/providers/connections` que a conexão aparece com
   `status: "ACTIVE"`.
