# =========================================================
# VesteAI — verify-phase1.ps1
# Verifica a Fase 1 de ponta a ponta. Rode com a API no ar
# (npm run api:dev) em outro terminal.
# =========================================================
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

Write-Host "1) Health check..." -ForegroundColor Cyan
$h = Invoke-RestMethod "$base/health"
$h | ConvertTo-Json -Depth 5

Write-Host "`n2) Handshake do webhook (deve retornar 12345)..." -ForegroundColor Cyan
$challenge = Invoke-RestMethod "$base/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=meu-verify-token&hub.challenge=12345"
Write-Host "challenge => $challenge"

Write-Host "`n3) Primeira mensagem de um numero novo (deve enviar boas-vindas)..." -ForegroundColor Cyan
$body = @{ from = '5511988887777'; text = 'oi' } | ConvertTo-Json
Invoke-RestMethod "$base/dev/wa/inbound" -Method Post -ContentType 'application/json' -Body $body | ConvertTo-Json

Write-Host "`n4) Segunda mensagem (deve ecoar)..." -ForegroundColor Cyan
$body2 = @{ from = '5511988887777'; text = 'quero experimentar uma roupa' } | ConvertTo-Json
Invoke-RestMethod "$base/dev/wa/inbound" -Method Post -ContentType 'application/json' -Body $body2 | ConvertTo-Json

Write-Host "`nVeja os logs da API: deve aparecer o envio [SIMULADO] das mensagens de saida." -ForegroundColor Green
