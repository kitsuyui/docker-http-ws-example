import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { connect } from "node:net";
import test from "node:test";
import { WebSocket } from "ws";
import { request } from "node:http";

test("websocket connection supports server and client ping flow", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const { port } = await waitForListeningAddress(server);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);

  t.after(() => {
    ws.close();
  });

  assert.equal(await readNextMessage(ws), "PING");

  ws.send("PING");
  assert.equal(await readNextMessage(ws), "PONG");
});

test("GET / returns 200 HTML with page content", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const { port } = await waitForListeningAddress(server);
  const { statusCode, contentType, body } = await httpGet(
    `http://127.0.0.1:${port}/`,
  );

  assert.equal(statusCode, 200);
  assert.match(contentType, /text\/html/);
  assert.match(body, /<!DOCTYPE html>/);
  assert.match(body, /const createWebSocketAddress = \(location\) =>/);
});

test("GET /unknown returns 404", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const { port } = await waitForListeningAddress(server);
  const { statusCode } = await httpGet(`http://127.0.0.1:${port}/favicon.ico`);

  assert.equal(statusCode, 404);
});

test("POST / returns 404", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const { port } = await waitForListeningAddress(server);
  const { statusCode } = await httpRequest("POST", `http://127.0.0.1:${port}/`);

  assert.equal(statusCode, 404);
});

test("command line host and port override environment defaults", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      HOST: "192.0.2.1",
      PORT: "8000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const { host } = await waitForListeningAddress(server);
  assert.equal(host, "127.0.0.1");
});

test("named host and port flags configure the listening address", async (t) => {
  const server = spawn(
    process.execPath,
    ["index.js", "--host", "127.0.0.1", "--port", "0"],
    {
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        HOST: "192.0.2.1",
        PORT: "8000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  t.after(() => {
    server.kill();
  });

  const { host } = await waitForListeningAddress(server);
  assert.equal(host, "127.0.0.1");
});

test("equals-form host and port flags configure the listening address", async (t) => {
  const server = spawn(
    process.execPath,
    ["index.js", "--host=127.0.0.1", "--port=0"],
    {
      cwd: import.meta.dirname,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  t.after(() => {
    server.kill();
  });

  const { host } = await waitForListeningAddress(server);
  assert.equal(host, "127.0.0.1");
});

test("unknown named flags fail before listening", async () => {
  const server = spawn(process.execPath, ["index.js", "--hostname"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { code, stderr } = await waitForExit(server);

  assert.equal(code, 1);
  assert.match(stderr, /Unknown option: --hostname/);
});

test("non-numeric port fails with a clear error before listening", async () => {
  const server = spawn(
    process.execPath,
    ["index.js", "127.0.0.1", "abc"],
    {
      cwd: import.meta.dirname,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const { code, stderr } = await waitForExit(server);

  assert.equal(code, 1);
  assert.match(stderr, /Invalid port: abc/);
});

test("out-of-range port fails with a clear error before listening", async () => {
  const server = spawn(
    process.execPath,
    ["index.js", "127.0.0.1", "99999"],
    {
      cwd: import.meta.dirname,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const { code, stderr } = await waitForExit(server);

  assert.equal(code, 1);
  assert.match(stderr, /Invalid port: 99999/);
});

test("websocket connection errors stay scoped to the client", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const { port } = await waitForListeningAddress(server);
  const rawSocket = await openRawWebSocket(port);

  t.after(() => {
    rawSocket.destroy();
  });

  await sendInvalidUnmaskedFrame(rawSocket);
  await waitForSocketClose(rawSocket);

  assert.equal(server.exitCode, null);

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);

  t.after(() => {
    ws.close();
  });

  assert.equal(await readNextMessage(ws), "PING");
});

const waitForListeningAddress = (server) =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      reject(new Error(`server did not start in time. stderr: ${stderr}`));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      server.stdout.off("data", onStdout);
      server.stderr.off("data", onStderr);
      server.off("exit", onExit);
      server.off("error", onError);
    };

    const onStdout = (chunk) => {
      stdout += chunk.toString();
    };

    const onStderr = (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/Server running at (http:\/\/\S+)/);
      if (match) {
        const url = new URL(match[1]);
        cleanup();
        resolve({ host: url.hostname, port: Number(url.port) });
      }
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`server exited before listening: ${code ?? signal}`));
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    server.stdout.on("data", onStdout);
    server.stderr.on("data", onStderr);
    server.on("exit", onExit);
    server.on("error", onError);
  });

const waitForExit = (server) =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      cleanup();
      server.kill();
      reject(new Error(`server did not exit in time. stderr: ${stderr}`));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      server.stdout.off("data", onStdout);
      server.stderr.off("data", onStderr);
      server.off("exit", onExit);
      server.off("error", onError);
    };

    const onStdout = (chunk) => {
      stdout += chunk.toString();
    };

    const onStderr = (chunk) => {
      stderr += chunk.toString();
    };

    const onExit = (code, signal) => {
      cleanup();
      resolve({ code, signal, stdout, stderr });
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    server.stdout.on("data", onStdout);
    server.stderr.on("data", onStderr);
    server.on("exit", onExit);
    server.on("error", onError);
  });

const openRawWebSocket = (port) =>
  new Promise((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port });
    let response = "";

    const timeout = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error("timed out waiting for websocket upgrade"));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    const onConnect = () => {
      const key = randomBytes(16).toString("base64");
      socket.write(
        [
          "GET / HTTP/1.1",
          `Host: 127.0.0.1:${port}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    };

    const onData = (chunk) => {
      response += chunk.toString("latin1");
      if (!response.includes("\r\n\r\n")) {
        return;
      }

      const statusLine = response.split("\r\n", 1)[0];
      if (!statusLine.includes("101")) {
        cleanup();
        socket.destroy();
        reject(new Error(`websocket upgrade failed: ${statusLine}`));
        return;
      }

      cleanup();
      resolve(socket);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("socket closed before websocket upgrade completed"));
    };

    socket.on("connect", onConnect);
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", onClose);
  });

const sendInvalidUnmaskedFrame = (socket) =>
  new Promise((resolve, reject) => {
    const onError = (error) => {
      socket.off("error", onError);
      reject(error);
    };

    socket.on("error", onError);
    socket.write(Buffer.from([0x81, 0x00]), () => {
      socket.off("error", onError);
      resolve();
    });
  });

const waitForSocketClose = (socket) =>
  new Promise((resolve, reject) => {
    if (socket.destroyed) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for socket to close"));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("close", onClose);
      socket.off("error", onError);
    };

    const onClose = () => {
      cleanup();
      resolve();
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    socket.on("close", onClose);
    socket.on("error", onError);
  });

const readNextMessage = (ws) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for websocket message"));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
    };

    const onMessage = (message) => {
      cleanup();
      resolve(message.toString());
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("websocket closed before a message was received"));
    };

    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
  });

const httpRequest = (method, url) =>
  new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = request(
      {
        method,
        host: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            contentType: res.headers["content-type"] ?? "",
            body,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });

const httpGet = (url) => httpRequest("GET", url);
