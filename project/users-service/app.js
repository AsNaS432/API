require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Простая "база данных" в памяти
const users = [];
let userIdCounter = 1;

// Регистрация пользователя
app.post('/v1/users/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверка существования пользователя
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь уже существует'
      });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const newUser = {
      id: `user-${userIdCounter++}`,
      email,
      password: hashedPassword
    };

    users.push(newUser);

    res.status(201).json({
      success: true,
      message: 'Пользователь зарегистрирован',
      data: {
        userId: newUser.id,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Логин пользователя
app.post('/v1/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Поиск пользователя
    const user = users.find(user => user.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    // Генерация JWT токена
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET || 'super-secret-for-dev',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Успешная авторизация',
      data: {
        token,
        userId: user.id,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Получение всех пользователей (для отладки)
app.get('/v1/users', (req, res) => {
  res.json({
    success: true,
    data: users.map(user => ({
      id: user.id,
      email: user.email
    }))
  });
});

app.listen(PORT, () => {
  console.log(`Users Service запущен на порту ${PORT}`);
});