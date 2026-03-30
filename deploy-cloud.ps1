# ============================================================
# DEPLOY MORANGOS NA NUVEM (Vercel + Turso)
# Guia interativo - faz tudo passo a passo
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

function Pause-Continue {
    Write-Host ''
    Read-Host 'Pressione Enter quando estiver pronto para continuar'
}

function Refresh-Path {
    $m = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $u = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = $m + ';' + $u
}

function Add-ToSessionPath($pathToAdd) {
    if (-not $pathToAdd) { return }
    if (-not (Test-Path $pathToAdd)) { return }

    $currentParts = ($env:Path -split ';') | Where-Object { $_ }
    if ($currentParts -contains $pathToAdd) { return }

    $env:Path = $pathToAdd + ';' + $env:Path
}

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-DeployRepo($deployDir) {
    $repoUrl = 'https://github.com/gtorige/morangos.git'
    $branch = 'cloud'

    if (-not (Test-Path $deployDir)) {
        Write-Host 'Baixando codigo (branch cloud)...' -ForegroundColor Yellow
        Set-Location ([Environment]::GetFolderPath('Desktop'))
        & git clone -b $branch $repoUrl $deployDir 2>&1 | Out-Host
        return
    }

    if (-not (Test-Path (Join-Path $deployDir '.git'))) {
        $backupDir = "$deployDir-backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
        Write-Host "A pasta existente nao e um repositorio Git. Movendo para: $backupDir" -ForegroundColor Yellow
        Move-Item $deployDir $backupDir
        Set-Location ([Environment]::GetFolderPath('Desktop'))
        & git clone -b $branch $repoUrl $deployDir 2>&1 | Out-Host
        return
    }

    $repoStatus = & git -C $deployDir status --porcelain 2>$null
    if ($repoStatus) {
        $backupDir = "$deployDir-backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
        Write-Host "A pasta morangos-cloud tem alteracoes locais. Movendo para: $backupDir" -ForegroundColor Yellow
        Move-Item $deployDir $backupDir
        Set-Location ([Environment]::GetFolderPath('Desktop'))
        & git clone -b $branch $repoUrl $deployDir 2>&1 | Out-Host
        return
    }

    Write-Host 'Atualizando repositorio cloud...' -ForegroundColor Yellow
    & git -C $deployDir fetch origin $branch 2>&1 | Out-Host
    & git -C $deployDir checkout $branch 2>&1 | Out-Host
    & git -C $deployDir reset --hard "origin/$branch" 2>&1 | Out-Host
}

function Ensure-CloudBuildConfig($deployDir) {
    $vercelJsonPath = Join-Path $deployDir 'vercel.json'
    $vercelJson = @'
{
  "framework": "nextjs",
  "buildCommand": "prisma generate && next build --webpack"
}
'@
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($vercelJsonPath, $vercelJson, $utf8NoBom)
    Write-Host 'vercel.json alinhado para build com --webpack.' -ForegroundColor Green
}

function Add-VercelEnvWithoutNewline($deployDir, $name, $value) {
    $tempFile = Join-Path $env:TEMP ("vercel-env-" + $name + ".txt")
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempFile, $value, $utf8NoBom)
    try {
        cmd /c "cd /d `"$deployDir`" && npx vercel env add $name production --force < `"$tempFile`"" 2>&1 | Out-Host
    } finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Ensure-VercelCli {
    if (Test-Command 'vercel') {
        $vercelVersion = & vercel --version 2>$null | Select-Object -First 1
        Write-Host "Vercel CLI ja instalada ($vercelVersion)" -ForegroundColor Green
        return
    }

    Write-Host 'Vercel CLI nao encontrada. Instalando globalmente...' -ForegroundColor Yellow
    & npm.cmd install -g vercel 2>&1 | Out-Host
    Refresh-Path
    $vercelVersion = & vercel --version 2>$null | Select-Object -First 1
    if (-not $vercelVersion) {
        throw 'Falha ao instalar a Vercel CLI.'
    }
    Write-Host "Vercel CLI instalada! ($vercelVersion)" -ForegroundColor Green
}

