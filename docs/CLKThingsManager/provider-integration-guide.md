# Como adicionar um novo provedor

A arquitetura foi pensada para que um novo provedor (ex: Philips Hue, Google
Calendar, etc.) não exija tocar em rotas, autenticação ou no dispatcher
genérico do dispositivo. Passos:

1. **Crie a pasta** `backend/src/providers/<seu-provider>/`.
2. **Implemente o client HTTP** (`client.ts`) — chamadas cruas à API do
   provedor (troca de código, refresh, chamadas de ação). Veja
   `backend/src/providers/spotify/client.ts` como referência.
3. **Implemente as ações** (`actions.ts`) — um `Record<string, ProviderAction>`
   onde cada chave se torna o segmento de rota
   `/device/v1/<seu-provider>/<acao>`. Cada `ProviderAction` tem:
   - `method`: `"GET"` ou `"POST"`.
   - `handler({ accessToken, binding, input })`: faz a chamada real e retorna
     um JSON **simplificado** (pense do ponto de vista de um firmware com
     pouca memória — não repasse a resposta bruta do provedor).
4. **Implemente o adapter** (`adapter.ts`), satisfazendo a interface
   `ProviderAdapter` de `backend/src/providers/types.ts`:
   - `getAuthorizeUrl` — monta a URL de autorização OAuth do provedor.
   - `exchangeCodeForTokens` — troca `code` (+ `codeVerifier` do PKCE) por
     tokens.
   - `refreshAccessToken` — renova o access token usando o refresh token.
   - `fetchIdentity` — busca um identificador estável da conta no provedor
     (usado para não duplicar `ProviderConnection` se o usuário reconectar).
   - `actions` — o objeto do passo 3.
5. **Registre o provider** em `backend/src/providers/registry.ts`, adicionando uma
   linha ao `providerRegistry`.
6. **Nenhum outro arquivo precisa mudar** — as rotas de OAuth
   (`/api/v1/providers/:provider/connect|callback`), o dispatcher de
   dispositivo (`/device/v1/:provider/:action`) e o `TokenBroker` já operam de
   forma genérica sobre a interface.

## Checklist de segurança ao adicionar um provedor

- Nunca retorne o `accessToken`/`refreshToken` bruto em nenhum handler de
  ação — apenas dados derivados (nome da música, status, etc.).
- Se o provedor não usar PKCE, ainda assim gere e valide o `code_verifier`
  localmente (o backend simplesmente não o envia ao provedor) — mantém a
  consistência do fluxo genérico de `oauth-state.service.ts`.
- Trate explicitamente o caso de refresh falhar (token revogado pelo
  provedor) — o `TokenBroker` já marca a conexão como `NEEDS_REAUTH`
  automaticamente ao capturar uma exceção do `refreshAccessToken`.
