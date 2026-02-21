# docker-http-ws-example

![Coverage](https://raw.githubusercontent.com/kitsuyui/octocov-central/main/badges/kitsuyui/docker-http-ws-example/coverage.svg)

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

## Expected output

### Client (Web Browser)

Open the browser and navigate to `http://localhost:8000`.

```
[2025-01-01T01:23:45.678Z] Connected to WebSocket server
[2025-01-01T01:23:45.679Z] Sending: PING
[2025-01-01T01:23:45.680Z] Received: PONG
```

### Server (Terminal)

```
Server running at http://0.0.0.0:8000
Received: PING
Sending: PONG
```

## License

ISC
