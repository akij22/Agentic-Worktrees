# @agentic-worktrees/web-search

Web Search capability for Agentic Worktrees. It exports the `web_search` tool and ships a static `capability.json` descriptor for review before executable code is loaded.

Install it through the Agentic Worktrees Marketplace or packaged CLI. A regular project-level `npm install @agentic-worktrees/web-search` does not register the capability with the desktop app.

Search uses Exa's automatic keyless mode by default. An optional Exa API key can be stored through Agentic Worktrees settings for authenticated requests.

This package contains executable Node.js code. Agentic Worktrees validates its package contract and runs it in a dedicated utility process, but that process boundary is not a security sandbox.

The implementation is a manual port of [`pi-web-access`](https://github.com/nicobailon/pi-web-access). See `LICENSE.pi-web-access` for its upstream provenance notice.
