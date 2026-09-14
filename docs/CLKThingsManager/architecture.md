# Arquitetura

## Visão geral

O CLKThingsManager é um backend que funciona como "gerenciador de dispositivos +
cofre de tokens" para dispositivos IoT (ESP32/CYD rodando Arduino/C++). Em vez
de cada firmware implementar OAuth e falar diretamente com a API de um
provedor terceiro (ex: Spotify), o dispositivo se cadastra neste backend e
consome uma API HTTP simplificada. O backend guarda os tokens OAuth do usuário
de forma criptografada e traduz as chamadas simples do dispositivo em chamadas
reais à API do provedor.

```
[Dispositivo CYD/ESP32]  --HTTP simples-->  [CLKThingsManager]  --OAuth/API real-->  [Spotify, ...]
        |                                          |
   Authorization: Device <serial>.<secret>    guarda tokens criptografados (AES-256-GCM)
                                               por usuário, nunca expõe para o dispositivo
```

## Três atores de autenticação

1. **Usuário humano** — login com e-mail/senha, recebe um JWT de acesso (15
   min) e um refresh token opaco rotativo em cookie httpOnly. Usado nas rotas
   `/api/v1/*` (exceto callback OAuth).
2. **Dispositivo** — cada dispositivo tem um `serial` público e um `secret`
   mostrado uma única vez na criação/rotação. Autentica via header
   `Authorization: Device <serial>.<secret>` nas rotas `/device/v1/*`.
3. **Provedor (OAuth)** — o backend conecta a conta do usuário no provedor
   (ex: Spotify) via Authorization Code + PKCE. O dispositivo nunca participa
   desse fluxo e nunca vê o token.

## Multi-tenancy

Toda entidade (`Device`, `ProviderConnection`, `DeviceBinding`) pertence a um
`User` (direta ou indiretamente). Toda query nos serviços em
`backend/src/modules/*/*.service.ts` filtra por `userId`, e helpers como
`getOwnedDevice`/`getOwnedConnection` retornam 404 (não 403) quando o recurso
existe mas pertence a outro usuário — para não confirmar a existência do
recurso a quem não é o dono.

## O "midware" (DeviceBinding)

`DeviceBinding` é a entidade que liga um `Device` a uma `ProviderConnection`,
com uma lista de `allowedActions` (whitelist) e um `config` livre (JSON). É o
ponto de enforcement: o dispositivo só pode chamar as ações que estão na sua
própria lista de bindings — mesmo que a ação exista no adapter do provedor.

## Abstração de provedor

`backend/src/providers/types.ts` define a interface `ProviderAdapter`. Cada
provedor (hoje, só `backend/src/providers/spotify/`) implementa:

- `getAuthorizeUrl` / `exchangeCodeForTokens` / `refreshAccessToken` /
  `fetchIdentity` — o ciclo OAuth.
- `actions` — um mapa de ações simplificadas (`now-playing`, `play`, `pause`,
  `next`, `previous`) que se tornam rotas `/device/v1/:provider/:action`.

Ver `docs/provider-integration-guide.md` para adicionar um novo provedor.

## Fluxo de uma chamada de dispositivo

`GET /device/v1/spotify/now-playing` (ver `backend/src/routes/device/generic.ts`):

1. `authenticateDevice` resolve `request.device` a partir do header.
2. Busca o `DeviceBinding` do dispositivo para o provedor `spotify`.
3. Confere se `now-playing` está em `allowedActions` (senão, 403).
4. `TokenBroker.getValidAccessToken` decripta o token, renova se estiver perto
   de expirar, e devolve um access token válido — que nunca sai desta função.
5. Chama `adapter.actions["now-playing"].handler(...)` e devolve o JSON
   simplificado ao dispositivo.

## Criptografia de tokens

`ProviderConnection.tokensEnc` guarda `{accessToken, refreshToken}` serializado
em JSON e criptografado com AES-256-GCM (`backend/src/lib/crypto.ts`), usando uma
única chave mestra (`ENCRYPTION_KEY`) e um IV aleatório por registro. Os dois
tokens são criptografados **juntos**, com o mesmo IV, porque reusar um IV para
duas criptografias diferentes sob a mesma chave quebraria a segurança do GCM —
por isso eles não têm colunas/IVs separados.

Perder `ENCRYPTION_KEY` torna todas as conexões de provedor existentes
irrecuperáveis (os usuários precisariam reconectar). Ver `docs/deployment-vps.md`.
