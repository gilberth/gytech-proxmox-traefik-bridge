import http.server
import socketserver
import subprocess
import json

# --- CONFIGURACIÓN ---
PORT = 9876
PROXMOX_HOST = "root@10.10.10.200"
REMOTE_SCRIPT_PATH = "/root/gytech-expose.sh" 

class GytechHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/expose':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data)
                
                target_port = data.get('port')
                target_vmid = data.get('vmid')
                # Recibimos el nombre o usamos "service" por defecto si falla
                target_name = data.get('name', 'service') 

                if not target_port or not str(target_port).isdigit():
                    raise ValueError("El puerto debe ser un número válido")

                # Limpieza básica del nombre para evitar inyección de comandos
                # Solo permitimos letras, números y guiones
                clean_name = "".join(c for c in target_name if c.isalnum() or c == "-")

                print(f"Solicitud: ID={target_vmid} Name={clean_name} Port={target_port}")

                # COMANDO CORREGIDO: Usamos clean_name en vez de "portainer"
                ssh_cmd = [
                    "ssh", "-o", "StrictHostKeyChecking=no", 
                    PROXMOX_HOST, 
                    f"{REMOTE_SCRIPT_PATH} {target_vmid} {clean_name} {target_port}"
                ]
                
                result = subprocess.run(ssh_cmd, capture_output=True, text=True)
                
                response_payload = {
                    "status": "success" if result.returncode == 0 else "error",
                    "output": result.stdout + result.stderr
                }
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response_payload).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

print(f"GYTECH Bridge (Name-Aware) corriendo en puerto {PORT}...")
with socketserver.TCPServer(("0.0.0.0", PORT), GytechHandler) as httpd:
    httpd.serve_forever()