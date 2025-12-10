// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ClientRay',
    cwd: "/var/www/vhosts/abc.com/httpdocs/backend",
    script: 'server.js',
    instances: '1',
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024', 
    env: {
      NODE_ENV: 'production',
      PORT: 3004
    },
    // PM2 specific restart strategies
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Error handling
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Advanced restart conditions
    ignore_watch: ['node_modules', 'logs'],
    watch_options: {
      followSymlinks: false
    },
    
    // Health check and restart conditions
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Restart on specific exit codes
    stop_exit_codes: [0],
    cron_restart: '0 3 * * *'
  }]
};