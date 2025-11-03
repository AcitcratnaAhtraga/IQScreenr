/**
 * Color Utilities
 * Handles color conversion, interpolation, and generation for badges
 */

(function() {
  'use strict';

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1, color2, t) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Desaturate a color by a percentage (0-1)
 */
function desaturateColor(rgb, amount = 0.4) {
  const gray = Math.round(rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
  return {
    r: Math.round(rgb.r + (gray - rgb.r) * amount),
    g: Math.round(rgb.g + (gray - rgb.g) * amount),
    b: Math.round(rgb.b + (gray - rgb.b) * amount)
  };
}

/**
 * Parse color string to RGB object
 */
function parseColor(colorStr) {
  if (colorStr.startsWith('rgb')) {
    const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    }
  } else if (colorStr.startsWith('#')) {
    return hexToRgb(colorStr);
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * Interpolate between two RGB colors
 */
function interpolateRgbColor(color1, color2, t) {
  const r = Math.round(color1.r + (color2.r - color1.r) * t);
  const g = Math.round(color1.g + (color2.g - color1.g) * t);
  const b = Math.round(color1.b + (color2.b - color1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get IQ color based on score (desaturated for elegant appearance)
 */
function getIQColor(iq) {
  // Gradient from 55 (red) to 145+ (green)
  let baseColor;

  if (iq < 70) {
    baseColor = '#d32f2f';
  } else if (iq < 80) {
    const t = (iq - 70) / 10;
    baseColor = interpolateColor('#d32f2f', '#f57c00', t);
  } else if (iq < 90) {
    const t = (iq - 80) / 10;
    baseColor = interpolateColor('#f57c00', '#fb8c00', t);
  } else if (iq < 95) {
    const t = (iq - 90) / 5;
    baseColor = interpolateColor('#fb8c00', '#fbc02d', t);
  } else if (iq < 105) {
    const t = (iq - 95) / 10;
    baseColor = interpolateColor('#fbc02d', '#fdd835', t);
  } else if (iq < 115) {
    const t = (iq - 105) / 10;
    baseColor = interpolateColor('#fdd835', '#c5e1a5', t);
  } else if (iq < 125) {
    const t = (iq - 115) / 10;
    baseColor = interpolateColor('#c5e1a5', '#81c784', t);
  } else if (iq < 135) {
    const t = (iq - 125) / 10;
    baseColor = interpolateColor('#81c784', '#66bb6a', t);
  } else if (iq < 145) {
    const t = (iq - 135) / 10;
    baseColor = interpolateColor('#66bb6a', '#4caf50', t);
  } else {
    baseColor = '#2e7d32';
  }

  // Desaturate the color for a more elegant appearance
  let rgb;
  if (baseColor.startsWith('rgb')) {
    const match = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      rgb = { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    } else {
      rgb = { r: 0, g: 0, b: 0 };
    }
  } else {
    rgb = hexToRgb(baseColor);
  }
  const desat = desaturateColor(rgb, 0.5);
  return `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
}

/**
 * Get color based on confidence percentage (0-100)
 * Maps confidence to the same color scale as IQ scores
 */
function getConfidenceColor(confidence) {
  // Map confidence percentage (0-100) with clear color transitions
  // Darkest red starts at 0% and changes every ~10% to show clear differences
  let baseColor;

  if (confidence < 10) {
    baseColor = '#d32f2f'; // Darkest red for very low confidence (0-10%)
  } else if (confidence < 20) {
    const t = (confidence - 10) / 10;
    baseColor = interpolateColor('#d32f2f', '#f57c00', t);
  } else if (confidence < 30) {
    const t = (confidence - 20) / 10;
    baseColor = interpolateColor('#f57c00', '#fb8c00', t);
  } else if (confidence < 40) {
    const t = (confidence - 30) / 10;
    baseColor = interpolateColor('#fb8c00', '#fbc02d', t);
  } else if (confidence < 50) {
    const t = (confidence - 40) / 10;
    baseColor = interpolateColor('#fbc02d', '#fdd835', t);
  } else if (confidence < 60) {
    const t = (confidence - 50) / 10;
    baseColor = interpolateColor('#fdd835', '#c5e1a5', t);
  } else if (confidence < 70) {
    const t = (confidence - 60) / 10;
    baseColor = interpolateColor('#c5e1a5', '#81c784', t);
  } else if (confidence < 80) {
    const t = (confidence - 70) / 10;
    baseColor = interpolateColor('#81c784', '#66bb6a', t);
  } else if (confidence < 90) {
    const t = (confidence - 80) / 10;
    baseColor = interpolateColor('#66bb6a', '#4caf50', t);
  } else {
    // Use maximum vibrant green for 90-100% confidence
    baseColor = '#4caf50';
  }

  // Desaturate the color for a more elegant appearance
  // Use less desaturation for 100% confidence to show maximum green
  let rgb;
  if (baseColor.startsWith('rgb')) {
    const match = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      rgb = { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    } else {
      rgb = { r: 0, g: 0, b: 0 };
    }
  } else {
    rgb = hexToRgb(baseColor);
  }

  // Use minimal desaturation for 100% confidence to maintain maximum green
  const desaturationAmount = confidence === 100 ? 0.1 : 0.5;
  const desat = desaturateColor(rgb, desaturationAmount);
  return `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
}

/**
 * Get color for dimension in console output
 */
function getDimensionColor(dimension) {
  const colors = {
    vocabulary_sophistication: '#E91E63',
    lexical_diversity: '#3F51B5',
    sentence_complexity: '#009688',
    grammatical_precision: '#FF5722'
  };
  return colors[dimension] || '#757575';
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BadgeColorUtils = {
    hexToRgb,
    interpolateColor,
    desaturateColor,
    parseColor,
    interpolateRgbColor,
    getIQColor,
    getConfidenceColor,
    getDimensionColor
  };
}

})();

