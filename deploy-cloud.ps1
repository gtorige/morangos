# ============================================================
# DEPLOY MORANGOS NA NUVEM (Vercel + Turso)
# Guia interativo para leigos ??" faz tudo passo a passo
# ============================================================

$ErrorActionPreference = "Continue"

function Show-Step($num, $title) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  PASSO $num ??" $title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Pause-Continue {
    Write-Host ""
    Read-Host "Pressione Enter quando estiver pronto para continuar"
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Clear-Host
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "  MORANGOS ??" DEPLOY NA NUVEM" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Este script vai colocar o app online" -ForegroundColor White
Write-Host "  para acessar de qualquer lugar." -ForegroundColor White
Write-Host ""
Write-Host "  Voce vai precisar:" -ForegroundColor Yellow
Write-Host "  - Uma conta GitHub (pode criar agora)" -ForegroundColor DarkGray
Write-Host "  - Uma conta Turso (banco de dados gratis)" -ForegroundColor DarkGray
Write-Host "  - Uma conta Vercel (hospedagem gratis)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Tudo gratuito. Nao precisa cartao de credito." -ForegroundColor Green
Write-Host ""
Pause-Continue

# ============================================================
# PASSO 1 ??" VERIFICAR/INSTALAR NODE.JS
# ============================================================
Show-Step 1 "VERIFICAR NODE.JS"

try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js ja instalado ($nodeVersion)" -ForegroundColor Green
    } else { throw "not found" }
} catch {
    Write-Host "Node.js nao encontrado. Instalando..." -ForegroundColor Yellow
    $nodeInstaller = Join-Path $env:TEMP "node-lts.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi" -OutFile $nodeInstaller -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait -NoNewWindow
    Refresh-Path
    Start-Sleep -Seconds 2
    $nodeVersion = & node --version 2>$null
    Write-Host "Node.js instalado! ($nodeVersion)" -ForegroundColor Green
    Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
}

# ============================================================
# PASSO 2 ??" VERIFICAR/INSTALAR TURSO CLI
# ============================================================
Show-Step 2 "INSTALAR TURSO CLI"

$tursoInstalled = $false
try {
    $tursoVersion = & turso --version 2>$null
    if ($tursoVersion) {
        Write-Host "Turso CLI ja instalado ($tursoVersion)" -ForegroundColor Green
        $tursoInstalled = $true
    }
} catch {}

