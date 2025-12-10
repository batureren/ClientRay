// Updated chainFieldRoutes.js with automatic read-only field management

const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

// Helper function to update read-only status for target fields
const updateTargetFieldReadOnlyStatus = async (db, fieldId, isReadOnly) => {
  await db.execute(`
    UPDATE custom_field_definitions 
    SET is_read_only = ? 
    WHERE id = ?
  `, [isReadOnly ? 1 : 0, fieldId]);
};

// Helper function to check if a field is targeted by any other active chain rules
const isFieldTargetedByOtherRules = async (db, fieldId, excludeRuleId = null) => {
  let query = `
    SELECT COUNT(*) as count 
    FROM chain_rules 
    WHERE target_field_id = ? AND is_active = 1
  `;
  let params = [fieldId];
  
  if (excludeRuleId) {
    query += ' AND id != ?';
    params.push(excludeRuleId);
  }
  
  const [result] = await db.execute(query, params);
  return result[0].count > 0;
};

// GET all chain rules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [rows] = await db.execute(`
      SELECT 
        cr.*, 
        sf.field_label as source_field_label,
        sf.field_name as source_field_name,
        sf.field_type as source_field_type,
        tf.field_label as target_field_label,
        tf.field_name as target_field_name,
        tf.field_type as target_field_type
      FROM chain_rules cr
      JOIN custom_field_definitions sf ON cr.source_field_id = sf.id
      JOIN custom_field_definitions tf ON cr.target_field_id = tf.id
      ORDER BY cr.module, cr.rule_name
    `);
    
    const processedRows = await Promise.all(rows.map(async (row) => {
      if (row.rule_type === 'bulk_mapping') {
        const [mappings] = await db.execute(`
          SELECT trigger_value, target_value 
          FROM chain_rule_value_maps 
          WHERE rule_id = ?
        `, [row.id]);
        
        return {
          ...row,
          mappings: mappings
        };
      }
      return {
        ...row,
        mappings: null
      };
    }));
    
    res.json(processedRows);
  } catch (error) {
    console.error('Error fetching chain rules:', error);
    res.status(500).json({ error: 'Failed to retrieve chain rules.' });
  }
});

// POST create new chain rule (simple or bulk mapping)
router.post('/', authenticateToken, requireRole('manager'), async (req, res) => {
  const db = await getDb();
  await db.beginTransaction();

  try {
    const {
      rule_name,
      module,
      source_field_id,
      target_field_id,
      comparison_operator,
      rule_type = 'simple',
      bulk_mappings,
      trigger_value,
      target_value
    } = req.body;

    // --- Main Validation ---
    if (!rule_name || !module || !source_field_id || !target_field_id) {
      return res.status(400).json({ error: 'Rule name, module, source field, and target field are required.' });
    }
    if (source_field_id === target_field_id) {
      return res.status(400).json({ error: 'Source and target fields cannot be the same.' });
    }

    // --- Insert the main rule ---
    const mainRuleTrigger = rule_type === 'bulk_mapping' ? null : trigger_value;
    const mainRuleTarget = rule_type === 'bulk_mapping' ? null : target_value;

    const [result] = await db.execute(`
      INSERT INTO chain_rules 
      (rule_name, module, source_field_id, target_field_id, comparison_operator, rule_type, trigger_value, target_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      rule_name, module, source_field_id, target_field_id,
      comparison_operator, rule_type, mainRuleTrigger, mainRuleTarget
    ]);

    const ruleId = result.insertId;

    // --- If it's a bulk rule, insert all the mappings ---
    if (rule_type === 'bulk_mapping' && bulk_mappings && bulk_mappings.length > 0) {
      const mappingValues = bulk_mappings.map(map => [ruleId, map.trigger_value, map.target_value]);
      
      await db.query(`
        INSERT INTO chain_rule_value_maps (rule_id, trigger_value, target_value)
        VALUES ?
      `, [mappingValues]);
    }

    // --- Set target field as read-only ---
    await updateTargetFieldReadOnlyStatus(db, target_field_id, true);

    await db.commit();
    res.status(201).json({ 
      id: ruleId, 
      message: 'Chain rule created successfully. Target field is now read-only.' 
    });

  } catch (error) {
    await db.rollback();
    console.error('Error creating chain rule:', error);
    res.status(500).json({ error: 'Failed to create chain rule.', details: error.message });
  }
});

