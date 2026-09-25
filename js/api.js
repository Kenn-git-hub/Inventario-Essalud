/**
 * api.js
 * Comunicación con el backend (Google Apps Script Web App).
 *
 * >>> PEGA AQUÍ LA URL DE TU WEB APP DE APPS SCRIPT <<<
 * Ejemplo: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec"
 * También puede configurarse desde la app (botón ⚙️), lo cual
 * se guarda en localStorage y tiene prioridad sobre esta constante.
 */
const API_URL = "PEGAR_AQUI_URL_DE_GOOGLE_APPS_SCRIPT";

const Api = (() => {

  function getUrl() {
    const stored = localStorage.getItem("inv_api_url");
    return (stored && stored.trim()) || API_URL;
  }

  function isConfigured() {
    const url = getUrl();
    return !!url && url.startsWith("http");
  }

  // Apps Script Web Apps aceptan bien peticiones GET, y POST simples
  // con Content-Type "text/plain" (evita el preflight CORS de JSON).
  async function request(action, payload = {}, method = "GET") {
    if (!isConfigured()) {
      throw { code: "NO_CONFIG", message: "Configura la URL de Google Apps Script en ⚙️ Configuración." };
    }
    const url = getUrl();
    try {
      let res;
      if (method === "GET") {
        const params = new URLSearchParams({ action, ...flatten(payload) });
        res = await fetch(`${url}?${params.toString()}`, { method: "GET" });
      } else {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, ...payload }),
        });
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data && data.ok === false) {
        throw { code: data.code || "SERVER_ERROR", message: data.message || "Error del servidor." };
      }
      return data;
    } catch (err) {
      if (err && err.code) throw err;
      throw { code: "NETWORK_ERROR", message: "No se pudo conectar con Google Sheets / Apps Script." };
    }
  }

  function flatten(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(k => {
      out[k] = typeof obj[k] === "object" ? JSON.stringify(obj[k]) : obj[k];
    });
    return out;
  }

  return {
    getUrl, isConfigured,
    setUrl(url) { localStorage.setItem("inv_api_url", url.trim()); },

    // Metadatos: tipos, marcas, modelos por tipo+marca, estados
    getMeta() { return request("getMeta", {}, "GET"); },

    // Registrar un equipo nuevo
    registrarEquipo(equipo) { return request("registrarEquipo", equipo, "POST"); },

    // Buscar por código patrimonial o serie
    buscarPorCodigo(codigo) { return request("buscarPorCodigo", { codigo }, "GET"); },

    // Consultar con filtros combinables
    consultarEquipos(filtros) { return request("consultarEquipos", filtros, "GET"); },

    // Verificación previa de duplicados (patrimonial / serie)
    verificarDuplicado(equipo) { return request("verificarDuplicado", equipo, "POST"); },
  };
})();