if (-not $tursoInstalled) {
    Write-Host "Instalando Turso CLI..." -ForegroundColor Yellow
    try {
        irm https://get.tur.so/install.ps1 | iex
        Refresh-Path
        Start-Sleep -Seconds 2
        Write-Host "Turso CLI instalado!" -ForegroundColor Green
    } catch {
        Write-Host "Erro ao instalar Turso CLI automaticamente." -ForegroundColor Red
        Write-Host ""
        Write-Host "Instale manualmente:" -ForegroundColor Yellow
        Write-Host "  1. Abra https://docs.turso.tech/cli/installation" -ForegroundColor DarkGray
        Write-Host "  2. Siga as instrucoes para Windows" -ForegroundColor DarkGray
        Write-Host "  3. Feche e abra o PowerShell novamente" -ForegroundColor DarkGray
        Write-Host "  4. Rode este script de novo" -ForegroundColor DarkGray
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

# ============================================================
# PASSO 3 ??" VERIFICAR/INSTALAR VERCEL CLI
# ============================================================
Show-Step 3 "INSTALAR VERCEL CLI"

$vercelInstalled = $false
try {
    $vercelVersion = & npx vercel --version 2>$null
    if ($vercelVersion) {
        Write-Host "Vercel CLI disponivel ($vercelVersion)" -ForegroundColor Green
        $vercelInstalled = $true
    }
} catch {}

if (-not $vercelInstalled) {
    Write-Host "Instalando Vercel CLI..." -ForegroundColor Yellow
    & npm.cmd install -g vercel 2>&1 | Out-Null
    Refresh-Path
    Write-Host "Vercel CLI instalado!" -ForegroundColor Green
}

# ============================================================
# PASSO 4 ??" CRIAR CONTA E LOGIN NO TURSO
# ============================================================
Show-Step 4 "CRIAR CONTA NO TURSO"

Write-Host "Vamos criar sua conta no Turso (banco de dados gratis)." -ForegroundColor White
Write-Host ""
Write-Host "O navegador vai abrir para voce criar a conta." -ForegroundColor White
Write-Host "Use sua conta do GitHub para entrar (mais facil)." -ForegroundColor Yellow
Write-Host ""
Pause-Continue

Write-Host "Abrindo login do Turso no navegador..." -ForegroundColor Yellow
& turso auth login 2>&1 | Out-Host
Write-Host ""
Write-Host "Login no Turso concluido!" -ForegroundColor Green

# ============================================================
# PASSO 5 ??" CRIAR BANCO DE DADOS
# ============================================================
Show-Step 5 "CRIAR BANCO DE DADOS"

Write-Host "Criando banco de dados 'morangos' no Turso..." -ForegroundColor Yellow
$prevEA = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
& turso db create morangos 2>&1 | Out-Host
$ErrorActionPreference = $prevEA

Write-Host ""
Write-Host "Obtendo URL do banco..." -ForegroundColor Yellow
$tursoUrl = (& turso db show morangos --url 2>$null).Trim()
if (-not $tursoUrl) {
    Write-Host "Erro ao obter URL. Tentando novamente..." -ForegroundColor Red
    Start-Sleep -Seconds 3
    $tursoUrl = (& turso db show morangos --url 2>$null).Trim()
}
Write-Host "URL: $tursoUrl" -ForegroundColor Green

Write-Host ""
Write-Host "Gerando token de acesso..." -ForegroundColor Yellow
$tursoToken = (& turso db tokens create morangos 2>$null).Trim()
Write-Host "Token gerado!" -ForegroundColor Green

if (-not $tursoUrl -or -not $tursoToken) {
    Write-Host ""
    Write-Host "ERRO: Nao foi possivel obter URL ou token do Turso." -ForegroundColor Red
    Write-Host "Verifique se o login foi feito corretamente." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ============================================================
# PASSO 6 ??" BAIXAR O CODIGO
# ============================================================
Show-Step 6 "BAIXAR O CODIGO"

$deployDir = Join-Path ([Environment]::GetFolderPath("Desktop")) "morangos-cloud"

if (Test-Path $deployDir) {
    Write-Host "Pasta morangos-cloud ja existe. Atualizando..." -ForegroundColor Yellow
    Set-Location $deployDir
    $env:GIT_REDIRECT_STDERR = '2>&1'
    & git pull origin cloud 2>&1 | Out-Host
    $env:GIT_REDIRECT_STDERR = $null
} else {
    Write-Host "Baixando codigo (branch cloud)..." -ForegroundColor Yellow
    Set-Location ([Environment]::GetFolderPath("Desktop"))
    $env:GIT_REDIRECT_STDERR = '2>&1'
    & git clone -b cloud "https://github.com/gtorige/morangos.git" "$deployDir" 2>&1 | Out-Host
    $env:GIT_REDIRECT_STDERR = $null
    Set-Location $deployDir
}

Write-Host "Codigo baixado!" -ForegroundColor Green

# ============================================================
# PASSO 7 ??" INSTALAR DEPENDENCIAS
# ============================================================
Show-Step 7 "INSTALAR DEPENDENCIAS"

Write-Host "Instalando dependencias (pode demorar 1-2 min)..." -ForegroundColor Yellow
& npm.cmd install 2>&1 | ForEach-Object { if ($_ -notmatch "^npm warn") { Write-Host $_ } }
Write-Host "Dependencias instaladas!" -ForegroundColor Green

# ============================================================
# PASSO 8 ??" CONFIGURAR VARIAVEIS DE AMBIENTE
# ============================================================
Show-Step 8 "CONFIGURAR VARIAVEIS"

$authSecret = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

$envContent = @"
DATABASE_URL="file:./dev.db"
TURSO_DATABASE_URL="$tursoUrl"
TURSO_AUTH_TOKEN="$tursoToken"
AUTH_SECRET="$authSecret"
"@

Set-Content -Path (Join-Path $deployDir ".env") -Value $envContent -Encoding UTF8
Write-Host "Arquivo .env criado!" -ForegroundColor Green

# ============================================================
# PASSO 9 ??" CONFIGURAR BANCO DE DADOS
# ============================================================
Show-Step 9 "CONFIGURAR BANCO DE DADOS"

Write-Host "Gerando cliente Prisma..." -ForegroundColor Yellow
& npx.cmd prisma generate 2>&1 | Out-Host

Write-Host "Aplicando schema no banco Turso..." -ForegroundColor Yellow
$prevEA = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
& npx.cmd prisma db push --accept-data-loss 2>&1 | Out-Host
$ErrorActionPreference = $prevEA

# Verificar se existe banco local para importar
$localDbPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "morangos\prisma\dev.db"
$backupDbPath = $null

# Verificar tambem na pasta de backups seguros
$safeBackupDir = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "MorangosBackups"
if (Test-Path $safeBackupDir) {
    $latestBackup = Get-ChildItem $safeBackupDir -Filter "dev_*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestBackup) { $backupDbPath = $latestBackup.FullName }
}

$importDb = $false
if ((Test-Path $localDbPath) -or $backupDbPath) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  BANCO DE DADOS LOCAL ENCONTRADO!" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""

    if (Test-Path $localDbPath) {
        $dbSize = [math]::Round((Get-Item $localDbPath).Length / 1KB)
        Write-Host "  Banco local: Desktop\morangos\prisma\dev.db ($dbSize KB)" -ForegroundColor White
    }
    if ($backupDbPath) {
        $bkSize = [math]::Round((Get-Item $backupDbPath).Length / 1KB)
        $bkName = (Get-Item $backupDbPath).Name
        Write-Host "  Backup: Documentos\MorangosBackups\$bkName ($bkSize KB)" -ForegroundColor White
    }

    Write-Host ""
    Write-Host "  Deseja importar os dados existentes para a nuvem?" -ForegroundColor White
    Write-Host "  (clientes, pedidos, produtos, contas, etc.)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [1] Sim, importar do banco local (Desktop\morangos)" -ForegroundColor White
    if ($backupDbPath) {
        Write-Host "  [2] Sim, importar do backup mais recente" -ForegroundColor White
    }
    Write-Host "  [3] Nao, comecar do zero" -ForegroundColor White
    Write-Host ""

    $importChoice = Read-Host "Escolha (1/2/3)"

    if ($importChoice -eq "1" -and (Test-Path $localDbPath)) {
        $importDb = $true
        $sourceDb = $localDbPath
        Write-Host "Importando banco local..." -ForegroundColor Yellow
    } elseif ($importChoice -eq "2" -and $backupDbPath) {
        $importDb = $true
        $sourceDb = $backupDbPath
        Write-Host "Importando backup..." -ForegroundColor Yellow
    }
}

if ($importDb) {
    # Para importar SQLite para Turso, precisamos do sqlite3 ou usar a CLI do Turso
    # Turso CLI tem o comando 'turso db shell' que aceita SQL

    Write-Host "Exportando dados do banco local..." -ForegroundColor Yellow

    # Tentar usar better-sqlite3 via Node.js para extrair SQL
    $exportScript = @'
const Database = require("better-sqlite3");
const db = new Database(process.argv[2], { readonly: true });

// Get all table names
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
            if (typeof v === "boolean") return v ? "1" : "0";
            return "'" + String(v).replace(/'/g, "''") + "'";
        }).join(", ");
        sql += `INSERT OR IGNORE INTO "${name}" (${cols.map(c => '"' + c + '"').join(", ")}) VALUES (${values});\n`;
    }
}

