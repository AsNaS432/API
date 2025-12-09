const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-for-dev';

/**
 * Middleware для проверки JWT токена
 * Извлекает токен из заголовка Authorization и проверяет его подпись
 * При успехе добавляет user данные в req.user
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Заголовок Authorization не найден' });
    }

    // Извлекаем токен из формата "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Токен не найден' });
    }

    // Проверяем токен
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

/**
 * Middleware для проверки владельца ресурса
 * Проверяет, что userId из токена совпадает с userId ресурса
 */
function checkResourceOwner(resourceUserId, req, res) {
  if (resourceUserId !== req.user.userId) {
    res.status(403).json({ error: 'У вас нет доступа к этому ресурсу' });
    return false;
  }
  return true;
}

module.exports = {
  authMiddleware,
  checkResourceOwner,
};
