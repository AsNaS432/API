require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8085;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API Gateway работает',
    timestamp: new Date().toISOString()
  });
});

// Прокси для Users Service (порт 3001)
app.use(
  '/v1/users',
  createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[${new Date().toISOString()}] Users Service: ${req.method} ${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[${new Date().toISOString()}] Users Service Response: ${proxyRes.statusCode}`);
    }
  })
);

// Прокси для Orders Service (порт 3002)
app.use(
  '/v1/orders',
  createProxyMiddleware({
    target: 'http://localhost:3002',
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[${new Date().toISOString()}] Orders Service: ${req.method} ${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[${new Date().toISOString()}] Orders Service Response: ${proxyRes.statusCode}`);
    }
  })
);

// Обработка 404 для всех остальных маршрутов
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Маршрут не найден',
    availableRoutes: [
      'GET /health',
      'POST /v1/users/register',
      'POST /v1/users/login',
      'POST /v1/orders',
      'GET /v1/orders',
      'PATCH /v1/orders/:id',
      'PATCH /v1/orders/:id/cancel'
    ]
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Gateway Error:`, err);
  res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка шлюза'
  });
});

app.listen(PORT, () => {
  console.log(`✅ API Gateway запущен на порту ${PORT}`);
  console.log(`📞 Users Service: http://localhost:${PORT}/v1/users`);
  console.log(`📦 Orders Service: http://localhost:${PORT}/v1/orders`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});