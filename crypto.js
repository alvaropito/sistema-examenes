/**
 * Sistema de Cifrado Seguro para Exámenes Web
 * Utiliza Web Crypto API nativa (PBKDF2 + AES-GCM de 256 bits)
 * Cero dependencias externas - Funciona 100% offline y en navegadores modernos
 */

const ExamCrypto = (() => {
  const webCrypto = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  // Convertir ArrayBuffer a Base64 URL-safe
  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Convertir Base64 URL-safe a ArrayBuffer
  function base64UrlToBuffer(base64Url) {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Derivar clave criptográfica AES-GCM a partir de una contraseña usando PBKDF2
  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await webCrypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return webCrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Cifra un objeto JavaScript con una contraseña
   * @param {Object} data - Datos del examen
   * @param {string} password - Contraseña o PIN definido por el profesor
   * @returns {Promise<string>} Payload comprimido en Base64 URL-safe
   */
  async function encryptData(data, password) {
    const enc = new TextEncoder();
    const salt = webCrypto.getRandomValues(new Uint8Array(16));
    const iv = webCrypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);

    const jsonString = JSON.stringify(data);
    const encryptedContent = await webCrypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(jsonString)
    );

    // Empaquetar salt (16B) + iv (12B) + ciphertext
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + encryptedContent.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.byteLength);
    combined.set(new Uint8Array(encryptedContent), salt.byteLength + iv.byteLength);

    return bufferToBase64Url(combined.buffer);
  }

  /**
   * Descifra un payload Base64 con la contraseña ingresada por el alumno
   * @param {string} base64Payload - Payload cifrado
   * @param {string} password - Contraseña ingresada
   * @returns {Promise<Object>} Datos originales del examen
   */
  async function decryptData(base64Payload, password) {
    try {
      const buffer = base64UrlToBuffer(base64Payload);
      const bytes = new Uint8Array(buffer);

      if (bytes.length < 28) {
        throw new Error('Payload inválido o incompleto');
      }

      const salt = bytes.slice(0, 16);
      const iv = bytes.slice(16, 28);
      const ciphertext = bytes.slice(28);

      const key = await deriveKey(password, salt);

      const decrypted = await webCrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (err) {
      throw new Error('Contraseña incorrecta o enlace de examen alterado');
    }
  }

  return {
    encryptData,
    decryptData,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = ExamCrypto;
}
