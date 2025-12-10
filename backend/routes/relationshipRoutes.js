// routes/relationshipRoutes.js
const express = require('express');

module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

// Predefined relationship types
const RELATIONSHIP_TYPES = [
  'spouse', 'father', 'mother', 'son', 'daughter', 'brother', 'sister',
  'colleague', 'manager', 'assistant', 'business_partner', 'client',
  'vendor', 'referral', 'friend', 'other'
];

// Get all relationship types
router.get('/types', authenticateToken, (req, res) => {
  res.json(RELATIONSHIP_TYPES);
});

// Search for potential relationships (leads/accounts to link)
router.get('/search/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const { q, exclude_id } = req.query;

    if (!['lead', 'account'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "lead" or "account"' });
    }

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const db = await getDb();
    const searchTerm = `%${q.trim()}%`;

    let searchResults = [];

    if (type === 'lead') {
      const excludeClause = exclude_id ? 'AND l.id != ?' : '';
      const params = exclude_id ? [searchTerm, searchTerm, searchTerm, searchTerm, exclude_id] : [searchTerm, searchTerm, searchTerm, searchTerm];

      const [leads] = await db.execute(`
        SELECT 
          l.id,
          l.fname as first_name,
          l.lname as last_name,
          l.email_address as email,
          l.phone_number as phone,
          l.company_name as company,
          l.lead_status as status,
          'lead' as entity_type
        FROM leads l
        WHERE (
          l.fname LIKE ? OR 
          l.lname LIKE ? OR 
          l.email_address LIKE ? OR 
          l.company_name LIKE ?
        ) ${excludeClause}
        ORDER BY l.fname, l.lname
        LIMIT 20
      `, params);

      searchResults = leads.map(lead => ({
        ...lead,
        display_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
      }));

    } else {
      const excludeClause = exclude_id ? 'AND a.id != ?' : '';
      const params = exclude_id ? [searchTerm, searchTerm, searchTerm, searchTerm, exclude_id] : [searchTerm, searchTerm, searchTerm, searchTerm];

      const [accounts] = await db.execute(`
        SELECT 
          a.id,
          a.name as account_name,
          a.contact_fname as first_name,
          a.contact_lname as last_name,
          a.contact_email as email,
          a.contact_phone as phone,
          a.type as account_type,
          'account' as entity_type
        FROM accounts a
        WHERE (
          a.name LIKE ? OR 
          a.contact_fname LIKE ? OR 
          a.contact_lname LIKE ? OR 
          a.contact_email LIKE ?
        ) ${excludeClause}
        ORDER BY a.name
        LIMIT 20
      `, params);

      searchResults = accounts.map(account => ({
        ...account,
        display_name: account.account_name,
        company: account.account_type
      }));
    }

    res.json(searchResults);

  } catch (error) {
    console.error('Error searching for relationships:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get relationships for a specific person (lead or account)
router.get('/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    
    if (!['lead', 'account'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "lead" or "account"' });
    }

    const db = await getDb();

    let effectiveType = type;
    let effectiveId = id;

    if (type === 'lead') {
      const [leads] = await db.execute(
        'SELECT id, converted_account_id FROM leads WHERE id = ?', 
        [id]
      );

      if (leads.length > 0 && leads[0].converted_account_id) {
        effectiveType = 'account';
        effectiveId = leads[0].converted_account_id;
      } else if (leads.length === 0) {
        return res.json([]);
      }
    }
    
    const [relationships] = await db.execute(`
      SELECT 
        r.*,
        l.fname as related_lead_first_name,
        l.lname as related_lead_last_name,
        l.email_address as related_lead_email,
        l.phone_number as related_lead_phone,
        l.company_name as related_lead_company,
        l.lead_status as related_lead_status,
        a.name as related_account_name,
        a.contact_fname as related_account_contact_first_name,
        a.contact_lname as related_account_contact_last_name,
        a.contact_email as related_account_contact_email,
        a.contact_phone as related_account_contact_phone,
        a.type as related_account_type,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM relationships r
      LEFT JOIN leads l ON r.related_type = 'lead' AND r.related_id = l.id
      LEFT JOIN accounts a ON r.related_type = 'account' AND r.related_id = a.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.entity_type = ? AND r.entity_id = ?
      
      UNION ALL
      
      SELECT 
        r.*,
        l2.fname as related_lead_first_name,
        l2.lname as related_lead_last_name,
        l2.email_address as related_lead_email,
        l2.phone_number as related_lead_phone,
        l2.company_name as related_lead_company,
        l2.lead_status as related_lead_status,
        a2.name as related_account_name,
        a2.contact_fname as related_account_contact_first_name,
        a2.contact_lname as related_account_contact_last_name,
        a2.contact_email as related_account_contact_email,
        a2.contact_phone as related_account_contact_phone,
        a2.type as related_account_type,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM relationships r
      LEFT JOIN leads l2 ON r.entity_type = 'lead' AND r.entity_id = l2.id
      LEFT JOIN accounts a2 ON r.entity_type = 'account' AND r.entity_id = a2.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.related_type = ? AND r.related_id = ?
      
      ORDER BY created_at DESC
    `, [effectiveType, effectiveId, effectiveType, effectiveId]);

    const formattedRelationships = relationships.map(rel => {
      const isReverse = rel.related_type === effectiveType && rel.related_id == effectiveId;
      
      return {
        id: rel.id,
        relationship_type: rel.relationship_type,
        is_reverse: isReverse,
        notes: rel.notes,
        created_at: rel.created_at,
        created_by_name: rel.created_by_name,
        related_entity: {
          type: isReverse ? rel.entity_type : rel.related_type,
          id: isReverse ? rel.entity_id : rel.related_id,
          name: isReverse 
            ? (rel.entity_type === 'lead' 
                ? `${rel.related_lead_first_name || ''} ${rel.related_lead_last_name || ''}`.trim()
                : rel.related_account_name)
            : (rel.related_type === 'lead'
                ? `${rel.related_lead_first_name || ''} ${rel.related_lead_last_name || ''}`.trim()
                : rel.related_account_name),
          email: isReverse
            ? (rel.entity_type === 'lead' ? rel.related_lead_email : rel.related_account_contact_email)
            : (rel.related_type === 'lead' ? rel.related_lead_email : rel.related_account_contact_email),
          phone: isReverse
            ? (rel.entity_type === 'lead' ? rel.related_lead_phone : rel.related_account_contact_phone)
            : (rel.related_type === 'lead' ? rel.related_lead_phone : rel.related_account_contact_phone),
          company: isReverse
            ? (rel.entity_type === 'lead' ? rel.related_lead_company : rel.related_account_type)
            : (rel.related_type === 'lead' ? rel.related_lead_company : rel.related_account_type),
          status: isReverse
            ? (rel.entity_type === 'lead' ? rel.related_lead_status : 'active')
            : (rel.related_type === 'lead' ? rel.related_lead_status : 'active')
        }
      };
    });

    res.json(formattedRelationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get relationship counts for multiple entities (for bulk display)
router.post('/counts', authenticateToken, async (req, res) => {
  try {
    const { entities } = req.body; // e.g., [{ type: 'lead', id: 1 }, { type: 'account', id: 2 }]
    
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return res.json({});
    }

    const db = await getDb();
    const counts = {};

    // 1. Create a map to hold the "effective" entity for each original lead ID.
    const leadIdToEffectiveEntityMap = new Map();
    const leadIds = entities
      .filter(e => e.type === 'lead')
      .map(e => e.id);

    if (leadIds.length > 0) {
      // 2. Pre-query the leads table to find which ones are converted.
      const placeholders = leadIds.map(() => '?').join(',');
      const [leads] = await db.execute(
        `SELECT id, converted_account_id FROM leads WHERE id IN (${placeholders})`,
        leadIds
      );

      // 3. Populate the map with the correct entity to query for relationships.
      for (const lead of leads) {
        if (lead.converted_account_id) {
          leadIdToEffectiveEntityMap.set(lead.id, { 
            type: 'account', 
            id: lead.converted_account_id 
          });
        } else {
          leadIdToEffectiveEntityMap.set(lead.id, { 
            type: 'lead', 
            id: lead.id 
          });
        }
      }
    }

    // 4. Iterate through the original entities and calculate counts using the effective entity.
    for (const entity of entities) {
      if (!['lead', 'account'].includes(entity.type)) continue;

      let entityToQuery = entity;

      if (entity.type === 'lead') {
        if (leadIdToEffectiveEntityMap.has(entity.id)) {
          entityToQuery = leadIdToEffectiveEntityMap.get(entity.id);
        } else {
          counts[`${entity.type}_${entity.id}`] = { total: 0 };
          continue;
        }
      }

      // 5. Run the count query using the correct (effective) type and ID.
      const [countResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM relationships r
        WHERE (r.entity_type = ? AND r.entity_id = ?) 
           OR (r.related_type = ? AND r.related_id = ?)
      `, [entityToQuery.type, entityToQuery.id, entityToQuery.type, entityToQuery.id]);
      
      // 6. IMPORTANT: Store the result using the ORIGINAL key that the frontend requested.
      const originalKey = `${entity.type}_${entity.id}`;
      counts[originalKey] = {
        total: countResult[0].total || 0
      };
    }    
    res.json(counts);
  } catch (error) {
    console.error('Error fetching relationship counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new relationship
router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      entity_type,
      entity_id,
      related_type,
      related_id,
      relationship_type,
      notes
    } = req.body;

    // Validation
    if (!['lead', 'account'].includes(entity_type) || !['lead', 'account'].includes(related_type)) {
      return res.status(400).json({ error: 'Entity types must be either "lead" or "account"' });
    }

    if (!RELATIONSHIP_TYPES.includes(relationship_type)) {
      return res.status(400).json({ error: 'Invalid relationship type' });
    }

    if (entity_type === related_type && entity_id == related_id) {
      return res.status(400).json({ error: 'Cannot create relationship with self' });
    }

    const db = await getDb();
    
    // Check if relationship already exists
    const [existing] = await db.execute(`
      SELECT id FROM relationships 
      WHERE (entity_type = ? AND entity_id = ? AND related_type = ? AND related_id = ?)
      OR (entity_type = ? AND entity_id = ? AND related_type = ? AND related_id = ?)
    `, [entity_type, entity_id, related_type, related_id, related_type, related_id, entity_type, entity_id]);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Relationship already exists' });
    }

    // Verify both entities exist
    if (entity_type === 'lead') {
      const [entityCheck] = await db.execute('SELECT id FROM leads WHERE id = ?', [entity_id]);
      if (entityCheck.length === 0) {
        return res.status(404).json({ error: 'Primary lead not found' });
      }
    } else {
      const [entityCheck] = await db.execute('SELECT id FROM accounts WHERE id = ?', [entity_id]);
      if (entityCheck.length === 0) {
        return res.status(404).json({ error: 'Primary account not found' });
      }
    }

    if (related_type === 'lead') {
      const [relatedCheck] = await db.execute('SELECT id FROM leads WHERE id = ?', [related_id]);
      if (relatedCheck.length === 0) {
        return res.status(404).json({ error: 'Related lead not found' });
      }
    } else {
      const [relatedCheck] = await db.execute('SELECT id FROM accounts WHERE id = ?', [related_id]);
      if (relatedCheck.length === 0) {
        return res.status(404).json({ error: 'Related account not found' });
      }
    }

    // Create the relationship
    const [result] = await db.execute(`
      INSERT INTO relationships (entity_type, entity_id, related_type, related_id, relationship_type, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [entity_type, entity_id, related_type, related_id, relationship_type, notes || null, req.user.id]);

    res.json({ 
      id: result.insertId,
      message: 'Relationship created successfully' 
    });

  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a relationship
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { relationship_type, notes } = req.body;

    if (relationship_type && !RELATIONSHIP_TYPES.includes(relationship_type)) {
      return res.status(400).json({ error: 'Invalid relationship type' });
    }

    const db = await getDb();
    
    // Check if relationship exists
    const [existing] = await db.execute('SELECT id FROM relationships WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    const updateFields = [];
    const updateValues = [];

    if (relationship_type !== undefined) {
      updateFields.push('relationship_type = ?');
      updateValues.push(relationship_type);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.json({ message: 'No changes to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.execute(
      `UPDATE relationships SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ message: 'Relationship updated successfully' });

  } catch (error) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a relationship
router.delete('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const [result] = await db.execute('DELETE FROM relationships WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    res.json({ 
      success: true,
      message: 'Relationship deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};