module.exports = {
  apps: [
    {
      name: "steelprodukt",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      // Two clustered workers share port 3000, so a slow request no longer
      // blocks every other visitor behind a single process.
      instances: 2,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env_production: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: 3000,
      },
    },
  ],
};
