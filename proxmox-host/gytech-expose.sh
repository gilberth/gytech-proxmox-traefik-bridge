#!/bin/bash

# --- CONFIGURACIÓN CENTRALIZADA ---
# Servidor donde corre Traefik (DockerServer)
TRAEFIK_HOST="root@10.10.10.232"
# Ruta absoluta donde Traefik busca los archivos dinámicos
TRAEFIK_REMOTE_PATH="/data/traefik/data/dynamic"
# Tu dominio base
DOMAIN="local.gytech.com.pe"

# Argumentos recibidos desde el Bridge Python
CT_ID=$1
CT_NAME=$2
CT_PORT=$3

# Validación de argumentos
if [ -z "$CT_ID" ] || [ -z "$CT_NAME" ] || [ -z "$CT_PORT" ]; then
    echo "Error: Faltan argumentos. Uso: $0 <vmid> <nombre> <puerto>"
    exit 1
fi

# 1. Obtener la IP del contenedor (se ejecuta localmente en el nodo donde vive el CT)
CT_IP=$(pct exec $CT_ID -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

if [ -z "$CT_IP" ]; then
  echo "Error: No se pudo obtener la IP del contenedor $CT_ID. ¿Está encendido?"
  exit 1
fi

# 2. Generar el contenido YAML en un archivo temporal local
TMP_FILE="/tmp/${CT_NAME}.yml"

cat <<EOF > "$TMP_FILE"
http:
  routers:
    ${CT_NAME}:
      entryPoints: ["https"]
      middlewares: ["default-headers", "https-redirectscheme"]
      rule: "Host(\`${CT_NAME}.${DOMAIN}\`)"
      service: "${CT_NAME}"
      tls:
        certResolver: "cloudflare"
  services:
    ${CT_NAME}:
      loadBalancer:
        passHostHeader: true
        servers:
          - url: "http://${CT_IP}:${CT_PORT}"
EOF

# 3. ENVIAR AL DOCKERSERVER (SCP)
# Aquí ocurre la magia: enviamos el archivo generado al servidor central
scp -o StrictHostKeyChecking=no "$TMP_FILE" "${TRAEFIK_HOST}:${TRAEFIK_REMOTE_PATH}/"

if [ $? -eq 0 ]; then
  # Si la copia fue exitosa, devolvemos la URL final a la extensión
  echo "https://${CT_NAME}.${DOMAIN}"
  rm "$TMP_FILE" # Borramos el temporal local
else
  echo "Error crítico: No se pudo enviar el archivo al DockerServer ($TRAEFIK_HOST)"
  rm "$TMP_FILE"
  exit 1
fi
