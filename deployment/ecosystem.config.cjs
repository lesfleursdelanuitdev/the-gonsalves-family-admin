/**
 * PM2 process for admin.gonsalvesfamily.com
 *
 * First time on the server:
 *   cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
 *   npm ci && npm run build
 *   pm2 start deployment/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # follow the printed command if needed
 *
 * Later deploys: npm run deploy (build + pm2 restart)
 */
const path = require("node:path");

const cwd = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "admin-gonsalvesfamily",
      cwd,
      script: path.join(cwd, "node_modules", ".bin", "next"),
      args: "start -p 3040",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
