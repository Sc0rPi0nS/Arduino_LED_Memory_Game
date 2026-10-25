(() => {
  const copyButton = document.querySelector(".copy-button");
  const copyFeedback = document.querySelector("#copy-feedback");
  if (copyButton && copyFeedback) {
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copy);
        copyFeedback.textContent = "คัดลอก Topic แล้ว";
      } catch {
        copyFeedback.textContent = "คัดลอกไม่ได้ในเบราว์เซอร์นี้ — เลือกข้อความ Topic แล้วคัดลอกได้";
      }
      window.setTimeout(() => { copyFeedback.textContent = ""; }, 2800);
    });
  }
})();

(() => {
  const sourceCode = document.querySelector(".full-source-code");
  const copyButtons = [...document.querySelectorAll(".copy-source")];
  const viewer = document.querySelector("#source-viewer");
  const viewerCode = document.querySelector("#source-modal-code");
  const openViewerButton = document.querySelector("#view-full-code");
  const closeViewerButton = document.querySelector(".source-viewer-close");
  if (!sourceCode) return;

  const keywords = new Set([
    "if", "else", "while", "for", "return", "true", "false", "break",
    "continue", "const", "int", "char", "bool", "void", "unsigned",
    "long", "double", "float",
  ]);
  const types = new Set(["WiFiClient", "MqttClient", "LiquidCrystal_I2C"]);
  const functions = new Set([
    "connectWiFi", "connectMQTT", "maintainMQTT", "publishScore", "buzzerOn",
    "buzzerOff", "wrongSound", "scoreSound", "allLedsOff", "showStartScreen",
    "waitForStart", "showColor", "showSequence", "showProgress", "waitForButton",
    "correctPress", "wrongAnswer", "resetGame", "setup", "loop", "begin",
    "status", "localIP", "connect", "connected", "connectError", "poll",
    "beginMessage", "endMessage", "clear", "setCursor", "init", "backlight",
    "analogRead", "randomSeed", "random", "millis", "delay", "digitalWrite",
    "pinMode", "digitalRead", "println", "print",
  ]);
  const tokens = /(#include\s*<[^>\n]+>|#\w+[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:if|else|while|for|return|true|false|break|continue|const|int|char|bool|void|unsigned|long|double|float)\b|\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|[A-Za-z_]\w*)/g;

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  const rawSource = sourceCode.textContent;
  sourceCode.innerHTML = rawSource.replace(tokens, (token, _fullToken, offset, completeSource) => {
    let tokenClass = "";
    if (token.startsWith("#")) tokenClass = "token-preprocessor";
    else if (token.startsWith("//") || token.startsWith("/*")) tokenClass = "token-comment";
    else if (token.startsWith('"') || token.startsWith("'")) tokenClass = "token-string";
    else if (keywords.has(token)) tokenClass = "token-keyword";
    else if (types.has(token)) tokenClass = "token-type";
    else if (/^(?:0x[\da-fA-F]+|\d)/.test(token)) tokenClass = "token-number";
    else if (functions.has(token)) tokenClass = "token-function";
    else if (/^\s*\(/.test(completeSource.slice(offset + token.length))) tokenClass = "token-function";
    return tokenClass ? `<span class="${tokenClass}">${escapeHtml(token)}</span>` : escapeHtml(token);
  });

  copyButtons.forEach((copyButton) => {
    const copyStatus = copyButton.closest(".code-card, .source-viewer-toolbar")?.querySelector(".copy-source-status");
    if (!copyStatus) return;

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawSource);
        copyStatus.textContent = "คัดลอกโค้ดแล้ว";
      } catch {
        copyStatus.textContent = "คัดลอกไม่ได้ในเบราว์เซอร์นี้ — เลือกโค้ดแล้วคัดลอกได้";
      }
      window.setTimeout(() => { copyStatus.textContent = ""; }, 2800);
    });
  });

  if (viewer && viewerCode && openViewerButton && closeViewerButton) {
    let returnScrollPosition = 0;

    openViewerButton.addEventListener("click", () => {
      returnScrollPosition = window.scrollY;
      viewerCode.innerHTML = sourceCode.innerHTML;
      viewer.showModal();
      closeViewerButton.focus();
    });

    closeViewerButton.addEventListener("click", () => viewer.close());
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer) viewer.close();
    });
    viewer.addEventListener("close", () => {
      viewerCode.replaceChildren();
      openViewerButton.focus({ preventScroll: true });
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, returnScrollPosition);
      root.style.scrollBehavior = previousScrollBehavior;
    });
  }
})();
