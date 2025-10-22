// src/middleware/auth.middleware.js
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client'); // <-- 1. Import Prisma

const prisma = new PrismaClient(); // <-- 2. Instantiate Prisma

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
// == UPDATED AUTHENTICATION MIDDLEWARE
// =================================================================
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  // 1. Use Supabase to verify the token
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

  if (error || !supabaseUser) {
    console.error('JWT validation error:', error);
    return res.status(403).json({ message: 'Forbidden: Token is not valid' });
  }

  try {
    // 2. Use the ID from Supabase to fetch our user profile from Prisma
    let userProfile = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    // 3. (Optional but recommended) Auto-create a profile if one doesn't exist
    // This matches the logic you already have in `getMyProfile`
    if (!userProfile) {
      userProfile = await prisma.user.create({
        data: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          firstName: "New", // Default values
          lastName: "User",
          role: 'CONSULTANT', // Default role
        },
      });
    }

    // 4. Attach the FULL user profile (with the .role) to req.user
    req.user = userProfile;

    next();
  } catch (dbError) {
    console.error("Error fetching user profile in middleware:", dbError);
    return res.status(500).json({ message: "Error authenticating user." });
  }
};


// =================================================================
// == AUTHORIZATION MIDDLEWARE (No changes needed)
// =================================================================
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    // This middleware MUST run *after* the updated authenticateToken
    
    // Now, req.user is our Prisma profile, so req.user.role will exist!
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: User role not available.' });
    }
    
    const { role } = req.user;

    // Convert allowedRoles to an array if it's not one
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (rolesArray.includes(role)) {
      next(); // User has permission
    } else {
      res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
    }
  };
};

module.exports = { authenticateToken, authorizeRole };