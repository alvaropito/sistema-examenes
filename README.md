# 🛡️ Sistema Web de Exámenes Seguros (Anti-Cheat)
> **Despliegue en GitHub Pages • Cero Instalación • Cifrado AES-GCM • Google Forms Integrado**

Este sistema permite a los docentes realizar exámenes universitarios utilizando **Google Forms**, pero ejecutándolos dentro de una interfaz web supervisada que impide o penaliza que los alumnos cambien de pestaña, minimicen la ventana o usen `Alt + Tab`.

---

## 🚀 Cómo funciona

1. **Panel del Profesor (`admin.html`)**:
   - Pegas el enlace de tu formulario de Google Forms.
   - Estableces el título, tiempo límite (minutos), límite de faltas toleradas (ej: 3 strikes) y una **clave secreta o PIN** (ej: `Calculo2026`).
   - El sistema **cifra el enlace de Google Forms con algoritmo militar AES-GCM de 256 bits** usando esa clave.
   - Genera un **enlace único** y un **Código QR** listo para proyectar en el salón de clases.

2. **Portal del Estudiante (`index.html`)**:
   - El estudiante abre el enlace o escanea el QR desde cualquier navegador (Chrome o Edge) en el computador de la universidad.
   - Ingresa su nombre, documento/código y la clave dictada por el profesor en el salón.
   - Al pulsar **"Iniciar Examen"**:
     - El examen solicita **Pantalla Completa obligatoria**.
     - Se descifra la URL de Google Forms en la memoria RAM del navegador (sin exponerla).
     - Se activa la barra superior de supervisión con cronómetro regresivo y semáforo de faltas.

3. **Motor Anti-Trampas Activo**:
   - 🚨 **Detección de Alt+Tab o clic en otra app:** detecta inmediatamente la pérdida de foco (`window.blur`).
   - 🚨 **Detección de cambio de pestaña:** supervisa la visibilidad (`document.visibilitychange`).
   - 🚨 **Detección de salida de pantalla completa:** si presionan `Esc` o `F11`, la pantalla se bloquea inmediatamente con una alarma sonora.
   - 🔒 **Bloqueos de atajos:** anula clic derecho, `F12`, `Ctrl+Shift+I`, `Ctrl+U`, `Ctrl+C`, `Ctrl+V` y `Ctrl+P`.
   - ⛔ **Bloqueo Definitivo (Strikes):** Si el estudiante acumula el límite de faltas configurado, el formulario de Google Forms se destruye de la pantalla y se genera un reporte oficial con código de verificación antifraude.

---

## 🌐 Cómo desplegarlo en GitHub Pages (Gratis y en 3 minutos)

No necesitas pagar servidores ni configurar bases de datos:

1. Ve a [GitHub.com](https://github.com) e inicia sesión (o crea una cuenta gratuita).
2. Haz clic en **"New repository"** (Nuevo repositorio).
   - Asígnale un nombre, por ejemplo: `sistema-examenes`.
   - Selecciona **Public**.
   - Haz clic en **"Create repository"**.
3. Sube los siguientes 5 archivos del proyecto:
   - `index.html`
   - `admin.html`
   - `styles.css`
   - `crypto.js`
   - `qrcode.min.js`
4. En tu repositorio, entra a **Settings** (Configuración) > pestaña **Pages** (en el menú lateral izquierdo).
5. En la sección **Branch**, selecciona `main` (o `master`) y la carpeta `/ (root)`, luego haz clic en **Save**.
6. ¡Listo! El sistema ya se encuentra desplegado y activo:
   - **Para configurar tus exámenes (Docente):** `https://alvaropito.github.io/sistema-examenes/admin.html`
   - **Portal de los alumnos:** `https://alvaropito.github.io/sistema-examenes/index.html` (o directamente `https://alvaropito.github.io/sistema-examenes/`)

> **Nota:** Solo necesitas desplegar en GitHub **una sola vez**. Para cada nuevo examen o materia, solo entras a `admin.html` y generas el enlace nuevo con su propia contraseña.

---

## 💻 Cómo probarlo ahora mismo en tu computador

1. Si deseas probarlo localmente, puedes hacer doble clic en `admin.html` o abrirlo en tu navegador.
2. Ingresa un enlace de Google Forms de prueba (o usa cualquier enlace).
3. Haz clic en **"Generar Enlace Seguro de Examen"**.
4. Haz clic en **"🚀 Probar como Alumno"**.
5. Simula el examen: ingresa tu nombre, código y la clave generada, y prueba presionar `Alt+Tab` o salir de pantalla completa para ver cómo reacciona la alarma y el contador de faltas.

---

## 🔒 Arquitectura de Seguridad
- **Cero dependencias externas:** Todo el código funciona 100% autónomo (incluso sin conexión a CDNs externos).
- **Web Crypto API Nativa:** Cifrado simétrico autenticado AES-GCM con PBKDF2 y sal aleatoria de 128 bits.
- **Audio Sintético:** La sirena de advertencia se genera con `AudioContext` nativo del navegador, sin requerir descargas de archivos de audio.
