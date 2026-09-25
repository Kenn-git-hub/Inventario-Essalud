/**
 * export.js
 * Exportación de los resultados de consulta a Excel (.xlsx) y PDF,
 * respetando los filtros aplicados (se exporta lo que está en pantalla).
 */
const ExportModule = (() => {

  const COLUMNS = [
    { key: "codigoPatrimonial", label: "Código Patrimonial" },
    { key: "tipoEquipo", label: "Tipo" },
    { key: "codigoSerie", label: "Serie" },
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "estado", label: "Estado" },
    { key: "ubicacion", label: "Ubicación" },
  ];

  function exportExcel(equipos) {
    if (typeof XLSX === "undefined") { App.notify("No se pudo cargar el módulo de Excel.", "error"); return; }
    const rows = equipos.map(e => {
      const row = {};
      COLUMNS.forEach(c => row[c.label] = e[c.key] || "");
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipos");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `equipos_${fecha}.xlsx`);
  }

  function exportPdf(equipos, filtrosTexto) {
    if (typeof window.jspdf === "undefined") { App.notify("No se pudo cargar el módulo de PDF.", "error"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(14);
    doc.text("REPORTE DE EQUIPOS INFORMÁTICOS", 14, 16);
    doc.setFontSize(9);
    doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, 14, 23);
    doc.text(`Filtros utilizados: ${filtrosTexto || "Ninguno"}`, 14, 28);

    doc.autoTable({
      startY: 34,
      head: [COLUMNS.map(c => c.label)],
      body: equipos.map(e => COLUMNS.map(c => e[c.key] || "-")),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 27, 45] },
    });

    const fecha = new Date().toISOString().slice(0, 10);
    doc.save(`equipos_${fecha}.pdf`);
  }

  return { exportExcel, exportPdf };
})();
