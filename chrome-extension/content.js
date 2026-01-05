// --- CONFIGURACIÓN ---
const BRIDGE_URL = 'http://10.10.10.50:9876/expose'; 

// --- 1. ESTILOS (Sin cambios) ---
const style = document.createElement('style');
style.textContent = `
    #gytech-btn-wrapper { position: fixed; z-index: 99999; display: none; align-items: center; justify-content: center; }
    #gytech-modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 100000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
    #gytech-modal-window { background: #333; width: 400px; border: 1px solid #555; box-shadow: 0 20px 50px rgba(0,0,0,0.7); border-radius: 4px; font-family: Arial, sans-serif; color: white; overflow: hidden; }
    .gy-header { background: #383f44; padding: 12px 15px; font-weight: bold; font-size: 14px; border-bottom: 1px solid #555; display: flex; justify-content: space-between; align-items: center; }
    .gy-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
    .gy-field-group { display: flex; flex-direction: column; gap: 5px; }
    .gy-label { font-size: 12px; color: #ccc; font-weight: 600; }
    .gy-input { background: #111; border: 1px solid #555; color: #E95420; padding: 8px 10px; font-size: 15px; border-radius: 3px; width: 100%; box-sizing: border-box; font-weight: bold; outline: none; font-family: monospace; }
    .gy-input:focus { border-color: #E95420; background: #000; }
    .gy-footer { padding: 12px 15px; background: #2a2a2a; border-top: 1px solid #444; display: flex; justify-content: flex-end; gap: 10px; }
    .gy-btn { padding: 8px 16px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold; border: none; text-transform: uppercase; }
    .gy-btn-cancel { background: #444; color: #ddd; }
    .gy-btn-cancel:hover { background: #555; }
    .gy-btn-run { background: #E95420; color: #fff; }
    .gy-btn-run:hover { background: #ff6b3d; }
    .gy-result-box { background: #1a1a1a; border: 1px solid #21A366; padding: 15px; border-radius: 4px; word-break: break-all; color: #21A366; font-family: monospace; margin-top: 5px; text-align: center; }
    .gy-link { color: #21A366; text-decoration: none; font-weight: bold; font-size: 14px; }
    .gy-link:hover { text-decoration: underline; }
`;
document.head.appendChild(style);

// --- 2. LÓGICA DE DETECCIÓN DE NODO (AQUÍ ESTÁ LA MAGIA) ---
function getVMData() {
    let vmid = null;
    let vmname = "";
    let node = ""; // Variable para guardar el nodo (ej: proxmox2)

    // Buscamos en el título visible de la página (La barra superior)
    // Ese texto dice algo como: "Container 103 (gdown) on node 'proxmox2'"
    const candidates = document.querySelectorAll('.x-panel-header-text, .x-title-text');
    
    for (let el of candidates) {
        const text = el.innerText || "";
        
        // EXPRESIÓN REGULAR ACTUALIZADA:
        // 1. Busca Container/VM...
        // 2. Captura el ID (\d+)
        // 3. Captura el Nombre entre paréntesis \((.*?)\) ignorando "Uptime"
        // 4. Captura el nodo después de "on node '...'"
        const fullMatch = text.match(/(?:Container|VM|Virtual Machine|Contenedor).*?(\d+)\s*\((?!Uptime)(.*?)\).*?on node\s*'(.+?)'/i);
        
        if (fullMatch) {
            vmid = fullMatch[1];   // ej: 103
            vmname = fullMatch[2]; // ej: gdown
            node = fullMatch[3];   // ej: proxmox2
            break; 
        }
    }
    
    // Si la regex compleja falla, intentamos sacar solo el ID de la URL y el nodo del cuerpo
    if (!vmid) {
        const hash = decodeURIComponent(window.location.hash);
        const matchIdUrl = hash.match(/(lxc|qemu)\/(\d+)/);
        if (matchIdUrl) vmid = matchIdUrl[2];
    }

    return { id: vmid, name: vmname, node: node };
}

// --- 3. CREAR EL BOTÓN ---
function createProxmoxButton() {
    const wrapper = document.createElement('div');
    wrapper.id = 'gytech-btn-wrapper';
    wrapper.innerHTML = `
        <a class="x-btn x-unselectable x-box-item x-toolbar-item x-btn-default-toolbar-small" role="button" hidefocus="on" unselectable="on" tabindex="0" id="gytech-real-btn" style="right: auto; left: 0px; top: 0px; margin: 0px;">
            <span class="x-btn-wrap x-btn-wrap-default-toolbar-small" role="presentation" unselectable="on">
                <span class="x-btn-button x-btn-button-default-toolbar-small x-btn-text x-btn-icon x-btn-icon-left x-btn-button-center" role="presentation" unselectable="on">
                    <span class="x-btn-icon-el x-btn-icon-el-default-toolbar-small fa fa-rocket" role="presentation" unselectable="on" style="color: #E95420;"></span>
                    <span class="x-btn-inner x-btn-inner-default-toolbar-small" unselectable="on">GYTECH Expose</span>
                </span>
            </span>
        </a>`;
    
    const link = wrapper.querySelector('a');
    link.onclick = (e) => {
        e.preventDefault();
        const vmData = getVMData();
        if (vmData.id) showModal(vmData);
        else alert("⚠️ Selecciona una VM primero (asegúrate que cargue el panel derecho).");
    };
    link.onmouseenter = () => link.classList.add('x-btn-over');
    link.onmouseleave = () => link.classList.remove('x-btn-over');
    return wrapper;
}

