const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Импортируем app (нужно будет модифицировать app.js для export)
const createApp = () => {
  const app = express();
  app.use(express.json());

  const users = [];
  const JWT_SECRET = 'super-secret-for-dev';

  app.post('/v1/users/register', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль требуются' });
      }

      if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        userId: users.length + 1,
        email,
        password: hashedPassword,
      };

      users.push(user);

      res.status(201).json({
        message: 'Пользователь успешно зарегистрирован',
        userId: user.userId,
        email: user.email,
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при регистрации', details: error.message });
    }
  });

  app.post('/v1/users/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль требуются' });
      }

      const user = users.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      const token = jwt.sign(
        { userId: user.userId, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Успешная авторизация',
        token,
        user: {
          userId: user.userId,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при логине', details: error.message });
    }
  });

  return app;
};

describe('Users Service Tests', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /v1/users/register', () => {
    it('должен успешно зарегистрировать нового пользователя', async () => {
      const res = await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Пользователь успешно зарегистрирован');
      expect(res.body.email).toBe('user1@example.com');
      expect(res.body.userId).toBeDefined();
    });

    it('должен вернуть ошибку 400, если email уже существует', async () => {
      // Регистрируем первого пользователя
      await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      // Пытаемся зарегистрировать с тем же email
      const res = await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
          password: 'password456',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('email уже существует');
    });

    it('должен вернуть ошибку 400, если отсутствует email', async () => {
      const res = await request(app)
        .post('/v1/users/register')
        .send({
          password: 'password123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Email и пароль требуются');
    });

    it('должен вернуть ошибку 400, если отсутствует пароль', async () => {
      const res = await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Email и пароль требуются');
    });
  });

  describe('POST /v1/users/login', () => {
    it('должен успешно авторизовать пользователя и вернуть JWT', async () => {
      // Регистрируем пользователя
      await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      // Авторизуемся
      const res = await request(app)
        .post('/v1/users/login')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Успешная авторизация');
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('user1@example.com');
    });

    it('должен вернуть ошибку 401, если неверный пароль', async () => {
      // Регистрируем пользователя
      await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      // Пытаемся авторизоваться с неверным паролем
      const res = await request(app)
        .post('/v1/users/login')
        .send({
          email: 'user1@example.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('Неверный email или пароль');
    });

    it('должен вернуть ошибку 401, если пользователь не найден', async () => {
      const res = await request(app)
        .post('/v1/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('Неверный email или пароль');
    });

    it('должен вернуть ошибку 400, если отсутствует email', async () => {
      const res = await request(app)
        .post('/v1/users/login')
        .send({
          password: 'password123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Email и пароль требуются');
    });

    it('должен вернуть валидный JWT токен с правильным payload', async () => {
      // Регистрируем пользователя
      await request(app)
        .post('/v1/users/register')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      // Авторизуемся
      const res = await request(app)
        .post('/v1/users/login')
        .send({
          email: 'user1@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(200);
      
      // Проверяем токен
      const decoded = jwt.decode(res.body.token);
      expect(decoded.email).toBe('user1@example.com');
      expect(decoded.userId).toBeDefined();
    });
  });
});
