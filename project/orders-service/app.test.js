const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'super-secret-for-dev';

const createApp = () => {
  const app = express();
  app.use(express.json());

  const orders = [];

  // Middleware для проверки JWT
  function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ error: 'Заголовок Authorization не найден' });
      }

      const token = authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Токен не найден' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Токен истек' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(403).json({ error: 'Неверный токен' });
      }
      res.status(403).json({ error: 'Ошибка при проверке токена' });
    }
  }

  function checkResourceOwner(resourceUserId, req, res) {
    if (resourceUserId !== req.user.userId) {
      res.status(403).json({ error: 'У вас нет доступа к этому ресурсу' });
      return false;
    }
    return true;
  }

  // POST /v1/orders - создание заказа
  app.post('/v1/orders', authMiddleware, (req, res) => {
    try {
      const { items, totalAmount } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Поле items должно содержать массив товаров' });
      }

      if (totalAmount === undefined || totalAmount <= 0) {
        return res.status(400).json({ error: 'Поле totalAmount должно быть положительным числом' });
      }

      const order = {
        orderId: orders.length + 1,
        userId: req.user.userId,
        items,
        totalAmount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.push(order);

      res.status(201).json({
        message: 'Заказ успешно создан',
        order,
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при создании заказа', details: error.message });
    }
  });

  // GET /v1/orders - получение своих заказов
  app.get('/v1/orders', authMiddleware, (req, res) => {
    try {
      const userOrders = orders.filter(order => order.userId === req.user.userId);

      res.json({
        message: 'Заказы пользователя',
        count: userOrders.length,
        orders: userOrders,
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при получении заказов', details: error.message });
    }
  });

  // PATCH /v1/orders/:id - изменение заказа
  app.patch('/v1/orders/:id', authMiddleware, (req, res) => {
    try {
      const { id } = req.params;
      const { items, totalAmount } = req.body;

      const order = orders.find(o => o.orderId === parseInt(id));

      if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      if (!checkResourceOwner(order.userId, req, res)) {
        return;
      }

      if (order.status === 'cancelled') {
        return res.status(400).json({ error: 'Невозможно изменить отмененный заказ' });
      }

      if (items && Array.isArray(items)) {
        order.items = items;
      }

      if (totalAmount !== undefined && totalAmount > 0) {
        order.totalAmount = totalAmount;
      }

      order.updatedAt = new Date().toISOString();

      res.json({
        message: 'Заказ успешно обновлен',
        order,
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при обновлении заказа', details: error.message });
    }
  });

  // PATCH /v1/orders/:id/cancel - отмена заказа
  app.patch('/v1/orders/:id/cancel', authMiddleware, (req, res) => {
    try {
      const { id } = req.params;

      const order = orders.find(o => o.orderId === parseInt(id));

      if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      if (!checkResourceOwner(order.userId, req, res)) {
        return;
      }

      if (order.status === 'cancelled') {
        return res.status(400).json({ error: 'Заказ уже отменен' });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Можно отменить только заказы со статусом pending' });
      }

      order.status = 'cancelled';
      order.cancelledAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();

      res.json({
        message: 'Заказ успешно отменен',
        order,
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при отмене заказа', details: error.message });
    }
  });

  return app;
};

// Helper функция для создания JWT токена
function createToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

describe('Orders Service Tests', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /v1/orders - создание заказа', () => {
    it('должен успешно создать заказ', async () => {
      const token = createToken(1, 'user1@example.com');

      const res = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Заказ успешно создан');
      expect(res.body.order.status).toBe('pending');
      expect(res.body.order.userId).toBe(1);
    });

    it('должен вернуть ошибку 401, если нет токена', async () => {
      const res = await request(app)
        .post('/v1/orders')
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      expect(res.statusCode).toBe(401);
    });

    it('должен вернуть ошибку 400, если items пусто', async () => {
      const token = createToken(1, 'user1@example.com');

      const res = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [],
          totalAmount: 100,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('items');
    });

    it('должен вернуть ошибку 400, если totalAmount <= 0', async () => {
      const token = createToken(1, 'user1@example.com');

      const res = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 0,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('totalAmount');
    });
  });

  describe('GET /v1/orders - получение заказов', () => {
    it('должен вернуть заказы текущего пользователя', async () => {
      const token = createToken(1, 'user1@example.com');

      // Создаем заказ
      await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      // Получаем заказы
      const res = await request(app)
        .get('/v1/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.orders[0].userId).toBe(1);
    });

    it('должен вернуть ошибку 401, если нет токена', async () => {
      const res = await request(app)
        .get('/v1/orders');

      expect(res.statusCode).toBe(401);
    });

    it('разные пользователи должны видеть только свои заказы', async () => {
      const token1 = createToken(1, 'user1@example.com');
      const token2 = createToken(2, 'user2@example.com');

      // User 1 создает заказ
      await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      // User 2 получает свои заказы (должны быть пусты)
      const res = await request(app)
        .get('/v1/orders')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  describe('PATCH /v1/orders/:id - изменение заказа', () => {
    it('должен успешно изменить заказ текущего пользователя', async () => {
      const token = createToken(1, 'user1@example.com');

      // Создаем заказ
      const createRes = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      const orderId = createRes.body.order.orderId;

      // Изменяем заказ
      const res = await request(app)
        .patch(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          totalAmount: 150,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.order.totalAmount).toBe(150);
    });

    it('должен вернуть ошибку 403, если пользователь не является владельцем', async () => {
      const token1 = createToken(1, 'user1@example.com');
      const token2 = createToken(2, 'user2@example.com');

      // User 1 создает заказ
      const createRes = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      const orderId = createRes.body.order.orderId;

      // User 2 пытается изменить заказ User 1
      const res = await request(app)
        .patch(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({
          totalAmount: 150,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('не имеете доступа' || 'access');
    });

    it('должен вернуть ошибку 404, если заказ не найден', async () => {
      const token = createToken(1, 'user1@example.com');

      const res = await request(app)
        .patch('/v1/orders/999')
        .set('Authorization', `Bearer ${token}`)
        .send({
          totalAmount: 150,
        });

      expect(res.statusCode).toBe(404);
    });

    it('должен вернуть ошибку 400, если заказ отменен', async () => {
      const token = createToken(1, 'user1@example.com');

      // Создаем заказ
      const createRes = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      const orderId = createRes.body.order.orderId;

      // Отменяем заказ
      await request(app)
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      // Пытаемся изменить отмененный заказ
      const res = await request(app)
        .patch(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          totalAmount: 150,
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /v1/orders/:id/cancel - отмена заказа', () => {
    it('должен успешно отменить заказ', async () => {
      const token = createToken(1, 'user1@example.com');

      // Создаем заказ
      const createRes = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      const orderId = createRes.body.order.orderId;

      // Отменяем заказ
      const res = await request(app)
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.order.status).toBe('cancelled');
      expect(res.body.order.cancelledAt).toBeDefined();
    });

    it('должен вернуть ошибку 403, если заказ не принадлежит пользователю', async () => {
      const token1 = createToken(1, 'user1@example.com');
      const token2 = createToken(2, 'user2@example.com');

      // User 1 создает заказ
      const createRes = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      const orderId = createRes.body.order.orderId;

      // User 2 пытается отменить заказ User 1
      const res = await request(app)
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.statusCode).toBe(403);
    });

    it('должен вернуть ошибку 404, если заказ не найден', async () => {
      const token = createToken(1, 'user1@example.com');

      const res = await request(app)
        .patch('/v1/orders/999/cancel')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });

    it('должен вернуть ошибку 400, если заказ уже отменен', async () => {
      const token = createToken(1, 'user1@example.com');

      // Создаем заказ
      const createRes = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
          totalAmount: 100,
        });

      const orderId = createRes.body.order.orderId;

      // Отменяем заказ
      await request(app)
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      // Пытаемся отменить уже отмененный заказ
      const res = await request(app)
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('уже отменен');
    });
  });

  describe('Защита от несанкционированного доступа', () => {
    it('должен вернуть ошибку 401, если токен истек', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'user1@example.com' },
        JWT_SECRET,
        { expiresIn: '0s' }
      );

      // Даем время на истечение
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await request(app)
        .get('/v1/orders')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('должен вернуть ошибку 403, если токен подделан', async () => {
      const res = await request(app)
        .get('/v1/orders')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.statusCode).toBe(403);
    });
  });
});
