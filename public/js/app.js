<!-- Buscá tu modal y ponale estos IDs y funciones si no las tiene -->
<div id="newRecordModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>New record</h2>
            <button class="close" onclick="closeNewRecordModal()">&times;</button>
        </div>
        
        <!-- ESTE CONTENEDOR TIENE QUE TENER ESTE ID PARA QUE EL JS META LOS INPUTS ACÁ -->
        <div id="modalFormContainer" class="modal-body">
            <!-- El JS va a rellenar esto automáticamente -->
        </div>
        
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeNewRecordModal()">Cancel</button>
            <button class="btn-save" onclick="saveRecord(event)">Save record</button>
        </div>
    </div>
</div>
