
# GYTECH Proxmox Traefik Bridge

![GYTECH Status](https://img.shields.io/badge/status-active-success) ![Proxmox](https://img.shields.io/badge/Proxmox-VE-E57000) ![Traefik](https://img.shields.io/badge/Traefik-Proxy-24a1c1)

Herramienta de automatización personalizada para **GYTECH**. Esta solución inyecta un botón nativo en la interfaz web de Proxmox VE que permite exponer servicios de contenedores LXC a través de Traefik y DNS con un solo clic.

## 🏗️ Arquitectura

El sistema funciona mediante tres componentes conectados:

1.  **Chrome Extension (Frontend):** Inyecta el botón "🚀 GYTECH Expose" en la UI de Proxmox. Detecta el ID y Nombre del contenedor y solicita el puerto interno.
2.  **LXC Bridge (Middleware):** Un servidor ligero en Python que recibe la petición HTTP de la extensión y la traduce a un comando de sistema seguro.
3.  **Proxmox Host (Backend):** Ejecuta el script Bash final que configura las reglas de Traefik/DNS.

```mermaid
graph LR
    A[Browser / Chrome Ext] -- HTTP JSON --> B[LXC Bridge (Python)]
    B -- SSH Command --> C[Proxmox Host (Bash)]
    C -- Configures --> D[Traefik / DNS]
```

📂 Estructura del Repositorio
Plaintext

gytech-proxmox-traefik-bridge/
├── chrome-extension/          # Código fuente de la extensión
│   ├── manifest.json
│   ├── content.js
│   └── icons/
├── lxc-bridge/                # Servidor intermedio (Python)
│   ├── gytech_bridge.py
│   └── gytech-bridge.service
└── proxmox-host/              # Script de ejecución final
    └── gytech-expose.sh
🚀 Instalación y Despliegue
Sigue estos pasos en orden para configurar el entorno.

Paso 1: Configurar el Proxmox Host (Servidor Físico)
Accede por SSH a tu nodo Proxmox (root@pam).

Copia el script proxmox-host/gytech-expose.sh a /root/.

Dale permisos de ejecución:

Bash

chmod +x /root/gytech-expose.sh
(Opcional) Edita el script para ajustar tus rutas de Traefik o dominio base si es necesario.

Paso 2: Configurar el LXC Bridge (Contenedor Intermedio)
Este contenedor actúa como puente de seguridad.

Copia el script lxc-bridge/gytech_bridge.py a /root/ en el contenedor.

Edita gytech_bridge.py y verifica que la variable PROXMOX_HOST apunte a la IP de tu nodo Proxmox.

Configura el servicio systemd para que inicie automáticamente:

Copia lxc-bridge/gytech-bridge.service a /etc/systemd/system/.

Recarga demonios y activa el servicio:

Bash

systemctl daemon-reload
systemctl enable --now gytech-bridge
IMPORTANTE (SSH Keys): El contenedor LXC debe poder conectarse por SSH al Host sin contraseña.

Bash

# En la consola del LXC:
ssh-keygen -t rsa
ssh-copy-id root@<IP_DEL_PROXMOX_HOST>
Paso 3: Instalar la Extensión de Chrome
Abre Google Chrome y ve a chrome://extensions.

Activa el "Modo de desarrollador" (esquina superior derecha).

Haz clic en "Cargar descomprimida" (Load unpacked).

Selecciona la carpeta chrome-extension de este repositorio.

Configuración: Si cambia la IP del contenedor LXC, edita la constante BRIDGE_URL en el archivo content.js y recarga la extensión.

💻 Uso
Entra a la interfaz web de Proxmox.

Selecciona cualquier VM o Contenedor (LXC) en el menú izquierdo.

Verás un botón "🚀 GYTECH EXPOSE" en la barra superior (junto a Start/Shutdown).

Haz clic en el botón.

Confirma el Nombre del Servicio (subdominio) y el Puerto Interno.

Haz clic en EJECUTAR.

El sistema te devolverá la URL generada (ej: https://influxdb.local.gytech.com.pe).

🔧 Solución de Problemas
Error "Network Error" en la extensión:

Verifica que la IP en content.js sea la correcta del LXC.

Asegúrate de estar accediendo a Proxmox vía HTTPS y que el navegador no esté bloqueando contenido mixto (si el bridge es HTTP).

El botón no aparece:

Recarga la página con F5.

Asegúrate de haber seleccionado una VM/CT.

Error "Permission denied" en el log:

Verifica las llaves SSH entre el LXC y el Host (ssh root@<host> date desde el LXC debería funcionar sin password).

📝 Licencia
Propiedad de GYTECH. Uso interno para automatización de infraestructura.
