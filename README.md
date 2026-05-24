# docker-http-ws-example

This is a simple example of a web server that serves HTTP and WebSocket requests.
Useful for testing WebSocket connections.

I used this to test if a HTTPS -> HTTP proxy works with WebSocket connections.

## Disclaimer

- This is a simple example and not intended for production use.
- The server is not secure and does not handle errors properly.
- The server is not optimized for performance.

## Proxy Setup

- frp ... https://github.com/kitsuyui/docker-http-ws-example/tree/frp
- ngrok ... https://github.com/kitsuyui/docker-http-ws-example/tree/ngrok
- oauth2-proxy ... https://github.com/kitsuyui/docker-http-ws-example/tree/oauth2-proxy

## Usage

```sh
docker compose up --build
```

For local runs, host and port can be configured with named flags:

```sh
npm start -- --host 127.0.0.1 --port 8000
```

The existing positional form is still supported:

```sh
node index.js 127.0.0.1 8000
```

When no command line values are provided, `HOST` and `PORT` environment
variables are used before falling back to `127.0.0.1:8080`.

The browser client connects to the WebSocket endpoint at the current page path
by default. For example, a page served at `/proxy/app/` connects to
`/proxy/app/` over `ws:` or `wss:`. Set `--websocket-endpoint` or
`WEBSOCKET_ENDPOINT` when a proxy exposes the WebSocket server at a different
path or origin:

```sh
npm start -- --websocket-endpoint /socket
WEBSOCKET_ENDPOINT=wss://ws.example.test/socket npm start
```

## Expected output

### Client (Web Browser)

Open the browser and navigate to `http://localhost:8000`.

```
[2025-01-01T01:23:45.678Z] Connected to WebSocket server
[2025-01-01T01:23:45.679Z] Sending: PING
[2025-01-01T01:23:45.680Z] Received: PING
[2025-01-01T01:23:45.681Z] Sending: PONG
[2025-01-01T01:23:45.682Z] Received: PONG
```

### Server (Terminal)

```
Server running at http://0.0.0.0:8000
Sending: PING
Received: PING
Sending: PONG
Received: PONG
```

## License

ISC
