// src/middleware/auth.middleware.js

import jwt from 'jsonwebtoken';

// =================================================================
// == 1. AUTHENTICATION MIDDLEWARE (Are you logged in?)
// =================================================================
// This middleware checks for a valid JWT.
export const authenticateToken = (req, res, next) => {
  // Get the token from the Authorization header
  // The header format is "Bearer TOKEN"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If there's no token, the user is not authenticated
  if (token == null) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  // Verify the token
  jwt.verify(token, import.meta.env.JWT_SECRET, (err, user) => {
    // If the token is invalid (expired, wrong secret, etc.)
    if (err) {
      return res.status(403).json({ message: 'Forbidden: Token is not valid' });
    }

    // If the token is valid, attach the user payload to the request object
    // The payload contains { userId, role } from when you created the token
    req.user = user;

    // Move on to the next middleware or the final controller
    next();
  });
};

// =================================================================
// == 2. AUTHORIZATION MIDDLEWARE (Do you have the right role?)
// =================================================================
// This is a "middleware generator". You call it with the roles you want to allow.
// It then returns an actual middleware function.
export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    // This middleware MUST run *after* authenticateToken, so req.user will exist.
    if (!req.user || !req.user.role) {
        return res.status(403).json({ message: 'Forbidden: User role not available.' });
    }
    
    const { role } = req.user;

    // Check if the user's role is in the array of allowed roles
    if (allowedRoles.includes(role)) {
      // If they have permission, move on
      next();
    } else {
      // If not, they are forbidden from accessing this resource
      res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    }
  };
};