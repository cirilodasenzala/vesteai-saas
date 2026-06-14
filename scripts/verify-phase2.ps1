# =========================================================
# VesteAI — verify-phase2.ps1
# Verifica o fluxo da Fase 2: boas-vindas -> link de pagamento ->
# pagamento simulado -> onboarding -> IDLE (stylist).
# Rode com a API no ar (npm run api:dev) em outro terminal.
# =========================================================
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$num  = '5511955554444'

function Send-Msg($text) {
  $body = @{ from = $num; text = $text } | ConvertTo-Json
  Invoke-RestMethod "$base/dev/wa/inbound" -Method Post -ContentType 'application/json' -Body $body | Out-Null
}

Write-Host "1) Primeira mensagem -> deve responder boas-vindas + LINK de pagamento" -ForegroundColor Cyan
Send-Msg 'oi'
Write-Host "   (veja nos logs da API a msg [SIMULADO] com http://localhost:3000/dev/pay/...)"

Write-Host "`n2) Confirmando pagamento simulado (decodifica o token do numero)..." -ForegroundColor Cyan
$token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($num)).TrimEnd('=').Replace('+','-').Replace('/','_')
Invoke-RestMethod "$base/dev/pay/$token" | Out-Null
Write-Host "   Pagamento confirmado -> onboarding deve iniciar (1a pergunta: nome)"

Write-Host "`n3) Respondendo o onboarding..." -ForegroundColor Cyan
Send-Msg 'David'          # nome
Send-Msg '28'             # idade
Send-Msg 'masculino'      # sexo
Send-Msg 'azul marinho'   # cor
Send-Msg 'Old Money'      # estilo
Send-Msg 'pular'          # altura
Send-Msg 'pular'          # peso
Write-Host "   Onboarding concluido -> estado IDLE"

Write-Host "`n4) Mensagem no IDLE -> stylist responde (mock)" -ForegroundColor Cyan
Send-Msg 'me da uma dica de look pra hoje'

Write-Host "`nPronto. Confira os logs [SIMULADO] e o banco (prisma studio):" -ForegroundColor Green
Write-Host "  - User criado, Subscription ACTIVE, Memory preenchida, Conversation.state=IDLE"
