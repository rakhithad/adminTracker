// src/middleware/auth.middleware.js

const { createClient } = require('@supabase/supabase-js');

// Initialize the Supabase admin client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// =================================================================
// == NEW AUTHENTICATION MIDDLEWARE (Supabase)
// =================================================================
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  // Use Supabase to verify the token
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('JWT validation error:', error);
    return res.status(403).json({ message: 'Forbidden: Token is not valid' });
  }

  // Attach the Supabase user object to the request
  // This object contains the user's ID (UUID), email, etc.
  req.user = user;

  next();
};


const authorizeRole = (allowedRoles) => {
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

module.exports = {authenticateToken, authorizeRole};