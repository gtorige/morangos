# Guia de Deploy: Turso + Vercel

Hospedagem gratuita do sistema Morangos usando Turso (banco de dados) e Vercel (aplicação).

---

## Pré-requisitos

- Conta no [GitHub](https://github.com) (já tem — o repositório existe)
- Node.js instalado (já tem)
- Terminal bash (Git Bash no Windows)

---

## Parte 1 — Turso (banco de dados na nuvem)

### 1.1 Criar conta e instalar a CLI

Acesse [turso.tech](https://turso.tech) e crie uma conta gratuita.

Depois, instale a CLI do Turso no terminal:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Feche e reabra o terminal, depois faça login:

```bash
turso auth login
```

### 1.2 Criar o banco de dados na nuvem

```bash
turso db create morangos
```

### 1.3 Copiar os dados do banco local para a nuvem

```bash
turso db shell morangos < prisma/dev.db
```

> **Atenção:** esse comando não funciona direto. O correto é usar o dump abaixo:

```bash
# Exportar o banco local como SQL
sqlite3 prisma/dev.db .dump > backup.sql

# Importar no Turso
turso db shell morangos < backup.sql
```

> Se não tiver o `sqlite3` instalado: `winget install SQLite.SQLite`

### 1.4 Pegar as credenciais de conexão

```bash
# URL do banco
turso db show morangos --url

# Token de acesso
turso db tokens create morangos
```

Anote os dois valores — serão usados nas variáveis de ambiente.

---

## Parte 2 — Ajustar o projeto para usar Turso

### 2.1 Instalar o driver libsql

```bash
npm install @libsql/client
npm install @prisma/adapter-libsql
```

### 2.2 Atualizar o `prisma/schema.prisma`

Mantenha o `datasource` apontando para o SQLite local e adicione o `previewFeatures` no generator:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 2.3 Atualizar o `src/lib/prisma.ts`

Substitua o conteúdo do arquivo por uma versão que:
- usa SQLite normal no desktop
- usa `@prisma/adapter-libsql` quando `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` existem
- aplica um shim no `fetch` para neutralizar o probe `/v1/jobs` do `@libsql/client` 0.6.x em bancos AWS da Turso

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createTursoFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.endsWith("/v1/jobs") || /\/v1\/jobs\/[^/]+$/.test(url)) {
      return new Response(JSON.stringify({ error: "Invalid namespace" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    return baseFetch(input, init);
  };
}

function patchGlobalFetchForTurso(): void {
  const globalWithPatchedFetch = globalThis as typeof globalThis & {
    __morangosTursoFetchPatched?: boolean;
  };

  if (globalWithPatchedFetch.__morangosTursoFetchPatched) return;

  globalWithPatchedFetch.fetch = createTursoFetch(globalWithPatchedFetch.fetch);
  globalWithPatchedFetch.__morangosTursoFetchPatched = true;
}

function createPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    patchGlobalFetchForTurso();

    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
      fetch: globalThis.fetch,
    });

    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 2.4 Atualizar o `.env` local

Adicione ao arquivo `.env`:

```env
# Manter para desenvolvimento local:
DATABASE_URL="file:./dev.db"

# Adicionar para produção (pegar os valores do passo 1.4):
TURSO_DATABASE_URL="libsql://morangos-SEUUSUARIO.turso.io"
TURSO_AUTH_TOKEN="eyJ..."
```

### 2.5 Regenerar o Prisma Client

```bash
npx prisma generate
```

---

## Parte 3 — Vercel (hospedagem da aplicação)

### 3.1 Criar conta na Vercel

Acesse [vercel.com](https://vercel.com) e crie conta usando o GitHub.

### 3.2 Importar o repositório

1. No painel da Vercel, clique em **"Add New → Project"**
2. Selecione o repositório `morangos` do GitHub
3. Clique em **"Import"**

### 3.3 Configurar as variáveis de ambiente

Antes de fazer o deploy, adicione as variáveis de ambiente no painel da Vercel:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | `file:./dev.db` |
| `AUTH_SECRET` | uma string aleatória longa |
| `TURSO_DATABASE_URL` | `libsql://morangos-SEUUSUARIO.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...` (token do passo 1.4) |

### 3.4 Fazer o deploy

Clique em **"Deploy"**. A Vercel vai:
1. Baixar o código do GitHub
2. Rodar `npm run build`
3. Publicar em uma URL como `https://morangos-xyz.vercel.app`

---

## Parte 4 — Deploys futuros (automático)

A partir de agora, toda vez que você fizer `git push` para o GitHub, a Vercel vai **automaticamente** publicar a nova versão. Nenhum passo manual necessário.

```bash
git add .
git commit -m "nova funcionalidade"
git push
# → Vercel detecta e faz deploy em ~1 minuto
```

---

## Desenvolvimento local (continua igual)

Para desenvolver localmente, nada muda:

```bash
npm run dev
```

O sistema vai usar o SQLite local (`prisma/dev.db`) automaticamente, porque `TURSO_DATABASE_URL` não está definido no ambiente local (está só no `.env` e na Vercel).

---

## Resolução de problemas

### Build falha na Vercel com erro de Prisma
```bash
# Adicione ao package.json, no script "build":
"build": "prisma generate && next build --webpack"
```

### Erro "Cannot find module @libsql/client"
```bash
npm install @libsql/client @prisma/adapter-libsql
git add package.json package-lock.json
git push
```

### Erro `Unexpected status code while fetching migration jobs: 400`
Se o banco Turso estiver em endpoint AWS (`*.aws-*.turso.io`), o `@libsql/client` 0.6.x pode chamar `/v1/jobs` e receber:

```json
{"error":"Protocol error: v1 endpoints are not supported at AWS"}
```

Nesse caso:
- mantenha o shim do `fetch` em `src/lib/prisma.ts`
- nao remova o `previewFeatures = ["driverAdapters"]`
- nao troque o `DATABASE_URL` local pelo `TURSO_DATABASE_URL` no schema

### Dados não aparecem em produção
Verifique se o dump foi importado corretamente:
```bash
turso db shell morangos "SELECT COUNT(*) FROM pedidos"
```
