/** HashBin controls: snapshot saves approved on hashbin.org, and stale-load guards. */
class HashBinPanel {
  constructor({ store, getSnapshot, getFingerprint, onLoad, onSaved, getShareOptions, getSavedLink }) {
    Object.assign(this, { store, getSnapshot, getFingerprint, onLoad, onSaved, getShareOptions, getSavedLink });
    this.revision = 0;
    this.status = document.getElementById('hashbin-status');
    this.dialog = document.getElementById('share-dialog');
    this.message = document.getElementById('hashbin-message');
    this.confirm = document.getElementById('hashbin-confirm');
    document.getElementById('hashbin-load').onclick = () => this.load(document.getElementById('hashbin-cid').value);
    document.getElementById('hashbin-cid').onkeydown = event => { if (event.key === 'Enter') this.load(event.target.value); };
    this.dialog.addEventListener('close', () => { this.dialogRevision = (this.dialogRevision || 0) + 1; });
    this.confirm.onclick = () => this.commit();
  }
  cancelLoad() {
    this.revision++;
    if (this.status.textContent === 'Loading from HashBin…') this.status.textContent = '';
  }
  async load(input) {
    const cid = HashBinDocuments.cid(input);
    if (!cid) { this.status.textContent = 'Enter a valid HashBin CID or saved link.'; return; }
    const revision = ++this.revision;
    this.status.textContent = 'Loading from HashBin…';
    try {
      const snapshot = await this.store.load(cid);
      if (revision !== this.revision) return;
      if (this.onLoad(snapshot, cid) === false) { this.status.textContent = 'Load cancelled. Current project kept.'; return; }
      this.status.textContent = 'Loaded from HashBin.';
    } catch (error) { if (revision === this.revision) this.status.textContent = error.message; }
  }
  async openSave() {
    if (this.saving) return;
    const revision = this.dialogRevision = (this.dialogRevision || 0) + 1;
    this.confirm.disabled = true;
    this.confirm.textContent = 'Save to HashBin';
    this.savedLink = null;
    this.message.textContent = 'Preparing save…';
    if (!this.dialog.open) this.dialog.showModal();
    try {
      this.snapshot = this.getSnapshot();
      this.payload = HashBinDocuments.serialize(this.snapshot);
      this.fingerprint = this.getFingerprint();
      // Load the SDK now: the approval popup must open synchronously from the next click.
      await this.store.init();
      if (revision !== this.dialogRevision) return;
      this.message.textContent = `${HashBinDocuments.bytes(this.payload).length} bytes. HashBin shows the retention, exact price and your balance, and you approve the save on hashbin.org. This editor never holds your HashBin sign-in.`;
      this.confirm.disabled = false;
    } catch (error) { if (revision === this.dialogRevision) this.message.textContent = error.message; }
  }
  async commit() {
    if (this.confirm.disabled || this.saving) return;
    if (this.fingerprint !== this.getFingerprint()) { await this.openSave(); return; }
    this.confirm.disabled = true;
    this.saving = true;
    try {
      const pending = this.store.publish(this.payload, this.snapshot, this.getShareOptions());
      this.message.textContent = 'Waiting for your approval on HashBin…';
      const result = await pending;
      if (result.redirected) return;
      this.saved(result.cid, this.fingerprint);
      this.message.replaceChildren(document.createTextNode('Saved. '));
      const a = document.createElement('a');
      this.savedLink = { element:a, cid:result.cid, snapshot:this.snapshot };
      this.refreshSavedLink();
      this.message.append(a);
      this.confirm.textContent = 'Saved';
    } catch (error) {
      this.message.textContent = error.message;
      this.confirm.disabled = false;
    } finally { this.saving = false; }
  }
  refreshSavedLink() {
    if (!this.savedLink) return;
    const { element, cid, snapshot } = this.savedLink;
    element.href = this.getSavedLink(cid, snapshot);
    element.textContent = this.getShareOptions().view ? 'Open saved page' : 'Open saved project';
  }
  /** Records a verified save, unless the project changed while HashBin was open. */
  saved(cid, fingerprint) {
    if (fingerprint === this.getFingerprint()) this.onSaved(cid, fingerprint, HashBinDocuments.link(location.href, cid));
    this.status.textContent = 'Saved to HashBin.';
  }
}
globalThis.HashBinPanel = HashBinPanel;
