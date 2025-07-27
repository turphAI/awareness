const { ROLES, PERMISSIONS, hasPermission, getRolePermissions } = require('../utils/roles');

describe('Role-Based Access Control', () => {
  describe('Role Permissions', () => {
    it('should define correct permissions for user role', () => {
      const userPermissions = getRolePermissions(ROLES.USER);
      
      // User should have basic permissions
      expect(userPermissions).toContain(PERMISSIONS.READ_CONTENT);
      expect(userPermissions).toContain(PERMISSIONS.READ_SOURCE);
      expect(userPermissions).toContain(PERMISSIONS.CREATE_SOURCE);
      expect(userPermissions).toContain(PERMISSIONS.READ_COLLECTION);
      expect(userPermissions).toContain(PERMISSIONS.CREATE_COLLECTION);
      
      // User should not have admin permissions
      expect(userPermissions).not.toContain(PERMISSIONS.MANAGE_SYSTEM);
      expect(userPermissions).not.toContain(PERMISSIONS.CREATE_USER);
      expect(userPermissions).not.toContain(PERMISSIONS.DELETE_USER);
    });
    
    it('should define correct permissions for editor role', () => {
      const editorPermissions = getRolePermissions(ROLES.EDITOR);
      
      // Editor should have content creation permissions
      expect(editorPermissions).toContain(PERMISSIONS.READ_CONTENT);
      expect(editorPermissions).toContain(PERMISSIONS.CREATE_CONTENT);
      expect(editorPermissions).toContain(PERMISSIONS.UPDATE_CONTENT);
      
      // Editor should not have admin permissions
      expect(editorPermissions).not.toContain(PERMISSIONS.MANAGE_SYSTEM);
      expect(editorPermissions).not.toContain(PERMISSIONS.DELETE_USER);
    });
    
    it('should define correct permissions for moderator role', () => {
      const moderatorPermissions = getRolePermissions(ROLES.MODERATOR);
      
      // Moderator should have content moderation permissions
      expect(moderatorPermissions).toContain(PERMISSIONS.READ_CONTENT);
      expect(moderatorPermissions).toContain(PERMISSIONS.UPDATE_CONTENT);
      expect(moderatorPermissions).toContain(PERMISSIONS.DELETE_CONTENT);
      expect(moderatorPermissions).toContain(PERMISSIONS.READ_USER);
      
      // Moderator should not have admin permissions
      expect(moderatorPermissions).not.toContain(PERMISSIONS.MANAGE_SYSTEM);
      expect(moderatorPermissions).not.toContain(PERMISSIONS.CREATE_USER);
    });
    
    it('should define all permissions for admin role', () => {
      const adminPermissions = getRolePermissions(ROLES.ADMIN);
      const allPermissions = Object.values(PERMISSIONS);
      
      // Admin should have all permissions
      allPermissions.forEach(permission => {
        expect(adminPermissions).toContain(permission);
      });
    });
  });
  
  describe('Permission Checking', () => {
    it('should correctly check if role has permission', () => {
      // User permissions
      expect(hasPermission(ROLES.USER, PERMISSIONS.READ_CONTENT)).toBe(true);
      expect(hasPermission(ROLES.USER, PERMISSIONS.CREATE_CONTENT)).toBe(false);
      
      // Editor permissions
      expect(hasPermission(ROLES.EDITOR, PERMISSIONS.CREATE_CONTENT)).toBe(true);
      expect(hasPermission(ROLES.EDITOR, PERMISSIONS.DELETE_USER)).toBe(false);
      
      // Moderator permissions
      expect(hasPermission(ROLES.MODERATOR, PERMISSIONS.DELETE_CONTENT)).toBe(true);
      expect(hasPermission(ROLES.MODERATOR, PERMISSIONS.CREATE_USER)).toBe(false);
      
      // Admin permissions
      expect(hasPermission(ROLES.ADMIN, PERMISSIONS.MANAGE_SYSTEM)).toBe(true);
      expect(hasPermission(ROLES.ADMIN, PERMISSIONS.DELETE_USER)).toBe(true);
    });
    
    it('should return false for invalid role', () => {
      expect(hasPermission('invalid-role', PERMISSIONS.READ_CONTENT)).toBe(false);
    });
  });
});