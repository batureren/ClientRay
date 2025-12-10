const express = require('express');

module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole, mapProductFromRemote } = dependencies;
  const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM products ORDER BY name');
    
    const mappedProducts = rows.map(mapProductFromRemote);
    
    res.json(mappedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      product_code, product_name, product_category, list_price, cost_price,
      currency, description, specifications, stock_quantity, reorder_point, is_active
    } = req.body;

    if (!product_code || !product_name) {
      return res.status(400).json({ error: 'Product code and name are required.' });
    }

    const db = await getDb();
    const [result] = await db.execute(`
      INSERT INTO products (
        sku, name, category, price, cost, currency, 
        description, specs, stock, reorder_point, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product_code, product_name, product_category || null, 
      list_price || 0, cost_price || 0, currency || 'USD',
      description || null, specifications || null, 
      stock_quantity || 0, reorder_point || 0, 
      is_active !== undefined ? is_active : true
    ]);

    res.status(201).json({ id: result.insertId, message: 'Product created successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A product with this SKU already exists.' });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      product_code, product_name, product_category, list_price, cost_price,
      currency, description, specifications, stock_quantity, reorder_point, is_active
    } = req.body;

    const db = await getDb();
    const [result] = await db.execute(`
      UPDATE products 
      SET sku = ?, name = ?, category = ?, price = ?, cost = ?, currency = ?,
          description = ?, specs = ?, stock = ?, reorder_point = ?, active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      product_code, product_name, product_category, list_price, cost_price,
      currency, description, specifications, stock_quantity, reorder_point, is_active, id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();
    
    const [result] = await db.execute(
      'DELETE FROM products WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ 
      success: true, 
      message: 'Product permanently deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const mappedProduct = mapProductFromRemote(rows[0]);
    res.json(mappedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/stock', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_quantity } = req.body;

    if (stock_quantity === undefined || stock_quantity < 0) {
      return res.status(400).json({ error: 'Valid stock quantity is required' });
    }

    const db = await getDb();
    const [result] = await db.execute(
      'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [stock_quantity, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product stock updated successfully' });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};