# =========================================================
# VesteAI — dev-up.ps1
# Roda APÓS reiniciar o Windows (WSL2 instalado).
# Sobe a infra (Postgres/Redis/MinIO), aplica a migração,
# faz o seed e deixa a API pronta para subir com:  npm run api:dev
# =========================================================
$ErrorActionPreference = 'Stop'

# Node nem sempre está no PATH desta sessão — garante.
$env:Path = "C:\Program Files\nodejs;" + $env:Path

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> Verificando WSL2..." -ForegroundColor Cyan
wsl --status

Write-Host "==> Subindo Docker (Postgres/Redis/MinIO)..." -ForegroundColor Cyan
# Garante que o Docker Desktop esteja rodando
if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  Write-Host "   Aguardando engine do Docker subir..."
  for ($i = 0; $i -lt 40; $i++) {
    docker info *> $null
    if ($?) { break }
    Start-Sleep -Seconds 3
  }
}

docker compose up -d

Write-Host "==> Aplicando migração do Prisma..." -ForegroundColor Cyan
# Se for a primeira migração, cria-a; senão aplica as existentes.
if (Test-Path "$root\apps\api\prisma\migrations") {
  npm run prisma:migrate --workspace '@vesteai/api'
} else {
  Push-Location "$root\apps\api"
  npx prisma migrate dev --name init
  Pop-Location
}

Write-Host "==> Seed (admin de bootstrap)..." -ForegroundColor Cyan
npm run db:seed --workspace '@vesteai/api'

Write-Host ""
Write-Host "Pronto! Agora rode:  npm run api:dev" -ForegroundColor Green
Write-Host "Verifique:           curl http://localhost:3000/health" -ForegroundColor Green
