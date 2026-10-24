// Test-only SDK surface. Never loaded by the shipped app.
export class HashBinClient {
  constructor(config) { this.config = config; }
  getTokens() { return this.config.storage?.getItem('pagesonline:test:connected') ? {refreshToken:'fixture-token',expiresAt:Date.now()+3600000} : null; }
  clearTokens() { this.config.storage?.removeItem('pagesonline:test:connected'); }
  async authorize() { const url=new URL(this.config.redirectUri); url.search='?code=fixture&state=fixture-state&hashbin-test=1&run=0'; return {state:'fixture-state',url:url.href}; }
  async handleCallback() { this.config.storage?.setItem('pagesonline:test:connected','yes'); }
  async refreshAccessToken() {}
  authorizedFetch(path,options) { return fetch('https://hashbin.org'+path,options); }
}