process.stdout.write(sql);
db.close();
'@

    $exportScriptPath = Join-Path $deployDir "export-db.js"
    Set-Content -Path $exportScriptPath -Value $exportScript -Encoding UTF8

    $sqlFile = Join-Path $deployDir "import.sql"
    & node.exe $exportScriptPath $sourceDb > $sqlFile 2>$null

    $sqlSize = [math]::Round((Get-Item $sqlFile).Length / 1KB)
    $sqlLines = (Get-Content $sqlFile | Measure-Object -Line).Lines
    Write-Host "Exportado: $sqlLines registros ($sqlSize KB)" -ForegroundColor Green

    if ($sqlLines -gt 0) {
        Write-Host "Importando para o Turso..." -ForegroundColor Yellow

        # Importar via turso db shell
        Get-Content $sqlFile | & turso db shell morangos 2>&1 | Out-Host

        Write-Host ""
        Write-Host "Dados importados com sucesso!" -ForegroundColor Green
        Write-Host "Seus clientes, pedidos e produtos estao na nuvem." -ForegroundColor Green
    } else {
        Write-Host "Banco local vazio ou nao foi possivel exportar." -ForegroundColor Yellow
        Write-Host "Iniciando do zero..." -ForegroundColor DarkGray
        & node.exe prisma/seed-init.js 2>&1 | Out-Host
    }

    # Limpar arquivos temporarios
    Remove-Item $exportScriptPath -Force -ErrorAction SilentlyContinue
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Criando dados iniciais..." -ForegroundColor Yellow
    & node.exe prisma/seed-init.js 2>&1 | Out-Host
}

