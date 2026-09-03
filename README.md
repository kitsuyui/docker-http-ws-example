# docker-http-ws-example

This is a simple example of a web server that serves HTTP and WebSocket requests.
Useful for testing WebSocket connections.

I used this to test if a HTTPS -> HTTP proxy works with WebSocket connections.

## Disclaimer

- This is a simple example and not intended for production use.
- The server is not secure and does not handle errors properly.
- The server is not optimized for performance.

## Security model

The server has **no authentication, no origin check, and no TLS**.
Any client that can reach the listening address can connect over HTTP or WebSocket.

| Run mode | Default bind | Reachable from |
| --- | --- | --- |
| `npm start` (no args) | `127.0.0.1` | localhost only |
| `docker compose up` | `0.0.0.0` inside the container, published via `ports: 8000:8000` | any host on the Docker host's network |

The Docker Compose configuration intentionally binds `0.0.0.0` so the container
port is reachable from the host. This is correct for a local proxy test, but it
means the server is reachable by any process or browser on the same machine (or
the same network segment if the host is multi-homed or on a shared network).

**Safe usage:** run with `docker compose up` on a machine where network access is
already controlled (e.g. a laptop on a private network, or a VM with no external
port exposure). Do not run with `docker compose up` on a server exposed to the
internet without an additional access-control layer in front of it.

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
Connected to WebSocket server
Sending: PING
Received: PING
Sending: PONG
Received: PONG
```

### Server (Terminal)

```
Server running at http://localhost:8000
Sending: PING
Received: PING
Sending: PONG
Received: PONG
```

## Development

Install [lefthook](https://github.com/evilmartians/lefthook) and register the Git hooks:

```sh
lefthook install
```

The following hooks are configured:

- **pre-push**: runs `pnpm run test` (syntax check + test suite)

These hooks mirror the checks that CI runs on every pull request and push to
`main`, so problems are caught locally before they reach the remote.
CI still runs the full suite independently — the hooks bring feedback earlier.

## License

ISC
