module.exports = {
  apps: [
    {
      name: 'rumah-money-mate',
      script: 'server/dist/index.js',
      cwd: '/home/fam/house_finance',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      watch: false,
      max_memory_restart: '200M',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000
    }
  ]
};
