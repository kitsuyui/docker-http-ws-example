import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { renderContent } from "./index.js";

// Run the inline client script from the rendered HTML in a simulated browser
// context.  Returns handles to the captured state for assertions.
const runClient = (html, { url = "http://localhost:8000/" } = {}) => {
  const endpoint = html.match(/data-websocket-endpoint="([^"]*)"/)?.[1] ?? "";
  const script = html.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script, "expected an inline <script> in the rendered HTML");

  const consoleLog = [];
  const domEntries = [];
  const events = {};
  let capturedWs = null;

  const logDiv = {
    appendChild(el) {
      domEntries.push(el.textContent ?? "");
    },
  };

  const context = {
    Date,
    URL,
    WebSocket: class MockWebSocket {
      constructor(address) {
        this.address = address;
        this.sent = [];
        capturedWs = this;
      }
      send(msg) {
        this.sent.push(msg);
      }
    },
    console: {
      log(msg) {
        consoleLog.push(String(msg));
      },
    },
    document: {
      currentScript: {
        dataset: { websocketEndpoint: endpoint },
      },
      addEventListener(name, callback) {
        events[name] = callback;
      },
      createElement() {
        return { textContent: "" };
      },
      getElementById(id) {
        if (id === "log") return logDiv;
        return null;
      },
    },
    location: new URL(url),
  };

  vm.runInNewContext(script, context);

  const getWs = () => capturedWs;
  return { events, getWs, consoleLog, domEntries };
};

test("DOMContentLoaded creates a WebSocket connection", () => {
  const { events, getWs } = runClient(renderContent());
  events.DOMContentLoaded();
  assert.ok(getWs() !== null, "WebSocket should be created after DOMContentLoaded");
});

test("ws.onopen logs 'Connected' and sends PING", () => {
  const { events, getWs, consoleLog } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onopen();

  assert.ok(
    consoleLog.some((m) => m.includes("Connected")),
    "should log a connected message",
  );
  assert.ok(getWs().sent.includes("PING"), "should send PING on open");
});

test("ws.onmessage with PING sends PONG", () => {
  const { events, getWs } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onopen();
  getWs().onmessage({ data: "PING" });

  assert.ok(getWs().sent.includes("PONG"), "should send PONG on PING message");
});

test("ws.onmessage with PONG does not send a reply", () => {
  const { events, getWs, consoleLog } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onopen();
  getWs().onmessage({ data: "PONG" });

  const sentAfterOpen = getWs().sent.filter((m) => m !== "PING");
  assert.equal(sentAfterOpen.length, 0, "should not send on PONG message");
  assert.ok(
    consoleLog.some((m) => m.includes("PONG")),
    "should log received PONG",
  );
});

test("ws.onclose logs a disconnect message", () => {
  const { events, getWs, consoleLog } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onopen();
  getWs().onclose();

  assert.ok(
    consoleLog.some((m) => m.includes("Disconnected")),
    "should log disconnect on close",
  );
});

test("ws.onerror logs an error message", () => {
  const { events, getWs, consoleLog } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onerror();

  assert.ok(
    consoleLog.some((m) => m.toLowerCase().includes("error")),
    "should log an error on ws.onerror",
  );
});

test("writeLog appends a timestamped entry to the DOM #log div", () => {
  const { events, getWs, domEntries } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onopen();

  assert.ok(domEntries.length > 0, "should append at least one entry to #log");
  assert.ok(
    domEntries[0].includes("Connected"),
    "first #log entry should mention Connected",
  );
  assert.match(
    domEntries[0],
    /^\[.+\] /,
    "log entries should start with a [timestamp] prefix",
  );
});

test("writeLog appends received message to the DOM #log div", () => {
  const { events, getWs, domEntries } = runClient(renderContent());
  events.DOMContentLoaded();
  getWs().onopen();
  const countAfterOpen = domEntries.length;
  getWs().onmessage({ data: "PONG" });

  assert.ok(
    domEntries.length > countAfterOpen,
    "should append a new entry for received message",
  );
  assert.ok(
    domEntries.some((m) => m.includes("PONG")),
    "should include received data in #log",
  );
});
