# ClientRay Setup Guide

## Prerequisites

- Node.js installed on your server

## Server Configuration

### Directory Structure
- **Document Root:** `/backend/public` (frontend folder goes here with npm run build)
- **Application Root:** `/httpdocs/backend`
- **Application Startup File:** `/httpdocs/backend/server.js`

### Starting the Server
```bash
npm run start:pm2
```

## Backend Configuration

### Environment Variables (`backend/.env`)

#### Required Variables
```env
APP_URL=https://yourdomain.com
JWT_SECRET=your_jwt_secret_key
```

#### Database Configuration
```env
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_SSL=true_or_false
```

#### Email Provider Setup
```env
EMAIL_PROVIDER=sendgrid  # Options: sendgrid, gmail, smtp, aws_ses
```

### PM2 Ecosystem Configuration (`backend/ecosystem.config.js`)

Update the following:
- **`cwd`:** Set to your exact server path (e.g., `/var/www/vhosts/SERVERNAME.com/httpdocs/backend`)
- **`PORT`:** Change to your desired port number

### Initial Admin Account

Create your first admin account by running:
```bash
node backend/createAdmin.js
```

### CORS Configuration

If you encounter CORS issues, add your website URL to `allowedOrigins` in `backend/server.js`

## Frontend Configuration

### Environment Variables (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:PORT/api
JWT_SECRET=your_jwt_secret_key  # Must match backend JWT_SECRET
VITE_APP_GOOGLE_CLIENT_ID=your_google_client_id
VITE_APP_GOOGLE_API_KEY=your_google_api_key
```

**Note:** Only change the `:PORT` in `VITE_API_BASE_URL` to match your backend port.

### Vite Configuration (`frontend/vite.config.js`)

Update the `:PORT` for both:
- `/api` proxy
- `/uploads` proxy

## Nginx Configuration

Add the following directives to your nginx configuration:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Replace `PORT` with your actual backend port number.

## Third-Party Integrations

### Google APIs

Visit the [Google Cloud Console](https://console.cloud.google.com/apis/dashboard) to set up:

1. **OAuth 2.0 Client ID** → Use for `VITE_APP_GOOGLE_CLIENT_ID`
2. **Enable APIs:**
   - Gmail API
   - Google Calendar API
   - Google Tasks API
3. **API Key** → Use for `VITE_APP_GOOGLE_API_KEY`

These credentials are required for:
- Company Calendar integration
- Email sending functionality

### SendGrid (Optional)

If using SendGrid as your email provider:

1. Create an API Key with Email Activity permissions
2. Visit: [SendGrid API Keys](https://app.sendgrid.com/settings/api_keys)
3. Add the API key to your backend `.env` file

### Calendly Integration (Optional)

For webhook setup, visit: [Calendly API Webhooks](https://calendly.com/integrations/api_webhooks)