function Ensure-TursoCli {
    if (Test-Command 'turso') {
        $tursoVersion = & turso --version 2>$null | Select-Object -First 1
        Write-Host "Turso CLI ja instalada ($tursoVersion)" -ForegroundColor Green
        return $true
    }

    Write-Host 'Turso CLI nao encontrada.' -ForegroundColor Yellow
    Write-Host 'No Windows, a automacao oficial da Turso CLI pode exigir WSL.' -ForegroundColor DarkGray
    Write-Host 'Vou tentar instalar mesmo assim; se nao houver comando compatível,' -ForegroundColor DarkGray
    Write-Host 'o script continua em modo manual para URL e token.' -ForegroundColor DarkGray

    & powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://github.com/tursodatabase/turso/releases/latest/download/turso_cli-installer.ps1 | iex" 2>&1 | Out-Host
    Refresh-Path
    Add-ToSessionPath (Join-Path $env:USERPROFILE '.turso')

    if (Test-Command 'turso') {
        $tursoVersion = & turso --version 2>$null | Select-Object -First 1
        if ($tursoVersion) {
            Write-Host "Turso CLI instalada! ($tursoVersion)" -ForegroundColor Green
            return $true
        }
    }

    Write-Host 'Nao foi encontrada uma Turso CLI compativel nesta sessao.' -ForegroundColor Yellow
    Write-Host 'O deploy vai seguir com a configuracao manual do Turso.' -ForegroundColor Yellow
    return $false
}

function Read-TursoCredentialsManually {
    Write-Host 'Vamos configurar o banco de dados no Turso pelo navegador.' -ForegroundColor White
    Write-Host 'Siga os passos:' -ForegroundColor White
    Write-Host ''
    Write-Host '  1. Entre com GitHub em https://turso.tech/app' -ForegroundColor DarkGray
    Write-Host '  2. Crie o banco "morangos" se ele ainda nao existir' -ForegroundColor DarkGray
    Write-Host '  3. Abra o banco e copie a URL libsql://' -ForegroundColor DarkGray
    Write-Host '  4. Gere um token de acesso e copie' -ForegroundColor DarkGray
    Write-Host ''
    Start-Process 'https://turso.tech/app'
    Pause-Continue

    while ($true) {
        $manualUrl = Read-Host 'Cole a URL do banco Turso aqui'
        if ($manualUrl -and $manualUrl.Trim().StartsWith('libsql://')) { break }
        Write-Host 'URL invalida. Deve comecar com libsql://' -ForegroundColor Red
    }

    while ($true) {
        $manualToken = Read-Host 'Cole o token do Turso aqui'
        if ($manualToken -and $manualToken.Trim().Length -gt 20) { break }
        Write-Host 'Token invalido. Deve ter mais de 20 caracteres.' -ForegroundColor Red
    }

    return @{
        Url = $manualUrl.Trim()
        Token = $manualToken.Trim()
    }
}

function Get-TursoCredentials {
    $hasTursoCli = Ensure-TursoCli
    if (-not $hasTursoCli) {
        return Read-TursoCredentialsManually
    }

    Write-Host 'Verificando autenticacao da Turso CLI...' -ForegroundColor Yellow
    & turso auth login 2>&1 | Out-Host

    $dbName = 'morangos'
    Write-Host ''
    Write-Host "Verificando banco '$dbName'..." -ForegroundColor Yellow
    $tursoUrl = (& turso db show $dbName --url 2>$null | Select-Object -First 1)
    if (-not $tursoUrl) {
        Write-Host "Banco '$dbName' nao existe. Criando automaticamente..." -ForegroundColor Yellow
        & turso db create $dbName 2>&1 | Out-Host
        $tursoUrl = (& turso db show $dbName --url 2>$null | Select-Object -First 1)
    }

    if (-not $tursoUrl) {
        throw "Nao foi possivel obter a URL do banco '$dbName'."
    }

    Write-Host 'Gerando token de acesso do Turso...' -ForegroundColor Yellow
    $tursoToken = (& turso db tokens create $dbName 2>$null | Select-Object -First 1)
    if (-not $tursoToken) {
        throw "Nao foi possivel gerar um token para o banco '$dbName'."
    }

    return @{
        Url = $tursoUrl.Trim()
        Token = $tursoToken.Trim()
    }
}

