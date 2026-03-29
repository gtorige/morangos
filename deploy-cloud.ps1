# ============================================================
# DEPLOY MORANGOS NA NUVEM (Vercel + Turso)
# Guia interativo - faz tudo passo a passo
# ============================================================

$ErrorActionPreference = 'Continue'

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
# PASSO 2 - CRIAR BANCO NO TURSO (via navegador)
# ============================================================
Show-Step 2 'CRIAR BANCO NO TURSO'

Write-Host 'Vamos criar o banco de dados no Turso.' -ForegroundColor White
Write-Host 'O navegador vai abrir. Siga os passos:' -ForegroundColor White
Write-Host ''
Write-Host '  1. Clique em "Get Started" ou "Sign Up"' -ForegroundColor DarkGray
Write-Host '  2. Entre com sua conta GitHub (mais facil)' -ForegroundColor DarkGray
Write-Host '  3. Apos entrar, clique em "Create Database"' -ForegroundColor DarkGray
Write-Host '  4. Nome: morangos' -ForegroundColor DarkGray
Write-Host '  5. Regiao: escolha a mais proxima (ex: gru - Sao Paulo)' -ForegroundColor DarkGray
Write-Host '  6. Clique "Create Database"' -ForegroundColor DarkGray
Write-Host ''
Pause-Continue

Start-Process 'https://turso.tech/app'
Write-Host 'Navegador aberto. Crie o banco "morangos".' -ForegroundColor Yellow
Write-Host ''
Pause-Continue

Write-Host ''
Write-Host 'Agora copie a URL do banco:' -ForegroundColor White
Write-Host '  No dashboard do Turso, clique no banco "morangos"' -ForegroundColor DarkGray
Write-Host '  Copie a URL que aparece (ex: libsql://morangos-seuuser.turso.io)' -ForegroundColor DarkGray
Write-Host ''

while ($true) {
    $tursoUrl = Read-Host 'Cole a URL do banco aqui'
    if ($tursoUrl -and $tursoUrl.Trim().StartsWith('libsql://')) { break }
    Write-Host 'URL invalida. Deve comecar com libsql://' -ForegroundColor Red
}
$tursoUrl = $tursoUrl.Trim()
Write-Host "URL salva: $tursoUrl" -ForegroundColor Green

Write-Host ''
Write-Host 'Agora crie um token de acesso:' -ForegroundColor White
Write-Host '  No dashboard, clique no banco "morangos"' -ForegroundColor DarkGray
Write-Host '  Va em "Create Token" ou "Generate Token"' -ForegroundColor DarkGray
Write-Host '  Copie o token gerado' -ForegroundColor DarkGray
Write-Host ''

while ($true) {
    $tursoToken = Read-Host 'Cole o token aqui'
    if ($tursoToken -and $tursoToken.Trim().Length -gt 20) { break }
    Write-Host 'Token invalido. Deve ter mais de 20 caracteres.' -ForegroundColor Red
}
$tursoToken = $tursoToken.Trim()
Write-Host 'Token salvo!' -ForegroundColor Green

# ============================================================
# PASSO 3 - BAIXAR O CODIGO
# ============================================================
Show-Step 3 'BAIXAR O CODIGO'

$deployDir = Join-Path ([Environment]::GetFolderPath('Desktop')) 'morangos-cloud'

if (Test-Path $deployDir) {
    Write-Host 'Pasta morangos-cloud ja existe. Atualizando...' -ForegroundColor Yellow
    Set-Location $deployDir
    $env:GIT_REDIRECT_STDERR = '2>&1'
    & git pull origin cloud 2>&1 | Out-Host
    $env:GIT_REDIRECT_STDERR = $null
} else {
    Write-Host 'Baixando codigo (branch cloud)...' -ForegroundColor Yellow
    Set-Location ([Environment]::GetFolderPath('Desktop'))
    $env:GIT_REDIRECT_STDERR = '2>&1'
    & git clone -b cloud 'https://github.com/gtorige/morangos.git' "$deployDir" 2>&1 | Out-Host
    $env:GIT_REDIRECT_STDERR = $null
    Set-Location $deployDir
}

Write-Host 'Codigo baixado!' -ForegroundColor Green

# ============================================================
# PASSO 4 - INSTALAR DEPENDENCIAS
# ============================================================
Show-Step 4 'INSTALAR DEPENDENCIAS'

Write-Host 'Instalando dependencias (pode demorar 1-2 min)...' -ForegroundColor Yellow
& npm.cmd install 2>&1 | ForEach-Object { if ($_ -notmatch '^npm warn') { Write-Host $_ } }
Write-Host 'Dependencias instaladas!' -ForegroundColor Green

# ============================================================
# PASSO 5 - CONFIGURAR VARIAVEIS
# ============================================================
Show-Step 5 'CONFIGURAR VARIAVEIS'

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
# PASSO 6 - CONFIGURAR BANCO DE DADOS
# ============================================================
Show-Step 6 'CONFIGURAR BANCO DE DADOS'

Write-Host 'Gerando cliente Prisma...' -ForegroundColor Yellow
& npx.cmd prisma generate 2>&1 | Out-Host

Write-Host 'Aplicando schema no banco Turso...' -ForegroundColor Yellow
$prevEA = $ErrorActionPreference; $ErrorActionPreference = 'SilentlyContinue'
& npx.cmd prisma db push --accept-data-loss 2>&1 | Out-Host
$ErrorActionPreference = $prevEA

# Verificar se existe banco local para importar
$localDbPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'morangos\prisma\dev.db'
$backupDbPath = $null
$safeBackupDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'MorangosBackups'
if (Test-Path $safeBackupDir) {
    $latestBackup = Get-ChildItem $safeBackupDir -Filter 'dev_*.db' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestBackup) { $backupDbPath = $latestBackup.FullName }
}

