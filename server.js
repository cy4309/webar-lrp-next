const fs = require("fs");
const path = require("path");
const https = require("https");
const { parse } = require("url");
const next = require("next");
const os = require("os");
const process = require("process");
const openurl = require("openurl");

// ---------- config ----------
const port = parseInt(process.env.PORT || process.argv[2] || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

// ---------- next ----------
const app = next({ dev });
const handle = app.getRequestHandler();

// ---------- cert ----------
const httpsOptions = {
  key: fs.readFileSync(path.resolve("cert/server.key")),
  cert: fs.readFileSync(path.resolve("cert/server.crt")),
};

// ---------- IP utils (整合 show-ip) ----------
function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  return ips;
}

// ---------- start ----------
app.prepare().then(() => {
  https
    .createServer(httpsOptions, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    })
    .listen(port, "0.0.0.0", () => {
      const ips = getLocalIPs();

      console.log("\n✅ HTTPS server running at:");
      console.log(`→ https://localhost:${port}`);

      ips.forEach((ip) => {
        console.log(`→ https://${ip}:${port}`);
      });

      // 自動開啟（非 Docker）
      if (!process.env.DOCKER) {
        const target = ips[0]
          ? `https://${ips[0]}:${port}`
          : `https://localhost:${port}`;

        openurl.open(target);
      }
    });
});
