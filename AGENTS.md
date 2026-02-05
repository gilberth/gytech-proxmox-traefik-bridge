# AGENTS.md - GYTECH Proxmox Traefik Bridge

## Project Overview

Chrome extension that integrates with Proxmox VE web UI to expose LXC containers via Traefik reverse proxy with automatic DNS registration in AdGuard Home.

**Architecture:** `Chrome Extension → Python Bridge (LXC) → Bash Script (Proxmox Host)`

## Project Structure

```
├── chrome-extension/           # Manifest V3 Chrome Extension
│   ├── manifest.json           # Extension config (matches, permissions)
│   ├── content.js              # Main script injected into Proxmox UI
│   └── icons/icon.svg
├── lxc-bridge/                 # Python HTTP Bridge Service
│   ├── gytech_bridge.py        # HTTP server (port 9876) → SSH to Proxmox
│   └── gytech-bridge.service   # Systemd unit file
└── proxmox-host/
    └── gytech-expose.sh        # Gets LXC IP, creates Traefik YAML, registers DNS
```

## Build/Lint/Test Commands

**No formal build system, package manager, or test framework.**

### Load Chrome Extension (Development)
1. Navigate to `chrome://extensions`
2. Enable "Developer mode" → "Load unpacked" → select `chrome-extension/`

### Deploy Bridge Service
```bash
scp lxc-bridge/gytech_bridge.py root@<LXC_IP>:/root/
scp lxc-bridge/gytech-bridge.service root@<LXC_IP>:/etc/systemd/system/
# On LXC: systemctl daemon-reload && systemctl enable --now gytech-bridge
```

### Deploy Proxmox Script
```bash
scp proxmox-host/gytech-expose.sh root@<PROXMOX_HOST>:/root/
chmod +x /root/gytech-expose.sh
```

### Manual Testing
```bash
# Test bridge API
curl -X POST http://<BRIDGE_IP>:9876/expose \
  -H "Content-Type: application/json" \
  -d '{"vmid": "103", "name": "test-service", "port": "8080", "node": "proxmox"}'

# Test expose script directly on Proxmox
./gytech-expose.sh 103 test-service 8080
```

## Code Style Guidelines

### JavaScript (content.js)

| Aspect | Convention |
|--------|------------|
| **Syntax** | ES6+, no semicolons, single quotes, 4-space indent |
| **Variables** | `camelCase`: `vmData`, `getVMData()` |
| **Constants** | `UPPER_SNAKE_CASE`: `BRIDGE_URL` |
| **DOM IDs** | Prefix with `gytech-` or `gy-`: `#gytech-modal-backdrop` |
| **CSS Classes** | Prefix with `gy-`: `.gy-btn`, `.gy-modal` |
| **Errors** | try/catch + `console.error()` + `alert()` for user feedback |

```javascript
const BRIDGE_URL = 'https://bridge.local.gytech.com.pe/expose'

async function executeAction(vmid, name, port, node, modal) {
    if (!name || !port) return alert("Faltan datos")
    try {
        const response = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port, vmid, name, node })
        })
        // ...
    } catch (err) {
        console.error(err)
        alert("Fallo de conexion")
    }
}
```

### Python (gytech_bridge.py)

| Aspect | Convention |
|--------|------------|
| **Dependencies** | Standard library only (http.server, subprocess, json) |
| **Indent** | 4 spaces, PEP 8 loosely followed |
| **Constants** | `UPPER_SNAKE_CASE`: `PORT`, `PROXMOX_HOST` |
| **Variables** | `snake_case`: `target_port`, `clean_name` |
| **Classes** | `PascalCase`: `GytechHandler` |
| **Security** | Sanitize inputs: `c.isalnum() or c == "-"`, use list-based subprocess |
| **HTTP** | CORS headers required, JSON responses with `status`/`output`/`message` |

```python
# Limpieza basica del nombre para evitar inyeccion de comandos
clean_name = "".join(c for c in target_name if c.isalnum() or c == "-")

ssh_cmd = [
    "ssh", "-o", "StrictHostKeyChecking=no",
    PROXMOX_HOST,
    f"{REMOTE_SCRIPT_PATH} {target_vmid} {clean_name} {target_port}"
]
result = subprocess.run(ssh_cmd, capture_output=True, text=True)
```

### Bash (gytech-expose.sh)

| Aspect | Convention |
|--------|------------|
| **Shebang** | `#!/bin/bash` |
| **Variables** | `UPPER_SNAKE_CASE`: `CT_ID`, `TRAEFIK_SSH_TARGET` |
| **Prefixes** | Category prefixes: `TRAEFIK_*`, `ADGUARD_*` |
| **Errors** | Validate args at start, check exit codes, `exit 1` on failure |
| **Output** | Final line = generated URL (parsed by extension) |

```bash
if [ -z "$CT_ID" ] || [ -z "$CT_NAME" ] || [ -z "$CT_PORT" ]; then
    echo "Error: Faltan argumentos. Uso: $0 <vmid> <nombre> <puerto>"
    exit 1
fi
```

## Configuration Points

| File | Variables |
|------|-----------|
| `manifest.json` | `matches` (Proxmox URLs), `host_permissions` (bridge URL) |
| `gytech_bridge.py` | `PORT` (9876), `PROXMOX_HOST`, `REMOTE_SCRIPT_PATH` |
| `gytech-expose.sh` | `TRAEFIK_SSH_TARGET`, `TRAEFIK_REMOTE_PATH`, `ADGUARD_*`, `DOMAIN` |

## Key Patterns

### VM Detection Regex (JavaScript)
```javascript
// Matches: "Container 103 (gdown) on node 'proxmox2'"
const fullMatch = text.match(
    /(?:Container|VM|Virtual Machine|Contenedor).*?(\d+)\s*\((?!Uptime)(.*?)\).*?on node\s*'(.+?)'/i
)
// fullMatch[1]=vmid, fullMatch[2]=name, fullMatch[3]=node
```

### API Response Structure
```json
{"status": "success|error", "output": "stdout+stderr", "message": "error desc"}
```

## Critical Notes

1. **No Automated Tests** - Test manually via curl and browser
2. **Hardcoded IPs** - Update 10.10.10.x addresses for your network
3. **Credentials in Plaintext** - AdGuard creds in gytech-expose.sh (line 19)
4. **SSH Keys Required** - Bridge LXC needs key-based SSH to Proxmox host
5. **Language** - All comments in Spanish; maintain this convention
6. **CORS Required** - Bridge must return `Access-Control-Allow-Origin: *`
7. **Never use `shell=True`** - Always use list-based subprocess calls for security
