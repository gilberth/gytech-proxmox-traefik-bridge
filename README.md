# GYTECH Proxmox Traefik Bridge

![GYTECH Status](https://img.shields.io/badge/status-active-success) ![Proxmox](https://img.shields.io/badge/Proxmox-VE-E57000) ![Traefik](https://img.shields.io/badge/Traefik-Proxy-24a1c1)

Herramienta de automatización personalizada para **GYTECH**. Esta solución inyecta un botón nativo en la interfaz web de Proxmox VE que permite exponer servicios de contenedores LXC a través de Traefik y DNS con un solo clic, soportando **múltiples nodos en clúster**.

---

## 🏗️ Arquitectura

El sistema funciona mediante una cadena de componentes distribuidos:

1. **Chrome Extension (Frontend):** Inyecta el botón "🚀 GYTECH Expose". Detecta inteligentemente el **ID**, **Nombre** y el **Nodo** (ej: `proxmox2`) donde reside el contenedor.
2. **LXC Bridge (Middleware):** Servidor Python que recibe la petición, busca la IP del nodo correspondiente en su mapa interno y se conecta vía SSH.
3. **Proxmox Node (Worker):** Ejecuta el script Bash localmente, genera la configuración YAML y la envía vía **SCP** al servidor central de Docker/Traefik.
4. **Docker Server (Backend):** Traefik detecta el nuevo archivo en caliente y expone el servicio.

```mermaid
graph LR
    A["Browser / Chrome Ext"] -- "JSON (ID, Name, Node)" --> B["LXC Bridge (Python)"]
    B -- "SSH (Selects IP from Map)" --> C["Proxmox Node (Bash)"]
    C -- "Generates YAML & SCP" --> D["Docker Server (Traefik)"]
```

## 📂 Estructura del Repositorio

```plaintext
gytech-proxmox-traefik-bridge/
├── chrome-extension/          # Código fuente de la extensión
│   ├── manifest.json
│   ├── content.js
│   └── icons/
├── lxc-bridge/                # Servidor intermedio (Python)
│   ├── gytech_bridge.py       # Configurar NODE_MAP aquí
│   └── gytech-bridge.service
└── proxmox-host/              # Script de ejecución final
    └── gytech-expose.sh       # Instalar en TODOS los nodos físicos
```

---

## 🚀 Instalación y Despliegue

Sigue estos pasos en orden para configurar el entorno completo.

### Paso 1: Configurar el Servidor Docker/Traefik (Destino Final)

Traefik debe estar configurado para leer archivos dinámicos desde una carpeta.

#### A. En tu `docker-compose.yaml` (Servicio Traefik)

Asegúrate de tener mapeado el volumen para configuraciones dinámicas:

```yaml
volumes:
  - ./data/dynamic:/dynamic_conf  # 🟢 Carpeta donde llegarán los archivos
```

#### B. En tu `traefik.yml`

Habilita el proveedor de archivos:

```yaml
providers:
  file:
    directory: /dynamic_conf
    watch: true
```

---

### Paso 2: Configurar los Nodos Proxmox (Físicos)

Realiza esto en **CADA NODO** de tu clúster (proxmox, proxmox2, etc.).

1. **Copia el script** `proxmox-host/gytech-expose.sh` a `/root/`

2. **Dale permisos de ejecución:**
   ```bash
   chmod +x /root/gytech-expose.sh
   ```

3. **Edita el script** y configura la IP de tu Docker Server:
   ```bash
   TRAEFIK_HOST="root@10.10.10.232"
   ```

4. **Configurar SSH hacia Docker:** El nodo Proxmox debe poder enviar archivos al Docker Server sin contraseña.
   ```bash
   # En la consola de CADA nodo Proxmox:
   ssh-copy-id root@10.10.10.232
   ```

---

### Paso 3: Configurar el LXC Bridge (Intermediario)

Este contenedor orquesta las peticiones.

1. **Copia** `lxc-bridge/gytech_bridge.py` a `/root/` en el contenedor.

2. **Configurar Mapa de Nodos:** Edita el archivo `.py` y actualiza la variable `NODE_MAP` con las IPs de tus nodos físicos:
   ```python
   NODE_MAP = {
       "proxmox": "root@10.10.10.200",
       "proxmox2": "root@10.10.10.201"
   }
   ```

3. **Instala y activa** el servicio systemd (`gytech-bridge.service`).

4. **Configurar SSH hacia los Nodos:** El LXC debe poder entrar a todos los nodos físicos.
   ```bash
   # En la consola del LXC:
   ssh-copy-id root@10.10.10.200
   ssh-copy-id root@10.10.10.201
   ```

---

### Paso 4: Instalar la Extensión de Chrome

1. Carga la carpeta `chrome-extension` en modo desarrollador (`chrome://extensions`).

2. Si la IP del LXC cambia, actualiza `BRIDGE_URL` en `content.js`.

---

## 💻 Uso

### Vía Interfaz Web (Recomendado)

1. Navega a la web de Proxmox.
2. Selecciona un contenedor en cualquier nodo.
3. Clic en "**🚀 GYTECH EXPOSE**".
4. Confirma nombre y puerto.
5. ¡Listo! La URL aparecerá en pantalla y el servicio estará activo en segundos.

### Vía Terminal (Debugging)

Puedes ejecutar el script manualmente desde el nodo donde vive el contenedor:

```bash
# Uso: ./gytech-expose.sh <VMID> <NOMBRE> <PUERTO>
./gytech-expose.sh 103 frigate 5000
```

---

## 🔧 Solución de Problemas Clásicos

### Error: "Permission denied (publickey)"

| Ubicación del Error | Causa | Solución |
|---------------------|-------|----------|
| **Falla el Bridge** | Faltan llaves SSH del LXC → Nodos Proxmox | Ejecutar `ssh-copy-id` desde el LXC a cada nodo |
| **Falla el Script** | Faltan llaves SSH de los Nodos Proxmox → Docker Server | Ejecutar `ssh-copy-id` desde cada nodo al Docker Server |

### El botón dice "Éxito" pero no funciona la URL

1. **Revisa si el archivo `.yml` llegó al servidor Docker:**
   ```bash
   ls /data/traefik/data/dynamic
   ```

2. **Si el archivo está ahí, revisa logs de Traefik:**
   ```bash
   docker logs traefik
   ```

### Error al cambiar de Nodo

- Asegúrate de que el script `gytech-expose.sh` existe en el nuevo nodo y tiene permisos `+x`.
- Verifica que agregaste el nuevo nodo al `NODE_MAP` en el script de Python.

---

## 📝 Licencia

Propiedad de **GYTECH**. Uso interno para automatización de infraestructura.
