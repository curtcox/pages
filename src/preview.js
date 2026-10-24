(() => {
'use strict';
class Preview {
  constructor({ iframe, getProject, onConsole, onClear, onTitle, onReady, onNavigate }) {
    Object.assign(this,{iframe,getProject,onConsole,onClear,onTitle,onReady,onNavigate}); this.history = [];
    window.addEventListener('message',event => this.message(event));
  }
  render(page = this.page || this.getProject().entry,hash = '') {
    const project = this.getProject();
    if (!project.files.some(f=>f.name === page && Project.PAGE.test(f.name))) page = project.entry;
    this.page = page; this.token = crypto.randomUUID(); this.onNavigate?.(page,this.history.length > 0);
    this.iframe.srcdoc = Bundler.build(project,page,{token:this.token,hash}).html;
  }
  navigate(page,hash = '') { if (this.page) this.history.push(this.page); this.render(page,hash); }
  back() { const page = this.history.pop(); if (page) this.render(page); }
  reset() { this.history = []; this.page = null; }
  eval(expression) { this.iframe.contentWindow.postMessage({channel:'pages-online',token:this.token,type:'eval',expression},'*'); }
  message(event) {
    const d = event.data;
    if (event.source !== this.iframe.contentWindow || !d || typeof d !== 'object' || d.channel !== 'pages-online' || d.token !== this.token) return;
    if (d.type === 'console' && ['log','info','warn','error','debug','table','dir'].includes(d.level) && Array.isArray(d.args) && d.args.length <= 100) {
      let size; try { size = JSON.stringify(d.args).length; } catch (_) { return; } if (size > 100000) return;
      const where = this.getProject().files.some(f=>f.name === d.file) && Number.isInteger(d.line) && d.line > 0 && d.line < 1000000 ? {file:d.file,line:d.line} : {};
      this.onConsole?.({...where,level:d.level,args:d.args});
    } else if (d.type === 'navigate' && typeof d.page === 'string' && this.getProject().files.some(f=>f.name === d.page && Project.PAGE.test(f.name))) this.navigate(d.page,typeof d.hash === 'string' ? d.hash.slice(0,1000) : '');
    else if (d.type === 'title' && typeof d.title === 'string') this.onTitle?.(d.title.slice(0,200));
    else if (d.type === 'ready') this.onReady?.();
    else if (d.type === 'clear') this.onClear?.();
  }
}
globalThis.Preview = Preview;
})();
