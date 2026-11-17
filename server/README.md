# server/

Server-only code. Nothing here is bundled into the web or native app.

- `sis/connector.ts`: the read-only SIS connector interface.
- `sis/facts.ts`: FACTS SIS client (not verified against a live FACTS account).

These files run only where secrets can be kept (a server or serverless function).
The app never talks to FACTS directly: it calls the portal API, and the API
calls FACTS. See `docs/facts.md`.
