# =========================================================
# VesteAI — verify-phase4.ps1
# Verifica o provador virtual (modo simulado/fila em memória) e o
# guarda-roupa. Pré-requisito: número com assinatura ativa + onboarding
# (rode verify-phase2.ps1 antes). API no ar (npm run api:dev).
# =========================================================
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$num  = '5511955554444'

function Send-Text($text) {
  $b = @{ from = $num; text = $text } | ConvertTo-Json
  Invoke-RestMethod "$base/dev/wa/inbound" -Method Post -ContentType 'application/json' -Body $b | Out-Null
  Start-Sleep -Milliseconds 250
}
function Send-Image($mediaId) {
  $b = @{ from = $num; type = 'IMAGE'; mediaId = $mediaId } | ConvertTo-Json
  Invoke-RestMethod "$base/dev/wa/inbound" -Method Post -ContentType 'application/json' -Body $b | Out-Null
  Start-Sleep -Milliseconds 250
}

Write-Host "1) Pedir provador -> bot pede foto do corpo" -ForegroundColor Cyan
Send-Text 'quero experimentar uma roupa'

Write-Host "2) Enviar foto do corpo -> bot pede a roupa" -ForegroundColor Cyan
Send-Image 'body-media-id'

Write-Host "3) Enviar a roupa -> enfileira, processa (simulado) e ENVIA a imagem" -ForegroundColor Cyan
Send-Image 'garment-media-id'
Start-Sleep -Seconds 1
Write-Host "   -> veja nos logs: [SIMULADO] envio de imagem + 'experimentar outra peca?'"

Write-Host "4) Recusar nova peca -> volta para IDLE" -ForegroundColor Cyan
Send-Text 'nao'

Write-Host "`n5) Guarda-roupa: cadastrar pecas" -ForegroundColor Cyan
Send-Text 'quero cadastrar minhas roupas'
Send-Image 'camisa-id'
Send-Image 'calca-id'
Send-Text 'pronto'

Write-Host "6) Montar look com o guarda-roupa" -ForegroundColor Cyan
Send-Text 'monte um look com minhas roupas'

Write-Host "`nConfira o banco: Photo(BODY/GARMENT/RESULT), TryOnJob=DONE, History, WardrobeItem." -ForegroundColor Green
Write-Host "Com STORAGE_DRIVER=local as imagens ficam em ./.storage e em GET /files/:key" -ForegroundColor Green
