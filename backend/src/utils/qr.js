const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique QR token for a class session
 */
function generateQRToken() {
  return uuidv4();
}

/**
 * Generate QR code as base64 data URL
 * @param {string} token - The QR token
 * @param {number} sessionId - Session ID
 * @returns {Promise<string>} Base64 QR code image
 */
async function generateQRCode(token, sessionId) {
  const payload = JSON.stringify({
    token,
    sessionId,
    timestamp: Date.now()
  });

  const qrDataURL = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1e40af',
      light: '#ffffff'
    },
    width: 300
  });

  return qrDataURL;
}

/**
 * Calculate QR expiry time
 */
function getQRExpiryTime() {
  const expiryMinutes = parseInt(process.env.QR_EXPIRY_MINUTES || '10');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);
  return expiresAt;
}

/**
 * Check if QR token is still valid
 */
function isQRValid(expiresAt) {
  if (!expiresAt) return false;
  return new Date() < new Date(expiresAt);
}

module.exports = { generateQRToken, generateQRCode, getQRExpiryTime, isQRValid };
