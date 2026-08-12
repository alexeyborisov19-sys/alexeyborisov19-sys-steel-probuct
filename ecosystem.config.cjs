module.exports = {
  apps: [
    {
      name: "steelprodukt",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      // A second worker cost more memory than this VPS has to spare: the build
      // step was OOM-killed while two workers were resident. Nginx now serves
      // the prerendered pages from cache, so one worker carries the rest.
      // Cluster mode is kept so the size can be raised on a larger box.
      instances: 1,
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
