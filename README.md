# Sistema de exámenes con supervisión local
> **Despliegue en GitHub Pages • Cero Instalación • Cifrado AES-GCM • Google Forms Integrado**

Este sitio estático muestra un Google Form dentro de una interfaz que solicita pantalla completa y registra algunas señales de cambio de foco. Esas funciones son disuasorias: se ejecutan en el navegador del estudiante y pueden eludirse. El sitio no autentica estudiantes ni produce evidencia oficial. Consulta [SECURITY.md](SECURITY.md) antes de usarlo en evaluaciones.

---

## 🚀 Cómo funciona

1. **Panel del Profesor (`admin.html`)**:
   - Pegas el enlace de tu formulario de Google Forms.
   - Estableces el título, tiempo límite (minutos), límite de faltas toleradas (ej: 3 strikes) y una **clave secreta o PIN** (ej: `Calculo2026`).
   - El sistema cifra la configuración con AES-GCM de 256 bits usando ese PIN. El PIN debe compartirse por un canal separado; quien lo conozca puede descifrar el enlace.
   - Genera un **enlace único** y un **Código QR** listo para proyectar en el salón de clases.

2. **Portal del Estudiante (`index.html`)**:
   - El estudiante abre el enlace o escanea el QR desde cualquier navegador (Chrome o Edge) en el computador de la universidad.
   - Ingresa su nombre, documento/código y la clave dictada por el profesor en el salón.
   - Al pulsar **"Iniciar Examen"**:
     - El examen solicita **Pantalla Completa obligatoria**.
     - Se descifra la URL de Google Forms en el navegador. La URL queda disponible para la página y no debe considerarse secreta frente al estudiante.
     - Se activa la barra superior de supervisión con cronómetro regresivo y semáforo de faltas.

3. **Señales locales de supervisión (no son controles de seguridad)**:
   - **Pérdida de foco:** escucha `window.blur`; el navegador o el sistema operativo pueden limitar esta señal.
   - **Cambio de pestaña y salida de pantalla completa:** detecta algunos cambios y oculta el formulario en esta página.
   - **Bloqueos de teclado y clic derecho:** son manejadores JavaScript locales y se pueden omitir.
   - **Límite de faltas:** oculta el iframe en esta página y presenta un registro local no verificado; no cancela respuestas ya enviadas a Google Forms.

---

## 🌐 Cómo desplegarlo en GitHub Pages (Gratis y en 3 minutos)

No necesitas pagar servidores ni configurar bases de datos:

1. Ve a [GitHub.com](https://github.com) e inicia sesión (o crea una cuenta gratuita).
2. Haz clic en **"New repository"** (Nuevo repositorio).
   - Asígnale un nombre, por ejemplo: `sistema-examenes`.
   - Selecciona **Public**.
   - Haz clic en **"Create repository"**.
3. Sube estos archivos del proyecto:
   - `index.html`
   - `admin.html`
   - `exam-controller.js`
   - `styles.css`
   - `crypto.js`
   - `qrcode.min.js`
   - `SECURITY.md` (documentación; no la carga la aplicación)
4. En tu repositorio, entra a **Settings** (Configuración) > pestaña **Pages** (en el menú lateral izquierdo).
5. En la sección **Branch**, selecciona `main` (o `master`) y la carpeta `/ (root)`, luego haz clic en **Save**.
6. ¡Listo! El sistema ya se encuentra desplegado y activo:
   - **Para configurar tus exámenes (Docente):** `https://alvaropito.github.io/sistema-examenes/admin.html`
   - **Portal de los alumnos:** `https://alvaropito.github.io/sistema-examenes/index.html` (o directamente `https://alvaropito.github.io/sistema-examenes/`)

> **Nota:** Solo necesitas desplegar en GitHub **una sola vez**. Para cada nuevo examen o materia, solo entras a `admin.html` y generas el enlace nuevo con su propia contraseña.

---

## 💻 Cómo probarlo ahora mismo en tu computador

1. Para probarlo localmente, sírvelo desde `localhost` (por ejemplo con una extensión de servidor local); el navegador puede bloquear Web Crypto al abrir archivos directamente.
2. Ingresa un enlace HTTPS de Google Forms.
3. Haz clic en **"Generar Enlace Seguro de Examen"**.
4. Haz clic en **"🚀 Probar como Alumno"**.
5. Simula el examen: ingresa tu nombre, código y la clave generada, y prueba presionar `Alt+Tab` o salir de pantalla completa para ver cómo reacciona la alarma y el contador de faltas.

---

## Seguridad

La configuración del enlace se cifra con Web Crypto: AES-GCM, PBKDF2 y una sal aleatoria. Esto protege el contenido del enlace frente a quien no conoce el PIN, pero no autentica al estudiante ni protege el examen en un dispositivo que controla. El temporizador y el registro son locales y modificables. Revisa [SECURITY.md](SECURITY.md) para conocer las limitaciones.



Panel del Profesor (Generador y QR):
https://alvaropito.github.io/sistema-examenes/admin.html

Portal del Estudiante (Examen supervisado):
https://alvaropito.github.io/sistema-examenes/ (o index.html)

Repositorio de GitHub:
https://github.com/alvaropito/sistema-examenes