// PUT update chain rule
router.put('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  const db = await getDb();
  
  try {
    await db.execute('START TRANSACTION');
    
    const { id } = req.params;
    const {
      rule_name,
      trigger_value,
      target_field_id,
      target_value,
      comparison_operator,
      bulk_mappings = []
    } = req.body;

    // Get the current rule
    const [currentRule] = await db.execute(`
      SELECT module, source_field_id, rule_type, target_field_id FROM chain_rules WHERE id = ?
    `, [id]);

    if (currentRule.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Chain rule not found.' });
    }

    const { module, source_field_id, rule_type, target_field_id: oldTargetFieldId } = currentRule[0];

    // Validation...
    if (!rule_name || !target_field_id || !comparison_operator) {
      await db.execute('ROLLBACK');
      return res.status(400).json({ error: 'Rule name, target field, and comparison operator are required.' });
    }

    // Rule-type specific validation
    if (rule_type === 'simple') {
      const needsTriggerValue = !['is_empty', 'is_not_empty'].includes(comparison_operator);
      if (needsTriggerValue && (!trigger_value || trigger_value.trim() === '')) {
        await db.execute('ROLLBACK');
        return res.status(400).json({ error: 'Trigger value is required for this comparison operator.' });
      }
      if (!target_value || target_value.trim() === '') {
        await db.execute('ROLLBACK');
        return res.status(400).json({ error: 'Target value is required for simple rules.' });
      }
    } else if (rule_type === 'bulk_mapping') {
      if (!bulk_mappings || !Array.isArray(bulk_mappings) || bulk_mappings.length === 0) {
        await db.execute('ROLLBACK');
        return res.status(400).json({ error: 'Bulk mappings are required for bulk mapping rules.' });
      }
      
      for (const mapping of bulk_mappings) {
        if (!mapping.trigger_value || !mapping.target_value) {
          await db.execute('ROLLBACK');
          return res.status(400).json({ error: 'Each bulk mapping must have both trigger_value and target_value.' });
        }
      }
    }

    // Update the main rule
    const needsTriggerValue = rule_type === 'simple' && !['is_empty', 'is_not_empty'].includes(comparison_operator);
    const [updateResult] = await db.execute(`
      UPDATE chain_rules
      SET rule_name = ?, trigger_value = ?, target_field_id = ?, target_value = ?, 
          comparison_operator = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      rule_name,
      needsTriggerValue ? trigger_value : null,
      target_field_id,
      rule_type === 'simple' ? target_value : null,
      comparison_operator,
      id
    ]);

    if (updateResult.affectedRows === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Chain rule not found.' });
    }

    // Handle bulk mappings update
    if (rule_type === 'bulk_mapping') {
      // Delete existing mappings from the correct table
      await db.execute('DELETE FROM chain_rule_value_maps WHERE rule_id = ?', [id]);
      
      // Insert new mappings
      if (bulk_mappings.length > 0) {
        const mappingValues = bulk_mappings.map(map => [id, map.trigger_value, map.target_value]);
        await db.query(`
          INSERT INTO chain_rule_value_maps (rule_id, trigger_value, target_value)
          VALUES ?
        `, [mappingValues]);
      }
    }

    // Handle read-only status changes if target field changed
    if (parseInt(oldTargetFieldId) !== parseInt(target_field_id)) {
      // Set new target field as read-only
      await updateTargetFieldReadOnlyStatus(db, target_field_id, true);
      
      // Check if old target field is still targeted by other rules
      const isOldFieldStillTargeted = await isFieldTargetedByOtherRules(db, oldTargetFieldId, id);
      if (!isOldFieldStillTargeted) {
        // Remove read-only status from old target field
        await updateTargetFieldReadOnlyStatus(db, oldTargetFieldId, false);
      }
    }

    await db.execute('COMMIT');
    res.json({ message: 'Chain rule updated successfully.' });
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error updating chain rule:', error);
    res.status(500).json({ error: 'Failed to update chain rule.' });
  }
});

// DELETE chain rule
router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  const db = await getDb();
  
  try {
    await db.execute('START TRANSACTION');
    
    const { id } = req.params;

    // Get the rule details before deletion
    const [ruleDetails] = await db.execute(`
      SELECT target_field_id FROM chain_rules WHERE id = ?
    `, [id]);

    if (ruleDetails.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Chain rule not found.' });
    }

    const { target_field_id } = ruleDetails[0];

    // Delete mappings first (if any)
    await db.execute('DELETE FROM chain_rule_value_maps WHERE rule_id = ?', [id]);
    
    // Delete the main rule
    const [result] = await db.execute('DELETE FROM chain_rules WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Chain rule not found.' });
    }

    // Check if target field is still targeted by other rules
    const isFieldStillTargeted = await isFieldTargetedByOtherRules(db, target_field_id);
    if (!isFieldStillTargeted) {
      // Remove read-only status from target field
      await updateTargetFieldReadOnlyStatus(db, target_field_id, false);
    }

    await db.execute('COMMIT');
    res.json({ message: 'Chain rule deleted successfully. Target field read-only status updated.' });
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error deleting chain rule:', error);
    res.status(500).json({ error: 'Failed to delete chain rule.' });
  }
});

  return router;
};