/**
 * app.js
 * Lógica principal: navegación entre vistas, carga de metadatos,
 * registro de equipos con validación/confirmación, búsqueda,
 * filtros, resultados y exportación.
 */
const App = (() => {

  let meta = { tipos: [], marcas: [], modelosPorTipoMarca: {}, estados: [] };
  let ultimosResultados = [];
  let ultimosFiltrosTexto = "";
  let equipoPendiente = null;

  // ---------------- INIT ----------------
  async function init() {
    wireNav();
    wireForm();
    wireBuscar();
    wireFiltros();
    wireExport();
    wireModals();
    wireScannerButtons();
    wireConfig();
    await cargarMeta();
  }

  // ---------------- NAVEGACIÓN ----------------
  function wireNav() {
    document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
  }

  function switchView(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }

  // ---------------- METADATOS ----------------
  async function cargarMeta() {
    if (!Api.isConfigured()) {
      notify("Configura la URL de Google Apps Script en ⚙️ para empezar.", "error");
      return;
    }
    try {
      const data = await Api.getMeta();
      meta.tipos = data.tipos || [];
      meta.marcas = data.marcas || [];
      meta.modelosPorTipoMarca = data.modelosPorTipoMarca || {};
      meta.estados = data.estados || ["Bueno", "Regular", "Malo", "Inoperativo", "En reparación", "De baja", "Nuevo"];
      pintarOpciones();
    } catch (err) {
      notify(err.message || "No se pudieron cargar los datos iniciales.", "error");
    }
  }

  function pintarOpciones() {
    fillDatalist("listaTipos", meta.tipos);
    fillDatalist("listaMarcas", meta.marcas);
    fillSelect("estado", meta.estados, "Selecciona un estado");
    fillSelect("filtroTipo", meta.tipos, "Todos", true);
    fillSelect("filtroMarca", meta.marcas, "Todas", true);
    fillSelect("filtroEstado", meta.estados, "Todos", true);
    actualizarModelosFormulario();
    actualizarModelosFiltro();
  }

  function fillDatalist(id, valores) {
    const dl = document.getElementById(id);
    dl.innerHTML = "";
    valores.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
    });
  }

  function fillSelect(id, valores, placeholder, keepEmpty) {
    const sel = document.getElementById(id);
    const actual = sel.value;
    sel.innerHTML = "";
    if (placeholder) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      if (!keepEmpty) opt.disabled = true;
      opt.selected = true;
      sel.appendChild(opt);
    }
    valores.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    if (valores.includes(actual)) sel.value = actual;
  }

  function claveTipoMarca(tipo, marca) {
    return `${(tipo || "").trim().toLowerCase()}|${(marca || "").trim().toLowerCase()}`;
  }

  function actualizarModelosFormulario() {
    const tipo = document.getElementById("tipoEquipo").value;
    const marca = document.getElementById("marca").value;
    const modelos = meta.modelosPorTipoMarca[claveTipoMarca(tipo, marca)] || [];
    fillDatalist("listaModelos", modelos);
  }

  function actualizarModelosFiltro() {
    const tipo = document.getElementById("filtroTipo").value;
    const marca = document.getElementById("filtroMarca").value;
    let modelos = [];
    if (tipo && marca) {
      modelos = meta.modelosPorTipoMarca[claveTipoMarca(tipo, marca)] || [];
    } else {
      const set = new Set();
      Object.values(meta.modelosPorTipoMarca).forEach(arr => arr.forEach(m => set.add(m)));
      modelos = [...set];
    }
    fillSelect("filtroModelo", modelos, "Todos", true);
  }

  // ---------------- FORMULARIO: REGISTRAR ----------------
  function wireForm() {
    document.getElementById("tipoEquipo").addEventListener("input", actualizarModelosFormulario);
    document.getElementById("marca").addEventListener("input", actualizarModelosFormulario);

    document.getElementById("btnLimpiarForm").addEventListener("click", limpiarFormulario);

    document.getElementById("formEquipo").addEventListener("submit", async (e) => {
      e.preventDefault();
      await intentarRegistrar();
    });
  }

  function leerFormulario() {
    return {
      codigoPatrimonial: document.getElementById("codigoPatrimonial").value.trim(),
      tipoEquipo: Validation.normalizarTexto(document.getElementById("tipoEquipo").value),
      codigoSerie: document.getElementById("codigoSerie").value.trim(),
      marca: Validation.normalizarTexto(document.getElementById("marca").value),
      modelo: document.getElementById("modelo").value.trim(),
      estado: document.getElementById("estado").value,
      ubicacion: document.getElementById("ubicacion").value.trim(),
    };
  }

  function limpiarFormulario() {
    document.getElementById("formEquipo").reset();
    fillDatalist("listaModelos", []);
  }

  async function intentarRegistrar() {
    const data = leerFormulario();
    const errores = Validation.validarFormularioEquipo(data);
    if (errores.length) { notify(errores[0], "error"); return; }

    equipoPendiente = data;
    mostrarConfirmacion(data);
  }

  function mostrarConfirmacion(data) {
    document.getElementById("confirmDetails").innerHTML = `
      <div><b>Código patrimonial:</b> ${escapeHtml(data.codigoPatrimonial)}</div>
      <div><b>Tipo:</b> ${escapeHtml(data.tipoEquipo)}</div>
      <div><b>Serie:</b> ${escapeHtml(data.codigoSerie)}</div>
      <div><b>Marca:</b> ${escapeHtml(data.marca)}</div>
      <div><b>Modelo:</b> ${escapeHtml(data.modelo)}</div>
      <div><b>Estado:</b> ${escapeHtml(data.estado)}</div>
      <div><b>Ubicación:</b> ${escapeHtml(data.ubicacion) || "—"}</div>
    `;
    openModal("modalConfirm");
  }

  async function confirmarRegistro() {
    if (!equipoPendiente) return;
    const btn = document.getElementById("btnOkConfirm");
    btn.disabled = true;
    try {
      // Verificación previa de duplicados / unicidad contra el servidor
      const chequeo = await Api.verificarDuplicado(equipoPendiente);

      if (chequeo.duplicadoExacto) {
        closeModal("modalConfirm");
        notify("⚠️ Este equipo ya está registrado.", "error");
        return;
      }
      if (chequeo.patrimonialConflicto) {
        closeModal("modalConfirm");
        notify(`⚠️ El código patrimonial ${equipoPendiente.codigoPatrimonial} ya está registrado con información diferente.`, "error");
        mostrarDetalle(chequeo.registroExistente);
        return;
      }
      if (chequeo.serieConflicto) {
        closeModal("modalConfirm");
        notify(`⚠️ El código de serie ${equipoPendiente.codigoSerie} ya está registrado.`, "error");
        return;
      }

      await Api.registrarEquipo(equipoPendiente);
      closeModal("modalConfirm");
      notify("✅ Equipo registrado correctamente.", "success");
      limpiarFormulario();
      equipoPendiente = null;
      await cargarMeta(); // refresca tipos/marcas/modelos por si se agregaron nuevos
    } catch (err) {
      notify(err.message || "Error al guardar el equipo.", "error");
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------- CONSULTAR: BÚSQUEDA POR CÓDIGO ----------------
  function wireBuscar() {
    document.getElementById("btnBuscarCodigo").addEventListener("click", buscarPorCodigo);
  }

  async function buscarPorCodigo() {
    const patrimonial = document.getElementById("buscarPatrimonial").value.trim();
    const serie = document.getElementById("buscarSerie").value.trim();
    if (!patrimonial && !serie) { notify("Ingresa un código patrimonial o de serie para buscar.", "error"); return; }

    try {
      const resultado = await Api.buscarPorCodigo(patrimonial || serie);
      if (resultado.equipos && resultado.equipos.length) {
        pintarResultados(resultado.equipos, "Búsqueda por código");
      } else {
        pintarResultados([], "Búsqueda por código");
      }
    } catch (err) {
      notify(err.message || "Error al consultar.", "error");
    }
  }

  // ---------------- CONSULTAR: FILTROS ----------------
  function wireFiltros() {
    document.getElementById("filtroTipo").addEventListener("change", actualizarModelosFiltro);
    document.getElementById("filtroMarca").addEventListener("change", actualizarModelosFiltro);
    document.getElementById("btnAplicarFiltros").addEventListener("click", aplicarFiltros);
    document.getElementById("btnLimpiarFiltros").addEventListener("click", limpiarFiltros);
  }

  function limpiarFiltros() {
    ["filtroTipo", "filtroMarca", "filtroModelo", "filtroEstado"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("filtroUbicacion").value = "";
  }

  async function aplicarFiltros() {
    const filtros = {
      tipoEquipo: document.getElementById("filtroTipo").value,
      marca: document.getElementById("filtroMarca").value,
      modelo: document.getElementById("filtroModelo").value,
      estado: document.getElementById("filtroEstado").value,
      ubicacion: document.getElementById("filtroUbicacion").value.trim(),
    };
    const textoFiltros = Object.entries(filtros)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`).join(", ");

    try {
      const resultado = await Api.consultarEquipos(filtros);
      pintarResultados(resultado.equipos || [], textoFiltros);
    } catch (err) {
      notify(err.message || "Error al consultar.", "error");
    }
  }

  // ---------------- RESULTADOS ----------------
  function pintarResultados(equipos, filtrosTexto) {
    ultimosResultados = equipos;
    ultimosFiltrosTexto = filtrosTexto;
    const wrap = document.getElementById("resultsWrap");
    const count = document.getElementById("resultsCount");
    count.textContent = equipos.length ? `${equipos.length} equipo(s) encontrado(s)` : "";

    document.getElementById("btnExportExcel").disabled = equipos.length === 0;
    document.getElementById("btnExportPdf").disabled = equipos.length === 0;

    if (!equipos.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span>No se encontró ningún equipo con ese código.</div>`;
      return;
    }

    // Tarjetas (móvil)
    const cards = equipos.map(e => `
      <div class="equipo-card">
        <div class="equipo-card-top">
          <div>
            <div class="equipo-card-code">${escapeHtml(e.codigoPatrimonial)}</div>
            <div class="equipo-card-tipo">${escapeHtml(e.tipoEquipo)} · ${escapeHtml(e.marca)} ${escapeHtml(e.modelo)}</div>
          </div>
          <span class="badge ${badgeClass(e.estado)}">${escapeHtml(e.estado)}</span>
        </div>
        <div class="equipo-card-meta">
          Serie: ${escapeHtml(e.codigoSerie)}<br>
          Ubicación: ${escapeHtml(e.ubicacion) || "—"}
        </div>
        <div class="equipo-card-actions">
          <button class="link-btn" data-id="${escapeHtml(e.id || e.codigoPatrimonial)}">Ver detalles →</button>
        </div>
      </div>
    `).join("");

    // Tabla (escritorio)
    const filas = equipos.map(e => `
      <tr data-id="${escapeHtml(e.id || e.codigoPatrimonial)}">
        <td>${escapeHtml(e.codigoPatrimonial)}</td>
        <td>${escapeHtml(e.tipoEquipo)}</td>
        <td>${escapeHtml(e.codigoSerie)}</td>
        <td>${escapeHtml(e.marca)}</td>
        <td>${escapeHtml(e.modelo)}</td>
        <td><span class="badge ${badgeClass(e.estado)}">${escapeHtml(e.estado)}</span></td>
        <td>${escapeHtml(e.ubicacion) || "—"}</td>
        <td><button class="link-btn" data-id="${escapeHtml(e.id || e.codigoPatrimonial)}">Ver →</button></td>
      </tr>
    `).join("");

    wrap.innerHTML = `
      ${cards}
      <table class="results-table">
        <thead><tr><th>Código Patrimonial</th><th>Tipo</th><th>Serie</th><th>Marca</th><th>Modelo</th><th>Estado</th><th>Ubicación</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", () => {
        const eq = equipos.find(x => (x.id || x.codigoPatrimonial) === el.dataset.id);
        if (eq) mostrarDetalle(eq);
      });
    });
  }

  function badgeClass(estado) {
    const e = (estado || "").toLowerCase();
    if (e.includes("buen") || e.includes("nuevo")) return "badge-bueno";
    if (e.includes("mal") || e.includes("inoperativo") || e.includes("baja")) return "badge-malo";
    if (e.includes("regular") || e.includes("reparaci")) return "badge-regular";
    return "";
  }

  function mostrarDetalle(e) {
    document.getElementById("detalleContent").innerHTML = `
      <div><b>Código patrimonial:</b> ${escapeHtml(e.codigoPatrimonial)}</div>
      <div><b>Tipo:</b> ${escapeHtml(e.tipoEquipo)}</div>
      <div><b>Serie:</b> ${escapeHtml(e.codigoSerie)}</div>
      <div><b>Marca:</b> ${escapeHtml(e.marca)}</div>
      <div><b>Modelo:</b> ${escapeHtml(e.modelo)}</div>
      <div><b>Estado:</b> ${escapeHtml(e.estado)}</div>
      <div><b>Ubicación:</b> ${escapeHtml(e.ubicacion) || "—"}</div>
      <div><b>Fecha de registro:</b> ${escapeHtml(e.fechaRegistro) || "—"}</div>
    `;
    openModal("modalDetalle");
  }

  // ---------------- EXPORTACIÓN ----------------
  function wireExport() {
    document.getElementById("btnExportExcel").addEventListener("click", () => {
      if (ultimosResultados.length) ExportModule.exportExcel(ultimosResultados);
    });
    document.getElementById("btnExportPdf").addEventListener("click", () => {
      if (ultimosResultados.length) ExportModule.exportPdf(ultimosResultados, ultimosFiltrosTexto);
    });
  }

  // ---------------- MODALES ----------------
  function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
  function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

  function wireModals() {
    document.getElementById("btnCancelConfirm").addEventListener("click", () => closeModal("modalConfirm"));
    document.getElementById("btnOkConfirm").addEventListener("click", confirmarRegistro);
    document.getElementById("btnCerrarDetalle").addEventListener("click", () => closeModal("modalDetalle"));
  }

  // ---------------- ESCÁNER ----------------
  function wireScannerButtons() {
    document.querySelectorAll(".scan-btn").forEach(btn => {
      btn.addEventListener("click", () => Scanner.open(btn.dataset.target, btn.dataset.mode));
    });
    document.getElementById("btnCloseScanner").addEventListener("click", () => Scanner.close());
    document.getElementById("btnScanUse").addEventListener("click", () => Scanner.useResult());
    document.getElementById("btnScanRetry").addEventListener("click", () => Scanner.retry());
    document.querySelectorAll(".scanner-tab").forEach(tab => {
      tab.addEventListener("click", () => Scanner.switchTab(tab.dataset.type));
    });
  }

  // ---------------- CONFIGURACIÓN ----------------
  function wireConfig() {
    document.getElementById("btnConfig").addEventListener("click", () => {
      document.getElementById("apiUrlInput").value = Api.getUrl() === API_URL ? "" : Api.getUrl();
      openModal("modalConfig");
    });
    document.getElementById("btnCerrarConfig").addEventListener("click", () => closeModal("modalConfig"));
    document.getElementById("btnGuardarConfig").addEventListener("click", async () => {
      const url = document.getElementById("apiUrlInput").value.trim();
      if (!url) { notify("Ingresa una URL válida.", "error"); return; }
      Api.setUrl(url);
      closeModal("modalConfig");
      notify("Configuración guardada.", "success");
      await cargarMeta();
    });
  }

  // ---------------- UTILIDADES ----------------
  function notify(msg, type) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast show" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
    clearTimeout(notify._t);
    notify._t = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  return { init, notify };
})();

document.addEventListener("DOMContentLoaded", App.init);
