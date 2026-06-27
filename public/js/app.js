// ==========================================
// CONFIGURACIÓN CENTRAL DE LA APP
// ==========================================
const API_URL = ''; // Dejar vacío si el backend corre en el mismo servidor de Render
let currentUser = null;

// Ejecutar acciones inmediatas al cargar la web
document.addEventListener('DOMContentLoaded', () => {
    // Intentar recuperar la sesión guardada para que no pida login al recargar
    const savedUser = localStorage.getItem('micronation_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showMainInterface();
        } catch (e) {
            localStorage.removeItem('micronation_user');
            showLoginInterface();
        }
    } else {
        showLoginInterface();
    }
});

// ==========================================
// AUTENTICACIÓN (LOGIN)
// ==========================================
async function doLogin(event) {
    if (event) event.preventDefault();
    
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorMessage = document.getElementById('loginErrorMessage');
    
    if (!emailInput || !passwordInput) {
        alert("Faltan los inputs de loginEmail o loginPassword en tu HTML.");
        return;
    }

    if (errorMessage) errorMessage.textContent = '';

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailInput.value.trim(),
                password: passwordInput.value
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Credenciales inválidas');
        }

        // Guardamos de forma global el usuario retornado
        currentUser = result.user;
        localStorage.setItem('micronation_user', JSON.stringify(currentUser));
        
        // Cambiar de pantalla e inicializar datos
        showMainInterface();

    } catch (error) {
        console.error('❌ Error en el Login:', error.message);
        if (errorMessage) {
            errorMessage.textContent = error.message;
        } else {
            alert(error.message);
        }
    }
}

// Ocultar sesión al salir
function doSignOut() {
    currentUser = null;
    localStorage.removeItem('micronation_user');
    showLoginInterface();
}

// ==========================================
// INTERFAZ DE USUARIO: PANTALLAS
// ==========================================
function showMainInterface() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (loginSection) loginSection.style.display = 'none';
    if (appSection) appSection.style.display = 'block';
    if (userNameDisplay && currentUser) userNameDisplay.textContent = currentUser.name;

    // Cargar los registros existentes en la tabla del panel principal
    loadRecords();
}

function showLoginInterface() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');

    if (loginSection) loginSection.style.display = 'block';
    if (appSection) appSection.style.display = 'none';
}

// ==========================================
// VEHICULAR REGISTROS DE SUPABASE (TABLA PRINCIPAL)
// ==========================================
async function loadRecords() {
    const recordsTableBody = document.getElementById('recordsTableBody');
    if (!recordsTableBody) return;

    try {
        const response = await fetch(`${API_URL}/api/records`, {
            method: 'GET',
            credentials: 'include' // Obligatorio para leer cookies de sesión en Render
        });

        if (response.status === 401) {
            doSignOut();
            return;
        }

        const records = await response.json();
        recordsTableBody.innerHTML = '';

        if (!Array.isArray(records) || records.length === 0) {
            recordsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#777;">No hay registros creados.</td></tr>`;
            return;
        }

        records.forEach(rec => {
            const tr = document.createElement('tr');
            // Adaptar dinámicamente si data viene formateado como objeto o texto plano
            const recordData = typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data;
            const previewText = Object.values(recordData || {}).slice(0, 2).join(' - ') || 'Registro vacío';
            const dateStr = new Date(rec.created_at).toLocaleDateString();

            tr.innerHTML = `
                <td style="padding:12px; border-bottom:1px solid #eee;"><strong>#${rec.citizen_number || '---'}</strong></td>
                <td style="padding:12px; border-bottom:1px solid #eee;">${previewText}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; color:#666;">${dateStr}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align:right;">
                    <button onclick="deleteRecord('${rec.id}')" style="background:#ff4d4d; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">Eliminar</button>
                </td>
            `;
            recordsTableBody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error al cargar registros:", e);
    }
}

// ==========================================
// VENTANA MODAL COMPLETA CON RESGUARDO DINÁMICO
// ==========================================
function openNewRecordModal() {
    const modal = document.getElementById('newRecordModal');
    let formContainer = document.getElementById('modalFormContainer');
    
    if (!modal || !formContainer) {
        console.error("❌ Estructura HTML de la modal o el contenedor de campos no fue encontrada.");
        return;
    }

    formContainer.innerHTML = '';
    let campos = [];
    
    if (currentUser && currentUser.nation && currentUser.nation.fields) {
        const fieldsData = currentUser.nation.fields;
        
        if (typeof fieldsData === 'string') {
            try { campos = JSON.parse(fieldsData); } catch (e) { campos = []; }
        } else if (Array.isArray(fieldsData)) {
            campos = fieldsData;
        }
    }

    // SEGURO ANTIBLANCO ADAPTADO: Si Supabase no tiene campos, dibuja estos de auxilio
    if (!campos || campos.length === 0) {
        console.warn("⚠️ No se detectaron campos guardados en Supabase. Cargando campos base.");
        campos = [
            { name: 'nombre_completo', label: 'Nombre Completo', type: 'text', required: true },
            { name: 'documento_identidad', label: 'Documento / DNI', type: 'text', required: true },
            { name: 'notas_adicionales', label: 'Notas / Observaciones', type: 'text', required: false }
        ];
    }

    campos.forEach(campo => {
        const labelText = campo.label || campo.name || (typeof campo === 'string' ? campo : 'Campo');
        const inputType = campo.type || 'text';
        const inputName = campo.name || labelText.toLowerCase().replace(/\s+/g, '_');
        const requiredAttr = campo.required ? 'required' : '';

        const fieldGroup = document.createElement('div');
        fieldGroup.style.marginBottom = '15px';
        fieldGroup.style.display = 'flex';
        fieldGroup.style.flexDirection = 'column';
        fieldGroup.style.textAlign = 'left';

        fieldGroup.innerHTML = `
            <label style="font-weight: 600; margin-bottom: 5px; color: #333; font-family: sans-serif;">
                ${labelText} ${campo.required ? '<span style="color:red">*</span>' : ''}
            </label>
            <input 
                type="${inputType}" 
                name="${inputName}" 
                id="input_field_${inputName}"
                ${requiredAttr} 
                style="padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; width: 100%; box-sizing: border-box;"
            />
        `;
        formContainer.appendChild(fieldGroup);
    });

    modal.style.display = 'flex';
    modal.classList.add('show');
}

function closeNewRecordModal() {
    const modal = document.getElementById('newRecordModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

// Guardar el registro enviado por la modal
async function saveRecord(event) {
    if (event) event.preventDefault();

    const formContainer = document.getElementById('modalFormContainer');
    const inputs = formContainer.querySelectorAll('input, select, textarea');
    
    const payloadData = {};
    inputs.forEach(input => {
        if (input.name) {
            payloadData[input.name] = input.value;
        }
    });

    try {
        const response = await fetch(`${API_URL}/api/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', 
            body: JSON.stringify({ data: payloadData })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al guardar');

        alert('✅ Registro guardado perfectamente en Supabase.');
        closeNewRecordModal();
        loadRecords();

    } catch (error) {
        alert('Hubo un problema: ' + error.message);
    }
}

// Eliminar un registro específico
async function deleteRecord(id) {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
        const response = await fetch(`${API_URL}/api/records/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (response.ok) {
            loadRecords();
        } else {
            const err = await response.json();
            alert(err.error || 'Error al eliminar');
            }
            } catch (e) {
                alert(e.message);
                }
                }