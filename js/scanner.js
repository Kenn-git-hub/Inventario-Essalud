/**
 * scanner.js
 * Escaneo con la cámara del dispositivo:
 *  - Códigos de barras / QR mediante la librería html5-qrcode.
 *  - Texto / números impresos mediante OCR con tesseract.js.
 *
 * Si el navegador no soporta cámara o las librerías no cargan,
 * se informa el error y se permite escribir manualmente (el campo
 * de texto siempre queda disponible).
 */
const Scanner = (() => {
  let currentTargetInput = null;
  let currentMode = "both";     // "barcode" | "ocr" | "both"
  let activeType = "barcode";   // pestaña activa dentro del modal
  let html5Qr = null;
  let ocrStream = null;

  const els = {};
  function cacheEls() {
    els.modal = document.getElementById("modalScanner");
    els.videoWrap = document.getElementById("scannerVideoWrap");
    els.status = document.getElementById("scannerStatus");
    els.resultBox = document.getElementById("scannerResultBox");
    els.resultInput = document.getElementById("scannerResultInput");
    els.tabs = document.querySelectorAll(".scanner-tab");
  }

  function setStatus(msg) {
    if (els.status) { els.status.textContent = msg; els.status.classList.remove("hidden"); }
  }

  function open(targetInputId, mode) {
    cacheEls();
    currentTargetInput = document.getElementById(targetInputId);
    currentMode = mode || "both";
    activeType = currentMode === "ocr" ? "ocr" : "barcode";
    els.modal.classList.remove("hidden");
    els.resultBox.classList.add("hidden");
    els.tabs.forEach(t => {
      t.classList.toggle("active", t.dataset.type === activeType);
      t.style.display = (currentMode === "both") ? "" : (t.dataset.type === currentMode ? "" : "none");
    });
    startActiveMode();
  }

  function close() {
    stopAll();
    els.modal.classList.add("hidden");
  }

  function switchTab(type) {
    if (type === activeType) return;
    activeType = type;
    els.tabs.forEach(t => t.classList.toggle("active", t.dataset.type === type));
    els.resultBox.classList.add("hidden");
    stopAll();
    startActiveMode();
  }

  function startActiveMode() {
    if (activeType === "barcode") startBarcode();
    else startOcrCamera();
  }

  function stopAll() {
    if (html5Qr) {
      html5Qr.stop().then(() => html5Qr.clear()).catch(() => {});
      html5Qr = null;
    }
    if (ocrStream) {
      ocrStream.getTracks().forEach(t => t.stop());
      ocrStream = null;
    }
    els.videoWrap.innerHTML = "";
  }

  // ---------- CÓDIGOS DE BARRAS ----------
  function startBarcode() {
    els.videoWrap.innerHTML = '<div id="qrRegion" style="width:100%"></div>';
    setStatus("Solicitando acceso a la cámara…");

    if (typeof Html5Qrcode === "undefined") {
      setStatus("No se pudo cargar el lector de códigos. Escribe el código manualmente.");
      return;
    }

    html5Qr = new Html5Qrcode("qrRegion");
    const config = { fps: 10, qrbox: { width: 250, height: 120 } };

    html5Qr.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        setStatus("¡Código detectado!");
        showResult(decodedText);
        html5Qr.stop().catch(() => {});
      },
      () => { /* frame sin detección: no hacer nada */ }
    ).then(() => {
      setStatus("Enfoca el código de barras dentro del recuadro.");
    }).catch((err) => {
      setStatus("No se pudo acceder a la cámara. Verifica los permisos o escribe el código manualmente.");
    });
  }

  // ---------- OCR (texto / números) ----------
  async function startOcrCamera() {
    setStatus("Solicitando acceso a la cámara…");
    els.videoWrap.innerHTML = '<video id="ocrVideo" autoplay playsinline muted></video>';
    const video = document.getElementById("ocrVideo");

    try {
      ocrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = ocrStream;
      setStatus("Encuadra el texto o número y presiona «Capturar».");
      addCaptureButton(video);
    } catch (err) {
      setStatus("No se pudo acceder a la cámara. Verifica los permisos o escribe el texto manualmente.");
    }
  }

  function addCaptureButton(video) {
    const btn = document.createElement("button");
    btn.textContent = "📸 Capturar";
    btn.className = "btn btn-primary full";
    btn.style.marginTop = "10px";
    btn.onclick = () => captureAndRecognize(video);
    els.videoWrap.appendChild(btn);
  }

  async function captureAndRecognize(video) {
    setStatus("Procesando imagen…");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    if (typeof Tesseract === "undefined") {
      setStatus("No se pudo cargar el motor de OCR. Escribe el texto manualmente.");
      return;
    }

    try {
      setStatus("Detectando texto…");
      const { data } = await Tesseract.recognize(canvas, "eng", {});
      const texto = (data.text || "").replace(/\s+/g, " ").trim();
      if (texto) {
        setStatus("Texto reconocido.");
        showResult(texto);
      } else {
        setStatus("No se pudo reconocer el contenido. Intenta de nuevo o escribe manualmente.");
      }
    } catch (err) {
      setStatus("Error al procesar el OCR. Intenta de nuevo o escribe manualmente.");
    }
  }

  function showResult(text) {
    els.resultInput.value = text;
    els.resultBox.classList.remove("hidden");
  }

  function useResult() {
    if (currentTargetInput) {
      currentTargetInput.value = els.resultInput.value.trim();
      currentTargetInput.dispatchEvent(new Event("input"));
    }
    close();
  }

  function retry() {
    els.resultBox.classList.add("hidden");
    stopAll();
    startActiveMode();
  }

  return { open, close, switchTab, useResult, retry };
})();