Clear-Host
Write-Host ''
Write-Host '  ========================================' -ForegroundColor Green
Write-Host '  MORANGOS - DEPLOY NA NUVEM' -ForegroundColor Green
Write-Host '  ========================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Este script vai colocar o app online' -ForegroundColor White
Write-Host '  para acessar de qualquer lugar.' -ForegroundColor White
Write-Host ''
Write-Host '  Voce vai precisar:' -ForegroundColor Yellow
Write-Host '  - Uma conta GitHub (pode criar agora)' -ForegroundColor DarkGray
Write-Host '  - Uma conta Turso (banco de dados gratis)' -ForegroundColor DarkGray
Write-Host '  - Uma conta Vercel (hospedagem gratis)' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  O script automatiza o clone, install, importacao do banco,' -ForegroundColor White
Write-Host '  configuracao do .env e os deploys via Vercel CLI.' -ForegroundColor White
Write-Host ''
Write-Host '  Interacoes manuais que continuam necessarias:' -ForegroundColor Yellow
Write-Host '  - Login no Turso pelo navegador' -ForegroundColor DarkGray
Write-Host '  - Login na Vercel (se a CLI nao estiver autenticada)' -ForegroundColor DarkGray
Write-Host '  - Google Maps e opcional' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Tudo gratuito. Nao precisa cartao de credito.' -ForegroundColor Green
Write-Host ''
Pause-Continue

# ============================================================
# PASSO 1 - VERIFICAR NODE.JS
# ============================================================
Show-Step 1 'VERIFICAR NODE.JS'

try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js ja instalado ($nodeVersion)" -ForegroundColor Green
    } else { throw 'not found' }
} catch {
    Write-Host 'Node.js nao encontrado. Instalando...' -ForegroundColor Yellow
    $nodeInstaller = Join-Path $env:TEMP 'node-lts.msi'
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi' -OutFile $nodeInstaller -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait -NoNewWindow
    Refresh-Path
    Start-Sleep -Seconds 2
    $nodeVersion = & node --version 2>$null
    Write-Host "Node.js instalado! ($nodeVersion)" -ForegroundColor Green
    Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
}

# ============================================================
# PASSO 2 - INSTALAR TURSO CLI
# ============================================================
Show-Step 2 'INSTALAR TURSO CLI'
Write-Host 'A Turso sera configurada automaticamente quando a CLI for compativel.' -ForegroundColor White
Write-Host 'Se nao for, o script muda sozinho para o modo manual.' -ForegroundColor DarkGray

# ============================================================
# PASSO 3 - INSTALAR VERCEL CLI
# ============================================================
Show-Step 3 'INSTALAR VERCEL CLI'
Ensure-VercelCli

# ============================================================
# PASSO 4 - AUTENTICAR E CONFIGURAR TURSO
# ============================================================
Show-Step 4 'CONFIGURAR TURSO'
$tursoConfig = Get-TursoCredentials
$tursoUrl = $tursoConfig.Url
$tursoToken = $tursoConfig.Token
Write-Host "Banco pronto: $tursoUrl" -ForegroundColor Green
Write-Host 'Token gerado!' -ForegroundColor Green

# ============================================================
# PASSO 5 - BAIXAR O CODIGO
# ============================================================
Show-Step 5 'BAIXAR O CODIGO'

$deployDir = Join-Path ([Environment]::GetFolderPath('Desktop')) 'morangos-cloud'
Ensure-DeployRepo $deployDir
Set-Location $deployDir
Ensure-CloudBuildConfig $deployDir

Write-Host 'Codigo baixado!' -ForegroundColor Green

# ============================================================
# PASSO 6 - INSTALAR DEPENDENCIAS
# ============================================================
Show-Step 6 'INSTALAR DEPENDENCIAS'

Write-Host 'Instalando dependencias (pode demorar 1-2 min)...' -ForegroundColor Yellow
& npm.cmd install 2>&1 | ForEach-Object { if ($_ -notmatch '^npm warn') { Write-Host $_ } }
Write-Host 'Dependencias instaladas!' -ForegroundColor Green

# ============================================================
# PASSO 7 - CONFIGURAR VARIAVEIS
# ============================================================
Show-Step 7 'CONFIGURAR VARIAVEIS'

$authSecret = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

