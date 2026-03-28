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

Altere o bloco `datasource`:

```prisma
// ANTES:
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// DEPOIS:
datasource db {
  provider     = "sqlite"
  url          = env("TURSO_DATABASE_URL")
  relationMode = "prisma"
}
```

E adicione o `previewFeatures` no generator:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

### 2.3 Atualizar o `src/lib/prisma.ts`

Substitua o conteúdo do arquivo:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  if (process.env.TURSO_DATABASE_URL) {
    // Produção: Turso na nuvem
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  // Desenvolvimento local: SQLite
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
| `TURSO_DATABASE_URL` | `libsql://morangos-SEUUSUARIO.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...` (token do passo 1.4) |
| `GOOGLE_ROUTES_API_KEY` | (sua chave atual do Google) |

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
"build": "prisma generate && next build"
```

### Erro "Cannot find module @libsql/client"
```bash
npm install @libsql/client @prisma/adapter-libsql
git add package.json package-lock.json
git push
```

### Dados não aparecem em produção
Verifique se o dump foi importado corretamente:
```bash
turso db shell morangos "SELECT COUNT(*) FROM pedidos"
```
