const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateEnv } = require('../config/env');
const { DEMO_ACCOUNTS } = require('../domain/constants');
const { serializeUserProfile } = require('../serializers/toDto');
const { findUserByCredentials } = require('../data/store');

const router = express.Router();
const env = validateEnv();

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { id, password, username } = req.body;
    const loginId = (id || username || '').trim();

    if (!loginId || !password) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid Login ID or Password.'
        }
      });
    }

    const userRecord = await findUserByCredentials(loginId);
    if (!userRecord) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid Login ID or Password.'
        }
      });
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid Login ID or Password.'
        }
      });
    }

    const userProfile = serializeUserProfile(userRecord);

    const tokenPayload = {
      userId: userRecord.user_id,
      id: userProfile.id,
      name: userProfile.name,
      role: userProfile.role,
      department: userProfile.department || null,
      company: userProfile.company || null,
      customerId: userProfile.customerId || null,
      email: userProfile.email
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: userProfile
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/demo-accounts
router.get('/demo-accounts', (req, res) => {
  if (env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Demo accounts are disabled in production'
      }
    });
  }

  res.json(DEMO_ACCOUNTS);
});

// POST /api/v1/auth/register (Customer self-registration)
router.post('/register', async (req, res, next) => {
  try {
    const { name, company, email, phone, password, confirm } = req.body;

    if (!name || !company || !email || !password || !confirm) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'All registration fields are required.' }
      });
    }

    if (password !== confirm) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Passwords do not match.' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { memoryStore } = require('../data/store');

    const emailInDemos = DEMO_ACCOUNTS.some(a => a.email.toLowerCase() === cleanEmail || a.id.toLowerCase() === cleanEmail);
    const emailInRegistered = memoryStore.registeredUsers.some(u => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail);

    if (emailInDemos || emailInRegistered) {
      return res.status(400).json({
        error: { code: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' }
      });
    }

    const { formatDate } = require('../serializers/date');
    const newCustId = memoryStore.customers.reduce((max, c) => Number(c.id) > max ? Number(c.id) : max, 0) + 1;
    const newCust = {
      id: newCustId,
      name: name.trim(),
      company: company.trim(),
      email: cleanEmail,
      phone: (phone || '').trim(),
      status: 'Active',
      date: formatDate(new Date())
    };
    memoryStore.customers.push(newCust);

    const newUser = {
      user_id: 100 + newCustId,
      username: cleanEmail,
      email: cleanEmail,
      password_hash: bcrypt.hashSync(password, 10),
      role: 'Customer',
      name: name.trim(),
      company: company.trim(),
      customerId: newCustId,
      phone: (phone || '').trim()
    };
    memoryStore.registeredUsers.push(newUser);

    res.status(201).json({
      message: 'Registration successful. You can now sign in.',
      customerId: newCustId,
      email: cleanEmail
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/auth/me (Profile update)
const { authenticate } = require('../middleware/auth');
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { name, phone, company, password } = req.body;
    const { memoryStore } = require('../data/store');

    // Immutable email: ignore any email changes
    const updatedUser = {
      id: req.user.id,
      name: name ? name.trim() : req.user.name,
      role: req.user.role,
      department: req.user.department,
      company: req.user.role === 'Customer' && company ? company.trim() : req.user.company,
      customerId: req.user.customerId,
      email: req.user.email, // email is immutable
      phone: phone ? phone.trim() : req.user.phone
    };

    // Update in memoryStore if registered
    const reg = memoryStore.registeredUsers.find(u => u.email === req.user.email || u.username === req.user.id);
    if (reg) {
      reg.name = updatedUser.name;
      reg.phone = updatedUser.phone;
      if (updatedUser.company) reg.company = updatedUser.company;
      if (password) reg.password_hash = bcrypt.hashSync(password, 10);
    }

    res.json({
      message: 'Profile updated successfully',
      user: serializeUserProfile(updatedUser)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
