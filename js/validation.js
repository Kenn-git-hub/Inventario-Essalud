/**
 * validation.js
 * Validaciones de campos y normalización de texto (marca, etc).
 * La validación real de duplicados/unicidad se confirma siempre
 * contra el servidor (Apps Script) antes de guardar.
 */
const Validation = (() => {

  function normalizarTexto(valor) {
    if (!valor) return "";
    let v = valor.trim().replace(/\s+/g, " ");
    if (v.length === 0) return v;
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  function requerido(valor) {
    return !!(valor && valor.trim().length > 0);
  }

  function validarFormularioEquipo(data) {
    const errores = [];
    if (!requerido(data.codigoPatrimonial)) errores.push("El código patrimonial es obligatorio.");
    if (!requerido(data.tipoEquipo)) errores.push("El tipo de equipo es obligatorio.");
    if (!requerido(data.codigoSerie)) errores.push("El código de serie es obligatorio.");
    if (!requerido(data.marca)) errores.push("La marca es obligatoria.");
    if (!requerido(data.modelo)) errores.push("El modelo es obligatorio.");
    if (!requerido(data.estado)) errores.push("El estado es obligatorio.");
    return errores;
  }

  // Compara si dos equipos tienen exactamente la misma información
  function esDuplicadoExacto(a, b) {
    const campos = ["codigoPatrimonial", "tipoEquipo", "codigoSerie", "marca", "modelo", "estado", "ubicacion"];
    return campos.every(c => (a[c] || "").trim().toLowerCase() === (b[c] || "").trim().toLowerCase());
  }

  return { normalizarTexto, requerido, validarFormularioEquipo, esDuplicadoExacto };
})();
