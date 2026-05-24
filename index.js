import { createServer } from 'http';
import { pathToFileURL } from 'url';
import { WebSocketServer } from 'ws';

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const DEFAULT_WEBSOCKET_ENDPOINT = "";

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

// Serialization contract: this function is embedded into the browser <script>
// via .toString() (see contentJS below). Any change must satisfy:
//   1. No closures: do not reference variables from the outer Node.js scope.
//   2. No Node.js-specific globals: the function runs in a browser context
//      (no process, require, Buffer, etc.).
// Violations silently pass Node.js tests but fail at browser runtime.
const createWebSocketAddress = (location, endpoint) => {
  const rawEndpoint =
    typeof endpoint === "string" && endpoint.trim() !== ""
      ? endpoint.trim()
      : location.pathname || "/";
  const url = new URL(rawEndpoint, `${location.protocol}//${location.host}`);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }

  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(`Unsupported WebSocket endpoint protocol: ${url.protocol}`);
  }

  return url.href;
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
    res.writeHead(statusCode, headers);
  }

  res.end(body);
};

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

  const wsServer = new WebSocketServer({ server });

  wsServer.on("connection", (ws) => {
    ws.on("error", (error) => {
      console.error(`WebSocket error: ${error.message}`);
    });

    console.error("Sending: PING");
    ws.send("PING", (err) => {
      if (err) console.error("ws send error:", err);
    });

    ws.on("message", (message) => {
      console.error(`Received: ${message}`);
      if (message.toString() === "PING") {
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

  server.listen(port, host);
};

const contentJS = `
const writeLog = (message) => {
  console.log(message);
  writeLogToHTML(message);
};

const writeLogToHTML = (message) => {
  const log = document.getElementById("log");
  const p = document.createElement("p");
  const currentTime = new Date().toISOString();
  p.textContent = \`[\${currentTime}] \${message}\`;
  log.appendChild(p);
};

const configuredEndpoint =
  document.currentScript?.dataset.websocketEndpoint ?? "";

const setupWebSocket = () => {
  const createWebSocketAddress = ${createWebSocketAddress.toString()};
  let addr;
  try {
    addr = createWebSocketAddress(location, configuredEndpoint);
  } catch (error) {
    writeLog(error.message);
    return;
  }
  const ws = new WebSocket(addr);
  ws.onopen = () => {
    writeLog("Connected to WebSocket server");
    writeLog("Sending: PING");
    ws.send("PING");
  };
  ws.onmessage = (event) => {
    writeLog("Received: " + event.data);
    if (event.data === "PING") {
      writeLog("Sending: PONG");
      ws.send("PONG");
    }
  };
  ws.onclose = () => {
    writeLog("Disconnected from WebSocket server");
  };
  ws.onerror = () => {
    writeLog("WebSocket error");
  };
};

document.addEventListener("DOMContentLoaded", setupWebSocket);
`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
