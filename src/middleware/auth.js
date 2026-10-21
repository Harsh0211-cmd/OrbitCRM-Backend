const jwt = require('jsonwebtoken');
const { validateEnv } = require('../config/env');

const env = validateEnv();

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      }
    });
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token'
      }
    });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden: Insufficient privileges'
        }
      });
    }

    next();
  };
}

function authorizeResource(resourceName) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }
    if (user.role === 'Admin') return next();

    if (resourceName === 'leads') {
      if (user.role === 'Employee' && user.department === 'Sales') return next();
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges for leads' }
      });
    }

    if (resourceName === 'projects') {
      if (user.role === 'Customer') return next();
      if (user.role === 'Employee' && user.department === 'Development') return next();
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges for projects' }
      });
    }

    if (resourceName === 'tickets') {
      if (user.role === 'Customer') return next();
      if (user.role === 'Employee' && (user.department === 'IT Support' || user.department === 'Development')) return next();
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges for tickets' }
      });
    }

    if (resourceName === 'tasks') {
      if (user.role === 'Employee') return next();
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges for tasks' }
      });
    }

    if (resourceName === 'requests') {
      if (user.role === 'Customer') return next();
      if (user.role === 'Employee' && user.department === 'Sales') return next();
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges for requests' }
      });
    }

    if (resourceName === 'employees' || resourceName === 'departments') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Insufficient privileges' }
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
  authorizeResource
};
