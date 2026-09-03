const writeLog = (message) => {
  console.log(message);
  writeLogToHTML(message);
};

const writeLogToHTML = (message) => {
  const log = document.getElementById("log");
  const p = document.createElement("p");
  p.textContent = message;
  log.appendChild(p);
};

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

const configuredEndpoint =
  document.currentScript?.dataset.websocketEndpoint ?? "";

const setupWebSocket = () => {
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
