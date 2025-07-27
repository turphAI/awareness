/**
 * Role definitions and permissions
 */

// Define roles
const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  EDITOR: 'editor',
  MODERATOR: 'moderator'
};

// Define permissions
const PERMISSIONS = {
  // Content permissions
  READ_CONTENT: 'read:content',
  CREATE_CONTENT: 'create:content',
  UPDATE_CONTENT: 'update:content',
  DELETE_CONTENT: 'delete:content',
  
  // Source permissions
  READ_SOURCE: 'read:source',
  CREATE_SOURCE: 'create:source',
  UPDATE_SOURCE: 'update:source',
  DELETE_SOURCE: 'delete:source',
  
  // User permissions
  READ_USER: 'read:user',
  CREATE_USER: 'create:user',
  UPDATE_USER: 'update:user',
  DELETE_USER: 'delete:user',
  
  // Collection permissions
  READ_COLLECTION: 'read:collection',
  CREATE_COLLECTION: 'create:collection',
  UPDATE_COLLECTION: 'update:collection',
  DELETE_COLLECTION: 'delete:collection',
  
  // System permissions
  MANAGE_SYSTEM: 'manage:system',
  VIEW_METRICS: 'view:metrics',
  MANAGE_SETTINGS: 'manage:settings'
};

// Define role-permission mappings
const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.READ_CONTENT,
    PERMISSIONS.READ_SOURCE,
    PERMISSIONS.CREATE_SOURCE,
    PERMISSIONS.UPDATE_SOURCE,
    PERMISSIONS.DELETE_SOURCE,
    PERMISSIONS.READ_COLLECTION,
    PERMISSIONS.CREATE_COLLECTION,
    PERMISSIONS.UPDATE_COLLECTION,
    PERMISSIONS.DELETE_COLLECTION
  ],
  [ROLES.EDITOR]: [
    PERMISSIONS.READ_CONTENT,
    PERMISSIONS.CREATE_CONTENT,
    PERMISSIONS.UPDATE_CONTENT,
    PERMISSIONS.READ_SOURCE,
    PERMISSIONS.CREATE_SOURCE,
    PERMISSIONS.UPDATE_SOURCE,
    PERMISSIONS.DELETE_SOURCE,
    PERMISSIONS.READ_COLLECTION,
    PERMISSIONS.CREATE_COLLECTION,
    PERMISSIONS.UPDATE_COLLECTION,
    PERMISSIONS.DELETE_COLLECTION
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.READ_CONTENT,
    PERMISSIONS.UPDATE_CONTENT,
    PERMISSIONS.DELETE_CONTENT,
    PERMISSIONS.READ_SOURCE,
    PERMISSIONS.UPDATE_SOURCE,
    PERMISSIONS.READ_USER,
    PERMISSIONS.READ_COLLECTION,
    PERMISSIONS.VIEW_METRICS
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS) // Admin has all permissions
};

/**
 * Check if role has permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean} - Whether role has permission
 */
const hasPermission = (role, permission) => {
  if (!ROLE_PERMISSIONS[role]) {
    return false;
  }
  
  return ROLE_PERMISSIONS[role].includes(permission);
};

/**
 * Get permissions for role
 * @param {string} role - User role
 * @returns {Array} - Array of permissions
 */
const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Get all roles
 * @returns {Object} - Object with role names
 */
const getRoles = () => {
  return ROLES;
};

/**
 * Get all permissions
 * @returns {Object} - Object with permission names
 */
const getAllPermissions = () => {
  return PERMISSIONS;
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  getRoles,
  getAllPermissions
};