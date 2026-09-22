/* ===================================================
   CONTROLADOR DEL PORTAL DE EXAMEN SEGURO
   Módulo extraído y mejorado con:
   - Estado protegido por closure (no modificable desde consola)
   - Limpieza del watchdog al finalizar
   - Persistencia con sessionStorage para recargas accidentales
   =================================================== */

const ExamController = (() => {
  'use strict';

  // ──────────────────────────────────────────────────
  // ESTADO PRIVADO (inaccesible desde la consola del navegador)
  // ──────────────────────────────────────────────────
  const _state = {
    payload: null,
    config: null,
    studentName: '',
    studentId: '',
    strikes: 0,
    maxStrikes: 3,
    incidentLog: [],
    timerInterval: null,
    timeRemainingSecs: 0,
    isExamActive: false,
    isLockdownActive: false,
    isPermanentlyLocked: false,
    audioCtx: null,
    watchdogInterval: null
  };

  // Clave para sessionStorage
  const STORAGE_KEY = 'examSessionState';

  // ──────────────────────────────────────────────────
  // API PÚBLICA DE SOLO-LECTURA PARA EL ESTADO
  // ──────────────────────────────────────────────────
  function getState() {
    return Object.freeze({
      payload: _state.payload,
      studentName: _state.studentName,
      studentId: _state.studentId,
      strikes: _state.strikes,
      maxStrikes: _state.maxStrikes,
      incidentLog: [..._state.incidentLog],
      timeRemainingSecs: _state.timeRemainingSecs,
      isExamActive: _state.isExamActive,
      isLockdownActive: _state.isLockdownActive,
      isPermanentlyLocked: _state.isPermanentlyLocked
    });
  }

  // ──────────────────────────────────────────────────
  // PERSISTENCIA CON SESSION STORAGE
  // ──────────────────────────────────────────────────
  function saveToSession() {
    try {
      const snapshot = {
        payload: _state.payload,
        studentName: _state.studentName,
        studentId: _state.studentId,
        strikes: _state.strikes,
        maxStrikes: _state.maxStrikes,
        incidentLog: _state.incidentLog,
        timeRemainingSecs: _state.timeRemainingSecs,
        isExamActive: _state.isExamActive,
        isPermanentlyLocked: _state.isPermanentlyLocked,
        configUrl: _state.config ? _state.config.url : null,
        configTitle: _state.config ? _state.config.title : null,
        configCourse: _state.config ? _state.config.course : null,
        configDuration: _state.config ? _state.config.duration : null,
        configStrikes: _state.config ? _state.config.strikes : null
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('No se pudo guardar estado de sesión:', e);
    }
  }

  function loadFromSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* silencioso */ }
  }

  // ──────────────────────────────────────────────────
  // ALARMA SONORA (Web Audio API)
  // ──────────────────────────────────────────────────
  function playSecurityAlarm() {
    try {
      if (!_state.audioCtx) {
        _state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_state.audioCtx.state === 'suspended') {
        _state.audioCtx.resume();
      }

      const now = _state.audioCtx.currentTime;
      const osc = _state.audioCtx.createOscillator();
      const gain = _state.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.3);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(_state.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio feedback error', e);
    }
  }

  // ──────────────────────────────────────────────────
  // PAYLOAD: LECTURA DESDE URL O INPUT MANUAL
  // ──────────────────────────────────────────────────
  function initPayload() {
    let payload = null;

    // 1. Verificar si fue inyectado en un archivo exportado
    if (window.__PRELOADED_EXAM_PAYLOAD__) {
      payload = window.__PRELOADED_EXAM_PAYLOAD__;
    }

    // 2. Verificar hash en la URL (#exam=... o #data=...)
    if (!payload && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const match = hash.match(/(?:exam|data)=([^&]+)/);
      if (match && match[1]) {
        payload = match[1];
      } else if (hash.length > 20) {
        payload = hash;
      }
    }

    if (payload) {
      _state.payload = payload;
      document.getElementById('manualPayloadSection').classList.add('hidden');
    } else {
      document.getElementById('manualPayloadSection').classList.remove('hidden');
    }
  }

  // ──────────────────────────────────────────────────
  // FULLSCREEN HELPERS
  // ──────────────────────────────────────────────────
  function requestBrowserFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      return docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      return docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      return docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      return docEl.msRequestFullscreen();
    }
    return Promise.reject(new Error('Fullscreen no compatible con este navegador'));
  }

  function isBrowserFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function lockKeyboard() {
    if (navigator.keyboard && navigator.keyboard.lock) {
      navigator.keyboard.lock(['Escape', 'Tab', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']).catch(() => {});
    }
  }

  // ──────────────────────────────────────────────────
  // SEMÁFORO DE FALTAS (STRIKE DOTS)
  // ──────────────────────────────────────────────────
  function renderStrikeDots() {
    const container = document.getElementById('strikeDots');
    container.innerHTML = '';
    document.getElementById('strikesFraction').innerText = `${_state.strikes} / ${_state.maxStrikes}`;

    for (let i = 0; i < _state.maxStrikes; i++) {
      const dot = document.createElement('div');
      dot.className = 'strike-dot' + (i < _state.strikes ? ' active' : '');
      container.appendChild(dot);
    }
  }

  // ──────────────────────────────────────────────────
  // TEMPORIZADOR
  // ──────────────────────────────────────────────────
  function startCountdown() {
    const timerText = document.getElementById('timerText');
    const timerPill = document.getElementById('timerContainer');

    function updateClock() {
      if (_state.timeRemainingSecs <= 0) {
        clearInterval(_state.timerInterval);
        _state.timerInterval = null;
        timerText.innerText = '00:00';
        alert('⏰ El tiempo del examen ha terminado. Por favor envía tus respuestas en el formulario.');
        return;
      }

      const mins = Math.floor(_state.timeRemainingSecs / 60);
      const secs = _state.timeRemainingSecs % 60;
      timerText.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      if (_state.timeRemainingSecs <= 300) {
        timerPill.classList.add('urgent');
      }

      _state.timeRemainingSecs--;
      // Guardar estado cada 10 segundos para no saturar storage
      if (_state.timeRemainingSecs % 10 === 0) {
        saveToSession();
      }
    }

    updateClock();
    _state.timerInterval = setInterval(updateClock, 1000);
  }

  // ──────────────────────────────────────────────────
  // LANZAR SESIÓN DE EXAMEN
  // ──────────────────────────────────────────────────
  async function launchExamSession() {
    // 1. Activar Keyboard Lock
    lockKeyboard();

    // 2. Actualizar interfaz del HUD
    document.getElementById('hudStudentName').innerText = _state.studentName;
    document.getElementById('hudStudentId').innerText = `ID: ${_state.studentId}`;
    document.getElementById('avatarInitial').innerText = _state.studentName.charAt(0).toUpperCase();

    renderStrikeDots();

    // 3. Configurar temporizador si existe
    if (_state.config.duration && _state.config.duration > 0) {
      if (_state.timeRemainingSecs <= 0) {
        _state.timeRemainingSecs = _state.config.duration * 60;
      }
      startCountdown();
    } else {
      document.getElementById('timerText').innerText = 'Ilimitado';
    }

    // 4. Cargar el Google Form en el iframe seguro
    const iframe = document.getElementById('examIframe');
    iframe.src = _state.config.url;

    // 5. Cambiar a pantalla de examen
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('examScreen').classList.remove('hidden');
    _state.isExamActive = true;

    // 6. FORZAR PANTALLA COMPLETA
    const wrapper = document.getElementById('iframeWrapper');
    if (!isBrowserFullscreen()) {
      if (wrapper) wrapper.style.visibility = 'hidden';
      document.getElementById('fullscreenEnforcerModal').classList.remove('hidden');
    } else {
      if (wrapper) wrapper.style.visibility = 'visible';
      document.getElementById('fullscreenEnforcerModal').classList.add('hidden');
    }

    // 7. Activar motor de supervisión continua
    enableSupervisionEngine();

    // 8. Guardar estado inicial
    saveToSession();
  }

  // ──────────────────────────────────────────────────
  // MOTOR DE SUPERVISIÓN Y DETECCIÓN ANTI-TRAMPAS
  // ──────────────────────────────────────────────────
  let isAltPressed = false;

  function enableSupervisionEngine() {
    // 1. Detección de salida de Pantalla Completa
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // 2. Detección de cambio de pestaña (Page Visibility API)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && _state.isExamActive && !_state.isPermanentlyLocked) {
        const wrapper = document.getElementById('iframeWrapper');
        if (wrapper) wrapper.style.visibility = 'hidden';
        triggerSecurityInfraction('Cambio de pestaña o navegador minimizado detectado');
      }
    });

    // 3. Detección de pérdida de foco (Alt+Tab, clic fuera)
    window.addEventListener('blur', () => {
      if (!_state.isExamActive || _state.isPermanentlyLocked || _state.isLockdownActive) return;

      setTimeout(() => {
        const activeEl = document.activeElement;
        const iframe = document.getElementById('examIframe');
        if (activeEl === iframe) return;
        if (!document.hasFocus()) {
          const wrapper = document.getElementById('iframeWrapper');
          if (wrapper) wrapper.style.visibility = 'hidden';

          const reason = isAltPressed
            ? 'Intento de cambio de ventana con Alt + Tab detectado'
            : 'Pérdida de foco del examen (clic fuera o cambio de aplicación)';
          triggerSecurityInfraction(reason);
        }
      }, 50);
    });

    // 4. Bloqueo de atajos de teclado
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Alt') isAltPressed = true;
      if (!_state.isExamActive) return;

      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        const wrapper = document.getElementById('iframeWrapper');
        if (wrapper) wrapper.style.visibility = 'hidden';
        triggerSecurityInfraction('Combinación Alt + Tab detectada');
        return;
      }

      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityInfraction('Intento de abrir herramientas de desarrollo (F12)');
        return;
      }

      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityInfraction('Atajo de inspección bloqueado');
        return;
      }

      if (e.ctrlKey && ['u', 'U'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.ctrlKey && ['c', 'C', 'v', 'V', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        return;
      }
    }, true);

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') isAltPressed = false;
    }, true);

    // 5. Bloqueo de Clic Derecho
    document.addEventListener('contextmenu', (e) => {
      if (_state.isExamActive) e.preventDefault();
    });

    // 6. Watchdog de Pantalla Completa (con referencia guardada para limpieza)
    _state.watchdogInterval = setInterval(() => {
      if (_state.isExamActive && !_state.isPermanentlyLocked) {
        if (!isBrowserFullscreen()) {
          const wrapper = document.getElementById('iframeWrapper');
          if (wrapper && wrapper.style.visibility !== 'hidden') {
            wrapper.style.visibility = 'hidden';
          }
          if (!_state.isLockdownActive) {
            const enforcer = document.getElementById('fullscreenEnforcerModal');
            if (enforcer && enforcer.classList.contains('hidden')) {
              enforcer.classList.remove('hidden');
            }
          }
        }
      }
    }, 400);
  }

  // ──────────────────────────────────────────────────
  // CAMBIO DE ESTADO DE PANTALLA COMPLETA
  // ──────────────────────────────────────────────────
  function handleFullscreenChange() {
    const isFull = isBrowserFullscreen();

    if (isFull) {
      if (_state.isExamActive && !_state.isLockdownActive && !_state.isPermanentlyLocked) {
        document.getElementById('fullscreenEnforcerModal').classList.add('hidden');
        const wrapper = document.getElementById('iframeWrapper');
        if (wrapper) wrapper.style.visibility = 'visible';
      }
      lockKeyboard();
    } else {
      if (_state.isExamActive && !_state.isPermanentlyLocked) {
        const wrapper = document.getElementById('iframeWrapper');
        if (wrapper) wrapper.style.visibility = 'hidden';
        triggerSecurityInfraction('Salida del modo de Pantalla Completa (Esc o F11)');
      }
    }
  }

  // ──────────────────────────────────────────────────
  // INFRACCIÓN DE SEGURIDAD
  // ──────────────────────────────────────────────────
  function triggerSecurityInfraction(reason) {
    if (!_state.isExamActive || _state.isPermanentlyLocked) return;

    _state.strikes++;
    const timeStr = new Date().toLocaleTimeString();
    const entry = `[${timeStr}] ${reason}`;
    _state.incidentLog.push(entry);

    playSecurityAlarm();
    renderStrikeDots();
    saveToSession();

    if (_state.strikes >= _state.maxStrikes) {
      executePermanentLockout();
    } else {
      showLockdownModal(reason);
    }
  }

  // ──────────────────────────────────────────────────
  // MODAL DE ADVERTENCIA ROJA
  // ──────────────────────────────────────────────────
  function showLockdownModal(reason) {
    _state.isLockdownActive = true;

    const wrapper = document.getElementById('iframeWrapper');
    if (wrapper) wrapper.style.visibility = 'hidden';

    document.getElementById('lastInfractionReason').innerText = `Motivo: ${reason}`;
    document.getElementById('strikeModalBadge').innerText = `Falta acumulada: ${_state.strikes}`;
    document.getElementById('strikeModalLimit').innerText = `Límite permitido: ${_state.maxStrikes}`;

    const listEl = document.getElementById('incidentLogList');
    listEl.innerHTML = '';
    _state.incidentLog.forEach(log => {
      const li = document.createElement('li');
      li.innerText = log;
      listEl.appendChild(li);
    });

    document.getElementById('lockdownModal').classList.remove('hidden');
  }

  // ──────────────────────────────────────────────────
  // REANUDAR EXAMEN TRAS ADVERTENCIA
  // ──────────────────────────────────────────────────
  async function resumeFromLockdown() {
    try {
      await requestBrowserFullscreen();
    } catch (err) {
      console.warn('Re-enter fullscreen error:', err);
    }

    setTimeout(() => {
      if (isBrowserFullscreen()) {
        const wrapper = document.getElementById('iframeWrapper');
        if (wrapper) wrapper.style.visibility = 'visible';
        document.getElementById('lockdownModal').classList.add('hidden');
        _state.isLockdownActive = false;
      } else {
        document.getElementById('lockdownModal').classList.add('hidden');
        _state.isLockdownActive = false;
        document.getElementById('fullscreenEnforcerModal').classList.remove('hidden');
      }
    }, 150);
  }

  // ──────────────────────────────────────────────────
  // BLOQUEO DEFINITIVO (LÍMITE DE FALTAS SUPERADO)
  // ──────────────────────────────────────────────────
  async function executePermanentLockout() {
    _state.isPermanentlyLocked = true;
    _state.isExamActive = false;

    // Limpiar intervalos
    cleanupIntervals();

    document.getElementById('lockdownModal').classList.add('hidden');

    // Destruir iframe
    const iframe = document.getElementById('examIframe');
    iframe.src = 'about:blank';
    iframe.remove();

    // Preparar informe de auditoría
    document.getElementById('auditStudentInfo').innerHTML = `
      <strong>Alumno:</strong> ${_state.studentName} | <strong>ID:</strong> ${_state.studentId}<br>
      <strong>Total de Infracciones:</strong> ${_state.strikes} de ${_state.maxStrikes}
    `;

    const auditEvents = document.getElementById('auditEventsList');
    auditEvents.innerHTML = '';
    _state.incidentLog.forEach(log => {
      const div = document.createElement('div');
      div.innerText = log;
      auditEvents.appendChild(div);
    });

    // Hash criptográfico de verificación antifraude
    const rawReport = `${_state.studentId}-${_state.studentName}-${_state.strikes}-${_state.incidentLog.join('|')}`;
    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(rawReport));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    document.getElementById('auditSecurityHash').innerText = hashHex.substring(0, 32).toUpperCase();

    document.getElementById('permanentLockModal').classList.remove('hidden');

    // Limpiar sesión guardada
    clearSession();
  }

  // ──────────────────────────────────────────────────
  // LIMPIEZA DE INTERVALOS
  // ──────────────────────────────────────────────────
  function cleanupIntervals() {
    if (_state.timerInterval) {
      clearInterval(_state.timerInterval);
      _state.timerInterval = null;
    }
    if (_state.watchdogInterval) {
      clearInterval(_state.watchdogInterval);
      _state.watchdogInterval = null;
    }
  }

  // ──────────────────────────────────────────────────
  // FINALIZACIÓN VOLUNTARIA
  // ──────────────────────────────────────────────────
  function finishExam() {
    const confirmFinish = confirm('¿Estás seguro de que ya hiciste clic en "ENVIAR" dentro del formulario de Google Forms y deseas salir del examen?');
    if (!confirmFinish) return;

    _state.isExamActive = false;
    cleanupIntervals();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    document.getElementById('examScreen').classList.add('hidden');
    document.getElementById('summaryStudentName').innerText = _state.studentName;
    document.getElementById('summaryStudentId').innerText = _state.studentId;

    const strikesEl = document.getElementById('summaryStrikes');
    if (_state.strikes === 0) {
      strikesEl.innerText = '0 infracciones (Excelente conducta)';
      strikesEl.style.color = 'var(--success)';
    } else {
      strikesEl.innerText = `${_state.strikes} infracciones registradas`;
      strikesEl.style.color = 'var(--warning)';
    }

    document.getElementById('finishedModal').classList.remove('hidden');
    clearSession();
  }

  // ──────────────────────────────────────────────────
  // INICIO DEL EXAMEN (Botón principal)
  // ──────────────────────────────────────────────────
  async function handleStartExam() {
    const errorDiv = document.getElementById('authError');
    errorDiv.style.display = 'none';

    if (!_state.payload) {
      _state.payload = document.getElementById('manualPayloadInput').value.trim();
      if (!_state.payload) {
        errorDiv.innerText = 'No se encontró la configuración del examen. Pega el código de examen.';
        errorDiv.style.display = 'block';
        return;
      }
    }

    const name = document.getElementById('studentName').value.trim();
    const id = document.getElementById('studentId').value.trim();
    const pin = document.getElementById('studentPin').value.trim();

    if (!name || !id || !pin) {
      errorDiv.innerText = 'Por favor completa todos los campos requeridos.';
      errorDiv.style.display = 'block';
      return;
    }

    // 1. SOLICITAR PANTALLA COMPLETA DIRECTA
    try {
      await requestBrowserFullscreen();
    } catch (fsErr) {
      console.warn('Fullscreen diferido:', fsErr);
    }

    // 2. Activar Keyboard Lock
    lockKeyboard();

    const btn = document.getElementById('btnStartExam');
    btn.innerText = 'Verificando y descifrando...';

    try {
      const config = await ExamCrypto.decryptData(_state.payload, pin);

      _state.config = {
        url: config.u || config.url,
        title: config.t || config.title,
        course: config.c || config.course,
        instructions: config.i || config.instructions,
        duration: config.d !== undefined ? config.d : config.duration,
        strikes: config.s !== undefined ? config.s : (config.strikes || 3)
      };
      _state.studentName = name;
      _state.studentId = id;
      _state.maxStrikes = _state.config.strikes;

      await launchExamSession();
    } catch (err) {
      console.error(err);
      if (isBrowserFullscreen()) {
        document.exitFullscreen().catch(() => {});
      }
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"></path></svg> Iniciar Examen en Pantalla Completa';
      errorDiv.innerText = 'Contraseña o PIN incorrecto. Por favor solicita la clave al profesor.';
      errorDiv.style.display = 'block';
    }
  }

  // ──────────────────────────────────────────────────
  // RECUPERACIÓN DE SESIÓN (RECARGA ACCIDENTAL)
  // ──────────────────────────────────────────────────
  async function tryRecoverSession() {
    const saved = loadFromSession();
    if (!saved || !saved.isExamActive || saved.isPermanentlyLocked) return false;

    const shouldRecover = confirm(
      '⚠️ Se detectó una sesión de examen activa que fue interrumpida.\n\n' +
      `Estudiante: ${saved.studentName}\n` +
      `Faltas acumuladas: ${saved.strikes} / ${saved.maxStrikes}\n\n` +
      '¿Deseas recuperar tu sesión y continuar el examen?'
    );

    if (!shouldRecover) {
      clearSession();
      return false;
    }

    // Restaurar estado
    _state.payload = saved.payload;
    _state.studentName = saved.studentName;
    _state.studentId = saved.studentId;
    _state.strikes = saved.strikes;
    _state.maxStrikes = saved.maxStrikes;
    _state.incidentLog = saved.incidentLog || [];
    _state.timeRemainingSecs = saved.timeRemainingSecs || 0;
    _state.config = {
      url: saved.configUrl,
      title: saved.configTitle,
      course: saved.configCourse,
      duration: saved.configDuration,
      strikes: saved.configStrikes
    };

    // Solicitar pantalla completa
    try {
      await requestBrowserFullscreen();
    } catch (e) {
      console.warn('Fullscreen recovery:', e);
    }

    lockKeyboard();
    await launchExamSession();
    return true;
  }

  // ──────────────────────────────────────────────────
  // INICIALIZACIÓN Y BINDEO DE EVENTOS
  // ──────────────────────────────────────────────────
  function init() {
    initPayload();

    // Botón de inicio
    document.getElementById('btnStartExam').addEventListener('click', handleStartExam);

    // Enter en los inputs activa el botón
    ['studentName', 'studentId', 'studentPin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btnStartExam').click();
          }
        });
      }
    });

    // Botón del HUD para pantalla completa
    document.getElementById('btnHudFullscreen').addEventListener('click', async () => {
      try {
        await requestBrowserFullscreen();
      } catch (e) {
        console.warn('Error fullscreen HUD:', e);
      }
    });

    // Botón del enforcer para pantalla completa
    document.getElementById('btnForceFullscreenNow').addEventListener('click', async () => {
      try {
        await requestBrowserFullscreen();
        lockKeyboard();
      } catch (err) {
        console.warn('Error al activar pantalla completa:', err);
        alert('Debes permitir el modo de Pantalla Completa en tu navegador para realizar el examen.');
      }
    });

    // Botón reanudar tras infracción
    document.getElementById('btnResumeExam').addEventListener('click', () => resumeFromLockdown());

    // Botón finalizar examen
    document.getElementById('btnFinishExam').addEventListener('click', () => finishExam());

    // Intentar recuperar sesión interrumpida
    tryRecoverSession();
  }

  // ──────────────────────────────────────────────────
  // API PÚBLICA (solo lo estrictamente necesario)
  // ──────────────────────────────────────────────────
  return {
    init,
    getState
  };
})();

// Inicializar al cargar
window.addEventListener('DOMContentLoaded', () => {
  ExamController.init();
});
