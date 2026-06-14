# =========================================================
# VesteAI — verify-phase3.ps1
# Verifica o stylist no IDLE: evento (slot-filling) e consultoria.
# Pré-requisito: número já com assinatura ativa e onboarding feito
# (rode verify-phase2.ps1 antes, ou use o mesmo número).
# Rode com a API no ar (npm run api:dev).
# =========================================================
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$num  = '5511955554444'   # mesmo número do verify-phase2

function Send-Msg($text) {
  $body = @{ from = $num; text = $text } | ConvertTo-Json
  Invoke-RestMethod "$base/dev/wa/inbound" -Method Post -ContentType 'application/json' -Body $body | Out-Null
  Start-Sleep -Milliseconds 200
}

Write-Host "1) Evento com detalhes (casamento) -> deve perguntar horario/local/clima" -ForegroundColor Cyan
Send-Msg 'tenho um casamento sabado'
Send-Msg 'a noite'         # horário
Send-Msg 'salao fechado'   # local
Send-Msg 'ameno'           # clima
Write-Host "   -> deve entregar um look com justificativa e persistir Event/Look/History"

Write-Host "`n2) Evento direto (academia) -> look imediato" -ForegroundColor Cyan
Send-Msg 'vou para academia agora'

Write-Host "`n3) Consultoria -> stylist responde justificando" -ForegroundColor Cyan
Send-Msg 'essa camisa azul combina comigo?'

Write-Host "`n4) Conversa livre -> resposta persona" -ForegroundColor Cyan
Send-Msg 'me conta uma tendencia de moda pra esse mes'

Write-Host "`nConfira os logs [SIMULADO] e no banco: Event, Look (com items) e History criados." -ForegroundColor Green
