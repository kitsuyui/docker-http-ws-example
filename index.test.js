import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
      const match = stderr.match(/Server running at http:\/\/([^:]+):(\d+)/);
      if (match) {
        cleanup();
        resolve({ host: match[1], port: Number(match[2]) });
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
