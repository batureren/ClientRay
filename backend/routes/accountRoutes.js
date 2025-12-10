// routes/accountRoutes.js
const express = require('express');

module.exports = (dependencies) => {
  const { 
    getDb, 
    authenticateToken, 
    requireRole, 
    buildFilterClause,
    mapAccountFromRemote,
    generateDescription,
    i18next,
    applyChainRulesMiddleware,
    CampaignGoalCalculator
  } = dependencies;

  const router = express.Router();

const logAccountHistory = async (accountId, actionType, description, userId, fieldName = null, oldValue = null, newValue = null) => {
  try {
    const db = await getDb();

    if (userId) {
      const [userExists] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
      if (userExists.length === 0) {
        console.error(`User ID ${userId} does not exist in users table. Logging without user_id.`);
        userId = null;
      }
    }

    await db.execute(
      `INSERT INTO account_history (account_id, action_type, description, user_id, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, actionType, description, userId, fieldName, oldValue, newValue]
    );
  } catch (error) {
    console.error('Error logging account history:', error);
  }
};

// Helper function to build search where clause
const buildSearchWhereClause = (searchTerm) => {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return { whereClause: '', params: [] };
  }
  
  const searchPattern = `%${searchTerm.trim()}%`;
  const whereClause = `AND (
    a.name LIKE ? OR 
    a.contact_fname LIKE ? OR 
    a.contact_lname LIKE ? OR 
    a.contact_email LIKE ? OR 
    a.contact_phone LIKE ? OR 
    a.industry LIKE ? OR
    a.type LIKE ? OR
    a.description LIKE ?
  )`;
  
  return {
    whereClause,
    params: [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
  };
};

const fetchCustomFieldsForAccounts = async (db, accountIds) => {
  if (accountIds.length === 0) return {};
  
  const placeholders = accountIds.map(() => '?').join(',');
  const [rows] = await db.execute(`
    SELECT 
      cv.record_id, 
      cd.field_name,
      cd.field_label,
      cd.field_type,
      cd.is_read_only,
      cd.is_required,
      cv.value 
    FROM custom_field_values cv
    JOIN custom_field_definitions cd ON cv.definition_id = cd.id
    WHERE cv.record_id IN (${placeholders}) AND cv.module = 'accounts'
  `, accountIds);

  const customFieldsByAccount = {};
  rows.forEach(row => {
    if (!customFieldsByAccount[row.record_id]) {
      customFieldsByAccount[row.record_id] = [];
    }
    customFieldsByAccount[row.record_id].push({
      field_name: row.field_name,
      field_label: row.field_label,
      field_type: row.field_type,
      is_read_only: row.is_read_only,
      is_required: row.is_required,
      value: row.value
    });
  });

  return customFieldsByAccount;
};

const saveOrUpdateCustomFields = async (db, accountId, customFieldsObject) => {
  if (!customFieldsObject || Object.keys(customFieldsObject).length === 0) {
    return;
  }

  const [definitions] = await db.execute(
    "SELECT id, field_name FROM custom_field_definitions WHERE module = 'accounts'"
  );
  const definitionMap = new Map(definitions.map(def => [def.field_name, def.id]));

  for (const [fieldName, value] of Object.entries(customFieldsObject)) {
    const definitionId = definitionMap.get(fieldName);
    if (!definitionId) {
      continue;
    }

    let storedValue;
    if (typeof value === 'boolean') {
      storedValue = value ? '1' : '0';
    } else if (Array.isArray(value)) {
      storedValue = JSON.stringify(value);
    } else {
      storedValue = value ?? '';
    }
    const [updateResult] = await db.execute(`
      UPDATE custom_field_values 
      SET value = ? 
      WHERE definition_id = ? AND record_id = ? AND module = ?
    `, [storedValue, definitionId, accountId, 'accounts']);

    if (updateResult.affectedRows === 0) {
      try {
        await db.execute(`
          INSERT INTO custom_field_values (definition_id, record_id, module, value)
          VALUES (?, ?, ?, ?)
        `, [definitionId, accountId, 'accounts', storedValue]);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          await db.execute(`
            UPDATE custom_field_values 
            SET value = ? 
            WHERE definition_id = ? AND record_id = ? AND module = ?
          `, [storedValue, definitionId, accountId, 'accounts']);
        } else {
          throw error;
        }
      }
    }
  }
};

// Updated main accounts route to handle optional pagination
router.get('/', authenticateToken, async (req, res) => {
  const db = await getDb();
  try {
    const {
      page,
      limit,
      search = '',
      filters
    } = req.query;

    const isPaginationRequested = page !== undefined || limit !== undefined;

    let parsedFilters = [];
    if (filters && filters !== '[]') {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filters format. Must be a JSON string.' });
      }
    }
    
    let pageNumber, limitNumber, offset;
    
    if (isPaginationRequested) {
      pageNumber = parseInt(page, 10) || 1;
      limitNumber = Math.min(parseInt(limit, 10) || 20, 100);
      offset = (pageNumber - 1) * limitNumber;

      if (pageNumber < 1 || limitNumber < 1 || limitNumber > 100) {
        return res.status(400).json({ 
          error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' 
        });
      }
    }

    const { whereClause: searchWhere, params: searchParams } = buildSearchWhereClause(search);
    const { 
      whereClause: filterWhere, 
      havingClause: filterHaving, 
      whereParams: filterWhereParams,
      havingParams: filterHavingParams,
      productDateFilter,
      purchaseDateFilter,
      productJoinCondition
    } = buildFilterClause(parsedFilters, 'accounts');

    const whereParams = [...searchParams, ...filterWhereParams];
    
    // Handle both product date filters properly
    let productJoinParams = [];
    
    // Add product creation date params
    if (productDateFilter && productDateFilter.params) {
      productJoinParams.push(...productDateFilter.params);
    }
    
    // Add purchase date params  
    if (purchaseDateFilter && purchaseDateFilter.params) {
      productJoinParams.push(...purchaseDateFilter.params);
    }
    
    const productJoinType = (productDateFilter || purchaseDateFilter) ? 'INNER JOIN' : 'LEFT JOIN';

    let countQuery;
    let countParams;
    
    if (filterHaving || productDateFilter || purchaseDateFilter) {
      countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT a.id,
            CASE WHEN COUNT(ap.id) > 0 THEN 'yes' ELSE 'no' END as has_products,
            COUNT(ap.id) as product_count,
            COALESCE(SUM(ap.quantity * ap.unit_price), 0) as total_products_value,
            GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as has_product_name,
            MAX(ap.created_at) as product_created_date,
            MAX(ap.purchase_date) as purchase_date
          FROM accounts a
          ${productJoinType} account_products ap ON a.id = ap.account_id ${productJoinCondition}
          LEFT JOIN products p ON ap.product_id = p.id
          WHERE 1=1 ${searchWhere} ${filterWhere}
          GROUP BY a.id
          ${filterHaving}
        ) as filtered_accounts
      `;
      countParams = [...whereParams, ...productJoinParams, ...filterHavingParams];
    } else {
      countQuery = `
        SELECT COUNT(*) as total 
        FROM accounts a 
        WHERE 1=1 ${searchWhere} ${filterWhere}
      `;
      countParams = whereParams;
    }

    console.log('Count Query:', countQuery);
    console.log('Count Params:', countParams);

    // Execute count query
    const [countResult] = await db.execute(countQuery, countParams);
    const totalItems = countResult[0].total;

    // Build accounts query with computed fields and product date filtering
    let accountsQuery = `
      SELECT a.*,
        CASE WHEN COUNT(ap.id) > 0 THEN 'yes' ELSE 'no' END as has_products,
        COUNT(ap.id) as product_count,
        COALESCE(SUM(ap.quantity * ap.unit_price), 0) as total_products_value,
        GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as has_product_name, 
        MAX(ap.created_at) as product_created_date,
        MAX(ap.purchase_date) as purchase_date
      FROM accounts a
      ${productJoinType} account_products ap ON a.id = ap.account_id ${productJoinCondition}
      LEFT JOIN products p ON ap.product_id = p.id
      WHERE 1=1 ${searchWhere} ${filterWhere}
      GROUP BY a.id
    `;

    let queryParams = [...whereParams, ...productJoinParams];

    if (filterHaving) {
      accountsQuery += `${filterHaving}`;
      queryParams.push(...filterHavingParams);
    }

    accountsQuery += ` ORDER BY a.created_at DESC`;
    
    // Only add LIMIT and OFFSET if pagination is requested
    if (isPaginationRequested) {
      accountsQuery += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);
    }

    console.log('Accounts Query:', accountsQuery);
    console.log('Query Params:', queryParams);

    // Execute accounts query
    const [accountsWithComputed] = await db.execute(accountsQuery, queryParams);

    if (accountsWithComputed.length === 0) {
      const responseData = {
        data: [],
        total: totalItems
      };

      if (isPaginationRequested) {
        const totalPages = Math.ceil(totalItems / limitNumber);
        responseData.pagination = {
          currentPage: pageNumber,
          totalPages: totalPages,
          total: totalItems,
          limit: limitNumber,
          hasNext: pageNumber < totalPages,
          hasPrev: pageNumber > 1,
          showing: { from: 0, to: 0 }
        };
      }

      return res.json(responseData);
    }

    // Get the full account data for the filtered IDs
    const accountIds = accountsWithComputed.map(acc => acc.id);
    const customFieldsByAccount = await fetchCustomFieldsForAccounts(db, accountIds);
    const [accounts] = await db.execute(`
      SELECT * FROM accounts WHERE id IN (${accountIds.map(() => '?').join(',')})
      ORDER BY FIELD(id, ${accountIds.map(() => '?').join(',')})
    `, [...accountIds, ...accountIds]);

    // Fetch assigned products for all accounts in the current page
    let productQuery = `
      SELECT 
        ap.id, ap.account_id, ap.product_id, ap.quantity, ap.unit_price, ap.discount_percentage, 
        ap.created_at, ap.updated_at, ap.total_amount, ap.status, ap.purchase_date, ap.notes, 
        p.name as product_name, p.sku as product_code, p.category as product_category, 
        p.description as product_description
      FROM account_products ap
      JOIN products p ON ap.product_id = p.id
      WHERE ap.account_id IN (${accountIds.map(() => '?').join(',')}) ${productJoinCondition}
      ORDER BY ap.account_id, ap.id DESC
    `;
    
    let productParams = [...accountIds, ...productJoinParams];
    const [accountProducts] = await db.execute(productQuery, productParams);

    // Fetch all tasks for current page accounts
    const [accountTasks] = await db.execute(`
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name,
        COUNT(DISTINCT ts.id) AS total_subtasks,
        SUM(CASE WHEN ts.is_completed = 1 THEN 1 ELSE 0 END) AS completed_subtasks
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN task_subtasks ts ON t.id = ts.task_id
      WHERE t.account_id IN (${accountIds.map(() => '?').join(',')})
      ORDER BY t.account_id, t.created_at DESC
    `, accountIds);

    // Fetch call counts for current page accounts
    const [callCounts] = await db.execute(`
      SELECT 
        account_id,
        COUNT(*) as total,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent
      FROM account_calls 
      WHERE account_id IN (${accountIds.map(() => '?').join(',')})
      GROUP BY account_id
    `, accountIds);
    
    // Group products by account
    const productsByAccount = accountProducts.reduce((acc, product) => {
      (acc[product.account_id] = acc[product.account_id] || []).push({
        id: product.id,
        product_id: product.product_id,
        quantity: product.quantity,
        unit_price: product.unit_price,
        discount_percentage: product.discount_percentage,
        total_amount: product.total_amount,
        status: product.status,
        purchase_date: product.purchase_date,
        notes: product.notes,
        product_name: product.product_name,
        product_code: product.product_code,
        product_category: product.product_category,
        product_description: product.product_description,
        created_at: product.created_at,
        updated_at: product.updated_at
      });
      return acc;
    }, {});

    // Group tasks by account
    const tasksByAccount = accountTasks.reduce((acc, task) => {
      (acc[task.account_id] = acc[task.account_id] || []).push(task);
      return acc;
    }, {});

    // Group call counts by account
    const callCountsByAccount = {};
    callCounts.forEach(count => {
      callCountsByAccount[count.account_id] = {
        total: count.total,
        recent: count.recent
      };
    });

    // Calculate task counts for each account
    const taskCountsByAccount = {};
    Object.keys(tasksByAccount).forEach(accountId => {
      const tasks = tasksByAccount[accountId];
      const now = new Date();
      
      taskCountsByAccount[accountId] = {
        total: tasks.length,
        pending: tasks.filter(t => t.task_status === 'pending').length,
        overdue: tasks.filter(t => {
          const deadline = new Date(t.deadline_date);
          return deadline < now && !['completed', 'cancelled'].includes(t.task_status);
        }).length,
        completed: tasks.filter(t => t.task_status === 'completed').length,
        cancelled: tasks.filter(t => t.task_status === 'cancelled').length
      };
    });

    // Map accounts with related data - use the computed values from the query
    const mappedAccounts = accounts.map(account => {
      const assignedProducts = productsByAccount[account.id] || [];
      
      // Find the computed values from the accountsWithComputed result
      const computedAccount = accountsWithComputed.find(acc => acc.id === account.id);
      
      // Use computed values from the query (which respect the product date filter)
      const hasProducts = computedAccount?.has_products || 'no';
      const productCount = computedAccount?.product_count || 0;
      const productsValue = computedAccount?.total_products_value || 0;
      const productNames = computedAccount?.has_product_name || null;
      const purchaseDate = computedAccount?.purchase_date || null;
      const custom_fields = customFieldsByAccount[account.id] || [];

      return {
        ...mapAccountFromRemote(account),
        has_products: hasProducts,
        product_count: productCount,
        total_products_value: productsValue,
        product_names: productNames,
        purchase_date: purchaseDate,
        assigned_products: assignedProducts,
        tasks: tasksByAccount[account.id] || [],
        task_counts: taskCountsByAccount[account.id] || {
          total: 0,
          pending: 0,
          overdue: 0,
          completed: 0,
          cancelled: 0
        },
        call_counts: callCountsByAccount[account.id] || {
          total: 0,
          recent: 0
        },
        custom_fields: custom_fields
      };
    });
    
    // Prepare response
    const responseData = {
      data: mappedAccounts,
      total: totalItems
    };

    // Add pagination info only if requested
    if (isPaginationRequested) {
      const totalPages = Math.ceil(totalItems / limitNumber);
      const from = totalItems === 0 ? 0 : offset + 1;
      const to = Math.min(offset + limitNumber, totalItems);
      
      responseData.pagination = {
        currentPage: pageNumber,
        totalPages: totalPages,
        total: totalItems,
        limit: limitNumber,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
        showing: { from, to }
      };
    }
    
    // Return response
    res.json(responseData);
    
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new account
router.post('/', authenticateToken, requireRole('user'), applyChainRulesMiddleware, async (req, res) => {
  const db = await getDb();
  await db.execute('START TRANSACTION');
  
  try {
    const { custom_fields, ...accountData } = req.body;
    
    const [result] = await db.execute(`
      INSERT INTO accounts (
        name, type, industry, revenue, company_name, employees, contact_fname, contact_lname, contact_email, contact_phone,
        billing_address, billing_city, billing_state, billing_zip, billing_country, website_url, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      accountData.account_name, accountData.account_type, accountData.industry, accountData.annual_revenue, accountData.company_name, accountData.employee_count,
      accountData.primary_contact_first_name, accountData.primary_contact_last_name, accountData.primary_contact_email, accountData.primary_contact_phone,
      accountData.billing_address_line1, accountData.billing_city, accountData.billing_state, accountData.billing_postal_code, accountData.billing_country,
      accountData.website, accountData.description
    ]);

    const accountId = result.insertId;
    await saveOrUpdateCustomFields(db, accountId, custom_fields);

    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);

    const description = generateDescription(t, 'created', { userName });
    
    await logAccountHistory(accountId, 'created', description, req.user.id, null, null, null, db);
    
    await db.execute('COMMIT');
    res.json({ id: accountId, message: 'Account created successfully' });
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error creating account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign product to account
router.post('/:id/products', authenticateToken, requireRole('user'), async (req, res) => {
  const { id: accountId } = req.params;
  const { product_id, quantity, unit_price, discount_percentage, status, purchase_date, notes } = req.body;

  let connection;

  try {
    connection = await getDb();
    await connection.beginTransaction();

    if (!product_id || !quantity || parseInt(quantity) <= 0) {
      throw new Error('A valid Product ID and a quantity greater than zero are required.');
    }

    const [productRows] = await connection.execute(
      'SELECT name, stock FROM products WHERE id = ? FOR UPDATE',
      [product_id]
    );

    if (productRows.length === 0) {
      throw new Error('Product not found.');
    }

    const currentStock = productRows[0].stock;
    const productName = productRows[0].name;

    if (currentStock < quantity) {
      throw new Error(`Insufficient stock for "${productName}". Only ${currentStock} available.`);
    }

    await connection.execute(
      'UPDATE products SET stock = stock - ? WHERE id = ?',
      [quantity, product_id]
    );

    const total_amount = (quantity * unit_price) * (1 - (discount_percentage || 0) / 100);

    const [result] = await connection.execute(
      `INSERT INTO account_products 
        (account_id, product_id, quantity, unit_price, discount_percentage, total_amount, status, purchase_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId, product_id, quantity, unit_price, discount_percentage, total_amount, status, purchase_date || null, notes]
    );

    const userName = req.user ? `${req.user.first_name} ${req.user.last_name}` : 'Unknown User';
    const userLanguage = req.user?.language || 'en';
    const t = i18next.getFixedT(userLanguage);

    const description = generateDescription(t, 'product_assigned', { 
      userName,
      productName,
      quantity 
    });

    await logAccountHistory(
      accountId,
      'product_assigned',
      description,
      req.user?.id || null,
      null, null, null,
      connection
    );

    // Add account to relevant sales campaigns if product has purchase_date
    if (purchase_date && status && ['delivered', 'completed', 'active'].includes(status)) {
      const [relevantSalesCampaigns] = await connection.execute(`
        SELECT id FROM campaigns
        WHERE status = 'active'
          AND campaign_type = 'account'
          AND goal_type = 'sales'
          AND auto_join = TRUE
          AND (
            is_open_campaign = TRUE
            OR (start_date IS NOT NULL AND end_date IS NOT NULL AND CURDATE() BETWEEN DATE(start_date) AND DATE(end_date))
          )
          AND NOT EXISTS (
            SELECT 1 FROM campaign_participants cp
            WHERE cp.campaign_id = campaigns.id
              AND cp.entity_type = 'account'
              AND cp.entity_id = ?
          )
      `, [accountId]);

      if (relevantSalesCampaigns.length > 0) {
        console.log(`Adding account ${accountId} to ${relevantSalesCampaigns.length} sales campaigns due to product purchase.`);
        for (const campaign of relevantSalesCampaigns) {
          await connection.execute(`
            INSERT INTO campaign_participants (campaign_id, entity_type, entity_id)
            VALUES (?, 'account', ?)
          `, [campaign.id, accountId]);

          await connection.execute(`
            INSERT INTO campaign_activities
            (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by, value_contributed)
            VALUES (?, 'account', ?, 'product_purchased', 'Account made a purchase and joined sales campaign', ?, ?)
          `, [campaign.id, accountId, req.user?.id || null, total_amount]);

          await connection.execute(`
            UPDATE accounts
            SET campaign_ids = JSON_ARRAY_APPEND(
              COALESCE(campaign_ids, JSON_ARRAY()),
              '$',
              ?
            )
            WHERE id = ? AND NOT JSON_CONTAINS(COALESCE(campaign_ids, JSON_ARRAY()), CAST(? AS CHAR), '$')
          `, [campaign.id, accountId, campaign.id]);

          // Calculate campaign progress to include this sale
          try {
            await CampaignGoalCalculator.calculateCampaignProgress(campaign.id);
          } catch (calcError) {
            console.error(`Error calculating campaign progress for campaign ${campaign.id}:`, calcError);
          }
        }
      }
    }

    await connection.commit();

    // TRIGGER CAMPAIGN GOAL CALCULATION - After successful commit
    try {
      await CampaignGoalCalculator.triggerGoalCalculation(
        'account', 
        accountId, 
        'product_assigned',
        {
          product_id,
          quantity,
          unit_price,
          total_amount,
          purchase_date,
          status
        }
      );
    } catch (calcError) {
      console.error('Error triggering goal calculation after product assignment:', calcError);
    }

    res.json({
      id: result.insertId,
      message: 'Product assigned and stock updated successfully',
      added_to_campaigns: purchase_date && status && ['delivered', 'completed', 'active'].includes(status) ? 'yes' : 'no'
    });

  } catch (error) {
    if (connection) await connection.rollback();
    let statusCode = 500;
    const errorMessage = error.message || 'Transaction failed. The product was not assigned.';
    if (
      errorMessage.includes('Insufficient stock') ||
      errorMessage.includes('Product not found') ||
      errorMessage.includes('required')
    ) {
      statusCode = 400;
    }
    if (!res.headersSent) {
      res.status(statusCode).json({ error: errorMessage });
    }
  }
});

// Get recipient count estimate for accounts
router.get('/count', async (req, res) => {
  try {
    const db = await getDb();
    const { filters } = req.query;
    let parsedFilters = [];
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filter format. Must be a valid JSON string.'
        });
      }
    }

    const {
      whereClause: filterWhere,
      havingClause: filterHaving,
      whereParams,
      havingParams,
      productDateFilter,
      productJoinCondition
    } = buildFilterClause(parsedFilters, 'accounts');

    const productJoinType = productDateFilter ? 'INNER JOIN' : 'LEFT JOIN';

    let productJoinParams = [];
    if (productDateFilter) {
      productJoinParams.push(productDateFilter.value);
    }

    const baseWhereCondition = `
      a.contact_email IS NOT NULL 
      AND a.contact_email != ''
      AND a.contact_email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'
    `;

    let countQuery;
    let countParams;

    if (filterHaving || productDateFilter) {
      countQuery = `
        SELECT COUNT(*) as count FROM (
          SELECT a.id,
                 CASE WHEN COUNT(ap.id) > 0 THEN 'yes' ELSE 'no' END as has_products,
                 COUNT(ap.id) as product_count,
                 COALESCE(SUM(ap.quantity * ap.unit_price), 0) as total_products_value,
                 GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as has_product_name,
                 MAX(ap.created_at) as product_created_date
          FROM accounts a
          ${productJoinType} account_products ap ON a.id = ap.account_id ${productJoinCondition}
          LEFT JOIN products p ON ap.product_id = p.id
          WHERE ${baseWhereCondition} ${filterWhere}
          GROUP BY a.id
          ${filterHaving}
        ) as filtered_accounts
      `;
      countParams = [...whereParams, ...productJoinParams, ...havingParams];
    } else {
      countQuery = `
        SELECT COUNT(*) as count 
        FROM accounts a
        WHERE ${baseWhereCondition} ${filterWhere}
      `;
      countParams = whereParams;
    }

    const [result] = await db.execute(countQuery, countParams);

    res.json({ success: true, count: result[0].count });
  } catch (error) {
    console.error('Error getting accounts count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get accounts count',
      details: error.message
    });
  }
});

