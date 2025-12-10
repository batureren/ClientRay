// utils/databaseSchema.js - Database table creation utilities

async function createRemoteTables(db) {
  const createQueries = [
    // Users table - Updated to match database structure
    `CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  role ENUM('user', 'manager', 'admin') DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  profile_picture VARCHAR(255),
  language VARCHAR(5) DEFAULT 'en',
  last_login TIMESTAMP NULL,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expires TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_active (is_active)
)`,
    `CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notes_grid_width INT DEFAULT 1200,
    notes_grid_height INT DEFAULT 800,
    shared_notes_grid_width INT DEFAULT 1200,
    shared_notes_grid_height INT DEFAULT 800,
    notes_view_mode ENUM('grid', 'list') DEFAULT 'grid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_preferences (user_id)
)`,

    // Accounts table
    `CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) DEFAULT 'prospect',
      industry VARCHAR(100),
      revenue DECIMAL(15,2),
      company_name VARCHAR(255),
      employees INT,
      contact_fname VARCHAR(100),
      contact_lname VARCHAR(100),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      billing_address VARCHAR(255),
      billing_city VARCHAR(100),
      billing_state VARCHAR(100),
      billing_zip VARCHAR(20),
      billing_country VARCHAR(100),
      website_url VARCHAR(255),
      description TEXT,
      campaign_ids JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Leads table
    `CREATE TABLE IF NOT EXISTS leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fname VARCHAR(100),
      lname VARCHAR(100),
      email_address VARCHAR(255) UNIQUE,
      phone_number VARCHAR(50),
      company_name VARCHAR(255),
      address VARCHAR(255),
      city VARCHAR(100),
      state VARCHAR(100),
      zip_code VARCHAR(20),
      country VARCHAR(100),
      website_url VARCHAR(255),
      source VARCHAR(100),
      comments TEXT,
      lead_status VARCHAR(50) DEFAULT 'new',
      converted_account_id INT NULL,
      webhook_event_id INT NULL,
      campaign_ids JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (converted_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      INDEX idx_leads_created_at (created_at DESC),
      INDEX idx_leads_phone (phone_number),
      INDEX idx_leads_company (company_name),
      INDEX idx_leads_source (source),
      INDEX idx_leads_status (lead_status),
      INDEX idx_leads_location (city, state),
      INDEX idx_leads_status_created (lead_status, created_at DESC),
      INDEX idx_leads_source_created (source, created_at DESC),
      INDEX idx_leads_covering (lead_status, source, created_at DESC, fname, lname, email_address, phone_number),
      FULLTEXT KEY idx_leads_fulltext (fname, lname, email_address, company_name, comments)
    )`,

        `CREATE TABLE IF NOT EXISTS docs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(100),
      file_size INT,
      related_to_entity VARCHAR(50), -- 'lead' or 'account'
      related_to_id INT,
      uploaded_by_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_docs_related_to (related_to_entity, related_to_id)
    )`,

    // Products table
    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      price DECIMAL(10,2),
      cost DECIMAL(10,2),
      currency VARCHAR(10) DEFAULT 'USD',
      description TEXT,
      specs TEXT,
      active BOOLEAN DEFAULT TRUE,
      stock INT DEFAULT 0,
      reorder_point INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Account Products
    `CREATE TABLE IF NOT EXISTS account_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT,
      product_id INT,
      quantity INT DEFAULT 1,
      unit_price DECIMAL(10,2),
      discount_percentage DECIMAL(5,2) DEFAULT 0,
      total_amount DECIMAL(12,2),
      status VARCHAR(50) DEFAULT 'quoted',
      purchase_date DATE NULL,
      notes TEXT,
      INDEX idx_account_products_purchase_date (account_id, purchase_date, status),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,

    // Lead History Table
    `CREATE TABLE IF NOT EXISTS lead_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      user_id INT NULL,
      user_name VARCHAR(255) NULL,
      action_type VARCHAR(50) NOT NULL,
      field_name VARCHAR(100) NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lead_id (lead_id),
      INDEX idx_created_at (created_at)
    )`,

    // Account History Table
    `CREATE TABLE IF NOT EXISTS account_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      user_id INT,
      field_name VARCHAR(100),
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_account_id (account_id),
      INDEX idx_created_at (created_at),
      INDEX idx_action_type (action_type),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,

    // Tasks Table
    `CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_name VARCHAR(255) NOT NULL,
      task_description TEXT NOT NULL,
      task_priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
      task_status ENUM('pending', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
      deadline_date DATETIME NOT NULL,
      assigned_to INT NOT NULL,
      created_by INT NOT NULL,
      lead_id INT NULL,
      account_id INT NULL,
      project_id INT NULL,
      completed_at DATETIME NULL,
      has_multiple_assignees BOOLEAN DEFAULT FALSE,
      is_recurring BOOLEAN DEFAULT FALSE,
      recurrence_pattern VARCHAR(50) NULL,
      recurrence_interval INT DEFAULT 1,
      recurrence_end_date DATETIME NULL,
      parent_recurring_task_id INT NULL,
      next_occurrence DATETIME NULL,
      INDEX idx_next_occurrence (next_occurrence),
      INDEX idx_parent_recurring (parent_recurring_task_id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      INDEX idx_assigned_to (assigned_to),
      INDEX idx_lead_id (lead_id),
      INDEX idx_account_id (account_id),
      INDEX idx_task_status (task_status),
      INDEX idx_deadline_date (deadline_date),
      INDEX idx_created_at (created_at),
      INDEX idx_has_multiple_assignees (has_multiple_assignees),
      INDEX idx_updated_at (updated_at),
      CONSTRAINT fk_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  project_description TEXT,
  project_status ENUM('active', 'completed', 'on_hold', 'cancelled') NOT NULL DEFAULT 'active',
  parent_project_id INT NULL DEFAULT NULL,
  owner_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_project FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE SET NULL
)`,

`CREATE TABLE IF NOT EXISTS project_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('viewer', 'editor') NOT NULL DEFAULT 'viewer',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_project_user (project_id, user_id)
)`,
    // Saved Reports
    `CREATE TABLE IF NOT EXISTS saved_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_name VARCHAR(255) NOT NULL,
      report_type ENUM('leads', 'accounts', 'calls') NOT NULL,
      created_by INT NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      filters JSON NOT NULL,
      selected_fields JSON NOT NULL,
      is_public BOOLEAN DEFAULT TRUE,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_report_type (report_type),
      INDEX idx_created_by (created_by),
      INDEX idx_is_public (is_public),
      INDEX idx_created_at (created_at)
    )`,

    // Task Comments
    `CREATE TABLE IF NOT EXISTS task_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      user_id INT NOT NULL,
      content TEXT NOT NULL,
      mentions JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_task_id (task_id),
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    )`,

    // Task Assignees
    `CREATE TABLE IF NOT EXISTS task_assignees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      user_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      assigned_by INT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_task_user (task_id, user_id),
      INDEX idx_task_id (task_id),
      INDEX idx_user_id (user_id)
    )`,

    // Task Mentions
    `CREATE TABLE IF NOT EXISTS task_mentions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      comment_id INT NULL,
      mentioned_user_id INT NOT NULL,
      mentioned_by_user_id INT NOT NULL,
      mention_type ENUM('comment', 'assignment', 'status_change') NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (mentioned_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_mentioned_user (mentioned_user_id),
      INDEX idx_task_id (task_id),
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at)
    )`,

        // Task Subtasks
    `CREATE TABLE IF NOT EXISTS task_subtasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      position INT DEFAULT 0,
      created_by INT NOT NULL,
      completed_by INT NULL,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_task_id (task_id),
      INDEX idx_position (task_id, position),
      INDEX idx_completed (is_completed)
    )`,

    // Call Logs
    `CREATE TABLE IF NOT EXISTS call_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      lead_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      category ENUM('Informational', 'Reminder', 'Sale', 'Follow-up', 'Support') NOT NULL DEFAULT 'Informational',
      notes TEXT,
      call_duration INT DEFAULT NULL COMMENT 'Duration in minutes',
      call_outcome ENUM('Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected') DEFAULT 'Successful',
      call_date DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_lead_id (lead_id),
      INDEX idx_user_id (user_id),
      INDEX idx_call_date (call_date),
      INDEX idx_category (category)
    )`,

    // Account Calls
    `CREATE TABLE IF NOT EXISTS account_calls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      category ENUM('Informational', 'Reminder', 'Sale', 'Follow-up', 'Support', 'Meeting', 'Negotiation') DEFAULT 'Informational',
      call_outcome ENUM('Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected', 'Meeting Scheduled') DEFAULT 'Successful',
      call_date DATETIME NOT NULL,
      call_duration INT NULL COMMENT 'Duration in minutes',
      notes TEXT NULL,
      contact_person VARCHAR(255) NULL COMMENT 'Who was contacted at the account',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_account_calls_account_id (account_id),
      INDEX idx_account_calls_user_id (user_id),
      INDEX idx_account_calls_date (call_date),
      INDEX idx_account_calls_category (category),
      INDEX idx_account_calls_outcome (call_outcome)
    )`,

    // Dashboards
    `CREATE TABLE IF NOT EXISTS dashboards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dashboard_name VARCHAR(255) NOT NULL,
      description TEXT,
      created_by INT NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      is_public BOOLEAN DEFAULT TRUE,
      grid_columns INT DEFAULT 12,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_dashboard_per_user (dashboard_name, created_by),
      INDEX idx_dashboards_created_by (created_by),
      INDEX idx_dashboards_public (is_public)
    )`,

    // Dashboard Widgets
    `CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dashboard_id INT NOT NULL,
      saved_report_id INT NOT NULL,
      widget_title VARCHAR(255),
      widget_type ENUM('table', 'bar_chart', 'line_chart', 'pie_chart', 'donut_chart', 'metric_card', 'list', 'text_field') DEFAULT 'table',
      position_x INT DEFAULT 0,
      position_y INT DEFAULT 0,
      width INT DEFAULT 6,
      height INT DEFAULT 4,
      chart_config JSON,
      display_options JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (saved_report_id) REFERENCES saved_reports(id) ON DELETE CASCADE,
      INDEX idx_dashboard_widgets_dashboard_id (dashboard_id),
      INDEX idx_dashboard_widgets_saved_report_id (saved_report_id)
    )`,

    // Email Templates
    `CREATE TABLE IF NOT EXISTS email_templates (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      category VARCHAR(100) DEFAULT 'general',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Email Campaigns
    `CREATE TABLE IF NOT EXISTS email_campaigns (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      template_id INT NULL,
      recipient_type ENUM('leads', 'accounts') NOT NULL,
      recipient_filter JSON,
      scheduled_at TIMESTAMP NULL,
      status ENUM('draft', 'sending', 'completed', 'failed', 'paused') DEFAULT 'draft',
      sent_count INT DEFAULT 0,
      delivered_count INT DEFAULT 0,
      opened_count INT DEFAULT 0,
      clicked_count INT DEFAULT 0,
      bounce_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Email Logs
    `CREATE TABLE IF NOT EXISTS email_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      campaign_id INT,
      recipient_id INT,
      recipient_type ENUM('lead', 'account') NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      status ENUM('queued', 'sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked') DEFAULT 'queued',
      message_id VARCHAR(255),
      provider_response TEXT,
      error_message TEXT,
      sent_at TIMESTAMP NULL,
      delivered_at TIMESTAMP NULL,
      opened_at TIMESTAMP NULL,
      clicked_at TIMESTAMP NULL,
      bounced_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Email Unsubscribes
    `CREATE TABLE IF NOT EXISTS email_unsubscribes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      recipient_type ENUM('lead', 'account'),
      recipient_id INT,
      reason VARCHAR(255),
      unsubscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Custom Field Definitions
    `CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module ENUM('leads', 'accounts') NOT NULL COMMENT 'The module this field applies to',
      field_name VARCHAR(100) NOT NULL COMMENT 'Internal, unique name for the field, e.g., "lead_source_details"',
      field_label VARCHAR(255) NOT NULL COMMENT 'User-friendly label shown in the UI, e.g., "Lead Source Details"',
      field_type ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'RADIO', 'MULTISELECT') NOT NULL DEFAULT 'TEXT',
      placeholder TEXT NULL COMMENT 'Placeholder text for the input field',
      is_required BOOLEAN DEFAULT FALSE,
      is_read_only TINYINT(1) DEFAULT 0,
      options JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_module_field_name (module, field_name)
    )`,

    // Custom Field Values
    `CREATE TABLE IF NOT EXISTS custom_field_values (
      id INT AUTO_INCREMENT PRIMARY KEY,
      definition_id INT NOT NULL COMMENT 'FK to custom_field_definitions',
      record_id INT NOT NULL COMMENT 'The ID of the lead or account this value belongs to',
      module ENUM('leads', 'accounts') NOT NULL,
      value TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (definition_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
      UNIQUE KEY uk_custom_field_values (definition_id, record_id, module),
      INDEX idx_record_module (record_id, module)
    )`,

    // Custom Field Mappings
    `CREATE TABLE IF NOT EXISTS custom_field_mappings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      lead_field_id INT NOT NULL,
      account_field_id INT NOT NULL,
      mapping_type ENUM('DIRECT', 'TRANSFORM', 'IGNORE') DEFAULT 'DIRECT',
      transform_rule TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
      FOREIGN KEY (account_field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
      UNIQUE KEY unique_lead_mapping (lead_field_id),
      INDEX idx_account_field (account_field_id)
    )`,

    // CUSTOM FIELD FORMULAS
    `CREATE TABLE IF NOT EXISTS formula_field_definitions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  module ENUM('leads', 'accounts') NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  return_type ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'RADIO', 'MULTISELECT') NOT NULL,
  formula_expression TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_field_per_module (module, field_name),
  update_schedule VARCHAR(20) DEFAULT 'manual',
  last_updated TIMESTAMP NULL,
  target_field_name VARCHAR(255) NULL DEFAULT NULL
)`,
`CREATE TABLE IF NOT EXISTS formula_field_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  formula_field_id INT NOT NULL,
  module VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  calculated_value JSON,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (formula_field_id) REFERENCES formula_field_definitions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_formula_record (formula_field_id, module, record_id),
  INDEX idx_module_record (module, record_id)
)`,

`CREATE TABLE IF NOT EXISTS chain_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    module ENUM('leads', 'accounts') NOT NULL,
    source_field_id INT NOT NULL,
    target_field_id INT NOT NULL,
    comparison_operator ENUM(
        'equals', 
        'not_equals', 
        'contains', 
        'greater_than', 
        'less_than', 
        'is_empty', 
        'is_not_empty'
    ) NOT NULL DEFAULT 'equals',
    rule_type ENUM('single_value', 'bulk_mapping') NOT NULL DEFAULT 'single_value',
    trigger_value TEXT,
    target_value TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (source_field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (target_field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rule_name_per_module (rule_name, module),
    INDEX idx_module_active (module, is_active),
    INDEX idx_source_field (source_field_id),
    INDEX idx_target_field (target_field_id)
)`,

`CREATE TABLE IF NOT EXISTS chain_rule_value_maps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_id INT NOT NULL,
    trigger_value VARCHAR(255) NOT NULL,
    target_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES chain_rules(id) ON DELETE CASCADE,
    INDEX idx_rule_id (rule_id),
    UNIQUE KEY unique_trigger_per_rule (rule_id, trigger_value)
)`,

`CREATE TABLE IF NOT EXISTS relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('lead', 'account') NOT NULL,
    entity_id INT NOT NULL,
    related_type ENUM('lead', 'account') NOT NULL,
    related_id INT NOT NULL,
    relationship_type ENUM(
        'spouse', 'father', 'mother', 'son', 'daughter', 'brother', 'sister',
        'colleague', 'manager', 'assistant', 'business_partner', 'client',
        'vendor', 'referral', 'friend', 'other'
    ) NOT NULL,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    relationship_key_1 VARCHAR(255) AS (
        LEAST(CONCAT(entity_type, ':', entity_id), CONCAT(related_type, ':', related_id))
    ) STORED,
    relationship_key_2 VARCHAR(255) AS (
        GREATEST(CONCAT(entity_type, ':', entity_id), CONCAT(related_type, ':', related_id))
    ) STORED,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_relationship (relationship_key_1, relationship_key_2),
    CONSTRAINT chk_no_self_relationship CHECK (NOT (entity_type = related_type AND entity_id = related_id)),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_related (related_type, related_id),
    INDEX idx_relationship_type (relationship_type),
    INDEX idx_created_at (created_at)
)`,

`CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL,
    x INT DEFAULT 0,
    y INT DEFAULT 0,
    width INT DEFAULT 280,
    height INT DEFAULT 200,
    z_index INT DEFAULT 0,
    color VARCHAR(100) DEFAULT 'bg-yellow-200 border-yellow-300',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notes_owner_id (owner_id),
    INDEX idx_notes_updated_at (updated_at),
    INDEX idx_notes_position (x, y)
)`,

`CREATE TABLE IF NOT EXISTS note_shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    note_id INT NOT NULL,
    user_id INT NOT NULL,
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(note_id, user_id),
    INDEX idx_note_shares_note_id (note_id),
    INDEX idx_note_shares_user_id (user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS note_share_properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    note_id INT NOT NULL,
    x INT,
    y INT,
    width INT,
    height INT,
    z_index INT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    UNIQUE KEY user_note_unique (user_id, note_id)
)`,

    `CREATE TABLE IF NOT EXISTS packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'integration',
        is_enabled BOOLEAN DEFAULT FALSE,
        config JSON,
        api_config JSON,
        status ENUM('active', 'inactive', 'error', 'pending') DEFAULT 'inactive',
        version VARCHAR(20) DEFAULT '1.0.0',
        last_sync TIMESTAMP NULL,
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_status (status),
        INDEX idx_enabled (is_enabled)
      )`,

    `CREATE TABLE IF NOT EXISTS package_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        package_name VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        status ENUM('success', 'error', 'warning', 'info') DEFAULT 'info',
        message TEXT,
        request_data JSON NULL,
        response_data JSON NULL,
        execution_time INT NULL COMMENT 'Execution time in milliseconds',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_package (package_name),
        INDEX idx_status (status),
        INDEX idx_created (created_at),
        FOREIGN KEY (package_name) REFERENCES packages(name) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    package_name VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_package_event_type (package_name, event_type),
    INDEX idx_processed_at (processed_at)
)`,

`CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type ENUM('lead', 'account') NOT NULL,
  goal_type VARCHAR(100) NOT NULL,
  goal_value DECIMAL(15),
  goal_currency VARCHAR(10) DEFAULT 'USD',
  current_value DECIMAL(15) DEFAULT 0,
  status ENUM('active', 'inactive', 'completed', 'paused') DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  is_open_campaign BOOLEAN DEFAULT FALSE,
  auto_join BOOLEAN DEFAULT true,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_campaigns_type (campaign_type),
  INDEX idx_campaigns_status (status),
  INDEX idx_campaigns_status_active (status, id),
  INDEX idx_campaigns_dates (start_date, end_date),
  INDEX idx_campaigns_created_by (created_by)
)`,

`CREATE TABLE IF NOT EXISTS campaign_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  entity_type ENUM('lead', 'account') NOT NULL,
  entity_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active', 'completed', 'removed') DEFAULT 'active',
  contribution DECIMAL(15,2) DEFAULT 0,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  UNIQUE KEY unique_campaign_entity (campaign_id, entity_type, entity_id),
  INDEX idx_campaign_participants_campaign (campaign_id),
  INDEX idx_campaign_participants_entity (entity_type, entity_id),
  INDEX idx_campaign_participants_status (status)
)`,

`CREATE TABLE IF NOT EXISTS campaign_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  entity_type ENUM('lead', 'account') NOT NULL,
  entity_id INT NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  activity_description TEXT,
  value_contributed DECIMAL(15,2) DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_campaign_activities_recent (campaign_id, created_at),
  INDEX idx_campaign_activities_campaign (campaign_id),
  INDEX idx_campaign_activities_entity (entity_type, entity_id),
  INDEX idx_campaign_activities_type (activity_type),
  INDEX idx_campaign_activities_date (created_at DESC)
)`,

`CREATE TABLE IF NOT EXISTS user_lead_layout_preferences (
  user_id INT NOT NULL,
  selected_fields JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`,

`CREATE TABLE IF NOT EXISTS user_account_layout_preferences (
  user_id INT NOT NULL,
  selected_fields JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`,

`CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  entity_type ENUM('lead', 'account') NOT NULL,
  entity_id INT NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'draft',
  currency_totals JSON,
  notes TEXT NULL,
  terms TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  created_by_name VARCHAR(255) NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  INDEX idx_dates (issue_date, due_date),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_created_by (created_by)
)`,

`CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT NULL,
  product_code VARCHAR(100) NULL,
  product_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_invoice (invoice_id),
  INDEX idx_product (product_id),
  INDEX idx_sort_order (invoice_id, sort_order)
)`,

`CREATE TABLE IF NOT EXISTS company_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255) DEFAULT '',
  address_line1 VARCHAR(255) DEFAULT '',
  address_line2 VARCHAR(255) DEFAULT '',
  city VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  zip_code VARCHAR(20) DEFAULT '',
  country VARCHAR(100) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  website VARCHAR(255) DEFAULT '',
  logo_filename VARCHAR(255) DEFAULT NULL,
  tax_id VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
)`

  ];

  console.log("📊 Creating database tables...");

  for (let i = 0; i < createQueries.length; i++) {
    const query = createQueries[i];
    try {
      await db.execute(query);
      // Extract table name from query for better logging
      const tableNameMatch = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      const tableName = tableNameMatch ? tableNameMatch[1] : `table_${i + 1}`;
      console.log(`✅ Table '${tableName}' created/verified`);
    } catch (error) {
      console.error(`❌ Error creating table ${i + 1}:`, error.message);
      console.error("Query:", query.substring(0, 200) + "...");
    }
  }
  console.log("🎉 Database schema setup completed");

  const [existing] = await db.execute('SELECT COUNT(*) as count FROM packages');
    if (existing[0].count === 0) {
      await db.execute(`
        INSERT INTO packages (name, display_name, description, category, config, api_config) VALUES
        ('iys', 'İYS Integration', 'İleti Yönetim Sistemi entegrasyonu', 'communication', 
         JSON_OBJECT('timeout', 30000, 'retries', 3, 'rate_limit', 100, 'default_user', ''),
         JSON_OBJECT('base_url', '', 'api_key', '', 'username', '', 'password', '')
        ),
        ('calendly', 'Calendly Integration', 'Calendly randevu sistemi entegrasyonu', 'scheduling',
         JSON_OBJECT('timeout', 15000, 'retries', 2, 'webhook_enabled', false),
         JSON_OBJECT('access_token', '', 'webhook_url', '', 'organization_uri', '')
        ),
        ('whatsapp', 'WhatsApp Business API', 'WhatsApp Business API entegrasyonu', 'communication',
         JSON_OBJECT('timeout', 20000, 'retries', 3, 'message_template_enabled', true),
         JSON_OBJECT('access_token', '', 'phone_number_id', '', 'webhook_verify_token', '')
        ),
        ('mailchimp', 'Mailchimp Integration', 'E-posta pazarlama entegrasyonu', 'marketing',
         JSON_OBJECT('timeout', 25000, 'retries', 2, 'auto_sync', true),
         JSON_OBJECT('api_key', '', 'server_prefix', '', 'list_id', '')
        )
      `);
    }
}

async function tableExists(db, tableName) {
  try {
    const [rows] = await db.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [tableName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

async function getTableCount(db, tableName) {
  try {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count FROM ${tableName}`
    );
    return rows[0].count;
  } catch (error) {
    console.error(`Error getting count for table ${tableName}:`, error);
    return 0;
  }
}

module.exports = {
  createRemoteTables,
  tableExists,
  getTableCount
};