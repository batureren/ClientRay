// server.js
global.setImmediate = global.setImmediate || require('setimmediate');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const axios = require('axios');
const crypto = require('crypto');

// --- Local Module Imports ---
const { createRemoteTables } = require('./utils/databaseSchema');
const i18next = require('./utils/i18n-config');
const { calculateNextOccurrence } = require('./utils/dateCalculator');
const { FormulaFieldScheduler } = require('./scheduledTasks/formulaFieldUpdater');
const CampaignScheduler = require('./scheduledTasks/campaignScheduler');
const RecurringTaskScheduler = require('./scheduledTasks/recurringTaskScheduler');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');
const { buildFilterWhereClause, buildFilterClause } = require('./utils/filterBuilder');
const { 
  logLeadHistory, 
  generateDescription, 
  leadFieldMapping, 
  mapLeadFromRemote,
  mapAccountFromRemote,
  mapProductFromRemote
} = require('./utils/helpers');
const { applyChainRulesMiddleware } = require('./utils/chainFieldsUtils');
const CampaignGoalCalculator = require('./utils/campaignGoalCalculator');

// --- Calculated Paths for Uploads ---
const profileUploadsDir = path.join(process.cwd(), 'uploads', 'profiles');
const companyUploadsDir = path.join(process.cwd(), 'uploads', 'company-detail');
const docsUploadDir = path.join(process.cwd(), 'uploads', 'docs');

const app = express();
const PORT = process.env.PORT || 3004;

let pool = null;
let dbConfig = null;

