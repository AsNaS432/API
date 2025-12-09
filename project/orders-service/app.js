require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Middleware для проверки JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Missing token'
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token format'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-for-dev');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// "База данных" заказов
const orders = [];
let orderIdCounter = 1;

// Создание заказа
app.post('/v1/orders', authMiddleware, (req, res) => {
  try {
    const { product, quantity, price } = req.body;
    
    const newOrder = {
      id: `${orderIdCounter++}`,
      ownerId: req.user.userId,
      product: product || 'Продукт по умолчанию',
      quantity: quantity || 1,
      price: price || 100,
      status: 'created',
      createdAt: new Date().toISOString(),
      cancelledAt: null
    };

    orders.push(newOrder);

    res.status(201).json({
      success: true,
      data: {
        id: newOrder.id,
        ownerId: newOrder.ownerId,
        status: newOrder.status,
        product: newOrder.product
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа'
    });
  }
});

// Получение всех заказов пользователя
app.get('/v1/orders', authMiddleware, (req, res) => {
  try {
    const userOrders = orders.filter(order => order.ownerId === req.user.userId);
    
    res.status(200).json({
      success: true,
      data: userOrders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении заказов'
    });
  }
});

// Изменение заказа
app.patch('/v1/orders/:id', authMiddleware, (req, res) => {
  try {
    const orderId = req.params.id;
    const { product, quantity, price } = req.body;
    
    const order = orders.find(o => o.id === orderId);
    
    // Проверка существования заказа
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
    }
    
    // Проверка владельца
    if (order.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: нельзя изменить чужой заказ'
      });
    }
    
    // Проверка статуса
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Заказ отменён, изменение невозможно'
      });
    }
    
    // Обновление данных
    if (product !== undefined) order.product = product;
    if (quantity !== undefined) order.quantity = quantity;
    if (price !== undefined) order.price = price;
    order.updatedAt = new Date().toISOString();
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении заказа'
    });
  }
});

// Отмена заказа
app.patch('/v1/orders/:id/cancel', authMiddleware, (req, res) => {
  try {
    const orderId = req.params.id;
    
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
    }
    
    if (order.ownerId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: нельзя отменить чужой заказ'
      });
    }
    
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Заказ уже отменён'
      });
    }
    
    // Отмена заказа
    order.status = 'cancelled';
    order.cancelledAt = new Date().toISOString();
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка при отмене заказа'
    });
  }
});

// Получение заказа по ID (для отладки)
app.get('/v1/orders/:id', authMiddleware, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Заказ не найден'
    });
  }
  
  if (order.ownerId !== req.user.userId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden'
    });
  }
  
  res.status(200).json({
    success: true,
    data: order
  });
});

// Получение всех заказов (для отладки - требует авторизации)
app.get('/v1/admin/orders', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: orders
  });
});

app.listen(PORT, () => {
  console.log(`Orders Service запущен на порту ${PORT}`);
});