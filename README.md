# CLOUTRIK Documentation

Documentacao oficial da CLOUTRIK, criada com Docusaurus.

O projeto foi pensado para publicar em `https://docs.cloutrik.com` e manter a mesma identidade visual da homepage: roxo, ciano, game/ranking e foco em qualidade comprovada por automacoes.

## Rodando localmente

```bash
npm install
npm run start
```

## Build

```bash
npm run build
```

## Publicacao

O workflow em `.github/workflows/deploy.yml` publica o build no GitHub Pages.

Para usar o subdominio, configure o GitHub Pages deste repositorio com o dominio customizado `docs.cloutrik.com` e crie o DNS apontando para o GitHub Pages.
