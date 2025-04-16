import CryptoJS from 'crypto-js';

export class Encryption {
  private static readonly keySize = 256;
  private static readonly iterations = 100;

  static generateKey(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  static encrypt(message: string, secretKey: string): string {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = CryptoJS.PBKDF2(secretKey, salt, {
      keySize: this.keySize / 32,
      iterations: this.iterations,
    });
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(message, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
    });
    const encryptedMessage = salt.toString() + iv.toString() + encrypted.toString();
    return encryptedMessage;
  }

  static decrypt(encryptedMessage: string, secretKey: string): string {
    const salt = CryptoJS.enc.Hex.parse(encryptedMessage.substr(0, 32));
    const iv = CryptoJS.enc.Hex.parse(encryptedMessage.substr(32, 32));
    const encrypted = encryptedMessage.substring(64);
    const key = CryptoJS.PBKDF2(secretKey, salt, {
      keySize: this.keySize / 32,
      iterations: this.iterations,
    });
    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }
}
