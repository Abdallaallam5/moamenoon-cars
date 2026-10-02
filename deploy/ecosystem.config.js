// PM2 process file: keeps the site running, restarts it if it crashes or after a reboot, and runs one copy per CPU core.
//   pm2 start deploy/ecosystem.config.js
//   pm2 reload moamenoon          (zero-downtime restart after an update)
module.exports = {
  apps: [
    {
      name: 'moamenoon',
      script: 'server.js',
      cwd: __dirname + '/..',
      exec_mode: 'cluster',
      // 2 copies is right for a 2-CPU server; use 1 on a 1-CPU server, 4 on a 4-CPU one.
      instances: Number(process.env.WEB_CONCURRENCY) || 2,
      node_args: '--disable-warning=ExperimentalWarning',
      max_memory_restart: '800M', // safety net against a memory leak
      kill_timeout: 12000, // lets running requests finish before a restart (the app closes the database cleanly)
      env: { NODE_ENV: 'production' },
    },
  ],
};
