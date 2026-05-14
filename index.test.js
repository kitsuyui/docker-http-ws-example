import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { connect } from "node:net";
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

  const { port } = await waitForListeningAddress(server);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);

  t.after(() => {
    ws.close();
  });

  assert.equal(await readNextMessage(ws), "PING");

  ws.send("PING");
  assert.equal(await readNextMessage(ws), "PONG");
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
  await waitForFrameHandling();

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

const waitForFrameHandling = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 100);
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
