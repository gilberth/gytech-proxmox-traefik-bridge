import http.server
import socketserver
import subprocess
import json

# --- CONFIGURACIÓN ---
PORT = 9876
REMOTE_SCRIPT_PATH = "/root/gytech-expose.sh"

# --- MAPA DE CLÚSTER ---
# ¡Aquí definimos a dónde conectarnos según el nombre!
NODE_MAP = {
    "proxmox": "root@10.10.10.200",   # Nodo 1
    "proxmox2": "root@10.10.10.201"   # Nodo 2 (Nuevo)
}
DEFAULT_NODE = NODE_MAP["proxmox"]

class GytechHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/expose':
            try:
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                
                target_port = data.get('port')
                target_vmid = data.get('vmid')
                target_name = data.get('name', 'service')
                
                # Leemos el nodo que envió la extensión
                # .lower() para evitar problemas de mayúsculas/minúsculas
                target_node_key = data.get('node', '').lower() 

                if not target_port: raise ValueError("Falta puerto")

                # Seleccionamos la IP correcta
                ssh_host = NODE_MAP.get(target_node_key)
                
                # Si no reconoce el nodo, avisa y usa el default
                if not ssh_host:
                    print(f"⚠️ Nodo '{target_node_key}' desconocido. Usando Default.")
                    ssh_host = DEFAULT_NODE

                print(f"Petición: {target_name} ({target_vmid}) en {target_node_key} -> SSH: {ssh_host}")

                # Limpieza de nombre
                clean_name = "".join(c for c in target_name if c.isalnum() or c == "-")

                # Comando SSH dinámico
                ssh_cmd = [
                    "ssh", "-o", "StrictHostKeyChecking=no", 
                    ssh_host, 
                    f"{REMOTE_SCRIPT_PATH} {target_vmid} {clean_name} {target_port}"
                ]
                
                result = subprocess.run(ssh_cmd, capture_output=True, text=True)
                
                response = { "status": "success" if result.returncode == 0 else "error", "output": result.stdout + result.stderr }
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

with socketserver.TCPServer(("0.0.0.0", PORT), GytechHandler) as httpd:
    print(f"GYTECH Cluster Bridge activo en puerto {PORT}")
    httpd.serve_forever()
