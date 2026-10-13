---
description: Start the project's preview server
---

This workflow starts the Next.js development server for preview.

1. Configure Node 24 environment and start the preview server.
```powershell
$env:Path = "$env:LOCALAPPDATA\nvm\v24.14.0;" + $env:Path; npm run dev
```

2. Once the server is running, use the `browser_subagent` tool or a regular browser to view `http://localhost:9002`.
