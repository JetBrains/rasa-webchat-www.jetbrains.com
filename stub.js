/**
 * WebChat Kill-Switch Stub
 */

// Log once that WebChat is disabled
if (typeof console !== 'undefined' && console.log) {
  console.log('[WebChat] off');
}

// Minimal stub implementation that provides the same API but does nothing
const stub = () => {
  // No-op function
};

// Export as default for UMD builds
export default stub;

// Also export selfMount for compatibility
export const selfMount = () => {
  // No-op - widget disabled
};
