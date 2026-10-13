---
description: Build the exported project
---

This workflow installs dependencies and builds the project.

// turbo-all
1. Configure Node 24 environment and install dependencies.
```powershell
$env:Path = "$env:LOCALAPPDATA\nvm\v24.14.0;" + $env:Path; npm install
```

2. Build the Next.js project.
```powershell
$env:Path = "$env:LOCALAPPDATA\nvm\v24.14.0;" + $env:Path; npm run build
```
