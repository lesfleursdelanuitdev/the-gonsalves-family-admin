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
 * Later deploys: npm run deploy (migrations + build + pm2 restart).
 * DATABASE_URL must be available to the deploy shell (see scripts/deploy.sh).
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
        // ligneous-gedcom-lib-api (parse / export). Override via shell when starting PM2 if needed.
        LIB_API_URL: process.env.LIB_API_URL ?? "http://127.0.0.1:8092",
        // ligneous-python-api (/api/research proxy). Same host: loopback. No trailing slash.
        PYTHON_API_URL: process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001",
        // Shared session cookie contract (must match public app).
        AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME ?? "gonsalves_session",
        AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN ?? ".gonsalvesfamily.com",
        AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE ?? "true",
      },
    },
  ],
};
