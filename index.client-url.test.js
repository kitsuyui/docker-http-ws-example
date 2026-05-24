import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import * as serverModule from "./index.js";
import { renderContent } from "./index.js";

test("websocket address helper is internal to the served client script", () => {
  assert.equal("createWebSocketAddress" in serverModule, false);
});

test("client websocket URL follows the current page path by default", () => {
  const address = captureWebSocketAddress(renderContent(), {
    url: "https://example.test/proxy/app/",
  });

  assert.equal(address, "wss://example.test/proxy/app/");
});

test("client websocket URL supports a configured path", () => {
  const address = captureWebSocketAddress(
    renderContent({ websocketEndpoint: "/socket" }),
    {
      url: "http://example.test/proxy/app/",
    },
  );

  assert.equal(address, "ws://example.test/socket");
});

test("client websocket URL supports a configured absolute endpoint", () => {
  const address = captureWebSocketAddress(
    renderContent({ websocketEndpoint: "wss://socket.example.test/ws" }),
    {
      url: "https://example.test/proxy/app/",
    },
  );

  assert.equal(address, "wss://socket.example.test/ws");
});

const captureWebSocketAddress = (html, { url }) => {
  const script = html.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script, "expected inline script");

  const endpoint = html.match(/data-websocket-endpoint="([^"]*)"/)?.[1] ?? "";
  const events = {};
  let capturedAddress = "";

  const context = {
    Date,
    URL,
    WebSocket: class {
      constructor(address) {
        capturedAddress = address;
      }

      send() {}
    },
    console: {
      log() {},
    },
    document: {
      currentScript: {
        dataset: {
          websocketEndpoint: endpoint,
        },
      },
      addEventListener(name, callback) {
        events[name] = callback;
      },
      createElement() {
        return {};
      },
      getElementById() {
        return {
          appendChild() {},
        };
      },
    },
    location: new URL(url),
  };

  vm.runInNewContext(script, context);
  events.DOMContentLoaded();

  return capturedAddress;
};
