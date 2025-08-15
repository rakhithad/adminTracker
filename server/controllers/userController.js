const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const apiResponse = require('../utils/apiResponse'); 


const prisma = new PrismaClient();

const register = async (req, res) => {
  
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


const getMyProfile = async (req, res) => {
    // The userId is attached to the request by our authenticateToken middleware
    const { userId } = req.user;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            // We explicitly select fields to avoid sending the password hash
            select: {
                id: true,
                email: true,
                title: true,
                firstName: true,
                lastName: true,
                contactNo: true,
                role: true,
                team: true,
                // Add profilePictureUrl here in the future
            }
        });

        if (!user) {
            return apiResponse.error(res, 'User not found.', 404);
        }

        return apiResponse.success(res, user);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return apiResponse.error(res, 'Failed to fetch user profile.', 500);
    }
};

// --- UPDATE CURRENT USER'S PROFILE ---
const updateMyProfile = async (req, res) => {
    const { userId } = req.user;
    // We only allow certain fields to be updated
    const { title, firstName, lastName, contactNo } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                title,
                firstName,
                lastName,
                contactNo,
                // We will handle password and profile picture updates separately
            },
            select: { // Return the updated user data, without the password
                id: true, email: true, title: true, firstName: true,
                lastName: true, contactNo: true, role: true, team: true,
            }
        });

        return apiResponse.success(res, updatedUser, 200, "Profile updated successfully.");
    } catch (error) {
        console.error("Error updating user profile:", error);
        return apiResponse.error(res, 'Failed to update profile.', 500);
    }
};


const getAgents = async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        role: {
          in: ['CONSULTANT', 'MANAGEMENT']
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        team: true // <-- ADD THIS LINE
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // We now map the team property as well
    const agentList = agents.map(agent => ({
      id: agent.id,
      fullName: `${agent.firstName} ${agent.lastName}`,
      team: agent.team // <-- ADD THIS LINE
    }));

    res.status(200).json(agentList);

  } catch (error) {
    console.error('Failed to fetch agents:', error);
    res.status(500).json({ message: 'Server error while fetching agents.' });
  }
};


module.exports = {
  register,
  login,
  getMyProfile,
  updateMyProfile,
  getAgents
};