const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// =================================================================
// == REGISTER A NEW USER (SIGN UP)
// =================================================================
const register = async (req, res) => {
  // ... your existing registration code (it's perfect)
  const { email, password, firstName, lastName, role, team, title, contactNo } = req.body;

  if (!email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        team,
        title,
        contactNo,
      },
    });

    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.status(201).json({ message: 'User created successfully', user: userWithoutPassword });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};


// =================================================================
// == LOG IN A USER
// =================================================================
const login = async (req, res) => {
  // ... your existing login code (it's perfect)
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const payload = { userId: user.id, role: user.role };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
        team: user.team,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// =================================================================
// == THIS IS THE MISSING PIECE
// =================================================================
module.exports = {
  register,
  login,
};