$importDb = $false
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

    if ($importChoice -eq '1' -and (Test-Path $localDbPath)) {
        $importDb = $true
        $sourceDb = $localDbPath
    } elseif ($importChoice -eq '2' -and $backupDbPath) {
        $importDb = $true
        $sourceDb = $backupDbPath
    }
}

if ($importDb) {
    Write-Host 'Exportando dados do banco local...' -ForegroundColor Yellow

    $exportScript = @'
const Database = require("better-sqlite3");
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
process.stdout.write(sql);
db.close();
'@

    $exportScriptPath = Join-Path $deployDir 'export-db.js'
    Set-Content -Path $exportScriptPath -Value $exportScript -Encoding UTF8
    $sqlFile = Join-Path $deployDir 'import.sql'
    & node.exe $exportScriptPath $sourceDb > $sqlFile 2>$null

    $sqlLines = (Get-Content $sqlFile | Measure-Object -Line).Lines
    Write-Host "Exportado: $sqlLines registros" -ForegroundColor Green

    if ($sqlLines -gt 0) {
        Write-Host 'Importando para o Turso...' -ForegroundColor Yellow
        Write-Host 'Abrindo o shell do Turso no navegador...' -ForegroundColor Yellow
        Write-Host ''
        Write-Host 'No dashboard do Turso:' -ForegroundColor White
        Write-Host '  1. Clique no banco "morangos"' -ForegroundColor DarkGray
        Write-Host '  2. Va em "Shell" ou "Edit Data"' -ForegroundColor DarkGray
        Write-Host '  3. Cole o conteudo do arquivo import.sql' -ForegroundColor DarkGray
        Write-Host ''
        Write-Host "  Arquivo: $sqlFile" -ForegroundColor Cyan
        Write-Host "  ($sqlLines linhas de SQL)" -ForegroundColor DarkGray
        Write-Host ''
        Write-Host '  Ou, se tiver o Turso CLI instalado:' -ForegroundColor DarkGray
        Write-Host "  turso db shell morangos < `"$sqlFile`"" -ForegroundColor DarkGray
        Write-Host ''
        Pause-Continue
    }

    Remove-Item $exportScriptPath -Force -ErrorAction SilentlyContinue
} else {
    Write-Host 'Criando dados iniciais...' -ForegroundColor Yellow
    & node.exe prisma/seed-init.js 2>&1 | Out-Host
}

Write-Host 'Banco de dados configurado!' -ForegroundColor Green

# ============================================================
# PASSO 7 - DEPLOY NA VERCEL
# ============================================================
Show-Step 7 'DEPLOY NA VERCEL'

Write-Host 'Agora vamos publicar o app na Vercel.' -ForegroundColor White
Write-Host ''
Write-Host 'O terminal vai pedir para voce fazer login.' -ForegroundColor White
Write-Host 'Use sua conta GitHub para entrar (mais facil).' -ForegroundColor Yellow
Write-Host ''
Pause-Continue

Write-Host 'Fazendo login na Vercel...' -ForegroundColor Yellow
& npx.cmd vercel login 2>&1 | Out-Host

Write-Host ''
Write-Host 'Iniciando deploy...' -ForegroundColor Yellow
Write-Host 'Quando perguntar, responda:' -ForegroundColor DarkGray
Write-Host '  Set up and deploy? -> Y' -ForegroundColor DarkGray
Write-Host '  Which scope? -> Escolha sua conta' -ForegroundColor DarkGray
Write-Host '  Link to existing project? -> N' -ForegroundColor DarkGray
Write-Host '  Project name? -> morangos' -ForegroundColor DarkGray
Write-Host '  Directory? -> ./' -ForegroundColor DarkGray
Write-Host '  Modify settings? -> N' -ForegroundColor DarkGray
Write-Host ''

& npx.cmd vercel --prod 2>&1 | Out-Host

Write-Host ''
Write-Host 'Adicionando variaveis de ambiente...' -ForegroundColor Yellow
Write-Host '(Responda "y" para cada pergunta)' -ForegroundColor DarkGray
Write-Host ''

echo $tursoUrl | & npx.cmd vercel env add TURSO_DATABASE_URL production 2>&1 | Out-Host
echo $tursoToken | & npx.cmd vercel env add TURSO_AUTH_TOKEN production 2>&1 | Out-Host
echo $authSecret | & npx.cmd vercel env add AUTH_SECRET production 2>&1 | Out-Host
echo 'file:./dev.db' | & npx.cmd vercel env add DATABASE_URL production 2>&1 | Out-Host

Write-Host ''
Write-Host 'Redeployando com as variaveis...' -ForegroundColor Yellow
& npx.cmd vercel --prod --yes 2>&1 | Out-Host

# ============================================================
# PASSO 8 - GOOGLE MAPS (OPCIONAL)
# ============================================================
Show-Step 8 'GOOGLE MAPS (OPCIONAL)'

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

    echo $apiKey.Trim() | & npx.cmd vercel env add GOOGLE_ROUTES_API_KEY production 2>&1 | Out-Host
    Write-Host 'API key configurada!' -ForegroundColor Green
    Write-Host 'Redeployando...' -ForegroundColor Yellow
    & npx.cmd vercel --prod --yes 2>&1 | Out-Host
}

# ============================================================
# PASSO 9 - PRONTO!
# ============================================================
Show-Step 9 'PRONTO!'

Write-Host ''
Write-Host '  ========================================' -ForegroundColor Green
Write-Host '  DEPLOY CONCLUIDO!' -ForegroundColor Green
Write-Host '  ========================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Seu app esta online!' -ForegroundColor White
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