const allowedOrigins = [ 'http://localhost:3000', 'http://localhost:5173', 'https://abc.com' ];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /^https:\/\/([a-z0-9-]+\.)?abc\.com$/i.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from ${origin}`), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Origin'],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads/company-detail', express.static(companyUploadsDir));
app.use('/uploads/profiles', express.static(profileUploadsDir));
app.use('/uploads/email_images', express.static(path.join(process.cwd(), 'uploads', 'email_images')));
app.use('/uploads/docs', express.static(docsUploadDir));
app.use(compression());

async function createDatabasePool() {
  dbConfig = dbConfig || {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 60000,
    maxIdle: 10,
    idleTimeout: 60000,
  };
  
  const newPool = mysql.createPool(dbConfig);
  
  // Test the pool
  try {
    const connection = await newPool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    console.log('✅ Database pool created and tested successfully');
  } catch (error) {
    await newPool.end();
    throw error;
  }
  
  return newPool;
}

async function initializeDatabase() {
  try {
    pool = await createDatabasePool();
    await createRemoteTables(pool);
    console.log('✅ MySQL database pool connected successfully');
    
    setInterval(async () => {
      try {
        if (pool) {
          const connection = await pool.getConnection();
          await connection.query('SELECT 1');
          connection.release();
        }
      } catch (error) {
        console.error('⚠️ Pool health check failed:', error.message);
      }
    }, 30000);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

const getDb = async () => {
  if (!pool) throw new Error('Database pool not initialized');
  return pool;
};

const requireDatabase = async (req, res, next) => {
  try {
    const db = await getDb();
    const connection = await db.getConnection();
    connection.release();
    next();
  } catch (error) {
    console.error('Database middleware error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable', message: error.message });
  }
};

// ============================================================================
// API ROUTES DISCOVERY HELPER FUNCTIONS
// ============================================================================

function extractRoutes(app) {
  const routes = [];
  function processStack(stack, basePath = '') {
    stack.forEach(middleware => {
      if (middleware.route) {
        const path = basePath + middleware.route.path;
        const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
        methods.forEach(method => {
          routes.push({
            method,
            path,
            auth_required: middleware.route.stack.some(layer => 
              layer.name === 'authenticateToken' || 
              layer.name === 'requireDatabase'
            )
          });
        });
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        let routerPath = basePath;
        if (middleware.regexp) {
          const pathMatch = middleware.regexp.source
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\$/g, '');
          if (pathMatch && pathMatch !== '/') routerPath = basePath + pathMatch;
        }
        processStack(middleware.handle.stack, routerPath);
      }
    });
  }
  processStack(app._router.stack);
  return routes;
}

function categorizeRoute(path) {
  if (path.includes('/auth')) return 'Authentication';
  if (path.includes('/leads')) return 'Leads';
  if (path.includes('/accounts')) return 'Accounts';
  if (path.includes('/products')) return 'Products';
  if (path.includes('/tasks')) return 'Tasks';
  if (path.includes('/users')) return 'Users';
  if (path.includes('/calls')) return 'Calls';
  if (path.includes('/email') || path.includes('/mailing')) return 'Email';
  if (path.includes('/field-definitions') || path.includes('/custom-fields') || path.includes('/formula-fields')) return 'Fields';
  if (path.includes('/dashboards')) return 'Dashboards';
  if (path.includes('/relationships')) return 'Relationships';
  if (path.includes('/notes')) return 'Notes';
  if (path.includes('/projects')) return 'Projects';
  if (path.includes('/docs')) return 'Documents';
  if (path.includes('/chain-fields')) return 'Chain Fields';
  if (path.includes('/packages')) return 'Packages';
  if (path.includes('/campaigns')) return 'Campaigns';
  if (path.includes('/invoices')) return 'Invoices';
  if (path.includes('/company-detail')) return 'Company';
  if (path.includes('/saved-reports')) return 'Reports';
  if (path.includes('/form2lead')) return 'Forms';
  return 'Other';
}

function generateRouteDescription(method, path) {
  const segments = path.split('/').filter(Boolean);
  const resource = segments[segments.length - 1] || segments[segments.length - 2];
  if (resource && resource.startsWith(':')) {
    const parentResource = segments[segments.length - 2];
    switch (method) {
      case 'GET': return `Get details of a specific ${parentResource}`;
      case 'PUT': return `Update a specific ${parentResource}`;
      case 'PATCH': return `Partially update a specific ${parentResource}`;
      case 'DELETE': return `Delete a specific ${parentResource}`;
      default: return `${method} operation on ${parentResource}`;
    }
  }
  switch (method) {
    case 'GET': return path.includes(':id') ? `Get specific ${resource}` : `List all ${resource}`;
    case 'POST': return `Create new ${resource}`;
    case 'PUT': return `Update ${resource}`;
    case 'PATCH': return `Partially update ${resource}`;
    case 'DELETE': return `Delete ${resource}`;
    default: return `${method} ${resource}`;
  }
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
  try {
    await i18next.init();
    await initializeDatabase();
    
    console.log('📂 Loading local routes...');
    let emailService = { sendEmail: () => console.warn('⚠️ Email service not loaded (mocked)') };
    try {
      const emailServicePath = path.join(__dirname, 'routes', 'emailService.js');
      if (fs.existsSync(emailServicePath)) {
        const emailServiceFactory = require(emailServicePath);
        if (typeof emailServiceFactory === 'function') {
           emailService = emailServiceFactory({ getDb });
           console.log('✅ Email Service loaded');
        }
      } else {
        console.log('⚠️ emailService.js not found in ./routes, skipping email dependency.');
      }
    } catch (err) {
      console.error('❌ Failed to load Email Service:', err.message);
    }

    console.log('📅 Initializing Formula Field Scheduler...');
    const formulaScheduler = new FormulaFieldScheduler(getDb);

    const dependencies = {
      getDb,
      authenticateToken,
      requireRole,
      JWT_SECRET,
      i18next,
      buildFilterWhereClause,
      buildFilterClause,
      logLeadHistory,
      generateDescription,
      leadFieldMapping,
      mapLeadFromRemote,
      mapAccountFromRemote,
      mapProductFromRemote,
      applyChainRulesMiddleware,
      CampaignGoalCalculator: new CampaignGoalCalculator(getDb),
      calculateNextOccurrence,
      emailService,
      profileUploadsDir,
      docsUploadDir,
      companyUploadsDir,
      formulaScheduler
    };
    
    // Dynamically load all routes from ./routes directory
    const routes = {};
    const routesPath = path.join(__dirname, 'routes');
    if (fs.existsSync(routesPath)) {
      const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
      
      for (const file of routeFiles) {
        const routeName = file.replace('.js', '');
        try {
          const factory = require(path.join(routesPath, file));
          if (typeof factory === 'function') {
            routes[routeName] = factory(dependencies);
            console.log(`✅ Route loaded: ${routeName}`);
          }
        } catch (err) {
          console.error(`❌ Failed to load route ${routeName}:`, err.message);
        }
      }
    } else {
      console.error('❌ Routes directory not found at:', routesPath);
    }
    
    // Fallback/Alias for route names used in app.use if they differ from filenames
    if (!routes.emailServiceRouter && routes.emailService) {
      routes.emailServiceRouter = routes.emailService;
    }

    const protectedMiddleware = [requireDatabase];
    
    // Register all routes
    if (routes.authRoutes) app.use('/api/auth', routes.authRoutes);
    if (routes.emailRoutes) app.use('/api/mailing', ...protectedMiddleware, routes.emailRoutes);
    if (routes.emailServiceRouter) app.use('/api/email', ...protectedMiddleware, routes.emailServiceRouter);
    if (routes.leadRoutes) app.use('/api/leads', ...protectedMiddleware, routes.leadRoutes);
    if (routes.accountRoutes) app.use('/api/accounts', ...protectedMiddleware, routes.accountRoutes);
    if (routes.productRoutes) app.use('/api/products', ...protectedMiddleware, routes.productRoutes);
    if (routes.taskRoutes) app.use('/api/tasks', ...protectedMiddleware, routes.taskRoutes);
    if (routes.userRoutes) app.use('/api/users', ...protectedMiddleware, routes.userRoutes);
    if (routes.savedReportsRoutes) app.use('/api/saved-reports', ...protectedMiddleware, routes.savedReportsRoutes);
    if (routes.callRoutes) app.use('/api/calls', ...protectedMiddleware, routes.callRoutes);
    if (routes.accountCallRoutes) app.use('/api/account-calls', ...protectedMiddleware, routes.accountCallRoutes);
    if (routes.fieldDefinations) app.use('/api/field-definitions', ...protectedMiddleware, routes.fieldDefinations);
    if (routes.dashboardRoutes) app.use('/api/dashboards', ...protectedMiddleware, routes.dashboardRoutes);
    if (routes.customFieldsRoutes) app.use('/api/custom-fields', ...protectedMiddleware, routes.customFieldsRoutes);
    if (routes.customFieldMappings) app.use('/api/custom-field-mappings', ...protectedMiddleware, routes.customFieldMappings);
    if (routes.formulaFields) app.use('/api/formula-fields', ...protectedMiddleware, routes.formulaFields);
    if (routes.relationshipRoutes) app.use('/api/relationships', ...protectedMiddleware, routes.relationshipRoutes);
    if (routes.noteRoutes) app.use('/api/notes', ...protectedMiddleware, routes.noteRoutes);
    if (routes.projectRoutes) app.use('/api/projects', ...protectedMiddleware, routes.projectRoutes);
    if (routes.docsRoutes) app.use('/api/docs', ...protectedMiddleware, routes.docsRoutes);
    if (routes.chainFieldRoutes) app.use('/api/chain-fields', ...protectedMiddleware, routes.chainFieldRoutes);
    if (routes.packageRoutes) app.use('/api/packages', ...protectedMiddleware, routes.packageRoutes);
    if (routes.campaignRoutes) app.use('/api/campaigns', ...protectedMiddleware, routes.campaignRoutes);
    if (routes.invoiceRoutes) app.use('/api/invoices', ...protectedMiddleware, routes.invoiceRoutes);
    if (routes.companyDetailsRoutes) app.use('/api/company-detail', ...protectedMiddleware, routes.companyDetailsRoutes);
    if (routes.form2leadRoutes) app.use('/api', routes.form2leadRoutes);
    
    // ============================================================================
    // API ROUTES DISCOVERY ENDPOINT
    // ============================================================================
    app.get('/api/api-routes', authenticateToken, async (req, res) => {
      try {
        const rawRoutes = extractRoutes(app);
        const apiRoutes = rawRoutes
          .filter(route => {
            return !route.path.includes('*') && 
                   route.path !== '/health' &&
                   route.path !== '/api-routes' &&
                   !route.path.includes('/_next') &&
                   route.path.startsWith('/api');
          })
          .map(route => ({
            method: route.method,
            path: route.path,
            category: categorizeRoute(route.path),
            description: generateRouteDescription(route.method, route.path),
            auth_required: route.auth_required,
            parameters: route.path.match(/:[^/]+/g)?.map(param => ({
              name: param.substring(1),
              type: 'string',
              required: true,
              in: 'path',
              description: `${param.substring(1)} identifier`
            })) || []
          }))
          .sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.path.localeCompare(b.path);
          });
        
        const categories = [...new Set(apiRoutes.map(r => r.category))].sort();
        
        res.json({
          success: true,
          count: apiRoutes.length,
          categories,
          routes: apiRoutes
        });
      } catch (error) {
        console.error('Error extracting API routes:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to extract API routes',
          message: error.message
        });
      }
    });
    
    // ============================================================================
    // BACKGROUND SCHEDULERS
    // ============================================================================
    if (pool) {
      console.log('\n🔄 Starting background schedulers...');
      
      try {
        await formulaScheduler.initializeScheduledUpdates();
        console.log('✅ Formula Field Scheduler started');
      } catch (error) {
        console.error('❌ Failed to start Formula Field Scheduler:', error);
      }
      
      try {
        CampaignScheduler.initialize(dependencies);
        CampaignScheduler.startScheduler();
        console.log('✅ Campaign Scheduler started');
      } catch (error) {
        console.error('❌ Failed to start Campaign Scheduler:', error);
      }
      
      try {
        RecurringTaskScheduler.initialize(dependencies);
        RecurringTaskScheduler.startScheduler();
        console.log('✅ Recurring Task Scheduler started');
      } catch (error) {
        console.error('❌ Failed to start Recurring Task Scheduler:', error);
      }
    }

    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message, error.stack);
    process.exit(1);
  }
}

async function getEnabledPackages() {
  try {
    const db = await getDb();
    const [packages] = await db.execute(`SELECT name, display_name, config, api_config, status FROM packages WHERE is_enabled = true AND status = 'active'`);
    return packages.reduce((acc, pkg) => {
      acc[pkg.name] = {
        displayName: pkg.display_name,
        config: JSON.parse(pkg.config || '{}'),
        apiConfig: JSON.parse(pkg.api_config || '{}'),
        status: pkg.status
      };
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching enabled packages:', error);
    return {};
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  if (pool) await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database pool...');
  if (pool) await pool.end();
  process.exit(0);
});

module.exports = { getDb, getEnabledPackages };

startServer();