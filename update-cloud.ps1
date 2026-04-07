# ============================================================
# ATUALIZAR MORANGOS NA NUVEM
# Atualiza codigo + schema sem perder dados
# ============================================================

$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

function Show-Step($num, $title) {
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host "  PASSO $num - $title" -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host ''
}

function Refresh-Path {
    $m = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $u = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = $m + ';' + $u
}

function Invoke-CmdPassthru($command) {
    $output = cmd /d /c "$command 2>&1"
    $exitCode = $LASTEXITCODE
    if ($output) { $output | ForEach-Object { Write-Host $_ } }
    return $exitCode
}

# ============================================================
$deployDir = Join-Path ([Environment]::GetFolderPath('Desktop')) 'morangos-cloud'

Clear-Host
Write-Host ''
Write-Host '  ========================================' -ForegroundColor Yellow
Write-Host '  MORANGOS - ATUALIZAR VERSAO CLOUD' -ForegroundColor Yellow
Write-Host '  ========================================' -ForegroundColor Yellow
Write-Host ''

# Verificar se ja existe deploy
if (-not (Test-Path $deployDir)) {
    Write-Host 'Pasta morangos-cloud nao encontrada.' -ForegroundColor Red
    Write-Host 'Execute primeiro o deploy-cloud.ps1 para fazer a instalacao inicial.' -ForegroundColor Yellow
    Write-Host ''
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

if (-not (Test-Path (Join-Path $deployDir '.env'))) {
    Write-Host 'Arquivo .env nao encontrado em morangos-cloud.' -ForegroundColor Red
    Write-Host 'O deploy inicial parece incompleto. Execute deploy-cloud.ps1 novamente.' -ForegroundColor Yellow
    Write-Host ''
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

Set-Location $deployDir

# ── Verificar infraestrutura existente ──
$envPath = Join-Path $deployDir '.env'
$vercelLinked = Test-Path (Join-Path $deployDir '.vercel\project.json')
$hasTurso = $false
$vercelToken = $null

if (Test-Path $envPath) {
    foreach ($line in (Get-Content $envPath)) {
        if ($line -match '^\s*VERCEL_TOKEN\s*=\s*"?([^"]+)"?\s*$') { $vercelToken = $Matches[1] }
        if ($line -match '^\s*TURSO_DATABASE_URL\s*=') { $hasTurso = $true }
    }
}

Write-Host '  Projeto Vercel:  ' -NoNewline
if ($vercelLinked) { Write-Host 'linkado' -ForegroundColor Green } else { Write-Host 'nao linkado' -ForegroundColor Red }
Write-Host '  Banco Turso:     ' -NoNewline
if ($hasTurso) { Write-Host 'configurado' -ForegroundColor Green } else { Write-Host 'nao encontrado' -ForegroundColor Red }
Write-Host '  Token Vercel:    ' -NoNewline
if ($vercelToken) {
    Write-Host 'salvo no .env' -ForegroundColor Green
    $env:VERCEL_TOKEN = $vercelToken
} else {
    Write-Host 'nao configurado' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Sem token, voce precisara estar logado no Vercel CLI.' -ForegroundColor DarkGray
    Write-Host '  Para configurar o token automatico:' -ForegroundColor DarkGray
    Write-Host '    1. Acesse https://vercel.com/account/tokens' -ForegroundColor DarkGray
    Write-Host '    2. Crie um token (Full Account, sem expiracao)' -ForegroundColor DarkGray
    Write-Host ''
    $inputToken = Read-Host '  Cole o token aqui (ou Enter para pular)'
    if ($inputToken -and $inputToken.Trim().Length -gt 10) {
        $vercelToken = $inputToken.Trim()
        $env:VERCEL_TOKEN = $vercelToken
        # Salvar no .env
        Add-Content -Path $envPath -Value "`nVERCEL_TOKEN=$vercelToken"
        Write-Host '  Token salvo no .env!' -ForegroundColor Green
    }
}
Write-Host ''

# Ler versao local
$localVersion = 'desconhecida'
$pkgPath = Join-Path $deployDir 'package.json'
if (Test-Path $pkgPath) {
    $localVersion = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
}

# Checar versao remota
$remoteVersion = $null
try {
    $remotePkg = Invoke-WebRequest -Uri "https://raw.githubusercontent.com/gtorige/morangos/cloud/package.json?$(Get-Date -Format 'yyyyMMddHHmmss')" -UseBasicParsing -TimeoutSec 5 -Headers @{"Cache-Control"="no-cache"} 2>$null
    $remoteVersion = ($remotePkg.Content | ConvertFrom-Json).version
} catch {}

Write-Host "  Versao local:  v$localVersion" -ForegroundColor White
if ($remoteVersion -and $remoteVersion -ne $localVersion) {
    Write-Host "  Versao remota: v$remoteVersion (NOVA!)" -ForegroundColor Yellow
} elseif ($remoteVersion) {
    Write-Host "  Versao remota: v$remoteVersion (igual)" -ForegroundColor Green
} else {
    Write-Host '  Nao foi possivel checar versao remota.' -ForegroundColor DarkGray
}
Write-Host ''

$confirm = Read-Host 'Continuar com a atualizacao? (S/N)'
if ($confirm -ne 'S' -and $confirm -ne 's') {
    Write-Host 'Cancelado.' -ForegroundColor Green
    exit 0
}

# ============================================================
Show-Step 1 'ATUALIZAR CODIGO'

Write-Host 'Fazendo git pull na branch cloud...' -ForegroundColor Yellow
$env:GIT_REDIRECT_STDERR = '2>&1'
& git fetch origin cloud 2>&1 | Out-Host
& git reset --hard origin/cloud 2>&1 | Out-Host
$env:GIT_REDIRECT_STDERR = $null
Write-Host 'Codigo atualizado!' -ForegroundColor Green

# ============================================================
Show-Step 2 'INSTALAR DEPENDENCIAS'

Write-Host 'Instalando dependencias...' -ForegroundColor Yellow
& npm.cmd install 2>&1 | ForEach-Object { if ($_ -notmatch '^npm warn') { Write-Host $_ } }
Write-Host 'Dependencias atualizadas!' -ForegroundColor Green

# ============================================================
Show-Step 3 'CONFIGURAR VERCEL E OBTER CREDENCIAIS'

# Argumentos extras do Vercel CLI quando temos token
$vercelAuth = @()
if ($env:VERCEL_TOKEN) { $vercelAuth = @('--token', $env:VERCEL_TOKEN) }

# Linkar ao projeto Vercel se necessario
if (-not (Test-Path (Join-Path $deployDir '.vercel'))) {
    Write-Host 'Linkando ao projeto Vercel...' -ForegroundColor Yellow
    & npx.cmd vercel link --project morangos --yes @vercelAuth 2>&1 | Out-Host
}

# Puxar env vars de producao do Vercel
Write-Host 'Obtendo variaveis de ambiente da Vercel...' -ForegroundColor Yellow
& npx.cmd vercel env pull .env --environment production --yes @vercelAuth 2>&1 | Out-Host

# Preservar VERCEL_TOKEN no .env (env pull sobrescreve o arquivo)
if ($vercelToken) {
    $envAfterPull = Get-Content (Join-Path $deployDir '.env') -Raw
    if ($envAfterPull -notmatch 'VERCEL_TOKEN') {
        Add-Content -Path (Join-Path $deployDir '.env') -Value "`nVERCEL_TOKEN=$vercelToken"
    }
}

Write-Host 'Credenciais obtidas!' -ForegroundColor Green

# ============================================================
Show-Step 4 'MIGRAR SCHEMA DO BANCO TURSO'

Write-Host 'Gerando cliente Prisma...' -ForegroundColor Yellow
& npx.cmd prisma generate 2>&1 | Out-Host

# Carregar variaveis do .env
$envContent = Get-Content (Join-Path $deployDir '.env') -Raw
$tursoUrl = $null; $tursoToken = $null
foreach ($line in $envContent -split "`n") {
    $line = $line.Trim()
    if ($line -match '^TURSO_DATABASE_URL="?([^"]+)"?$') { $tursoUrl = $Matches[1] }
    if ($line -match '^TURSO_AUTH_TOKEN="?([^"]+)"?$') { $tursoToken = $Matches[1] }
}

if (-not $tursoUrl -or -not $tursoToken) {
    Write-Host 'ERRO: TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN nao encontrados no .env' -ForegroundColor Red
    Write-Host 'Verifique se as variaveis estao configuradas no Vercel.' -ForegroundColor Yellow
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

Write-Host "Banco Turso: $tursoUrl" -ForegroundColor DarkGray

# Backup do banco antes de migrar
$backupDir = Join-Path $deployDir 'backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
$backupFile = Join-Path $backupDir "turso-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
Write-Host "Criando backup do banco em $backupFile..." -ForegroundColor Yellow

$backupScript = @'
const _of = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (typeof u === 'string' && u.includes('/v1/jobs')) return new Response('', { status: 404 });
  return _of.call(globalThis, u, o);
};
require('dotenv').config();
const { createClient } = require('@libsql/client');
const fs = require('fs');
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
async function backup() {
  const tables = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  let sql = '-- Backup Turso ' + new Date().toISOString() + '\n\n';
  for (const t of tables.rows) {
    sql += t.sql + ';\n';
    const rows = await client.execute('SELECT * FROM "' + t.name + '"');
    for (const row of rows.rows) {
      const vals = Object.values(row).map(v => v === null ? 'NULL' : typeof v === 'string' ? "'" + v.replace(/'/g, "''") + "'" : v);
      sql += 'INSERT INTO "' + t.name + '" VALUES (' + vals.join(',') + ');\n';
    }
    sql += '\n';
  }
  fs.writeFileSync(process.argv[2], sql, 'utf8');
  console.log('Backup: ' + tables.rows.length + ' tabelas exportadas');
}
backup().then(() => process.exit(0)).catch(e => { console.error('Erro no backup:', e.message); process.exit(1); });
'@

$backupPath = Join-Path $deployDir '_backup-turso.js'
[System.IO.File]::WriteAllText($backupPath, $backupScript, (New-Object System.Text.UTF8Encoding($false)))
& node.exe $backupPath $backupFile 2>&1 | Out-Host
$backupExit = $LASTEXITCODE
Remove-Item $backupPath -Force -ErrorAction SilentlyContinue

if ($backupExit -ne 0) {
    Write-Host 'AVISO: Backup falhou, mas continuando com a migracao...' -ForegroundColor Yellow
} else {
    Write-Host "Backup salvo em: $backupFile" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Aplicando schema incremental no Turso...' -ForegroundColor Yellow
Write-Host '(Adiciona colunas e tabelas novas sem apagar dados existentes)' -ForegroundColor DarkGray

# Script Node.js para migration incremental
$migrateScript = @'
require("dotenv").config();
// Fetch shim for Turso AWS /v1/jobs probe bug
const _of = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = typeof u === 'string' ? u : '';
  if (s.includes('/v1/jobs')) return new Response('', { status: 404 });
  return _of.call(globalThis, u, o);
};

const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  // 1. Buscar tabelas existentes
  const existing = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  );
  const existingTables = new Set(existing.rows.map(r => r.name));
  console.log("Tabelas existentes: " + [...existingTables].join(", "));

  // 2. Buscar colunas existentes de cada tabela
  const existingColumns = {};
  for (const table of existingTables) {
    const cols = await client.execute('PRAGMA table_info("' + table + '")');
    existingColumns[table] = new Set(cols.rows.map(r => r.name));
  }

  // 3. Gerar schema desejado
  const { execSync } = require("child_process");
  const schema = execSync(
    "npx.cmd prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );

  // 4. Parsear CREATE TABLE e extrair colunas desejadas
  const createTableRegex = /CREATE TABLE "(\w+)" \(([\s\S]*?)\);/g;
  let match;
  let changes = 0;

  while ((match = createTableRegex.exec(schema)) !== null) {
    const tableName = match[1];
    const tableBody = match[2];

    if (!existingTables.has(tableName)) {
      console.log("CREATE TABLE " + tableName);
      await client.execute(match[0]);
      changes++;
      continue;
    }

    const lines = tableBody.split(",\n").map(l => l.trim()).filter(l => l && !l.startsWith("CONSTRAINT") && !l.startsWith("FOREIGN KEY"));
    for (const line of lines) {
      const colMatch = line.match(/^"(\w+)"\s+(.+)$/);
      if (!colMatch) continue;
      const colName = colMatch[1];
      const colDef = colMatch[2];
      if (existingColumns[tableName] && existingColumns[tableName].has(colName)) continue;

      const alterSql = 'ALTER TABLE "' + tableName + '" ADD COLUMN "' + colName + '" ' + colDef.replace(/,$/, "");
      try {
        await client.execute(alterSql);
        console.log("ADD COLUMN " + tableName + "." + colName);
        changes++;
      } catch (e) {
        if (e.message && e.message.includes("duplicate column")) {
          console.log("SKIP (ja existe): " + tableName + "." + colName);
        } else {
          console.error("ERRO em " + tableName + "." + colName + ": " + e.message);
        }
      }
    }
  }

  // 5. Aplicar CREATE INDEX IF NOT EXISTS
  const indexRegex = /CREATE (UNIQUE )?INDEX.*?;/g;
  const indexes = schema.match(indexRegex) || [];
  for (let idx of indexes) {
    idx = idx.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS").replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS");
    try {
      await client.execute(idx);
    } catch {}
  }

  if (changes === 0) {
    console.log("Schema ja esta atualizado. Nenhuma mudanca necessaria.");
  } else {
    console.log(changes + " alteracao(oes) aplicada(s).");
  }

  // 6. Verificar estado final
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  );
  console.log("\nEstado do banco:");
  for (const row of tables.rows) {
    const count = await client.execute('SELECT COUNT(*) as c FROM "' + row.name + '"');
    console.log("  " + row.name + ": " + count.rows[0].c + " registros");
  }
}

migrate().catch(e => { console.error("Erro fatal:", e.message); process.exit(1); });
'@

$migratePath = Join-Path $deployDir '_migrate-cloud.js'
[System.IO.File]::WriteAllText($migratePath, $migrateScript, (New-Object System.Text.UTF8Encoding($false)))

& node.exe $migratePath 2>&1 | Out-Host
$migrateExit = $LASTEXITCODE
Remove-Item $migratePath -Force -ErrorAction SilentlyContinue

if ($migrateExit -ne 0) {
    Write-Host ''
    Write-Host 'ERRO: Falha na migracao do schema. O deploy NAO foi feito.' -ForegroundColor Red
    Write-Host 'Verifique os erros acima.' -ForegroundColor Yellow
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

Write-Host 'Schema atualizado!' -ForegroundColor Green

# ============================================================
Show-Step 5 'DEPLOY NA VERCEL'

Write-Host 'Publicando nova versao...' -ForegroundColor Yellow
$deployCmd = 'npx vercel --prod --yes'
if ($env:VERCEL_TOKEN) { $deployCmd += " --token $env:VERCEL_TOKEN" }
$deployExit = Invoke-CmdPassthru $deployCmd

Write-Host ''
if ($deployExit -eq 0) {
    $newVersion = 'desconhecida'
    if (Test-Path $pkgPath) {
        $newVersion = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
    }
    Write-Host '  ========================================' -ForegroundColor Green
    Write-Host "  ATUALIZACAO CONCLUIDA! v$newVersion" -ForegroundColor Green
    Write-Host '  ========================================' -ForegroundColor Green
    Write-Host ''
    Write-Host '  O app foi atualizado na Vercel.' -ForegroundColor White
    Write-Host '  O schema do Turso foi migrado sem perda de dados.' -ForegroundColor White
} else {
    Write-Host '  ========================================' -ForegroundColor Red
    Write-Host '  DEPLOY FALHOU' -ForegroundColor Red
    Write-Host '  ========================================' -ForegroundColor Red
    Write-Host ''
    Write-Host '  O schema do Turso foi atualizado, mas o deploy na Vercel falhou.' -ForegroundColor Yellow
    Write-Host '  Verifique os erros de build acima.' -ForegroundColor Yellow
    Write-Host '  Voce pode tentar novamente com: npx vercel --prod' -ForegroundColor DarkGray
}
Write-Host ''
Read-Host 'Pressione Enter para fechar'
