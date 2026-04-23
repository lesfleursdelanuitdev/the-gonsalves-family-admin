import path from "node:path";
import { fileURLToPath } from "node:url";

// Default base is `process.cwd()`. If dev is started from `gonsalves-genealogy/`
// (e.g. workspace root), resolution for `@import "tailwindcss"` fails there.
const appDir = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    "@tailwindcss/postcss": { base: appDir },
  },
};

export default config;
