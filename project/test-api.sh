#!/bin/bash
# Примеры curl команд для тестирования API

echo "=== Тестирование Microservices API ==="
echo ""

# Переменные
USERS_BASE="http://localhost:3001"
ORDERS_BASE="http://localhost:3002"
GATEWAY_BASE="http://localhost:3000"

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== USERS SERVICE ==========${NC}"
echo ""

# 1. Регистрация User 1
echo -e "${YELLOW}1. Регистрация User 1${NC}"
USER1_RESPONSE=$(curl -s -X POST "$USERS_BASE/v1/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password123"
  }')
echo $USER1_RESPONSE | jq '.'
echo ""

# 2. Логин User 1
echo -e "${YELLOW}2. Логин User 1${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$USERS_BASE/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password123"
  }')
echo $LOGIN_RESPONSE | jq '.'
USER1_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo -e "${GREEN}✓ JWT Token User1: $USER1_TOKEN${NC}"
echo ""

# 3. Регистрация User 2
echo -e "${YELLOW}3. Регистрация User 2${NC}"
USER2_RESPONSE=$(curl -s -X POST "$USERS_BASE/v1/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com",
    "password": "password456"
  }')
echo $USER2_RESPONSE | jq '.'
echo ""

# 4. Логин User 2
echo -e "${YELLOW}4. Логин User 2${NC}"
LOGIN2_RESPONSE=$(curl -s -X POST "$USERS_BASE/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com",
    "password": "password456"
  }')
echo $LOGIN2_RESPONSE | jq '.'
USER2_TOKEN=$(echo $LOGIN2_RESPONSE | jq -r '.token')
echo -e "${GREEN}✓ JWT Token User2: $USER2_TOKEN${NC}"
echo ""

echo -e "${BLUE}========== ORDERS SERVICE ==========${NC}"
echo ""

# 5. Создание заказа User 1
echo -e "${YELLOW}5. Создание заказа User 1${NC}"
ORDER_RESPONSE=$(curl -s -X POST "$ORDERS_BASE/v1/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{
    "items": [
      {
        "productId": 1,
        "productName": "Laptop",
        "quantity": 1,
        "price": 999
      }
    ],
    "totalAmount": 999
  }')
echo $ORDER_RESPONSE | jq '.'
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order.orderId')
echo -e "${GREEN}✓ Order ID: $ORDER_ID${NC}"
echo ""

# 6. Получение заказов User 1
echo -e "${YELLOW}6. Получение заказов User 1${NC}"
curl -s -X GET "$ORDERS_BASE/v1/orders" \
  -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
echo ""

# 7. Изменение заказа User 1
echo -e "${YELLOW}7. Изменение заказа User 1${NC}"
curl -s -X PATCH "$ORDERS_BASE/v1/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{
    "totalAmount": 1299
  }' | jq '.'
echo ""

# 8. Попытка User 2 изменить заказ User 1 (403 Forbidden)
echo -e "${RED}8. Попытка User 2 изменить заказ User 1 (ожидается 403)${NC}"
curl -s -X PATCH "$ORDERS_BASE/v1/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -d '{
    "totalAmount": 500
  }' | jq '.'
echo -e "${GREEN}✓ Защита работает! Доступ запрещен${NC}"
echo ""

# 9. Отмена заказа User 1
echo -e "${YELLOW}9. Отмена заказа User 1${NC}"
curl -s -X PATCH "$ORDERS_BASE/v1/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
echo ""

# 10. Проверка статуса заказа после отмены
echo -e "${YELLOW}10. Проверка заказов User 1 после отмены${NC}"
curl -s -X GET "$ORDERS_BASE/v1/orders" \
  -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
echo ""

echo -e "${BLUE}========== API GATEWAY ==========${NC}"
echo ""

# 11. Health check Gateway
echo -e "${YELLOW}11. Health check API Gateway${NC}"
curl -s -X GET "$GATEWAY_BASE/health" | jq '.'
echo ""

# 12. Регистрация через Gateway
echo -e "${YELLOW}12. Регистрация User 3 через Gateway${NC}"
curl -s -X POST "$GATEWAY_BASE/v1/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user3@example.com",
    "password": "password789"
  }' | jq '.'
echo ""

echo -e "${GREEN}=== Тестирование завершено ===${NC}"
