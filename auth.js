const jwt = require('jsonwebtoken');
const { user } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Auth middleware
async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.session?.token ||
                  req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user data
    const userData = await user.findUserById(decoded.userId);
    if (!userData) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userData;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// Optional auth middleware (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.session?.token ||
                  req.cookies?.token;

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const userData = await user.findUserById(decoded.userId);
        if (userData) {
          req.user = userData;
        }
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth
};