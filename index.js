import { createServer } from 'http';
import { pathToFileURL } from 'url';
import { WebSocketServer } from 'ws';

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;

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

    if (arg === "--host" || arg === "--port") {
      const optionName = arg.slice(2);
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }

      options[optionName] = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--host=") || arg.startsWith("--port=")) {
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
  };
};

// Serialization contract: this function is embedded into the browser <script>
// via .toString() (see contentJS below). Any change must satisfy:
//   1. No closures: do not reference variables from the outer Node.js scope.
//   2. No Node.js-specific globals: the function runs in a browser context
//      (no process, require, Buffer, etc.).
// Violations silently pass Node.js tests but fail at browser runtime.
const createWebSocketAddress = (location) => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}`;
};

const USAGE = `Usage: node index.js [--host HOST] [--port PORT]

Options:
  --host HOST   Hostname or IP address to listen on (default: 127.0.0.1, env: HOST)
  --port PORT   Port number to listen on (default: 8080, env: PORT)
  --help        Show this help message and exit`;

const sendResponse = (res, statusCode, headers, body) => {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  if (!res.headersSent) {
    res.writeHead(statusCode, headers);
  }

  res.end(body);
};

export const handleHttpRequest = (req, res) => {
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
        sendResponse(res, 200, { "Content-Type": "text/html" }, content);
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

  const server = createServer(handleHttpRequest);

  const wsServer = new WebSocketServer({ server });

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

const setupWebSocket = () => {
  const createWebSocketAddress = ${createWebSocketAddress.toString()};
  const addr = createWebSocketAddress(location);
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

const content = `<!DOCTYPE html>
<html>
  <head>
    <title>WebSocket Test</title>
  </head>
  <body>
    <script>${contentJS}</script>
    <div id="log"></div>
  </body>
</html>`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