// --- 4. MODAL ---
function showModal(vmData) {
    if (document.getElementById('gytech-modal-backdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'gytech-modal-backdrop';
    
    // Mostramos también el nodo detectado para que estés seguro
    backdrop.innerHTML = `
        <div id="gytech-modal-window">
            <div class="gy-header">
                <span>🚀 Expose: ${vmData.name} (${vmData.node})</span>
                <span style="cursor:pointer; opacity:0.7;" onclick="document.getElementById('gytech-modal-backdrop').remove()">✕</span>
            </div>
            <div class="gy-body" id="gy-modal-body-content">
                <div class="gy-field-group">
                    <div class="gy-label">Nombre del Servicio:</div>
                    <input type="text" class="gy-input" id="gytech-name-input" value="${vmData.name}" placeholder="ej: servicio">
                </div>
                <div class="gy-field-group">
                    <div class="gy-label">Puerto Interno:</div>
                    <input type="text" class="gy-input" id="gytech-port-input" value="9000" placeholder="ej: 8086">
                </div>
            </div>
            <div class="gy-footer" id="gy-modal-footer">
                <button class="gy-btn gy-btn-cancel" id="gy-cancel-btn">Cancelar</button>
                <button class="gy-btn gy-btn-run" id="gy-run-btn">EJECUTAR</button>
            </div>
        </div>`;
    
    document.body.appendChild(backdrop);
    const nameInput = document.getElementById('gytech-name-input');
    const portInput = document.getElementById('gytech-port-input');
    if (!nameInput.value) nameInput.focus(); else { portInput.focus(); portInput.select(); }
    
    document.getElementById('gy-cancel-btn').onclick = () => backdrop.remove();
    
    // AL ENVIAR, INCLUIMOS EL NODO
    const runHandler = () => executeAction(vmData.id, nameInput.value, portInput.value, vmData.node, backdrop);
    document.getElementById('gy-run-btn').onclick = runHandler;
    portInput.addEventListener("keypress", (e) => { if (e.key === "Enter") runHandler(); });
}

// --- 5. EJECUCIÓN (ENVÍA EL NODO AL PYTHON) ---
async function executeAction(vmid, name, port, node, modal) {
    if (!name || !port) return alert("Faltan datos");
    const btn = document.getElementById('gy-run-btn');
    btn.innerText = "PROCESANDO..."; btn.disabled = true;

    try {
        const response = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                port: port, 
                vmid: vmid, 
                name: name,
                node: node // <--- ¡AQUÍ VA EL DATO CLAVE!
            })
        });
        const result = await response.json();

        if (response.ok && result.status === 'success') {
            const cleanOutput = (result.output || "").replace(/\u001b\[[0-9;]*m/g, '');
            const urlMatch = cleanOutput.match(/(https?:\/\/[^\s]+)/);
            const generatedUrl = urlMatch ? urlMatch[0] : null;
            
            modal.querySelector('.gy-header span').innerHTML = "✅ ¡Servicio Expuesto!";
            modal.querySelector('.gy-header span').style.color = "#21A366";
            
            let htmlResult = generatedUrl 
                ? `<div style="text-align: center; color: #ddd; margin-bottom: 10px;">Tu servicio está listo:</div><div class="gy-result-box"><a href="${generatedUrl}" target="_blank" class="gy-link">${generatedUrl}</a></div>`
                : `<pre style="background:#111;padding:10px;font-size:11px;color:#ccc;overflow:auto;">${cleanOutput}</pre>`;
                
            document.getElementById('gy-modal-body-content').innerHTML = htmlResult;
            document.getElementById('gy-modal-footer').innerHTML = `<button class="gy-btn" style="background:#444;color:white;" onclick="document.getElementById('gytech-modal-backdrop').remove()">Cerrar</button> ${generatedUrl ? `<button class="gy-btn" style="background:#21A366;color:white;" onclick="window.open('${generatedUrl}', '_blank')">ABRIR 🔗</button>` : ''}`;
        } else {
            alert("Error: " + result.message);
            btn.innerText = "REINTENTAR"; btn.disabled = false; btn.style.backgroundColor = "#d93025";
        }
    } catch (err) { console.error(err); alert("Fallo de conexión"); btn.innerText = "FAIL"; btn.disabled = false; }
}

// --- 6. POSICIONAMIENTO ---
function findAnchorButton() {
    const buttons = document.querySelectorAll('.x-toolbar .x-btn');
    for (let btn of buttons) {
        if (btn.offsetParent !== null) {
            const txt = btn.innerText || "";
            if (txt.includes('Start') || txt.includes('Iniciar') || btn.querySelector('.fa-play')) return btn;
        }
    }
    return null;
}
function updateButtonPosition() {
    const anchor = findAnchorButton();
    let wrapper = document.getElementById('gytech-btn-wrapper');
    if (!anchor) { if (wrapper) wrapper.style.display = 'none'; return; }
    if (!wrapper) { wrapper = createProxmoxButton(); document.body.appendChild(wrapper); }
    
    const rect = anchor.getBoundingClientRect();
    wrapper.style.display = 'flex';
    const btnWidth = 140; const margin = 10;
    const leftPos = rect.left - btnWidth - margin;
    wrapper.style.top = rect.top + 'px'; wrapper.style.left = leftPos + 'px'; 
    wrapper.style.height = rect.height + 'px'; wrapper.style.width = btnWidth + 'px';
}
window.addEventListener('resize', updateButtonPosition);
const observer = new MutationObserver(updateButtonPosition);
observer.observe(document.body, { childList: true, subtree: true });
setInterval(updateButtonPosition, 500);
