const express = require('express');

module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

  // Helper function to map invoice from database
  const mapInvoiceFromRemote = (row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    issue_date: row.issue_date,
    due_date: row.due_date,
    subtotal: parseFloat(row.subtotal || 0),
    tax_rate: parseFloat(row.tax_rate || 0),
    tax_amount: parseFloat(row.tax_amount || 0),
    discount_amount: parseFloat(row.discount_amount || 0),
    total_amount: parseFloat(row.total_amount || 0),
    paid_amount: parseFloat(row.paid_amount || 0),
    currency_totals: row.currency_totals ? JSON.parse(row.currency_totals) : null,
    status: row.status,
    notes: row.notes,
    terms: row.terms,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by
  });

  const mapInvoiceItemFromRemote = (row) => ({
    id: row.id,
    invoice_id: row.invoice_id,
    product_id: row.product_id,
    product_code: row.product_code,
    product_name: row.product_name,
    description: row.description,
    quantity: parseFloat(row.quantity || 0),
    unit_price: parseFloat(row.unit_price || 0),
    discount_percent: parseFloat(row.discount_percent || 0),
    discount_amount: parseFloat(row.discount_amount || 0),
    tax_rate: parseFloat(row.tax_rate || 0),
    tax_amount: parseFloat(row.tax_amount || 0),
    line_total: parseFloat(row.line_total || 0),
    currency: row.currency || 'USD',
    sort_order: row.sort_order
  });

  // Helper function to calculate totals by currency
  const calculateCurrencyTotals = (items, invoiceDiscountAmount = 0, invoiceTaxRate = 0) => {
    const currencyTotals = {};
    
    // Calculate item totals per currency
    items.forEach(item => {
      const currency = item.currency || 'USD';
      if (!currencyTotals[currency]) {
        currencyTotals[currency] = { 
          subtotal: 0,
          itemDiscounts: 0,
          itemTaxes: 0,
          subtotalAfterItemAdjustments: 0
        };
      }
      
      const quantity = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unit_price || 0);
      const discountPercent = parseFloat(item.discount_percent || 0);
      const itemTaxRate = parseFloat(item.tax_rate || 0);
      
      const itemSubtotal = quantity * unitPrice;
      const itemDiscount = (itemSubtotal * discountPercent) / 100;
      const itemTaxableAmount = itemSubtotal - itemDiscount;
      const itemTax = (itemTaxableAmount * itemTaxRate) / 100;
      
      currencyTotals[currency].subtotal += itemSubtotal;
      currencyTotals[currency].itemDiscounts += itemDiscount;
      currencyTotals[currency].itemTaxes += itemTax;
      currencyTotals[currency].subtotalAfterItemAdjustments += itemTaxableAmount;
    });

    // Apply invoice-level discount and tax proportionally
    const totalSubtotalAllCurrencies = Object.values(currencyTotals)
      .reduce((sum, ct) => sum + ct.subtotalAfterItemAdjustments, 0);

    const results = {};
    Object.keys(currencyTotals).forEach(currency => {
      const data = currencyTotals[currency];
      
      // Distribute invoice discount proportionally
      const proportion = totalSubtotalAllCurrencies > 0 
        ? data.subtotalAfterItemAdjustments / totalSubtotalAllCurrencies 
        : 0;
      const currencyInvoiceDiscount = invoiceDiscountAmount * proportion;
      
      const afterInvoiceDiscount = data.subtotalAfterItemAdjustments - currencyInvoiceDiscount;
      const currencyInvoiceTax = (afterInvoiceDiscount * invoiceTaxRate) / 100;
      const total = afterInvoiceDiscount + currencyInvoiceTax + data.itemTaxes;

      results[currency] = {
        subtotal: data.subtotal,
        itemDiscounts: data.itemDiscounts,
        itemTaxes: data.itemTaxes,
        invoiceDiscount: currencyInvoiceDiscount,
        invoiceTax: currencyInvoiceTax,
        total: total
      };
    });

    return results;
  };

  // GET all invoices with pagination and filtering
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const db = await getDb();
      const {
        page = 1,
        limit = 20,
        status,
        entity_type,
        search = ''
      } = req.query;

      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      const offset = (pageNumber - 1) * limitNumber;

      let whereConditions = [];
      let queryParams = [];

      if (status) {
        whereConditions.push('i.status = ?');
        queryParams.push(status);
      }

      if (entity_type) {
        whereConditions.push('i.entity_type = ?');
        queryParams.push(entity_type);
      }

      if (search) {
        whereConditions.push('(i.invoice_number LIKE ? OR i.entity_name LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ') 
        : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM invoices i ${whereClause}`;
      const [countResult] = await db.execute(countQuery, queryParams);
      const totalItems = countResult[0].total;

      // Get invoices with entity details
      const query = `
        SELECT 
          i.*,
          CASE 
            WHEN i.entity_type = 'lead' THEN CONCAT(COALESCE(l.fname, ''), ' ', COALESCE(l.lname, ''))
            WHEN i.entity_type = 'account' THEN a.name
            ELSE i.entity_name
          END as entity_name
        FROM invoices i
        LEFT JOIN leads l ON i.entity_type = 'lead' AND i.entity_id = l.id
        LEFT JOIN accounts a ON i.entity_type = 'account' AND i.entity_id = a.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await db.execute(query, [...queryParams, limitNumber, offset]);
      const invoices = rows.map(mapInvoiceFromRemote);

      const totalPages = Math.ceil(totalItems / limitNumber);

      res.json({
        data: invoices,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          total: totalItems,
          limit: limitNumber,
          hasNext: pageNumber < totalPages,
          hasPrev: pageNumber > 1
        }
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET single invoice with items
  router.get('/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const db = await getDb();

      // Get invoice with entity details
      const [invoiceRows] = await db.execute(`
        SELECT 
          i.*,
          CASE 
            WHEN i.entity_type = 'lead' THEN CONCAT(COALESCE(l.fname, ''), ' ', COALESCE(l.lname, ''))
            WHEN i.entity_type = 'account' THEN a.name
            ELSE i.entity_name
          END as entity_name,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.email_address
            WHEN i.entity_type = 'account' THEN a.contact_email
            ELSE NULL
          END as entity_email,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.phone_number
            WHEN i.entity_type = 'account' THEN a.contact_phone
            ELSE NULL
          END as entity_phone,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.address
            WHEN i.entity_type = 'account' THEN a.billing_address
            ELSE NULL
          END as entity_address,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.city
            WHEN i.entity_type = 'account' THEN a.billing_city
            ELSE NULL
          END as entity_city,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.state
            WHEN i.entity_type = 'account' THEN a.billing_state
            ELSE NULL
          END as entity_state,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.zip_code
            WHEN i.entity_type = 'account' THEN a.billing_zip
            ELSE NULL
          END as entity_zip,
          CASE 
            WHEN i.entity_type = 'lead' THEN l.country
            WHEN i.entity_type = 'account' THEN a.billing_country
            ELSE NULL
          END as entity_country
        FROM invoices i
        LEFT JOIN leads l ON i.entity_type = 'lead' AND i.entity_id = l.id
        LEFT JOIN accounts a ON i.entity_type = 'account' AND i.entity_id = a.id
        WHERE i.id = ?
      `, [id]);

      if (invoiceRows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = mapInvoiceFromRemote(invoiceRows[0]);
      invoice.entity_email = invoiceRows[0].entity_email;
      invoice.entity_phone = invoiceRows[0].entity_phone;
      invoice.entity_address = invoiceRows[0].entity_address;
      invoice.entity_city = invoiceRows[0].entity_city;
      invoice.entity_state = invoiceRows[0].entity_state;
      invoice.entity_zip = invoiceRows[0].entity_zip;
      invoice.entity_country = invoiceRows[0].entity_country;

      // Get invoice items
      const [itemRows] = await db.execute(`
        SELECT * FROM invoice_items 
        WHERE invoice_id = ? 
        ORDER BY sort_order
      `, [id]);

      invoice.items = itemRows.map(mapInvoiceItemFromRemote);

      res.json(invoice);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST create new invoice
  router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
    try {
      const {
        entity_type,
        entity_id,
        issue_date,
        due_date,
        tax_rate,
        discount_amount,
        notes,
        terms,
        items = []
      } = req.body;

      // Validate required fields
      if (!entity_type || !entity_id || !issue_date || !due_date || items.length === 0) {
        return res.status(400).json({ 
          error: 'Entity type, entity ID, dates, and at least one item are required' 
        });
      }

      const db = await getDb();

      // Validate entity exists and get name
      let entityName;
      if (entity_type === 'lead') {
        const [leadRows] = await db.execute(
          `SELECT CONCAT(COALESCE(fname, ''), ' ', COALESCE(lname, '')) as name FROM leads WHERE id = ?`,
          [entity_id]
        );
        if (leadRows.length === 0) {
          return res.status(404).json({ error: 'Lead not found' });
        }
        entityName = leadRows[0].name;
      } else if (entity_type === 'account') {
        const [accountRows] = await db.execute(
          `SELECT name FROM accounts WHERE id = ?`,
          [entity_id]
        );
        if (accountRows.length === 0) {
          return res.status(404).json({ error: 'Account not found' });
        }
        entityName = accountRows[0].name;
      } else {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      // Generate invoice number
      const [lastInvoice] = await db.execute(
        'SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1'
      );
      
      let invoiceNumber;
      if (lastInvoice.length > 0) {
        const lastNum = parseInt(lastInvoice[0].invoice_number.replace('INV-', ''));
        invoiceNumber = `INV-${String(lastNum + 1).padStart(6, '0')}`;
      } else {
        invoiceNumber = 'INV-000001';
      }

      // Process items with currency support
      let subtotal = 0;
      const processedItems = items.map((item, index) => {
        const quantity = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unit_price || 0);
        const discountPercent = parseFloat(item.discount_percent || 0);
        const itemTaxRate = parseFloat(item.tax_rate || 0);
        const currency = item.currency || 'USD';

        const itemSubtotal = quantity * unitPrice;
        const itemDiscountAmount = (itemSubtotal * discountPercent) / 100;
        const itemTaxableAmount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = (itemTaxableAmount * itemTaxRate) / 100;
        const lineTotal = itemTaxableAmount + itemTaxAmount;

        subtotal += itemSubtotal;

        return {
          product_id: item.product_id || null,
          product_code: item.product_code || '',
          product_name: item.product_name || '',
          description: item.description || '',
          quantity,
          unit_price: unitPrice,
          discount_percent: discountPercent,
          discount_amount: itemDiscountAmount,
          tax_rate: itemTaxRate,
          tax_amount: itemTaxAmount,
          line_total: lineTotal,
          currency: currency,
          sort_order: index
        };
      });

      // Calculate currency totals
      const invoiceDiscountAmount = parseFloat(discount_amount || 0);
      const invoiceTaxRate = parseFloat(tax_rate || 0);
      const currencyTotals = calculateCurrencyTotals(processedItems, invoiceDiscountAmount, invoiceTaxRate);

      // For backward compatibility, use first currency's total as main total
      const firstCurrency = Object.keys(currencyTotals)[0];
      const taxableAmount = subtotal - invoiceDiscountAmount;
      const taxAmount = (taxableAmount * invoiceTaxRate) / 100;
      const totalAmount = taxableAmount + taxAmount;

      // Insert invoice with currency_totals JSON
      const invoiceParams = [
        invoiceNumber,
        entity_type,
        entity_id,
        entityName,
        issue_date,
        due_date,
        subtotal,
        invoiceTaxRate,
        taxAmount,
        invoiceDiscountAmount,
        totalAmount,
        0, // paid_amount
        'draft', // status
        JSON.stringify(currencyTotals),
        notes || null,
        terms || null,
        req.user?.userId || req.user?.id || null
      ];

      // Check for undefined values
      const hasUndefined = invoiceParams.some(param => param === undefined);
      if (hasUndefined) {
        console.error('CRITICAL: Undefined parameter detected in invoice insert');
        console.error('Parameters:', invoiceParams);
        return res.status(500).json({ 
          error: 'Internal error: Invalid parameters. Please contact support.' 
        });
      }

      // Insert invoice
      const [invoiceResult] = await db.execute(`
        INSERT INTO invoices (
          invoice_number, entity_type, entity_id, entity_name,
          issue_date, due_date, subtotal, tax_rate, tax_amount,
          discount_amount, total_amount, paid_amount, status,
          currency_totals, notes, terms, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, invoiceParams);

      const invoiceId = invoiceResult.insertId;

      // Insert invoice items with currency
      for (const item of processedItems) {
        const itemParams = [
          invoiceId,
          item.product_id,
          item.product_code,
          item.product_name,
          item.description,
          item.quantity,
          item.unit_price,
          item.discount_percent,
          item.discount_amount,
          item.tax_rate,
          item.tax_amount,
          item.line_total,
          item.currency,
          item.sort_order
        ];

        const itemHasUndefined = itemParams.some(param => param === undefined);
        if (itemHasUndefined) {
          console.error('CRITICAL: Undefined parameter in invoice item');
          console.error('Item params:', itemParams);
          await db.execute('DELETE FROM invoices WHERE id = ?', [invoiceId]);
          return res.status(500).json({ 
            error: 'Internal error: Invalid item parameters' 
          });
        }

        await db.execute(`
          INSERT INTO invoice_items (
            invoice_id, product_id, product_code, product_name,
            description, quantity, unit_price, discount_percent,
            discount_amount, tax_rate, tax_amount, line_total, currency, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, itemParams);
      }

      res.status(201).json({ 
        id: invoiceId, 
        invoice_number: invoiceNumber,
        currency_totals: currencyTotals,
        message: 'Invoice created successfully' 
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      console.error('Request body:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ error: error.message });
    }
  });

  // PUT update invoice
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      issue_date,
      due_date,
      tax_rate = 0,
      discount_amount = 0,
      status,
      notes,
      terms,
      items = []
    } = req.body;

    const db = await getDb();

    // Check if invoice exists and get current status
    const [existing] = await db.execute('SELECT id, status, total_amount FROM invoices WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Process items with currency support
    let subtotal = 0;
    const processedItems = items.map((item, index) => {
      const quantity = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unit_price || 0);
      const discountPercent = parseFloat(item.discount_percent || 0);
      const itemTaxRate = parseFloat(item.tax_rate || 0);
      const currency = item.currency || 'USD';

      const itemSubtotal = quantity * unitPrice;
      const itemDiscountAmount = (itemSubtotal * discountPercent) / 100;
      const itemTaxableAmount = itemSubtotal - itemDiscountAmount;
      const itemTaxAmount = (itemTaxableAmount * itemTaxRate) / 100;
      const lineTotal = itemTaxableAmount + itemTaxAmount;

      subtotal += itemSubtotal;

      return {
        ...item,
        quantity,
        unit_price: unitPrice,
        discount_percent: discountPercent,
        discount_amount: itemDiscountAmount,
        tax_rate: itemTaxRate,
        tax_amount: itemTaxAmount,
        line_total: lineTotal,
        currency: currency,
        sort_order: index
      };
    });

    // Calculate currency totals
    const invoiceDiscountAmount = parseFloat(discount_amount || 0);
    const invoiceTaxRate = parseFloat(tax_rate || 0);
    const currencyTotals = calculateCurrencyTotals(processedItems, invoiceDiscountAmount, invoiceTaxRate);

    const taxableAmount = subtotal - invoiceDiscountAmount;
    const taxAmount = (taxableAmount * invoiceTaxRate) / 100;
    const totalAmount = taxableAmount + taxAmount;

    // Determine paid_amount based on status
    let paidAmount = 0;
    if (status === 'paid') {
      paidAmount = totalAmount;
    }

    // Update invoice
    await db.execute(`
      UPDATE invoices 
      SET issue_date = ?, due_date = ?, subtotal = ?, tax_rate = ?,
          tax_amount = ?, discount_amount = ?, total_amount = ?,
          status = ?, paid_amount = ?, currency_totals = ?, notes = ?, terms = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      issue_date, due_date, subtotal, invoiceTaxRate,
      taxAmount, invoiceDiscountAmount, totalAmount,
      status, paidAmount, JSON.stringify(currencyTotals), notes, terms, id
    ]);

    // Delete old items
    await db.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

    // Insert new items
    for (const item of processedItems) {
      await db.execute(`
        INSERT INTO invoice_items (
          invoice_id, product_id, product_code, product_name,
          description, quantity, unit_price, discount_percent,
          discount_amount, tax_rate, tax_amount, line_total, currency, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, item.product_id, item.product_code, item.product_name,
        item.description, item.quantity, item.unit_price, item.discount_percent,
        item.discount_amount, item.tax_rate, item.tax_amount, item.line_total,
        item.currency, item.sort_order
      ]);
    }

    res.json({ 
      message: 'Invoice updated successfully',
      currency_totals: currencyTotals
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH update invoice status
  router.patch('/:id/status', authenticateToken, requireRole('user'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const db = await getDb();
      
      if (status === 'paid') {
        const [invoiceRows] = await db.execute(
          'SELECT total_amount FROM invoices WHERE id = ?',
          [id]
        );
        
        if (invoiceRows.length === 0) {
          return res.status(404).json({ error: 'Invoice not found' });
        }
        
        const totalAmount = invoiceRows[0].total_amount;
        
        await db.execute(
          'UPDATE invoices SET status = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, totalAmount, id]
        );
      } else {
        // For other status changes, reset paid_amount to 0
        const [result] = await db.execute(
          'UPDATE invoices SET status = ?, paid_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, id]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Invoice not found' });
        }
      }

      res.json({ message: 'Invoice status updated successfully' });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE invoice
  router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { id } = req.params;
      const db = await getDb();

      await db.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

      // Delete invoice
      const [result] = await db.execute('DELETE FROM invoices WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.json({ 
        success: true, 
        message: 'Invoice deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};