# PowerShell скрипт для тестирования API

Write-Host "=== Тестирование Microservices API ===" -ForegroundColor Green
Write-Host ""

# Переменные
$USERS_BASE = "http://localhost:3001"
$ORDERS_BASE = "http://localhost:3002"
$GATEWAY_BASE = "http://localhost:3000"

function ConvertTo-Hashtable {
    param($response)
    return $response | ConvertFrom-Json
}

Write-Host "========== USERS SERVICE ==========" -ForegroundColor Blue
Write-Host ""

# 1. Регистрация User 1
Write-Host "1. Регистрация User 1" -ForegroundColor Yellow
$User1Response = Invoke-WebRequest -Uri "$USERS_BASE/v1/users/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (ConvertTo-Json @{"email"="user1@example.com"; "password"="password123"}) `
  -UseBasicParsing

$User1Data = $User1Response.Content | ConvertFrom-Json
$User1Data | ConvertTo-Json
Write-Host ""

# 2. Логин User 1
Write-Host "2. Логин User 1" -ForegroundColor Yellow
$LoginResponse = Invoke-WebRequest -Uri "$USERS_BASE/v1/users/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (ConvertTo-Json @{"email"="user1@example.com"; "password"="password123"}) `
  -UseBasicParsing

$LoginData = $LoginResponse.Content | ConvertFrom-Json
$LoginData | ConvertTo-Json
$User1Token = $LoginData.token
Write-Host "✓ JWT Token User1: $User1Token" -ForegroundColor Green
Write-Host ""

# 3. Регистрация User 2
Write-Host "3. Регистрация User 2" -ForegroundColor Yellow
$User2Response = Invoke-WebRequest -Uri "$USERS_BASE/v1/users/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (ConvertTo-Json @{"email"="user2@example.com"; "password"="password456"}) `
  -UseBasicParsing

$User2Data = $User2Response.Content | ConvertFrom-Json
$User2Data | ConvertTo-Json
Write-Host ""

# 4. Логин User 2
Write-Host "4. Логин User 2" -ForegroundColor Yellow
$Login2Response = Invoke-WebRequest -Uri "$USERS_BASE/v1/users/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (ConvertTo-Json @{"email"="user2@example.com"; "password"="password456"}) `
  -UseBasicParsing

$Login2Data = $Login2Response.Content | ConvertFrom-Json
$Login2Data | ConvertTo-Json
$User2Token = $Login2Data.token
Write-Host "✓ JWT Token User2: $User2Token" -ForegroundColor Green
Write-Host ""

Write-Host "========== ORDERS SERVICE ==========" -ForegroundColor Blue
Write-Host ""

# 5. Создание заказа User 1
Write-Host "5. Создание заказа User 1" -ForegroundColor Yellow
$OrderBody = @{
    "items" = @(@{
        "productId" = 1;
        "productName" = "Laptop";
        "quantity" = 1;
        "price" = 999
    })
    "totalAmount" = 999
} | ConvertTo-Json

$OrderResponse = Invoke-WebRequest -Uri "$ORDERS_BASE/v1/orders" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $User1Token"} `
  -Body $OrderBody `
  -UseBasicParsing

$OrderData = $OrderResponse.Content | ConvertFrom-Json
$OrderData | ConvertTo-Json
$OrderId = $OrderData.order.orderId
Write-Host "✓ Order ID: $OrderId" -ForegroundColor Green
Write-Host ""

# 6. Получение заказов User 1
Write-Host "6. Получение заказов User 1" -ForegroundColor Yellow
$GetOrdersResponse = Invoke-WebRequest -Uri "$ORDERS_BASE/v1/orders" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $User1Token"} `
  -UseBasicParsing

$GetOrdersResponse.Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

# 7. Изменение заказа User 1
Write-Host "7. Изменение заказа User 1" -ForegroundColor Yellow
$UpdateBody = @{"totalAmount" = 1299} | ConvertTo-Json

$UpdateResponse = Invoke-WebRequest -Uri "$ORDERS_BASE/v1/orders/$OrderId" `
  -Method PATCH `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $User1Token"} `
  -Body $UpdateBody `
  -UseBasicParsing

$UpdateResponse.Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

# 8. Попытка User 2 изменить заказ User 1 (403 Forbidden)
Write-Host "8. Попытка User 2 изменить заказ User 1 (ожидается 403)" -ForegroundColor Red
try {
    $ForbiddenResponse = Invoke-WebRequest -Uri "$ORDERS_BASE/v1/orders/$OrderId" `
      -Method PATCH `
      -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $User2Token"} `
      -Body $UpdateBody `
      -UseBasicParsing
} catch {
    $ForbiddenResponse = $_.Exception.Response
    if ($ForbiddenResponse.StatusCode -eq 403) {
        Write-Host "✓ Защита работает! Доступ запрещен" -ForegroundColor Green
        Write-Host ($ForbiddenResponse.Content | ConvertFrom-Json | ConvertTo-Json)
    }
}
Write-Host ""

# 9. Отмена заказа User 1
Write-Host "9. Отмена заказа User 1" -ForegroundColor Yellow
$CancelResponse = Invoke-WebRequest -Uri "$ORDERS_BASE/v1/orders/$OrderId/cancel" `
  -Method PATCH `
  -Headers @{"Authorization"="Bearer $User1Token"} `
  -UseBasicParsing

$CancelResponse.Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

# 10. Проверка статуса заказа после отмены
Write-Host "10. Проверка заказов User 1 после отмены" -ForegroundColor Yellow
$FinalResponse = Invoke-WebRequest -Uri "$ORDERS_BASE/v1/orders" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $User1Token"} `
  -UseBasicParsing

$FinalResponse.Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

Write-Host "========== API GATEWAY ==========" -ForegroundColor Blue
Write-Host ""

# 11. Health check Gateway
Write-Host "11. Health check API Gateway" -ForegroundColor Yellow
$HealthResponse = Invoke-WebRequest -Uri "$GATEWAY_BASE/health" `
  -Method GET `
  -UseBasicParsing

$HealthResponse.Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

# 12. Регистрация через Gateway
Write-Host "12. Регистрация User 3 через Gateway" -ForegroundColor Yellow
$GatewayRegBody = @{"email"="user3@example.com"; "password"="password789"} | ConvertTo-Json

$GatewayRegResponse = Invoke-WebRequest -Uri "$GATEWAY_BASE/v1/users/register" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $GatewayRegBody `
  -UseBasicParsing

$GatewayRegResponse.Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

Write-Host "=== Тестирование завершено ===" -ForegroundColor Green
