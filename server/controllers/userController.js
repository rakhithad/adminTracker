const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

// Create user (admin only)
const createUser = async (req, res) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        title: req.body.title,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        contactNo: req.body.contactNo,
        role: req.body.role || 'ADMIN'
      }
    });
    apiResponse.success(res, user, 201);
  } catch (error) {
    apiResponse.error(res, "Failed to create user: " + error.message);
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    apiResponse.success(res, users);
  } catch (error) {
    apiResponse.error(res, "Failed to fetch users");
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!user) return apiResponse.error(res, "User not found", 404);
    apiResponse.success(res, user);
  } catch (error) {
    apiResponse.error(res, "Failed to fetch user");
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    apiResponse.success(res, updatedUser);
  } catch (error) {
    apiResponse.error(res, "Failed to update user");
  }
};

// Delete user (soft delete)
const deleteUser = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false } // Soft delete pattern
    });
    apiResponse.success(res, { message: "User deactivated" });
  } catch (error) {
    apiResponse.error(res, "Failed to deactivate user");
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
};