$envLines = @(
    'DATABASE_URL="file:./dev.db"',
    "TURSO_DATABASE_URL=`"$tursoUrl`"",
    "TURSO_AUTH_TOKEN=`"$tursoToken`"",
    "AUTH_SECRET=`"$authSecret`""
)
$envLines -join "`n" | Set-Content -Path (Join-Path $deployDir '.env') -Encoding UTF8 -NoNewline
Write-Host 'Arquivo .env criado!' -ForegroundColor Green

# ============================================================
# PASSO 8 - CONFIGURAR BANCO DE DADOS
# ============================================================
Show-Step 8 'CONFIGURAR BANCO DE DADOS'

Write-Host 'Gerando cliente Prisma...' -ForegroundColor Yellow
& npx.cmd prisma generate 2>&1 | Out-Host

# Gerar SQL do schema e aplicar via @libsql/client (Prisma db push nao suporta libsql://)
# Script Node.js que gera schema, aplica, e importa dados automaticamente
$setupDbScript = @'
require("dotenv").config();
const { createClient } = require("@libsql/client");
const { execSync } = require("child_process");
const fs = require("fs");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // 1. Generate schema SQL via prisma (outputs UTF-8 to stdout)
  console.log("Generating schema...");
  const schema = execSync("npx.cmd prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  console.log("Schema: " + schema.length + " chars");

  console.log("Cleaning existing tables...");
  await client.executeMultiple("PRAGMA foreign_keys = OFF;");
  const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  for (const row of existing.rows) {
    try { await client.execute('DROP TABLE IF EXISTS "' + row.name + '"'); } catch {}
  }

  console.log("Applying schema...");
  await client.executeMultiple(schema);
  console.log("Schema applied!");

  if (fs.existsSync("import.sql")) {
    const importSql = fs.readFileSync("import.sql", "utf8");
    const rowCount = importSql.split("\n").filter(s => s.trim()).length;
    if (rowCount > 0) {
      console.log("Importing " + rowCount + " rows...");
      try {
        await client.executeMultiple(importSql);
        console.log("Import complete!");
      } catch (e) {
        console.log("Batch failed, trying row by row...");
        const rows = importSql.split("\n").filter(s => s.trim());
        let ok = 0, err = 0;
        for (const row of rows) {
          try { await client.execute(row); ok++; } catch { err++; }
        }
        console.log("Imported: " + ok + " OK" + (err > 0 ? ", " + err + " errors" : ""));
      }
    }
  }
  await client.executeMultiple("PRAGMA foreign_keys = ON;");

  // 5. Verify
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  console.log("\nBanco na nuvem:");
  let total = 0;
  for (const row of tables.rows) {
    const count = await client.execute('SELECT COUNT(*) as c FROM "' + row.name + '"');
    const c = count.rows[0].c;
    if (c > 0) { console.log("  " + row.name + ": " + c + " registros"); total += Number(c); }
  }
  console.log("Total: " + total + " registros");
}
run().catch(e => { console.error("Erro:", e.message); process.exit(1); });
'@
Set-Content -Path (Join-Path $deployDir 'setup-turso.js') -Value $setupDbScript -Encoding UTF8

# Verificar se existe banco local para importar
$localDbPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'morangos\prisma\dev.db'
$backupDbPath = $null
$safeBackupDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'MorangosBackups'
if (Test-Path $safeBackupDir) {
    $latestBackup = Get-ChildItem $safeBackupDir -Filter 'dev_*.db' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestBackup) { $backupDbPath = $latestBackup.FullName }
}

$sourceDb = $null
if ((Test-Path $localDbPath) -or $backupDbPath) {
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Yellow
    Write-Host '  BANCO DE DADOS LOCAL ENCONTRADO!' -ForegroundColor Yellow
    Write-Host '========================================' -ForegroundColor Yellow
    Write-Host ''

    if (Test-Path $localDbPath) {
        $dbSize = [math]::Round((Get-Item $localDbPath).Length / 1KB)
        Write-Host "  Banco local: Desktop\morangos\prisma\dev.db ($dbSize KB)" -ForegroundColor White
    }
    if ($backupDbPath) {
        $bkSize = [math]::Round((Get-Item $backupDbPath).Length / 1KB)
        $bkName = (Get-Item $backupDbPath).Name
        Write-Host "  Backup: Documentos\MorangosBackups\$bkName ($bkSize KB)" -ForegroundColor White
    }

    Write-Host ''
    Write-Host '  Deseja importar os dados existentes para a nuvem?' -ForegroundColor White
    Write-Host '  (clientes, pedidos, produtos, contas, etc.)' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  [1] Sim, importar do banco local (Desktop\morangos)' -ForegroundColor White
    if ($backupDbPath) {
        Write-Host '  [2] Sim, importar do backup mais recente' -ForegroundColor White
    }
    Write-Host '  [3] Nao, comecar do zero' -ForegroundColor White
    Write-Host ''

    $importChoice = Read-Host 'Escolha (1/2/3)'

    if ($importChoice -eq '1' -and (Test-Path $localDbPath)) { $sourceDb = $localDbPath }
    elseif ($importChoice -eq '2' -and $backupDbPath) { $sourceDb = $backupDbPath }
}

