import { createServer } from 'http';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { WebSocketServer } from 'ws';

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const DEFAULT_WEBSOCKET_ENDPOINT = "";
export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws: wss:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

export const parsePort = (raw) => {
  const n = Number(raw);
  if (raw === "" || !Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(
      `Invalid port: ${String(raw) || "(empty)"}. Expected an integer between 0 and 65535.`,
    );
  }
  return n;
};

export const formatListenUrl = (addressInfo) => {
  const host =
    addressInfo.family === "IPv6"
      ? `[${addressInfo.address}]`
      : addressInfo.address;
  return `http://${host}:${addressInfo.port}`;
};

const escapeLogValue = (value) => JSON.stringify(String(value)).slice(1, -1);

export const resolveHost = (...candidates) => {
  for (const raw of candidates) {
    if (raw === undefined || raw === null) {
      continue;
    }

    const host = String(raw).trim();

    if (host !== "") {
      return host;
    }
  }

  return DEFAULT_HOST;
};

export const resolveServerConfig = (
  argv = process.argv.slice(2),
  env = process.env,
) => {
  const positional = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (
      arg === "--host" ||
      arg === "--port" ||
      arg === "--websocket-endpoint"
    ) {
      const optionName = arg.slice(2);
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }

      options[optionName] = value;
      index += 1;
      continue;
    }

    if (
      arg.startsWith("--host=") ||
      arg.startsWith("--port=") ||
      arg.startsWith("--websocket-endpoint=")
    ) {
      const [option, value] = arg.split("=", 2);

      if (value === "") {
        throw new Error(`${option} requires a value`);
      }

      options[option.slice(2)] = value;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  return {
    host: resolveHost(options.host, positional[0], env.HOST),
    port: parsePort(options.port ?? positional[1] ?? env.PORT ?? DEFAULT_PORT),
    websocketEndpoint:
      options["websocket-endpoint"] ??
      env.WEBSOCKET_ENDPOINT ??
      DEFAULT_WEBSOCKET_ENDPOINT,
  };
};

const USAGE = `Usage: node index.js [--host HOST] [--port PORT] [--websocket-endpoint URL_OR_PATH]

Options:
  --host HOST                 Hostname or IP address to listen on (default: 127.0.0.1, env: HOST)
  --port PORT                 Port number to listen on (default: 8080, env: PORT)
  --websocket-endpoint URL_OR_PATH
                              WebSocket URL or path for the browser client (env: WEBSOCKET_ENDPOINT)
  --help                      Show this help message and exit`;

const escapeHtmlAttribute = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const sendResponse = (res, statusCode, headers, body) => {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  if (!res.headersSent) {
    res.writeHead(statusCode, { ...headers, ...SECURITY_HEADERS });
  }

  res.end(body);
};

const contentJS = readFileSync(new URL("./public/client.js", import.meta.url), "utf8");

export const renderContent = ({ websocketEndpoint = "" } = {}) => {
  const endpointAttribute =
    websocketEndpoint === ""
      ? ""
      : ` data-websocket-endpoint="${escapeHtmlAttribute(websocketEndpoint)}"`;

  return `<!DOCTYPE html>
<html>
  <head>
    <title>WebSocket Test</title>
  </head>
  <body>
    <script${endpointAttribute}>${contentJS}</script>
    <div id="log"></div>
  </body>
</html>`;
};

export const handleHttpRequest = (req, res, options = {}) => {
  req
    .on("error", (err) => {
      console.error("request error:", err);
      sendResponse(
        res,
        400,
        { "Content-Type": "text/plain", Connection: "close" },
        "Bad Request",
      );
    })
    .addListener("end", () => {
      if (req.method === "GET" && req.url === "/") {
        sendResponse(
          res,
          200,
          { "Content-Type": "text/html" },
          renderContent(options),
        );
      } else {
        sendResponse(res, 404, { "Content-Type": "text/plain" }, "Not Found");
      }
    })
    .resume();
};

const main = () => {
  if (process.argv.slice(2).includes("--help")) {
    console.log(USAGE);
    process.exit(0);
  }

  let config;

  try {
    config = resolveServerConfig();
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const { host, port } = config;

  const server = createServer((req, res) => handleHttpRequest(req, res, config));

  const wsServer = new WebSocketServer({ server, maxPayload: 65536 });

  wsServer.on("connection", (ws) => {
    ws.on("error", (error) => {
      console.error(`WebSocket error: ${error.message}`);
    });

    ws.on("close", (code, reason) => {
      const reasonStr = reason.length > 0 ? `, reason=${reason}` : "";
      console.error(`WebSocket closed: code=${code}${reasonStr}`);
    });

    console.error("Sending: PING");
    ws.send("PING", (err) => {
      if (err) console.error("ws send error:", err);
    });

    ws.on("message", (message) => {
      const msg = message.toString();
      console.error(`Received: ${escapeLogValue(msg)}`);
      if (msg === "PING" && ws.readyState === ws.OPEN) {
        console.error("Sending: PONG");
        ws.send("PONG", (err) => {
          if (err) console.error("ws send error:", err);
        });
      }
    });
  });

  wsServer.on("error", (err) => {
    console.error("wsServer error:", err);
    process.exit(1);
  });

  server.on("listening", () => {
    const url = formatListenUrl(server.address());
    console.error(`Server running at ${url}`);
    process.stdout.write(JSON.stringify({ ready: true, url }) + "\n");
  });

  server.on("error", (err) => {
    console.error("server error:", err);
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.error(`${signal} received, shutting down`);
    for (const ws of wsServer.clients) {
      ws.close(1001, "Server shutting down");
    }
    wsServer.close(() => {
      server.close(() => {
        process.exit(0);
      });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  server.listen(port, host);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
