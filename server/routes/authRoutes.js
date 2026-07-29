/**
 * routes/authRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const { register, login, getProfile, updateProfile, updatePassword } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { registerValidator, loginValidator, updatePasswordValidator } = require('../validators/authValidator');
const validateRequest = require('../utils/validateRequest');

router.post('/register', registerValidator, validateRequest, register);
router.post('/login', loginValidator, validateRequest, login);

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePasswordValidator, validateRequest, updatePassword);

module.exports = router;
