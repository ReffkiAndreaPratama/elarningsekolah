/**
 * GPS Utility Functions
 * Haversine formula for accurate distance calculation
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Validate if student is within allowed radius of school
 */
function validateGPSLocation(studentLat, studentLng) {
  const schoolLat = parseFloat(process.env.SCHOOL_LAT || '14.5995');
  const schoolLng = parseFloat(process.env.SCHOOL_LNG || '120.9842');
  const allowedRadius = parseFloat(process.env.SCHOOL_RADIUS_METERS || '200');

  const distance = calculateDistance(studentLat, studentLng, schoolLat, schoolLng);
  const isValid = distance <= allowedRadius;

  return {
    isValid,
    distance: Math.round(distance * 100) / 100,
    allowedRadius,
    schoolLocation: { lat: schoolLat, lng: schoolLng }
  };
}

/**
 * Basic GPS spoofing detection
 * Checks for suspicious patterns
 */
function detectGPSSpoofing(lat, lng, accuracy) {
  const suspiciousIndicators = [];

  // Check for suspiciously perfect coordinates (rounded to too few decimals)
  const latStr = lat.toString();
  const lngStr = lng.toString();
  const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
  const lngDecimals = lngStr.includes('.') ? lngStr.split('.')[1].length : 0;

  if (latDecimals < 3 || lngDecimals < 3) {
    suspiciousIndicators.push('Suspiciously low GPS precision');
  }

  // Check for unrealistic accuracy (too perfect)
  if (accuracy !== undefined && accuracy === 0) {
    suspiciousIndicators.push('Zero GPS accuracy reported');
  }

  // Check coordinate bounds
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    suspiciousIndicators.push('Coordinates out of valid range');
  }

  return {
    isSuspicious: suspiciousIndicators.length > 0,
    indicators: suspiciousIndicators
  };
}

module.exports = { calculateDistance, validateGPSLocation, detectGPSSpoofing };
