import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Base width of 390 is standard for modern iPhones (e.g. iPhone 12/13/14)
// If the device is very wide (tablet/landscape), we cap the scale at 1 to prevent elements from becoming comically large.
const scale = width < 420 ? width / 390 : 1;

/**
 * Responsive scaler.
 * Multiplies value by the screen ratio relative to standard mobile width.
 */
export const s = (n: number): number => Math.round(n * scale);
