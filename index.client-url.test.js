import assert from "node:assert/strict";
import test from "node:test";

import { createWebSocketAddress } from "./index.js";

test("websocket address omits an empty default port", () => {
  assert.equal(
    createWebSocketAddress({ protocol: "http:", host: "example.test" }),
    "ws://example.test",
  );
  assert.equal(
    createWebSocketAddress({ protocol: "https:", host: "example.test" }),
    "wss://example.test",
  );
});

test("websocket address preserves an explicit non-default port", () => {
  assert.equal(
    createWebSocketAddress({ protocol: "http:", host: "example.test:8000" }),
    "ws://example.test:8000",
  );
  assert.equal(
    createWebSocketAddress({ protocol: "https:", host: "example.test:8443" }),
    "wss://example.test:8443",
  );
});