Write-Host "Banco de dados configurado!" -ForegroundColor Green

# ============================================================
# PASSO 10 ??" DEPLOY NA VERCEL
# ============================================================
Show-Step 10 "DEPLOY NA VERCEL"

Write-Host "Agora vamos publicar o app na Vercel." -ForegroundColor White
Write-Host ""
Write-Host "O navegador vai abrir para voce criar sua conta." -ForegroundColor White
Write-Host "Use sua conta do GitHub para entrar (mais facil)." -ForegroundColor Yellow
Write-Host ""
Write-Host "Quando o terminal perguntar, responda:" -ForegroundColor White
Write-Host '  "Set up and deploy?" -> Y' -ForegroundColor DarkGray
Write-Host '  "Which scope?" -> Escolha sua conta' -ForegroundColor DarkGray
Write-Host '  "Link to existing project?" -> N' -ForegroundColor DarkGray
Write-Host '  "What is your project name?" -> morangos' -ForegroundColor DarkGray
Write-Host '  "In which directory?" -> ./' -ForegroundColor DarkGray
Write-Host '  "Want to modify settings?" -> N' -ForegroundColor DarkGray
Write-Host ""
Pause-Continue

# Login na Vercel
Write-Host "Fazendo login na Vercel..." -ForegroundColor Yellow
& npx.cmd vercel login 2>&1 | Out-Host

# Configurar variaveis de ambiente na Vercel
Write-Host ""
Write-Host "Configurando variaveis de ambiente na Vercel..." -ForegroundColor Yellow

# Deploy
Write-Host ""
Write-Host "Iniciando deploy..." -ForegroundColor Yellow
& npx.cmd vercel --prod --yes 2>&1 | Out-Host

# Configurar env vars via CLI
Write-Host ""
Write-Host "Adicionando variaveis de ambiente ao projeto..." -ForegroundColor Yellow

# Usar echo via pipeline para enviar valores
$tursoUrl | & npx.cmd vercel env add TURSO_DATABASE_URL production 2>&1 | Out-Host
$tursoToken | & npx.cmd vercel env add TURSO_AUTH_TOKEN production 2>&1 | Out-Host
$authSecret | & npx.cmd vercel env add AUTH_SECRET production 2>&1 | Out-Host
"file:./dev.db" | & npx.cmd vercel env add DATABASE_URL production 2>&1 | Out-Host

