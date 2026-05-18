import assert from "node:assert/strict";
import test from "node:test";

import { parsePort, formatListenUrl, resolveServerConfig } from "./index.js";

test("parsePort accepts valid port numbers", () => {
  assert.equal(parsePort(0), 0);
  assert.equal(parsePort(8080), 8080);
  assert.equal(parsePort(65535), 65535);
  assert.equal(parsePort("3000"), 3000);
});

test("parsePort rejects non-numeric strings", () => {
  assert.throws(() => parsePort("abc"), /Invalid port: abc/);
});

test("parsePort rejects empty string", () => {
  assert.throws(() => parsePort(""), /Invalid port/);
});

test("parsePort rejects fractional numbers", () => {
  assert.throws(() => parsePort("3.14"), /Invalid port: 3\.14/);
});

test("parsePort rejects ports above 65535", () => {
  assert.throws(() => parsePort(99999), /Invalid port: 99999/);
});

test("formatListenUrl produces bracketed IPv6 URL", () => {
  assert.equal(
    formatListenUrl({ address: "::1", port: 8080, family: "IPv6" }),
    "http://[::1]:8080",
  );
});

test("formatListenUrl produces plain IPv4 URL", () => {
  assert.equal(
    formatListenUrl({ address: "127.0.0.1", port: 8080, family: "IPv4" }),
    "http://127.0.0.1:8080",
  );
});

test("resolveServerConfig uses default host and port", () => {
  const config = resolveServerConfig([], {});
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 8080);
});

test("resolveServerConfig throws on invalid port from argv", () => {
  assert.throws(() => resolveServerConfig(["127.0.0.1", "abc"], {}), /Invalid port: abc/);
});
