const http = require("node:http");
const os = require("node:os");

const PORT = Number(process.env.PORT || 3000);
const startedAt = Date.now();
let totalRequests = 0;
let healthChecks = 0;

function getInstanceId() {
  // Optional value can be supplied by EC2 User Data or a systemd environment file.
  return process.env.INSTANCE_ID || "Not configured (hostname fallback below)";
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data, null, 2));
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

const server = http.createServer((req, res) => {
  totalRequests += 1;

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    healthChecks += 1;
    return sendJson(res, 200, {
      status: "healthy",
      application: "AWS EC2 Health Monitor",
      hostname: os.hostname(),
      timestamp: new Date().toISOString()
    });
  }

  if (url.pathname === "/api/status") {
    return sendJson(res, 200, {
      application: "AWS EC2 Health Monitor",
      status: "running",
      hostname: os.hostname(),
      instanceId: getInstanceId(),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      processUptimeSeconds: Math.floor(process.uptime()),
      totalRequests,
      healthChecks,
      memory: {
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    });
  }

  if (url.pathname === "/api/health") {
    return sendJson(res, 200, {
      status: "healthy",
      checks: {
        nodeProcess: "OK",
        httpServer: "OK"
      },
      note: "This lightweight app does not connect to a database or AWS APIs."
    });
  }

  if (url.pathname === "/") {
    const hostname = os.hostname();
    const uptime = Math.floor((Date.now() - startedAt) / 1000);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });

    return res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AWS EC2 Health Monitor</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #f3f6fb; color: #182230; }
    header { background: #172b4d; color: white; padding: 24px 18px; }
    header h1 { margin: 0 0 8px; font-size: 25px; }
    header p { margin: 0; color: #d7e3f4; }
    main { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .card { background: white; padding: 18px; border-radius: 10px; border: 1px solid #dfe6ef; box-shadow: 0 2px 7px #14213d0a; }
    .label { font-size: 13px; color: #526277; margin-bottom: 9px; }
    .value { font-size: 20px; font-weight: bold; overflow-wrap: anywhere; }
    .healthy { color: #14804a; }
    h2 { font-size: 19px; margin: 26px 0 12px; }
    .links a { display: inline-block; margin: 5px 8px 5px 0; padding: 10px 12px; background: #e6efff; color: #164a9b; border-radius: 7px; text-decoration: none; }
    .note { line-height: 1.5; color: #526277; font-size: 14px; }
    footer { margin-top: 24px; padding: 18px 0; color: #65748a; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>AWS EC2 Health Monitor</h1>
    <p>Lightweight Node.js dashboard for EC2, ALB and Auto Scaling practice</p>
  </header>
  <main>
    <div class="grid">
      <section class="card"><div class="label">Application status</div><div class="value healthy">● RUNNING</div></section>
      <section class="card"><div class="label">Server hostname</div><div class="value">${htmlEscape(hostname)}</div></section>
      <section class="card"><div class="label">Configured instance ID</div><div class="value">${htmlEscape(getInstanceId())}</div></section>
      <section class="card"><div class="label">Node.js version</div><div class="value">${htmlEscape(process.version)}</div></section>
      <section class="card"><div class="label">Application uptime</div><div class="value">${uptime} sec</div></section>
      <section class="card"><div class="label">Requests received</div><div class="value">${totalRequests}</div></section>
    </div>

    <h2>Test endpoints</h2>
    <div class="card links">
      <a href="/health">Basic health check</a>
      <a href="/api/health">Detailed health API</a>
      <a href="/api/status">Server status JSON</a>
    </div>

    <h2>How to test AWS services</h2>
    <div class="card note">
      <p><strong>EC2:</strong> Open this page using the instance public IP during the first deployment.</p>
      <p><strong>Target Group:</strong> Configure its health-check path as <code>/health</code>.</p>
      <p><strong>ALB:</strong> Open the ALB DNS name and refresh. Compare the server hostname to see which instance answered.</p>
      <p><strong>Auto Scaling:</strong> After configuring a Launch Template and ASG, confirm every new instance starts this application and becomes healthy in the Target Group.</p>
      <p><strong>Important:</strong> Hostname is a reliable per-instance identifier. The optional instance ID field only shows a real EC2 ID when you set the <code>INSTANCE_ID</code> environment variable.</p>
    </div>
    <footer>Updated on page load. Refresh to send another request. No external npm packages or database required.</footer>
  </main>
</body>
</html>`);
  }

  return sendJson(res, 404, {
    error: "Not found",
    availableEndpoints: ["/", "/health", "/api/health", "/api/status"]
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`AWS EC2 Health Monitor listening on port ${PORT}`);
  console.log(`Health check path: /health`);
});