# Rebuild com as variaveis
Write-Host ""
Write-Host "Redeployando com as variaveis configuradas..." -ForegroundColor Yellow
& npx.cmd vercel --prod --yes 2>&1 | Out-Host

# ============================================================
# PASSO 11 ??" CONFIGURACAO GOOGLE MAPS (OPCIONAL)
# ============================================================
Show-Step 11 "GOOGLE MAPS (OPCIONAL)"

Write-Host "O app usa o Google Maps para otimizar rotas de entrega." -ForegroundColor White
Write-Host "Isso e opcional ??" o app funciona sem ele." -ForegroundColor DarkGray
Write-Host ""
$configurarMaps = Read-Host "Deseja configurar o Google Maps agora? (S/N)"

if ($configurarMaps -eq "S" -or $configurarMaps -eq "s") {
    Write-Host ""
    Write-Host "Abrindo o Google Cloud Console..." -ForegroundColor Yellow
    Start-Process "https://console.cloud.google.com"
    Write-Host ""
    Write-Host "Siga estes passos no navegador:" -ForegroundColor White
    Write-Host "  1. Faca login com sua conta Google" -ForegroundColor DarkGray
    Write-Host '  2. Crie um projeto (ex: "Morangos")' -ForegroundColor DarkGray
    Write-Host '  3. Va em APIs, depois Biblioteca' -ForegroundColor DarkGray
    Write-Host '  4. Ative: Routes API e Maps Embed API' -ForegroundColor DarkGray
    Write-Host '  5. Va em Credenciais, Criar, Chave de API' -ForegroundColor DarkGray
    Write-Host "  6. Copie a chave" -ForegroundColor DarkGray
    Write-Host ""

    while ($true) {
        $apiKey = Read-Host "Cole sua API key aqui"
        if ($apiKey -and $apiKey.Trim().Length -gt 10) { break }
        Write-Host "Chave invalida. Tente novamente." -ForegroundColor Red
    }

    $apiKey.Trim() | & npx.cmd vercel env add GOOGLE_ROUTES_API_KEY production 2>&1 | Out-Host
    Write-Host "API key configurada!" -ForegroundColor Green

    # Redeploy final
    Write-Host "Redeployando com Google Maps..." -ForegroundColor Yellow
    & npx.cmd vercel --prod --yes 2>&1 | Out-Host
}

# ============================================================
# PASSO 12 ??" OBTER URL FINAL
# ============================================================
Show-Step 12 "PRONTO!"

$vercelUrl = (& npx.cmd vercel ls 2>$null | Select-String "https://" | Select-Object -First 1).ToString().Trim()

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "  DEPLOY CONCLUIDO!" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Seu app esta online!" -ForegroundColor White
Write-Host ""
if ($vercelUrl) {
    Write-Host "  URL: $vercelUrl" -ForegroundColor Cyan
} else {
    Write-Host "  Acesse: https://vercel.com/dashboard" -ForegroundColor Cyan
    Write-Host "  para encontrar a URL do seu projeto." -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  Primeiro acesso:" -ForegroundColor White
Write-Host "  1. Abra a URL no navegador" -ForegroundColor DarkGray
Write-Host "  2. Crie o usuario administrador" -ForegroundColor DarkGray
Write-Host "  3. Pronto ??" use de qualquer lugar!" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Dados salvos:" -ForegroundColor White
Write-Host "  - Banco: Turso (morangos)" -ForegroundColor DarkGray
Write-Host "  - URL Turso: $tursoUrl" -ForegroundColor DarkGray
Write-Host "  - Hosting: Vercel" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Para atualizar no futuro:" -ForegroundColor Yellow
Write-Host "  Qualquer git push na branch 'cloud'" -ForegroundColor DarkGray
Write-Host "  atualiza o app automaticamente." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Custo: R$ 0/mes (plano gratuito)" -ForegroundColor Green
Write-Host ""
Read-Host "Pressione Enter para fechar"