// Update product assignment
router.put('/:accountId/products/:productAssignmentId', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { accountId, productAssignmentId } = req.params;
    const { product_id, quantity, unit_price, discount_percentage, status, purchase_date, notes } = req.body;
    
    const total_amount = (quantity * unit_price) * (1 - discount_percentage / 100);
    
    const db = await getDb();
    await db.execute('START TRANSACTION');
    
    const [currentAssignment] = await db.execute(`
      SELECT ap.*, p.name as product_name
      FROM account_products ap
      JOIN products p ON ap.product_id = p.id
      WHERE ap.id = ? AND ap.account_id = ?
    `, [productAssignmentId, accountId]);
    
    if (currentAssignment.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Product assignment not found' });
    }
    
    const oldAssignment = currentAssignment[0];
    
    const [result] = await db.execute(`
      UPDATE account_products 
      SET product_id = ?, quantity = ?, unit_price = ?, discount_percentage = ?, 
          total_amount = ?, status = ?, purchase_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND account_id = ?
    `, [
      product_id, quantity, unit_price, discount_percentage, 
      total_amount, status, purchase_date || null, notes, productAssignmentId, accountId
    ]);
    
    if (result.affectedRows === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Product assignment not found' });
    }
    
    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);
    let changes = [];
    
    if (oldAssignment.quantity !== quantity) {
      changes.push(`quantity from ${oldAssignment.quantity} to ${quantity}`);
    }
    if (oldAssignment.unit_price !== unit_price) {
      changes.push(`price from $${oldAssignment.unit_price} to $${unit_price}`);
    }
    if (oldAssignment.status !== status) {
      changes.push(`status from ${oldAssignment.status} to ${status}`);
    }
    if (oldAssignment.purchase_date !== purchase_date) {
      changes.push(`purchase date from ${oldAssignment.purchase_date || 'none'} to ${purchase_date || 'none'}`);
    }
    
    if (changes.length > 0) {
      const description = generateDescription(t, 'product_updated', {
        userName,
        productName: oldAssignment.product_name,
        changes: changes.join(', ')
      });

      await logAccountHistory(
        accountId,
        'product_updated',
        description,
        req.user.id
      );
    }

    // Check if account should be added to sales campaigns due to this update
    const hadValidPurchase = oldAssignment.purchase_date && ['delivered', 'completed', 'active'].includes(oldAssignment.status);
    const hasValidPurchase = purchase_date && ['delivered', 'completed', 'active'].includes(status);
    
    if (!hadValidPurchase && hasValidPurchase) {
      // Account now qualifies for sales campaigns
      const [relevantSalesCampaigns] = await db.execute(`
        SELECT id FROM campaigns
        WHERE status = 'active'
          AND campaign_type = 'account'
          AND goal_type = 'sales'
          AND auto_join = TRUE
          AND (
            is_open_campaign = TRUE
            OR (start_date IS NOT NULL AND end_date IS NOT NULL AND CURDATE() BETWEEN DATE(start_date) AND DATE(end_date))
          )
          AND NOT EXISTS (
            SELECT 1 FROM campaign_participants cp
            WHERE cp.campaign_id = campaigns.id
              AND cp.entity_type = 'account'
              AND cp.entity_id = ?
          )
      `, [accountId]);

      if (relevantSalesCampaigns.length > 0) {
        console.log(`Adding account ${accountId} to ${relevantSalesCampaigns.length} sales campaigns due to purchase date update.`);
        for (const campaign of relevantSalesCampaigns) {
          await db.execute(`
            INSERT INTO campaign_participants (campaign_id, entity_type, entity_id)
            VALUES (?, 'account', ?)
          `, [campaign.id, accountId]);

          await db.execute(`
            INSERT INTO campaign_activities
            (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by, value_contributed)
            VALUES (?, 'account', ?, 'product_updated', 'Account purchase confirmed and joined sales campaign', ?, ?)
          `, [campaign.id, accountId, req.user.id, total_amount]);

          await db.execute(`
            UPDATE accounts
            SET campaign_ids = JSON_ARRAY_APPEND(
              COALESCE(campaign_ids, JSON_ARRAY()),
              '$',
              ?
            )
            WHERE id = ? AND NOT JSON_CONTAINS(COALESCE(campaign_ids, JSON_ARRAY()), CAST(? AS CHAR), '$')
          `, [campaign.id, accountId, campaign.id]);

          await CampaignGoalCalculator.calculateCampaignProgress(campaign.id);
        }
      }
    }
    
    await db.execute('COMMIT');

    // TRIGGER CAMPAIGN GOAL CALCULATION
    try {
      await CampaignGoalCalculator.triggerGoalCalculation(
        'account', 
        accountId, 
        'product_updated',
        {
          product_id,
          old_values: oldAssignment,
          new_values: {
            quantity,
            unit_price,
            total_amount,
            status,
            purchase_date
          },
          changes
        }
      );
    } catch (calcError) {
      console.error('Error triggering goal calculation after product update:', calcError);
    }
    
    res.json({ 
      message: 'Product assignment updated successfully',
      total_amount: total_amount,
      added_to_campaigns: !hadValidPurchase && hasValidPurchase ? 'yes' : 'no'
    });
    
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error updating product assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete product assignment
router.delete('/:accountId/products/:productAssignmentId', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { accountId, productAssignmentId } = req.params;
    const db = await getDb();
    await db.execute('START TRANSACTION');
    
    const [assignmentToDelete] = await db.execute(`
      SELECT ap.*, p.name as product_name
      FROM account_products ap
      JOIN products p ON ap.product_id = p.id
      WHERE ap.id = ? AND ap.account_id = ?
    `, [productAssignmentId, accountId]);
    
    if (assignmentToDelete.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Product assignment not found' });
    }
    
    const productToRemove = assignmentToDelete[0];
    
    const [result] = await db.execute(
      'DELETE FROM account_products WHERE id = ? AND account_id = ?',
      [productAssignmentId, accountId]
    );
    
    if (result.affectedRows === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Product assignment not found' });
    }
    
    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);

    const description = generateDescription(t, 'product_removed', {
      userName,
      productName: productToRemove.product_name,
      quantity: productToRemove.quantity,
      unitPrice: productToRemove.unit_price
    });
    
    await logAccountHistory(
      accountId,
      'product_removed',
      description,
      req.user.id
    );

    // Log the removal in campaign activities if this was contributing to sales campaigns
    if (productToRemove.purchase_date && ['delivered', 'completed', 'active'].includes(productToRemove.status)) {
      const [activeSalesCampaigns] = await db.execute(`
        SELECT cp.campaign_id, c.name as campaign_name
        FROM campaign_participants cp
        JOIN campaigns c ON cp.campaign_id = c.id
        WHERE cp.entity_type = 'account' 
          AND cp.entity_id = ? 
          AND cp.status = 'active'
          AND c.status = 'active'
          AND c.campaign_type = 'account'
          AND c.goal_type = 'sales'
      `, [accountId]);

      for (const campaign of activeSalesCampaigns) {
        await db.execute(`
          INSERT INTO campaign_activities
          (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by, value_contributed)
          VALUES (?, 'account', ?, 'product_removed', 'Product sale removed from account', ?, ?)
        `, [campaign.campaign_id, accountId, req.user.id, -productToRemove.total_amount]);
      }
    }
    
    await db.execute('COMMIT');

    // TRIGGER CAMPAIGN GOAL CALCULATION
    try {
      await CampaignGoalCalculator.triggerGoalCalculation(
        'account', 
        accountId, 
        'product_removed',
        {
          removed_product: productToRemove
        }
      );
    } catch (calcError) {
      console.error('Error triggering goal calculation after product removal:', calcError);
    }
    
    res.json({ 
      success: true,
      message: 'Product assignment removed successfully',
      removed_value: productToRemove.total_amount
    });
    
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error deleting product assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific product assignment
router.get('/:accountId/products/:productAssignmentId', authenticateToken, async (req, res) => {
  try {
    const { accountId, productAssignmentId } = req.params;
    const db = await getDb();
    
const [rows] = await db.execute(`
  SELECT 
    ap.id, ap.account_id, ap.product_id, ap.quantity, ap.unit_price, ap.discount_percentage, ap.total_amount, 
    ap.status, ap.purchase_date, ap.notes, ap.created_at, ap.updated_at, p.name as product_name, p.sku as product_code,
    p.category as product_category, p.description as product_description
  FROM account_products ap
  JOIN products p ON ap.product_id = p.id
  WHERE ap.id = ? AND ap.account_id = ?
`, [productAssignmentId, accountId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product assignment not found' });
    }
    
    res.json(rows[0]);
    
  } catch (error) {
    console.error('Error fetching product assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tasks related to a specific account (keep this for backward compatibility if needed)
router.get('/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [tasks] = await db.execute(`
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.account_id = ?
      ORDER BY t.created_at DESC
    `, [id]);
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching account tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy search endpoint - now redirects to main endpoint with search param
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Redirect to main endpoint with search parameter
    req.query.search = q;
    delete req.query.q;
    
    // Call the main GET handler
    return router.stack.find(layer => 
      layer.route?.path === '/' && layer.route?.methods.get
    ).route.stack[0].handle(req, res);

  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update account
router.put('/:id', authenticateToken, requireRole('user'), applyChainRulesMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { custom_fields, ...standardUpdates } = updates;
  const db = await getDb();
  await db.execute('START TRANSACTION');
  
  try {
    const [currentAccount] = await db.execute('SELECT * FROM accounts WHERE id = ?', [id]);
    
    if (currentAccount.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const oldAccount = mapAccountFromRemote(currentAccount[0]);
    const changes = [];
    
    // Process standard field updates
    const fieldMapping = {
      account_name: 'name', account_type: 'type', industry: 'industry', 
      annual_revenue: 'revenue', employee_count: 'employees', company_name: 'company_name',
      primary_contact_first_name: 'contact_fname', primary_contact_last_name: 'contact_lname', 
      primary_contact_email: 'contact_email', primary_contact_phone: 'contact_phone', 
      billing_address_line1: 'billing_address', billing_city: 'billing_city',
      billing_state: 'billing_state', billing_postal_code: 'billing_zip', 
      billing_country: 'billing_country', website: 'website_url', description: 'description'
    };
    
    const updateFields = [];
    const updateValues = [];
    
    for (const [frontendField, dbField] of Object.entries(fieldMapping)) {
      if (standardUpdates.hasOwnProperty(frontendField)) {
        const oldValue = oldAccount[frontendField];
        const newValue = standardUpdates[frontendField];
        
        if (oldValue !== newValue) {
          updateFields.push(`${dbField} = ?`);
          updateValues.push(newValue);
          changes.push({
            field_name: frontendField,
            old_value: oldValue,
            new_value: newValue
          });
        }
      }
    }

    // Handle custom fields
    await saveOrUpdateCustomFields(db, id, custom_fields);

    // Update standard fields if there are changes
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);
      
      await db.execute(
        `UPDATE accounts SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    const hasChanges = updateFields.length > 0 || (custom_fields && Object.keys(custom_fields).length > 0);
    
    if (!hasChanges) {
      await db.execute('COMMIT');
      return res.json({ message: 'No changes to update' });
    }

    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);
    
    // Log standard field changes
    for (const change of changes) {
      const actionType = change.field_name === 'status' ? 'status_changed' : 'updated';
      const description = generateDescription(
        t, 
        actionType, 
        {
          userName,
          fieldName: change.field_name,
          oldValue: change.old_value,
          newValue: change.new_value
        }
      );

      await logAccountHistory(
        id,
        actionType,
        description,
        req.user.id,
        change.field_name,
        change.old_value,
        change.new_value,
        db
      );
    }

    // Log custom fields update if no standard field changes but custom fields were updated
    if (changes.length === 0 && custom_fields && Object.keys(custom_fields).length > 0) {
      const description = generateDescription(t, 'updated', { userName });
      await logAccountHistory(
        id,
        'updated',
        description,
        req.user.id,
        null,
        null,
        null,
        db
      );
    }

    await db.execute('COMMIT');
    res.json({ 
      message: 'Account updated successfully',
      changes_count: changes.length
    });
    
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error updating account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete account
router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  
  // Start a transaction to ensure all or nothing is deleted
  await db.execute('START TRANSACTION');

  try {
    const [accountToDelete] = await db.execute('SELECT * FROM accounts WHERE id = ?', [id]);
    
    if (accountToDelete.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
        
    // 1. Find associated documents
    const [docsToDelete] = await db.execute(
      `SELECT id, file_path FROM docs WHERE related_to_entity = 'account' AND related_to_id = ?`,
      [id]
    );

    if (docsToDelete.length > 0) {
      for (const doc of docsToDelete) {
        try {
          await fs.unlink(doc.file_path);
        } catch (fileError) {
          console.error(`Could not delete file ${doc.file_path}:`, fileError.message);
        }
      }

      // 3. Delete document records from the database
      const docIds = docsToDelete.map(d => d.id);
      await db.execute(`DELETE FROM docs WHERE id IN (${docIds.map(() => '?').join(',')})`, docIds);
    }
        
    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);

    const description = generateDescription(t, 'deleted', { userName });
    await logAccountHistory(id, 'deleted', description, req.user.id);
    
    // 4. Delete all relationships associated with this account
    await db.execute(
      `DELETE FROM relationships 
       WHERE (entity_type = 'account' AND entity_id = ?) 
          OR (related_type = 'account' AND related_id = ?)`,
      [id, id]
    );

    // 5. Delete the account itself
    const [result] = await db.execute('DELETE FROM accounts WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Account could not be deleted' });
    }
    
    await db.execute('COMMIT');

    res.json({ 
      success: true, 
      deletedId: id,
      message: 'Account, associated relationships, and documents deleted successfully'
    });

  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error deleting account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const accountId = req.params.id;
    const db = await getDb();
    
    const [accountRows] = await db.execute('SELECT id FROM accounts WHERE id = ?', [accountId]);
    
    if (accountRows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const [history] = await db.execute(`
      SELECT 
        ah.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM account_history ah 
      LEFT JOIN users u ON ah.user_id = u.id
      WHERE ah.account_id = ? 
      ORDER BY ah.created_at DESC
    `, [accountId]);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching account history:', error);
    res.status(500).json({ error: 'Failed to fetch account history' });
  }
});

// Get single account by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [accounts] = await db.execute('SELECT * FROM accounts WHERE id = ?', [id]);
    
    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accounts[0];

    // Fetch assigned products
const [accountProducts] = await db.execute(`
  SELECT 
    ap.id, ap.account_id, ap.product_id, ap.quantity, ap.unit_price, ap.discount_percentage, ap.created_at, ap.updated_at,
    ap.total_amount, ap.status, ap.purchase_date, ap.notes, p.name as product_name, p.sku as product_code,
    p.category as product_category, p.description as product_description
  FROM account_products ap
  JOIN products p ON ap.product_id = p.id
  WHERE ap.account_id = ?
  ORDER BY ap.id DESC
`, [id]);

    // Fetch tasks
    const [accountTasks] = await db.execute(`
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.account_id = ?
      ORDER BY t.created_at DESC
    `, [id]);

    // Fetch call counts
    const [callCounts] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent
      FROM account_calls 
      WHERE account_id = ?
    `, [id]);

    // Fetch custom fields
    const customFieldsByAccount = await fetchCustomFieldsForAccounts(db, [id]);
    const custom_fields = customFieldsByAccount[id] || [];

    // Process assigned products
const assignedProducts = accountProducts.map(product => ({
  id: product.id,
  product_id: product.product_id,
  quantity: product.quantity,
  unit_price: product.unit_price,
  discount_percentage: product.discount_percentage,
  total_amount: product.total_amount,
  status: product.status,
  purchase_date: product.purchase_date,
  notes: product.notes,
  product_name: product.product_name,
  product_code: product.product_code,
  product_category: product.product_category,
  product_description: product.product_description
}));

    // Calculate task counts
    const now = new Date();
    const taskCounts = {
      total: accountTasks.length,
      pending: accountTasks.filter(t => t.task_status === 'pending').length,
      overdue: accountTasks.filter(t => {
        const deadline = new Date(t.deadline_date);
        return deadline < now && !['completed', 'cancelled'].includes(t.task_status);
      }).length,
      completed: accountTasks.filter(t => t.task_status === 'completed').length,
      cancelled: accountTasks.filter(t => t.task_status === 'cancelled').length
    };

    // Map account with related data including custom fields
    const mappedAccount = {
      ...mapAccountFromRemote(account),
      assigned_products: assignedProducts,
      tasks: accountTasks,
      task_counts: taskCounts,
      call_counts: {
        total: callCounts[0]?.total || 0,
        recent: callCounts[0]?.recent || 0
      },
      custom_fields: custom_fields
    };
    
    res.json(mappedAccount);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/recalculate-campaigns', authenticateToken, async (req, res) => {
  try {
    const { id: accountId } = req.params;
    const db = await getDb();
    
    // Check if account exists
    const [account] = await db.execute('SELECT id FROM accounts WHERE id = ?', [accountId]);
    if (account.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Find all active campaigns this account participates in
    const [campaigns] = await db.execute(`
      SELECT DISTINCT cp.campaign_id, c.name as campaign_name
      FROM campaign_participants cp
      JOIN campaigns c ON cp.campaign_id = c.id
      WHERE cp.entity_type = 'account' AND cp.entity_id = ? 
        AND cp.status = 'active' AND c.status = 'active'
    `, [accountId]);
    
    let updatedCampaigns = [];
    
    for (const campaign of campaigns) {
      try {
        await CampaignGoalCalculator.calculateCampaignProgress(campaign.campaign_id);
        updatedCampaigns.push({
          id: campaign.campaign_id,
          name: campaign.campaign_name,
          status: 'updated'
        });
      } catch (error) {
        console.error(`Error updating campaign ${campaign.campaign_id}:`, error);
        updatedCampaigns.push({
          id: campaign.campaign_id,
          name: campaign.campaign_name,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Recalculated ${campaigns.length} campaigns for account ${accountId}`,
      updated_campaigns: updatedCampaigns
    });
    
  } catch (error) {
    console.error('Error recalculating campaigns for account:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};