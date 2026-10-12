# Fixture provenance

`home.pen` is self-authored, schema-derived test data, NOT an official mock, an official exported file, or a live Pencil document. Field names, variables/themes, frame/ref/descendants examples follow the official format documentation retrieved 2026-10-09:

https://docs.pencil.dev/for-developers/the-pen-format

The wrapper version 2.8 is a fixture value, not a claim about the current application schema. No renderer conversion is attempted. The dark ref intentionally illustrates that saved-file intake must not claim instance evaluation or a visual baseline.

`mock_mcp.py` is a self-authored MCP protocol test double. Tool names are grounded in the live tool inventory documentation; schemas and replies are fixture-specific and are NOT claimed to be official tool schemas:

https://docs.pencil.dev/getting-started/ai-integration

https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

React/Vue browser fixtures test the capture/measurement code with real framework runtimes. They are not generated-page fidelity evaluations. Native runner fixtures do not run iOS/Android applications.

Live Pencil still requires an authenticated CLI or a running app/IDE host. The workflow records an explicit not_run when that environment is absent, rather than replacing it with mock success.
