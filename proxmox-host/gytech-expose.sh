#!/bin/bash

# ==============================================================================
# GYTECH AUTOMATION - EXPOSE LXC TO TRAEFIK & ADGUARD
# Autor: Gilberth (GYTECH)
# Descripción: Automatiza la creación de DNS y Reglas de Enrutamiento para LXC.
# ==============================================================================

# --- CONFIGURACIÓN DE INFRAESTRUCTURA ---
# Servidor Docker donde corre Traefik
TRAEFIK_SSH_USER="user"
TRAEFIK_HOST="10.10.10.xxxx"
# Ruta ABSOLUTA en el servidor Docker donde Traefik busca configuraciones dinámicas
TRAEFIK_DATA_PATH="/data/traefik/data/dynamic"

# Servidor AdGuard Home (DNS)
ADGUARD_HOST="10.10.10.xxx"
ADGUARD_USER="admin"
ADGUARD_PASS="admin" # ⚠️ Se recomienda usar variables de entorno para mayor seguridad

# Configuración de Dominio
DOMAIN_SUFFIX=".local.gytech.com.pe"

# --- VALIDACIÓN DE ARGUMENTOS ---
if [ "$#" -lt 2 ]; then
    echo "❌ Error de Uso."
    echo "Sintaxis: $0 <VMID> <NOMBRE_SERVICIO> [PUERTO]"
    echo "Ejemplos:"
    echo "  $0 105 grafana        (Usa puerto 80 por defecto)"
    echo "  $0 106 portainer 9000 (Usa puerto 9000)"
    exit 1
fi

VMID=$1
RAW_NAME=$2
PORT=${3:-80} # Si no se especifica 3er argumento, usa 80.

# 1. LIMPIEZA DE NOMBRE
# Permite ingresar "servicio" o "servicio.local.gytech..." y funciona igual.
SERVICE_NAME=${RAW_NAME%%.*}
FULL_DOMAIN="${SERVICE_NAME}${DOMAIN_SUFFIX}"

# 2. OBTENER IP DEL LXC DESDE PROXMOX
echo "🔍 [1/3] Buscando IP del contenedor $VMID..."
LXC_IP=$(pct exec $VMID -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

if [ -z "$LXC_IP" ]; then
    echo "❌ Error: No se pudo detectar la IP. Verifica que el LXC ($VMID) esté ENCENDIDO."
    exit 1
fi
echo "✅ IP Detectada: $LXC_IP"

# 3. CONFIGURAR ADGUARD (DNS REWRITE)
echo "📡 [2/3] Creando registro DNS ($FULL_DOMAIN -> $TRAEFIK_HOST)..."
curl -s -u "$ADGUARD_USER:$ADGUARD_PASS" -H "Content-Type: application/json" \
    -d "{\"domain\": \"$FULL_DOMAIN\", \"answer\": \"$TRAEFIK_HOST\"}" \
    http://$ADGUARD_HOST/control/rewrite/add > /dev/null

# 4. GENERAR E INYECTAR CONFIGURACIÓN EN TRAEFIK
echo "🚀 [3/3] Inyectando configuración en Traefik..."

# Definición del archivo YAML (Heredoc)
YAML_CONTENT="http:
  routers:
    ${SERVICE_NAME}:
      entryPoints:
        - https
      middlewares:
        - default-headers
        - https-redirectscheme
      rule: \"Host(\`${FULL_DOMAIN}\`)\"
      service: \"${SERVICE_NAME}\"
      tls:
        certResolver: cloudflare

  services:
    ${SERVICE_NAME}:
      loadBalancer:
        passHostHeader: true
        servers:
          - url: \"http://${LXC_IP}:${PORT}\""

# Envío seguro por SSH usando tubería (evita errores de comillas)
echo "$YAML_CONTENT" | ssh -o BatchMode=yes -o StrictHostKeyChecking=no $TRAEFIK_SSH_USER@$TRAEFIK_HOST "cat > ${TRAEFIK_DATA_PATH}/${SERVICE_NAME}.yml"

echo "✅ DESPLIEGUE EXITOSO"
echo "🔗 URL: https://$FULL_DOMAIN"
echo "🎯 Destino: http://$LXC_IP:$PORT"