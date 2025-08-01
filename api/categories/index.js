const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  requireAuth
} = require('../../lib/auth');

// Categories management endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  // Require authentication for all category operations
  return requireAuth(async (req, res) => {
    try {
      if (req.method === 'GET') {
        // Get all categories
        const categories = await executeQuery(
          `SELECT 
            id, name, description, color, icon, parent_id, sort_order,
            created_at, updated_at
          FROM categories 
          ORDER BY sort_order ASC, name ASC`
        );

        // Build hierarchical structure
        const categoryMap = new Map();
        const rootCategories = [];

        // First pass: create all categories
        categories.forEach(category => {
          categoryMap.set(category.id, {
            ...category,
            children: []
          });
        });

        // Second pass: build hierarchy
        categories.forEach(category => {
          if (category.parent_id) {
            const parent = categoryMap.get(category.parent_id);
            if (parent) {
              parent.children.push(categoryMap.get(category.id));
            }
          } else {
            rootCategories.push(categoryMap.get(category.id));
          }
        });

        return res.status(200).json({
          success: true,
          data: rootCategories
        });
      }

      if (req.method === 'POST') {
        // Create new category (admin only for now)
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Admin access required'
          });
        }

        const { name, description, color, icon, parent_id, sort_order } = req.body;

        // Validation
        if (!name) {
          return res.status(400).json({
            success: false,
            error: 'Category name is required'
          });
        }

        // Check if category already exists
        const existingCategories = await executeQuery(
          'SELECT id FROM categories WHERE name = ?',
          [name.trim()]
        );

        if (existingCategories.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Category with this name already exists'
          });
        }

        // Create category
        const result = await executeQuery(
          `INSERT INTO categories (
            name, description, color, icon, parent_id, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            name.trim(),
            description || null,
            color || '#3498db',
            icon || null,
            parent_id || null,
            sort_order || 0
          ]
        );

        // Get created category
        const createdCategories = await executeQuery(
          `SELECT 
            id, name, description, color, icon, parent_id, sort_order,
            created_at
          FROM categories WHERE id = ?`,
          [result.insertId]
        );

        return res.status(201).json({
          success: true,
          data: createdCategories[0],
          message: 'Category created successfully'
        });
      }

      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });

    } catch (error) {
      console.error('Categories API error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })(req, res);
}