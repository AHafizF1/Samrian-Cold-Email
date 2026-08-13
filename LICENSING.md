# Licensing

Samrian uses component-based licensing. This is not a dual license over the same code.

| Path                                                              | License           |
| ----------------------------------------------------------------- | ----------------- |
| Application, server, workers, migrations, and operational scripts | AGPL-3.0-or-later |
| `packages/contracts`                                              | MIT               |
| `packages/sdk`                                                    | MIT               |
| `packages/cli`                                                    | MIT               |
| `packages/mcp`                                                    | MIT               |

The root `LICENSE` applies unless a directory contains its own `LICENSE`. Each permissive package
contains a separate MIT license and declares `MIT` in its package manifest. Third-party and
generated files retain their original notices and licenses.

## Network Use

The AGPL permits commercial use, modification, and self-hosting. If you modify the AGPL-covered
software and let users interact with it over a network, review section 13 of the AGPL and provide
those users access to the corresponding source for the version you operate.

Production operators should set `NEXT_PUBLIC_SOURCE_URL` to a durable URL containing the matching
source. Forks should point this value at their own corresponding source, not an unrelated upstream
revision.

## Packages

The contracts, SDK, CLI, and MCP packages are MIT-licensed so clients and integrations can use them
without extending the application license into their own code. Their licenses do not change the
license of Samrian application or server code.

## Brand

Copyright licenses do not grant rights to present a fork as the official Samrian product. See
[`TRADEMARKS.md`](TRADEMARKS.md) for practical brand-use guidance.

This document summarizes repository boundaries and is not legal advice. The license texts control.
