// Entry point for host panels that run a Node.js app by executing one file
// directly (e.g. Hostinger hPanel's "Node.js" app manager, built on Phusion
// Passenger) rather than running an npm script. `next start` is what runs
// everywhere else (Vercel, a plain VPS, `npm run start` locally) — this file
// only exists for that one deployment style. It must listen on
// `process.env.PORT`, which is what these panels assign your app.
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Ready on port ${port} (${dev ? "development" : "production"})`);
  });
});
