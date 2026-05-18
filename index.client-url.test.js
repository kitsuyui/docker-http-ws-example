import assert from "node:assert/strict";
import test from "node:test";

import * as serverModule from "./index.js";

test("websocket address helper is internal to the served client script", () => {
  assert.equal("createWebSocketAddress" in serverModule, false);
});
