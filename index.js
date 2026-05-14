import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const HOST = process.env.HOST || process.argv[2] || '127.0.0.1';
const PORT = process.env.PORT || process.argv[3] || 8080;

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
    console.log("Sending: PING");
    ws.send("PING");

    ws.on("message", (message) => {
      console.log(`Received: ${message}`);
      if (message.toString() === "PING") {
        console.log("Sending: PONG");
        ws.send("PONG");
      }
    });
  });

  server.on("listening", () => {
    const addressInfo = server.address();
    const url = `http://${addressInfo.address}:${addressInfo.port}`;
    console.log(`Server running at ${url}`);
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
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const addr = \`\${protocol}//\${location.hostname}:\${location.port}\`;
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

main();