if ($sourceDb) {
    Write-Host 'Exportando dados do banco local...' -ForegroundColor Yellow

    $exportScript = @'
const Database = require("better-sqlite3");
const fs = require("fs");
const db = new Database(process.argv[2], { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all();
let sql = "";
for (const { name } of tables) {
    const rows = db.prepare(`SELECT * FROM "${name}"`).all();
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    for (const row of rows) {
        const values = cols.map(c => {
            const v = row[c];
            if (v === null) return "NULL";
            if (typeof v === "number") return String(v);
            return "'" + String(v).replace(/'/g, "''") + "'";
        }).join(", ");
        sql += `INSERT OR IGNORE INTO "${name}" (${cols.map(c => '"' + c + '"').join(", ")}) VALUES (${values});\n`;
    }
}
fs.writeFileSync("import.sql", sql, "utf8");
console.log("Exportado: " + sql.split("\n").filter(l => l.trim()).length + " registros");
db.close();
'@

    Set-Content -Path (Join-Path $deployDir 'export-db.js') -Value $exportScript -Encoding UTF8
    & node.exe export-db.js $sourceDb 2>&1 | Out-Host
    Remove-Item (Join-Path $deployDir 'export-db.js') -Force -ErrorAction SilentlyContinue
}

# Aplicar schema + importar dados automaticamente
Write-Host ''
Write-Host 'Aplicando schema e dados no Turso...' -ForegroundColor Yellow
& node.exe setup-turso.js 2>&1 | Out-Host

# Seed inicial se nao importou dados
if (-not $sourceDb) {
    # Executar seed via libsql tambem
    Write-Host 'Criando dados iniciais...' -ForegroundColor Yellow
    & node.exe prisma/seed-init.js 2>&1 | Out-Host
}

# Limpar arquivos temporarios
Remove-Item (Join-Path $deployDir 'setup-turso.js') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $deployDir 'schema.sql') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $deployDir 'import.sql') -Force -ErrorAction SilentlyContinue

Write-Host 'Banco de dados configurado!' -ForegroundColor Green

# ============================================================
# PASSO 9 - DEPLOY NA VERCEL
# ============================================================
Show-Step 9 'DEPLOY NA VERCEL'

Write-Host 'Agora vamos publicar o app na Vercel.' -ForegroundColor White
Write-Host ''
Write-Host 'Verificando autenticacao da Vercel CLI...' -ForegroundColor Yellow
$vercelUser = (& npx.cmd vercel whoami 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $vercelUser) {
    Write-Host 'A Vercel CLI ainda nao esta autenticada.' -ForegroundColor Yellow
    Write-Host 'O terminal vai pedir para voce fazer login.' -ForegroundColor White
    Write-Host 'Use sua conta GitHub para entrar (mais facil).' -ForegroundColor Yellow
    Write-Host ''
    Pause-Continue
    & npx.cmd vercel login 2>&1 | Out-Host
} else {
    Write-Host "Ja autenticado como $vercelUser" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Iniciando deploy...' -ForegroundColor Yellow
Write-Host 'Tentando linkar o projeto automaticamente...' -ForegroundColor Yellow
& npx.cmd vercel link --yes --project morangos 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Nao foi possivel linkar automaticamente.' -ForegroundColor Yellow
    Write-Host 'A Vercel pode pedir algumas respostas na primeira execucao.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host 'Quando perguntar, responda:' -ForegroundColor DarkGray
    Write-Host '  Set up and deploy? -> Y' -ForegroundColor DarkGray
    Write-Host '  Which scope? -> Escolha sua conta' -ForegroundColor DarkGray
    Write-Host '  Link to existing project? -> N' -ForegroundColor DarkGray
    Write-Host '  Project name? -> morangos' -ForegroundColor DarkGray
    Write-Host '  Directory? -> ./' -ForegroundColor DarkGray
    Write-Host '  Modify settings? -> N' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host 'Fazendo deploy inicial...' -ForegroundColor Yellow
& npx.cmd vercel --prod 2>&1 | Out-Host
$initialDeployOk = ($LASTEXITCODE -eq 0)

Write-Host ''
Write-Host 'Adicionando variaveis de ambiente...' -ForegroundColor Yellow
Write-Host '(Sem prompts extras: o script usa --force)' -ForegroundColor DarkGray
Write-Host ''

Add-VercelEnvWithoutNewline $deployDir 'TURSO_DATABASE_URL' $tursoUrl
Add-VercelEnvWithoutNewline $deployDir 'TURSO_AUTH_TOKEN' $tursoToken
Add-VercelEnvWithoutNewline $deployDir 'AUTH_SECRET' $authSecret
Add-VercelEnvWithoutNewline $deployDir 'DATABASE_URL' 'file:./dev.db'

Write-Host ''
Write-Host 'Redeployando com as variaveis...' -ForegroundColor Yellow
& npx.cmd vercel --prod --yes 2>&1 | Out-Host
$finalDeployOk = ($LASTEXITCODE -eq 0)

# ============================================================
# PASSO 10 - GOOGLE MAPS (OPCIONAL)
# ============================================================
Show-Step 10 'GOOGLE MAPS (OPCIONAL)'

Write-Host 'O app usa o Google Maps para otimizar rotas de entrega.' -ForegroundColor White
Write-Host 'Isso e opcional. O app funciona sem ele.' -ForegroundColor DarkGray
Write-Host ''
$configurarMaps = Read-Host 'Deseja configurar o Google Maps agora? (S/N)'

if ($configurarMaps -eq 'S' -or $configurarMaps -eq 's') {
    Write-Host ''
    Write-Host 'Abrindo o Google Cloud Console...' -ForegroundColor Yellow
    Start-Process 'https://console.cloud.google.com'
    Write-Host ''
    Write-Host 'Siga estes passos no navegador:' -ForegroundColor White
    Write-Host '  1. Faca login com sua conta Google' -ForegroundColor DarkGray
    Write-Host '  2. Crie um projeto (ex: Morangos)' -ForegroundColor DarkGray
    Write-Host '  3. Va em APIs, depois Biblioteca' -ForegroundColor DarkGray
    Write-Host '  4. Ative: Routes API e Maps Embed API' -ForegroundColor DarkGray
    Write-Host '  5. Va em Credenciais, Criar, Chave de API' -ForegroundColor DarkGray
    Write-Host '  6. Copie a chave' -ForegroundColor DarkGray
    Write-Host ''

    while ($true) {
        $apiKey = Read-Host 'Cole sua API key aqui'
        if ($apiKey -and $apiKey.Trim().Length -gt 10) { break }
        Write-Host 'Chave invalida. Tente novamente.' -ForegroundColor Red
    }

    Add-VercelEnvWithoutNewline $deployDir 'GOOGLE_ROUTES_API_KEY' $apiKey.Trim()
    Write-Host 'API key configurada!' -ForegroundColor Green
    Write-Host 'Redeployando...' -ForegroundColor Yellow
    & npx.cmd vercel --prod --yes 2>&1 | Out-Host
    $finalDeployOk = ($LASTEXITCODE -eq 0)
}

# ============================================================
# PASSO 11 - PRONTO!
# ============================================================
Show-Step 11 'PRONTO!'

Write-Host ''
Write-Host '  ========================================' -ForegroundColor Green
Write-Host '  DEPLOY CONCLUIDO!' -ForegroundColor Green
Write-Host '  ========================================' -ForegroundColor Green
Write-Host ''
if ($finalDeployOk) {
    Write-Host '  Seu app esta online!' -ForegroundColor White
} else {
    Write-Host '  O script terminou, mas o deploy final falhou.' -ForegroundColor Yellow
    Write-Host '  Veja os erros acima no build da Vercel.' -ForegroundColor Yellow
}
Write-Host ''
Write-Host '  Acesse o dashboard da Vercel para ver a URL:' -ForegroundColor White
Write-Host '  https://vercel.com/dashboard' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Primeiro acesso:' -ForegroundColor White
Write-Host '  1. Abra a URL no navegador' -ForegroundColor DarkGray
Write-Host '  2. Crie o usuario administrador' -ForegroundColor DarkGray
Write-Host '  3. Pronto!' -ForegroundColor DarkGray
Write-Host ''
Write-Host "  Banco Turso: $tursoUrl" -ForegroundColor DarkGray
Write-Host '  Hosting: Vercel' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Para atualizar no futuro:' -ForegroundColor Yellow
Write-Host '  Qualquer git push na branch cloud' -ForegroundColor DarkGray
Write-Host '  atualiza o app automaticamente.' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Custo: R$0/mes (plano gratuito)' -ForegroundColor Green
Write-Host ''
Read-Host 'Pressione Enter para fechar'
