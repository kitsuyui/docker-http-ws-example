import { createServer } from 'http';
import { pathToFileURL } from 'url';
import { WebSocketServer } from 'ws';

const HOST = process.argv[2] || process.env.HOST || '127.0.0.1';
const PORT = process.argv[3] || process.env.PORT || 8080;

export const createWebSocketAddress = (location) => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}`;
};

const main = () => {
  const host = HOST;
  const port = PORT;

  const server = createServer((req, res) => {
    req
      .addListener("end", () => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
      })
      .resume();
  });

  const wsServer = new WebSocketServer({ server });

  wsServer.on("connection", (ws) => {
    ws.on("error", (error) => {
      console.error(`WebSocket error: ${error.message}`);
    });

    console.error("Sending: PING");
    ws.send("PING");

    ws.on("message", (message) => {
      console.error(`Received: ${message}`);
      if (message.toString() === "PING") {
        console.error("Sending: PONG");
        ws.send("PONG");
      }
    });
  });

  server.on("listening", () => {
    const addressInfo = server.address();
    const url = `http://${addressInfo.address}:${addressInfo.port}`;
    console.error(`Server running at ${url}`);
  });

  server.listen(port, host);
}

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
  ws.onerror = (error) => {
    writeLog("WebSocket error: " + error.message);
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
