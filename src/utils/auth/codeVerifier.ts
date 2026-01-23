function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '')
    .slice(0, length);
}

const codeVerifier = generateCodeVerifier();

export default codeVerifier;
