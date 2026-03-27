# ============================================================
# INSTALADOR AUTOMATICO - MORANGOS
# Sistema de Gerenciamento de Pedidos e Entregas
# ============================================================

$ErrorActionPreference = "Stop"
$installDir = $PSScriptRoot
if (-not $installDir) { $installDir = Get-Location }
$morangosDir = Join-Path $installDir "morangos"

function Show-Error {
    param([string]$msg)
    Write-Host ""
    Write-Host "ERRO: $msg" -ForegroundColor Red
    Write-Host ""
    if (Test-Path (Join-Path $morangosDir ".installed")) {
        Remove-Item (Join-Path $morangosDir ".installed") -Force
    }
    Read-Host "Pressione Enter para fechar"
    exit 1
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ============================================================
# STEP 1 — DETECTAR SE JA ESTA INSTALADO
# ============================================================
if ((Test-Path $morangosDir) -and (Test-Path (Join-Path $morangosDir ".installed"))) {
    Write-Host ""
    Write-Host "App ja esta instalado!" -ForegroundColor Green
    Write-Host ""
    # Pular para INICIAR APP
} else {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  INSTALADOR - MORANGOS" -ForegroundColor Cyan
    Write-Host "  Sistema de Gerenciamento" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""

    # ============================================================
    # STEP 2 — INSTALAR NODE.JS SE NECESSARIO
    # ============================================================
    try {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Host "Node.js ja esta instalado ($nodeVersion)" -ForegroundColor Green
        } else {
            throw "not found"
        }
    } catch {
        Write-Host "Instalando Node.js, aguarde..." -ForegroundColor Yellow
        $nodeInstaller = Join-Path $env:TEMP "node-lts.msi"
        try {
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi" -OutFile $nodeInstaller -UseBasicParsing
        } catch {
            Show-Error "Falha ao baixar Node.js. Verifique sua conexao com a internet."
        }
        try {
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait -NoNewWindow
        } catch {
            Show-Error "Falha ao instalar Node.js."
        }
        Refresh-Path
        Start-Sleep -Seconds 2
        try {
            $nodeVersion = & node --version 2>$null
            if (-not $nodeVersion) { throw "not found" }
            Write-Host "Node.js instalado com sucesso! ($nodeVersion)" -ForegroundColor Green
        } catch {
            Show-Error "Node.js foi instalado mas nao foi encontrado no PATH. Feche esta janela, reinicie o PowerShell e tente novamente."
        }
        Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
    }

    # ============================================================
    # STEP 3 — INSTALAR GIT SE NECESSARIO
    # ============================================================
    try {
        $gitVersion = & git --version 2>$null
        if ($gitVersion) {
            Write-Host "Git ja esta instalado ($gitVersion)" -ForegroundColor Green
        } else {
            throw "not found"
        }
    } catch {
        Write-Host "Instalando Git, aguarde..." -ForegroundColor Yellow
        $gitInstaller = Join-Path $env:TEMP "git-installer.exe"
        try {
            Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe" -OutFile $gitInstaller -UseBasicParsing
        } catch {
            Show-Error "Falha ao baixar Git. Verifique sua conexao com a internet."
        }
        try {
            Start-Process $gitInstaller -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=`"`"" -Wait -NoNewWindow
        } catch {
            Show-Error "Falha ao instalar Git."
        }
        Refresh-Path
        Start-Sleep -Seconds 2
        try {
            $gitVersion = & git --version 2>$null
            if (-not $gitVersion) { throw "not found" }
            Write-Host "Git instalado com sucesso! ($gitVersion)" -ForegroundColor Green
        } catch {
            Show-Error "Git foi instalado mas nao foi encontrado no PATH. Feche esta janela, reinicie o PowerShell e tente novamente."
        }
        Remove-Item $gitInstaller -Force -ErrorAction SilentlyContinue
    }

    # ============================================================
    # STEP 4 — CLONAR REPOSITORIO
    # ============================================================
    Write-Host ""
    Write-Host "Baixando o aplicativo..." -ForegroundColor Yellow
    if (Test-Path $morangosDir) {
        Remove-Item $morangosDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    try {
        & git clone https://github.com/gtorige/morangos.git morangos 2>&1
        if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
    } catch {
        Show-Error "Falha ao baixar o aplicativo. Verifique sua conexao com a internet."
    }
    Write-Host "Aplicativo baixado!" -ForegroundColor Green

    # ============================================================
    # STEP 5 — INSTALAR DEPENDENCIAS
    # ============================================================
    Set-Location $morangosDir
    Write-Host ""
    Write-Host "Instalando dependencias do projeto..." -ForegroundColor Yellow
    Write-Host "(isso pode demorar alguns minutos)" -ForegroundColor DarkGray
    try {
        & npm install 2>&1
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    } catch {
        Show-Error "Falha ao instalar dependencias do projeto."
    }
    Write-Host "Dependencias instaladas!" -ForegroundColor Green

    # ============================================================
    # STEP 6 — CONFIGURAR PRISMA
    # ============================================================
    Write-Host ""
    Write-Host "Configurando banco de dados..." -ForegroundColor Yellow
    try {
        & npx prisma generate 2>&1
        if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }
    } catch {
        Show-Error "Falha ao gerar cliente Prisma."
    }
    try {
        & npx prisma migrate deploy 2>&1
        if ($LASTEXITCODE -ne 0) { throw "prisma migrate failed" }
    } catch {
        Show-Error "Falha ao aplicar migracoes do banco de dados."
    }
    Write-Host "Banco de dados configurado!" -ForegroundColor Green

    # ============================================================
    # STEP 7 — CRIAR ARQUIVO .ENV
    # ============================================================
    Write-Host ""
    Write-Host "Criando arquivo de configuracao..." -ForegroundColor Yellow
    try {
        & node -e "const c=require('crypto');const fs=require('fs');fs.writeFileSync('.env','DATABASE_URL=\`"file:./dev.db\`"\nAUTH_SECRET='+c.randomBytes(32).toString('hex')+'\n');"
        if ($LASTEXITCODE -ne 0) { throw "env creation failed" }
    } catch {
        Show-Error "Falha ao criar arquivo .env."
    }
    Write-Host "Arquivo .env criado!" -ForegroundColor Green

    # ============================================================
    # STEP 7B — CONFIGURACAO DO GOOGLE MAPS
    # ============================================================
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  CONFIGURACAO DO GOOGLE MAPS" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "O app usa 3 servicos do Google com uma unica chave:" -ForegroundColor White
    Write-Host "  - Google Routes API (otimizacao de rotas)" -ForegroundColor DarkGray
    Write-Host "  - Google Maps Embed API (preview do mapa)" -ForegroundColor DarkGray
    Write-Host "  - Google Maps URLs (abrir no Google Maps)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Voce precisara criar uma API key gratuita do Google." -ForegroundColor White
    Write-Host "O plano gratuito da `$200 de credito por mes —" -ForegroundColor White
    Write-Host "mais do que suficiente para uso pessoal." -ForegroundColor White
    Write-Host ""
    Write-Host "Abrindo o Google Cloud Console no navegador..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    Start-Process "https://console.cloud.google.com"
    Write-Host ""
    Write-Host "Siga estes passos no navegador:" -ForegroundColor White
    Write-Host "  1. Faca login com sua conta Google" -ForegroundColor DarkGray
    Write-Host "  2. Crie um projeto (ex: Morangos)" -ForegroundColor DarkGray
    Write-Host "  3. Va em APIs e Servicos > Biblioteca" -ForegroundColor DarkGray
    Write-Host "  4. Busque e ative: Routes API" -ForegroundColor DarkGray
    Write-Host "  5. Busque e ative: Maps Embed API" -ForegroundColor DarkGray
    Write-Host "  6. Va em Credenciais > Criar Credencial > Chave de API" -ForegroundColor DarkGray
    Write-Host "  7. Copie a chave gerada" -ForegroundColor DarkGray
    Write-Host ""
    while ($true) {
        $apiKey = Read-Host "Cole sua API key aqui e pressione Enter"
        if ($apiKey -and $apiKey.Trim().Length -gt 10) {
            break
        }
        Write-Host "A API key nao pode estar vazia. Tente novamente." -ForegroundColor Red
    }
    Add-Content -Path (Join-Path $morangosDir ".env") -Value "GOOGLE_ROUTES_API_KEY=$($apiKey.Trim())"
    Write-Host "API key salva com sucesso!" -ForegroundColor Green
    Write-Host ""

    # ============================================================
    # STEP 8 — CRIAR MARCADOR .installed
    # ============================================================
    New-Item -Path (Join-Path $morangosDir ".installed") -ItemType File -Force | Out-Null

    # ============================================================
    # STEP 9 — CRIAR iniciar.ps1
    # ============================================================
    $iniciarContent = @"
`$appDir = "$morangosDir"
Set-Location `$appDir
Start-Process powershell -ArgumentList "-Command", "Set-Location '`$appDir'; npm run dev" -WindowStyle Minimized
Start-Sleep -Seconds 8
Start-Process "http://localhost:3000"
"@
    Set-Content -Path (Join-Path $morangosDir "iniciar.ps1") -Value $iniciarContent -Encoding UTF8

    # ============================================================
    # STEP 10 — CRIAR ATALHO NA AREA DE TRABALHO
    # ============================================================
    Write-Host ""
    Write-Host "Criando atalho na area de trabalho..." -ForegroundColor Yellow
    try {
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutPath = Join-Path $desktopPath "Morangos.lnk"
        $iniciarPath = Join-Path $morangosDir "iniciar.ps1"
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "powershell.exe"
        $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$iniciarPath`""
        $shortcut.WorkingDirectory = $morangosDir
        $shortcut.WindowStyle = 7
        $shortcut.IconLocation = "shell32.dll,41"
        $shortcut.Save()
        Write-Host "Atalho criado na area de trabalho!" -ForegroundColor Green
    } catch {
        Write-Host "Nao foi possivel criar atalho automaticamente." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  INSTALACAO CONCLUIDA!" -ForegroundColor Green
    Write-Host "  Iniciando o app pela primeira vez..." -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
}

# ============================================================
# STEP 11 — INICIAR O APP
# ============================================================
Set-Location $morangosDir
Write-Host "Iniciando o aplicativo..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "Set-Location '$morangosDir'; npm run dev" -WindowStyle Minimized
Write-Host "Aguardando o app iniciar..." -ForegroundColor DarkGray
Start-Sleep -Seconds 8
Start-Process "http://localhost:3000"
Write-Host ""
Write-Host "App aberto no navegador!" -ForegroundColor Green
Write-Host "Pode fechar esta janela." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Pressione Enter para fechar"
