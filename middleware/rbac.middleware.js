const Role = require('../models/Role');
const User = require('../models/User');

/**
 * Middleware to check if the authenticated user has a specific permission.
 * Assumes that `req.user` is populated by the authentication middleware,
 * and contains `id` and `companyId`.
 * 
 * @param {String} requiredPermission - The permission string to check for (e.g., 'CREATE_USER')
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, msg: 'Authentication required' });
      }

      // Fetch the full user to get their current roleId
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, msg: 'User not found' });
      }

      if (!user.roleId) {
        return res.status(403).json({ success: false, msg: 'User has no assigned role' });
      }

      // Fetch the role
      const role = await Role.findById(user.roleId);
      if (!role) {
        return res.status(403).json({ success: false, msg: 'Role not found' });
      }

      // Check permissions: either has the specific permission, or has '*' (super admin for company)
      if (role.permissions.includes(requiredPermission) || role.permissions.includes('*')) {
        // Attach role to req.user for convenience in downstream controllers
        req.user.roleDetails = role;
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        msg: `Forbidden: Requires '${requiredPermission}' permission.` 
      });

    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ success: false, msg: 'Server error during authorization check' });
    }
  };
};

module.exports = {
  requirePermission
};
