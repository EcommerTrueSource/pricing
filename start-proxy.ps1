# Define o encoding para UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Verificando processos existentes do Cloud SQL Proxy..."
Get-Process cloud_sql_proxy -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$proxyUrl = "https://dl.google.com/cloudsql/cloud-sql-proxy_x64.exe"
$proxyPath = ".\cloud_sql_proxy.exe"

Write-Host "Verificando se o Cloud SQL Proxy existe..."
if (-not (Test-Path $proxyPath)) {
    Write-Host "Baixando Cloud SQL Proxy de $proxyUrl"
    try {
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($proxyUrl, $proxyPath)
        Write-Host "Download concluído com sucesso!"
    } catch {
        Write-Host "ERRO ao baixar o Cloud SQL Proxy: $_"
        exit 1
    }
}

Write-Host "Verificando arquivo de credenciais..."
if (-not (Test-Path ".\key.json")) {
    Write-Host "ERRO: Arquivo key.json não encontrado!"
    exit 1
}

Write-Host "Verificando Cloud SQL Proxy..."
if (-not (Test-Path ".\cloud_sql_proxy.exe")) {
    Write-Host "ERRO: cloud_sql_proxy.exe não encontrado!"
    Write-Host "Por favor, baixe o arquivo de: https://dl.google.com/cloudsql/cloud-sql-proxy.x64.exe"
    exit 1
}

Write-Host "Verificando porta 5432..."
$portCheck = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
if ($portCheck.TcpTestSucceeded) {
    Write-Host "ERRO: Porta 5432 já está em uso!"
    exit 1
}

$instanceConnection = "truebrands-warehouse:southamerica-east1:pricing"
Write-Host "Iniciando Cloud SQL Proxy para instância $instanceConnection..."

try {
    # Nova sintaxe do Cloud SQL Proxy v2
    $arguments = "$instanceConnection --credentials-file=.\key.json --address 0.0.0.0 --port 5432"
    Start-Process -FilePath ".\cloud_sql_proxy.exe" -ArgumentList $arguments -NoNewWindow
    Write-Host "Cloud SQL Proxy iniciado com sucesso!"
} catch {
    Write-Host "ERRO ao iniciar Cloud SQL Proxy: $_"
    exit 1
}