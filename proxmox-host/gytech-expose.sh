#!/bin/bash

# ==============================================================================
# GYTECH AUTOMATION - EXPOSE LXC (CLUSTER AWARE + ADGUARD)
# ==============================================================================

# --- 1. CONFIGURACIÓN DOCKER/TRAEFIK ---
# Usuario y Host para enviar el archivo por SCP
TRAEFIK_SSH_TARGET="root@10.10.10.232"
# Ruta donde Traefik lee los archivos dinámicos
TRAEFIK_REMOTE_PATH="/data/traefik/data/dynamic"
# La IP que AdGuard debe devolver (LA IP DE TU TRAEFIK, NO LA DEL LXC)
TRAEFIK_DNS_IP="10.10.10.232"

# --- 2. CONFIGURACIÓN ADGUARD HOME ---
# Ajusta la IP y puerto de tu AdGuard
ADGUARD_URL="http://10.10.10.142" 
ADGUARD_USER="admin"
ADGUARD_PASS="admin" # <--- ¡PON TU CONTRASEÑA DE ADGUARD AQUÍ!

# --- 3. DOMINIO BASE ---
DOMAIN="local.gytech.com.pe"

# --- VALIDACIÓN DE ARGUMENTOS ---
CT_ID=$1
CT_NAME=$2
CT_PORT=$3

if [ -z "$CT_ID" ] || [ -z "$CT_NAME" ] || [ -z "$CT_PORT" ]; then
    echo "Error: Faltan argumentos. Uso: $0 <vmid> <nombre> <puerto>"
    exit 1
fi

# ==============================================================================
# PASO 1: OBTENER IP DEL LXC (Localmente en el nodo)
# ==============================================================================
# Esto se ejecuta en el nodo Proxmox donde está el contenedor
CT_IP=$(pct exec $CT_ID -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

if [ -z "$CT_IP" ]; then
  echo "Error: No se pudo obtener la IP del contenedor $CT_ID. ¿Está encendido?"
  exit 1
fi

# ==============================================================================
# PASO 2: GENERAR YAML DE TRAEFIK (Temporal)
# ==============================================================================
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

# ==============================================================================
# PASO 3: ENVIAR A TRAEFIK (SCP / Multi-nodo)
# ==============================================================================
# Enviamos el archivo temporal al servidor Docker central
scp -o StrictHostKeyChecking=no "$TMP_FILE" "${TRAEFIK_SSH_TARGET}:${TRAEFIK_REMOTE_PATH}/"
SCP_STATUS=$?
rm "$TMP_FILE" # Limpieza inmediata

if [ $SCP_STATUS -ne 0 ]; then
  echo "Error crítico: Falló el envío SCP al Docker Server."
  exit 1
fi

# ==============================================================================
# PASO 4: REGISTRAR EN ADGUARD HOME (DNS Rewrite)
# ==============================================================================
FULL_DOMAIN="${CT_NAME}.${DOMAIN}"

# Nota: El registro DNS apunta a la IP de TRAEFIK (10.10.10.232), no a la del LXC.
# Usamos curl con autenticación básica (-u user:pass)
RESPONSE=$(curl -s -u "${ADGUARD_USER}:${ADGUARD_PASS}" \
     -X POST "${ADGUARD_URL}/control/rewrite/add" \
     -H "Content-Type: application/json" \
     -d "{\"domain\": \"$FULL_DOMAIN\", \"answer\": \"$TRAEFIK_DNS_IP\"}")

# Validación simple de AdGuard (Devuelve JSON vacío {} si es exitoso o error si ya existe)
# Si falla AdGuard, igual mostramos la URL porque Traefik ya está configurado.

# ==============================================================================
# PASO 5: RESULTADO FINAL (Para la Extensión de Chrome)
# ==============================================================================
echo "https://${FULL_DOMAIN}"
