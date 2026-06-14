# =========================================================
# VesteAI — verify-phase5.ps1
# Verifica o painel admin: login (JWT) + métricas protegidas.
# Pré-requisito: seed rodado (cria AdminUser de bootstrap).
# API no ar (npm run api:dev).
# =========================================================
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$email = 'admin@vesteai.local'
$pass  = 'troque-esta-senha'   # = ADMIN_BOOTSTRAP_PASSWORD do .env

Write-Host "1) Login admin -> recebe accessToken" -ForegroundColor Cyan
$login = Invoke-RestMethod "$base/admin/login" -Method Post -ContentType 'application/json' `
  -Body (@{ email = $email; password = $pass } | ConvertTo-Json)
$token = $login.accessToken
Write-Host "   token: $($token.Substring(0,20))..."

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n2) Overview (métricas)" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/overview" -Headers $headers | ConvertTo-Json -Depth 5

Write-Host "`n3) Usuários recentes" -ForegroundColor Cyan
(Invoke-RestMethod "$base/admin/users" -Headers $headers).items | Format-Table whatsappNumber, language, favoriteStyle

Write-Host "`n4) Conversas recentes" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/conversations" -Headers $headers | Format-Table whatsappNumber, state

Write-Host "`n5) Acesso SEM token deve dar 401" -ForegroundColor Cyan
try { Invoke-RestMethod "$base/admin/overview"; Write-Host "   ERRO: deveria bloquear!" -ForegroundColor Red }
catch { Write-Host "   OK: bloqueado (401)" -ForegroundColor Green }

Write-Host "`nPainel visual: abra http://localhost:3000/admin-ui/ no navegador." -ForegroundColor Green
