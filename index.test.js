import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { WebSocket } from "ws";

test("websocket connection supports server and client ping flow", async (t) => {
  const server = spawn(process.execPath, ["index.js", "127.0.0.1", "0"], {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    server.kill();
  });

  const port = await waitForListeningPort(server);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);

  t.after(() => {
    ws.close();
  });

  assert.equal(await readNextMessage(ws), "PING");

  ws.send("PING");
  assert.equal(await readNextMessage(ws), "PONG");
});

const waitForListeningPort = (server) =>
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
      const match = stdout.match(/Server running at http:\/\/[^:]+:(\d+)/);
      if (match) {
        cleanup();
        resolve(Number(match[1]));
      }
    };

    const onStderr = (chunk) => {
      stderr += chunk.toString();
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
