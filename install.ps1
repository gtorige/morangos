# ============================================================
# INSTALADOR AUTOMATICO - MORANGOS
# Sistema de Gerenciamento de Pedidos e Entregas
# ============================================================

# Permitir execucao de scripts nesta sessao (necessario para npm/npx)
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force } catch {}

# "Continue" evita que o PowerShell trate stderr de comandos nativos como erro fatal
$ErrorActionPreference = "Continue"
# Sempre instalar na area de trabalho do usuario
$installDir = [Environment]::GetFolderPath("Desktop")
$morangosDir = Join-Path $installDir "morangos"

function Show-Error {
    param([string]$msg)
    Write-Host ""
    Write-Host "ERRO: $msg" -ForegroundColor Red
    Write-Host ""
    if (Test-Path (Join-Path $morangosDir ".installed")) {
        Remove-Item (Join-Path $morangosDir ".installed") -Force
    }
    Read-Host "Pressione Enter para continuar"
    exit 1
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ============================================================
# STEP 1 — DETECTAR SE JA ESTA INSTALADO
# ============================================================
if ((Test-Path $morangosDir) -and (Test-Path (Join-Path $morangosDir ".installed"))) {
    # Ler versao local do package.json
    $localVersion = "desconhecida"
    $pkgPath = Join-Path $morangosDir "package.json"
    if (Test-Path $pkgPath) {
        $pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $localVersion = $pkgJson.version
    }

    # Checar versao remota
    $remoteVersion = $null
    $hasUpdate = $false
    Write-Host ""
    Write-Host "Verificando atualizacoes..." -ForegroundColor DarkGray
    try {
        $remotePkg = Invoke-WebRequest -Uri "https://raw.githubusercontent.com/gtorige/morangos/main/package.json" -UseBasicParsing -TimeoutSec 5 2>$null
        $remotePkgJson = $remotePkg.Content | ConvertFrom-Json
        $remoteVersion = $remotePkgJson.version
        if ($remoteVersion -and $remoteVersion -ne $localVersion) {
            $hasUpdate = $true
        }
    } catch {
        # Sem internet ou erro — nao conseguiu checar
    }

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  MORANGOS - GERENCIADOR" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Versao instalada: v$localVersion" -ForegroundColor White
    if ($hasUpdate) {
        Write-Host "  Nova versao disponivel: v$remoteVersion" -ForegroundColor Yellow
    } else {
        Write-Host "  Voce esta na ultima versao!" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  [1] Iniciar o app" -ForegroundColor White
    if ($hasUpdate) {
        Write-Host "  [2] Atualizar para v$remoteVersion" -ForegroundColor Yellow
    } else {
        Write-Host "  [2] Reinstalar/reparar" -ForegroundColor DarkGray
    }
    Write-Host "  [3] Desinstalar" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Escolha uma opcao (1/2/3)"

    switch ($choice) {
        "2" {
            # ATUALIZAR
            if (-not $hasUpdate) {
                Write-Host ""
                $confirmReinstall = Read-Host "Nao ha atualizacao. Deseja reinstalar mesmo assim? (S/N)"
                if ($confirmReinstall -ne "S" -and $confirmReinstall -ne "s") {
                    Write-Host "Operacao cancelada." -ForegroundColor Green
                    # Continua para INICIAR APP
                    break
                }
            }
            Write-Host ""
            if ($hasUpdate) {
                Write-Host "Atualizando de v$localVersion para v$remoteVersion..." -ForegroundColor Yellow
            } else {
                Write-Host "Reinstalando o aplicativo..." -ForegroundColor Yellow
            }
            Set-Location $morangosDir

            # Criar pasta de backups
            $backupDir = Join-Path $morangosDir "backups"
            if (-not (Test-Path $backupDir)) {
                New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
            }

            # Backup com timestamp
            $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
            $dbPath = Join-Path $morangosDir "prisma\dev.db"
            $envPath = Join-Path $morangosDir ".env"
            $dbBackupPath = Join-Path $backupDir "dev_$timestamp.db"
            $envBackupPath = Join-Path $backupDir "env_$timestamp.bak"

            try {
                # Salvar backup do banco
                if (Test-Path $dbPath) {
                    Copy-Item $dbPath $dbBackupPath -Force
                    Write-Host "Backup do banco: backups\dev_$timestamp.db" -ForegroundColor Green
                }

                # Salvar backup do .env
                $envBackup = $null
                if (Test-Path $envPath) {
                    $envBackup = Get-Content $envPath -Raw
                    Set-Content -Path $envBackupPath -Value $envBackup -NoNewline
                    Write-Host "Backup do .env: backups\env_$timestamp.bak" -ForegroundColor Green
                }

                # Limpar backups antigos (manter apenas os 5 mais recentes)
                Get-ChildItem $backupDir -Filter "dev_*.db" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force -ErrorAction SilentlyContinue
                Get-ChildItem $backupDir -Filter "env_*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force -ErrorAction SilentlyContinue

                Write-Host ""
                Write-Host "Baixando atualizacao..." -ForegroundColor Yellow
                $env:GIT_REDIRECT_STDERR = '2>&1'
                $prevEP = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
                & git fetch origin 2>&1 | Out-Null
                & git reset --hard origin/main 2>&1 | Out-Null
                $gitExit = $LASTEXITCODE
                $ErrorActionPreference = $prevEP; $env:GIT_REDIRECT_STDERR = $null
                if ($gitExit -ne 0) { throw "git pull failed" }
                Write-Host "Codigo atualizado!" -ForegroundColor Green

                # Restaurar .env
                if ($envBackup) {
                    Set-Content -Path $envPath -Value $envBackup -NoNewline
                    Write-Host "Arquivo .env restaurado!" -ForegroundColor Green
                }

                # Restaurar banco de dados
                if (Test-Path $dbBackupPath) {
                    Copy-Item $dbBackupPath $dbPath -Force
                    Write-Host "Banco de dados restaurado!" -ForegroundColor Green
                }

                Write-Host ""
                Write-Host "Instalando dependencias..." -ForegroundColor Yellow
                & npm.cmd install 2>&1 | Out-Host
                if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

                Write-Host "Aplicando migracoes do banco..." -ForegroundColor Yellow
                & npx.cmd prisma generate 2>&1 | Out-Host
                & npx.cmd prisma migrate deploy 2>&1 | Out-Host
                if ($LASTEXITCODE -ne 0) {
                    # Migracao falhou — restaurar backup
                    Write-Host "Erro na migracao! Restaurando backup..." -ForegroundColor Red
                    if (Test-Path $dbBackupPath) {
                        Copy-Item $dbBackupPath $dbPath -Force
                        Write-Host "Banco restaurado do backup." -ForegroundColor Yellow
                    }
                    throw "migration failed"
                }

                # Recriar marcador
                New-Item -Path (Join-Path $morangosDir ".installed") -ItemType File -Force | Out-Null

                Write-Host ""
                Write-Host "Atualizacao concluida!" -ForegroundColor Green
                Write-Host "Backup salvo em: backups\dev_$timestamp.db" -ForegroundColor DarkGray
                Write-Host ""
            } catch {
                # Restaurar banco em caso de qualquer erro
                if (Test-Path $dbBackupPath) {
                    Copy-Item $dbBackupPath $dbPath -Force -ErrorAction SilentlyContinue
                }
                if ($envBackup) {
                    Set-Content -Path $envPath -Value $envBackup -NoNewline -ErrorAction SilentlyContinue
                }
                Show-Error "Falha ao atualizar. Seus dados foram restaurados do backup."
            }
            # Continua para INICIAR APP
        }
        "3" {
            # DESINSTALAR
            Write-Host ""
            Write-Host "================================================" -ForegroundColor Red
            Write-Host "  DESINSTALAR MORANGOS" -ForegroundColor Red
            Write-Host "================================================" -ForegroundColor Red
            Write-Host ""
            Write-Host "ATENCAO: Isso vai remover:" -ForegroundColor Yellow
            Write-Host "  - Todos os dados (pedidos, clientes, etc.)" -ForegroundColor DarkGray
            Write-Host "  - O aplicativo inteiro" -ForegroundColor DarkGray
            Write-Host "  - O atalho da area de trabalho" -ForegroundColor DarkGray
            Write-Host ""
            $confirm = Read-Host "Digite DESINSTALAR para confirmar"
            if ($confirm -ne "DESINSTALAR") {
                Write-Host "Desinstalacao cancelada." -ForegroundColor Green
                Read-Host "Pressione Enter para continuar"
                exit 0
            }

            Write-Host ""
            Write-Host "Removendo atalho da area de trabalho..." -ForegroundColor Yellow
            $desktopPath = [Environment]::GetFolderPath("Desktop")
            $shortcutPath = Join-Path $desktopPath "Morangos.lnk"
            if (Test-Path $shortcutPath) {
                Remove-Item $shortcutPath -Force
                Write-Host "Atalho removido!" -ForegroundColor Green
            }

            Write-Host "Parando processos do app..." -ForegroundColor Yellow
            Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
                $_.Path -like "*morangos*"
            } | Stop-Process -Force -ErrorAction SilentlyContinue

            Write-Host "Removendo pasta do aplicativo..." -ForegroundColor Yellow
            Set-Location $installDir
            Remove-Item $morangosDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host ""
            Write-Host "================================================" -ForegroundColor Green
            Write-Host "  DESINSTALACAO CONCLUIDA!" -ForegroundColor Green
            Write-Host "================================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "O Node.js e Git nao foram removidos." -ForegroundColor DarkGray
            Write-Host "Se quiser remove-los, use o Painel de Controle." -ForegroundColor DarkGray
            Write-Host ""
            Read-Host "Pressione Enter para continuar"
            exit 0
        }
        default {
            # INICIAR (opcao 1 ou qualquer outra)
            # Continua para INICIAR APP
        }
    }
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
    Write-Host "Instalando em: $morangosDir" -ForegroundColor DarkGray
    if (Test-Path $morangosDir) {
        Remove-Item $morangosDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Set-Location $installDir
    # Git escreve progresso no stderr, que o PowerShell trata como erro
    # quando $ErrorActionPreference = "Stop". Solucao: redirecionar stderr do git.
    $env:GIT_REDIRECT_STDERR = '2>&1'
    $prevErrorPref = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $cloneOutput = & git clone "https://github.com/gtorige/morangos.git" "$morangosDir" 2>&1 | Out-String
    $cloneExit = $LASTEXITCODE
    $ErrorActionPreference = $prevErrorPref
    $env:GIT_REDIRECT_STDERR = $null
    if ($cloneExit -ne 0 -or -not (Test-Path (Join-Path $morangosDir "package.json"))) {
        Write-Host ""
        Write-Host "Saida do git:" -ForegroundColor Red
        Write-Host $cloneOutput -ForegroundColor Red
        Write-Host ""
        Write-Host "Diretorio: $morangosDir" -ForegroundColor Red
        Show-Error "Falha ao baixar o aplicativo (exit code: $cloneExit)."
    }
    Write-Host "Aplicativo baixado!" -ForegroundColor Green

    # ============================================================
    # STEP 5 — INSTALAR DEPENDENCIAS
    # ============================================================
    Set-Location $morangosDir
    Write-Host ""
    Write-Host "Instalando dependencias do projeto..." -ForegroundColor Yellow
    Write-Host "(isso pode demorar alguns minutos)" -ForegroundColor DarkGray
    & npm.cmd install 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Show-Error "Falha ao instalar dependencias do projeto." }
    Write-Host "Dependencias instaladas!" -ForegroundColor Green

    # ============================================================
    # STEP 6 — CONFIGURAR PRISMA
    # ============================================================
    Write-Host ""
    Write-Host "Configurando banco de dados..." -ForegroundColor Yellow
    & npx.cmd prisma generate 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Show-Error "Falha ao gerar cliente Prisma." }
    & npx.cmd prisma migrate deploy 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Show-Error "Falha ao aplicar migracoes do banco de dados." }
    Write-Host "Banco de dados configurado!" -ForegroundColor Green

    # ============================================================
    # STEP 7 — CRIAR ARQUIVO .ENV
    # ============================================================
    Write-Host ""
    Write-Host "Criando arquivo de configuracao..." -ForegroundColor Yellow
    & node.exe -e "const c=require('crypto');const fs=require('fs');fs.writeFileSync('.env','DATABASE_URL=\`"file:./dev.db\`"\nAUTH_SECRET='+c.randomBytes(32).toString('hex')+'\n');" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Show-Error "Falha ao criar arquivo .env." }
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
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -Command", "Set-Location '`$appDir'; npm.cmd run dev" -WindowStyle Minimized
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
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -Command", "Set-Location '$morangosDir'; npm.cmd run dev" -WindowStyle Minimized
Write-Host "Aguardando o app iniciar..." -ForegroundColor DarkGray
Start-Sleep -Seconds 8
Start-Process "http://localhost:3000"
Write-Host ""
Write-Host "App aberto no navegador!" -ForegroundColor Green
Write-Host "Pode fechar esta janela." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Pressione Enter para continuar"
