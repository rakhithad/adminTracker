const { PrismaClient } = require('@prisma/client');
const apiResponse = require('../utils/apiResponse'); 
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const createUser = async (req, res) => {
  const { email, password, firstName, lastName, title, role, team, contactNo } = req.body;

  // Basic validation
  if (!email || !password || !firstName || !lastName || !role) {
    return apiResponse.error(res, 'Missing required fields (email, password, firstName, lastName, role).', 400);
  }

  try {
    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm the email since an admin is creating it
    });

    if (authError) {
      // Handle Supabase specific errors, e.g., user already exists
      return apiResponse.error(res, authError.message, 409);
    }
    
    const newUserId = authData.user.id;

    // 2. Create the user profile in your public.users table with all details
    const newUserProfile = await prisma.user.create({
      data: {
        id: newUserId,
        email,
        firstName,
        lastName,
        title,
        role,
        team: team || null, // Handle optional team
        contactNo,
      },
    });

    return apiResponse.success(res, newUserProfile, 201, "User created successfully.");

  } catch (error) {
    console.error("Error creating user:", error);
    // This is a generic fallback error
    return apiResponse.error(res, 'An unexpected error occurred while creating the user.', 500);
  }
};


const getMyProfile = async (req, res) => {
  const supabaseUser = req.user; 

  try {
    let userProfile = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (!userProfile) {
      userProfile = await prisma.user.create({
        data: {
          id: supabaseUser.id, 
          email: supabaseUser.email,
          firstName: "New",
          lastName: "User",
          role: 'CONSULTANT',
        },
      });
    }

    req.user = { ...supabaseUser, ...userProfile };

    res.status(200).json(userProfile);
  } catch (error) {
    console.error("Error in getMyProfile:", error);
    res.status(500).json({ message: "Error fetching or creating user profile." });
  }
};


const updateMyProfile = async (req, res) => {
    const userId = req.user.id;
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


const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { // Explicitly select fields to NEVER expose the password hash
                id: true,
                email: true,
                title: true,
                firstName: true,
                lastName: true,
                contactNo: true,
                role: true,
                team: true,
            },
            orderBy: {
                firstName: 'asc'
            }
        });
        // Use your apiResponse utility for consistency
        return apiResponse.success(res, users);
    } catch (error) {
        console.error("Error fetching all users:", error);
        return apiResponse.error(res, 'Failed to fetch users.', 500);
    }
};

const updateUserById = async (req, res) => {
    const userIdToUpdate = req.params.id; 
    if (!userIdToUpdate) {
        return apiResponse.error(res, 'User ID is required.', 400);
    }

    const { title, firstName, lastName, contactNo, role, team } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userIdToUpdate }, // This now works correctly with a string ID
            data: {
                title,
                firstName,
                lastName,
                contactNo,
                role,
                team,
            },
            select: {
                id: true, email: true, title: true, firstName: true,
                lastName: true, contactNo: true, role: true, team: true,
            }
        });

        return apiResponse.success(res, updatedUser, 200, "User profile updated successfully.");
    } catch (error) {
        console.error(`Error updating user ${userIdToUpdate}:`, error);
        // Check if the error is because the user wasn't found
        if (error.code === 'P2025') {
            return apiResponse.error(res, 'User not found.', 404);
        }
        return apiResponse.error(res, 'Failed to update user profile.', 500);
    }
};




module.exports = {
  createUser,
  getMyProfile,
  updateMyProfile,
  getAgents,
  getAllUsers,
  updateUserById,
};