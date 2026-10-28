// Test-only SDK surface. Never loaded by the shipped app.
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function cid(text) {
  const bytes = new TextEncoder().encode(text), size = new Uint8Array(6);
  new DataView(size.buffer).setUint32(2, bytes.length);
  return encode(size) + encode(bytes.length <= 64 ? bytes : new Uint8Array(await crypto.subtle.digest('SHA-512', bytes)));
}
export class HashBinClient {
  constructor(config) { this.config = config; }
  // Mirrors the real SDK: tests choose approval, cancellation or a blocked popup (redirect).
  publish(content, { clientState }) {
    const outcome = localStorage.getItem('pagesonline:test:publish') || 'approve';
    return cid(content).then(saved => {
      if (outcome === 'cancel') throw new Error('access_denied');
      if (outcome === 'redirect') {
        sessionStorage.setItem('pagesonline:test:transaction', JSON.stringify({ clientState }));
        location.href = this.config.redirectUri + '#hashbin_publish=fixture&cid=' + saved;
        return { redirected: true };
      }
      return { cid: saved };
    });
  }
  async handlePublishCallback({ hash }) {
    const params = new URLSearchParams(hash.slice(1)), saved = JSON.parse(sessionStorage.getItem('pagesonline:test:transaction'));
    sessionStorage.removeItem('pagesonline:test:transaction');
    return { cid: params.get('cid'), clientState: saved.clientState };
  }
  async disconnect() { localStorage.removeItem('hashbin:tokens:' + this.config.clientId); localStorage.setItem('pagesonline:test:revoked', 'yes'); }
}
