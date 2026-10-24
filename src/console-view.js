(() => {
'use strict';
class ConsoleView {
  constructor({list,badge,onLocation,onEval}) {
    Object.assign(this,{list,badge,onLocation}); this.mobileBadge = document.getElementById('mobile-console-count'); this.entries = []; this.count = 0;
    document.getElementById('console-clear').onclick = () => this.clear();
    document.getElementById('console-copy').onclick = () => navigator.clipboard.writeText(this.entries.map(e=>`${e.level}: ${e.text}${e.file ? ' ('+e.file+':'+e.line+')' : ''}`).join('\n')).catch(()=>{});
    document.getElementById('console-form').onsubmit = event => { event.preventDefault(); const input = document.getElementById('console-expression'); if (input.value.trim()) onEval(input.value); input.value = ''; };
  }
  clear() { this.list.replaceChildren(); this.entries = []; this.count = 0; this.badge.textContent = '0'; if (this.mobileBadge) this.mobileBadge.textContent = '0'; }
  add(entry) {
    const text = entry.args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg,null,2)).join(' ');
    const previous = this.entries.at(-1);
    if (['warn','error'].includes(entry.level)) { this.count++; this.badge.textContent = String(this.count); if (this.mobileBadge) this.mobileBadge.textContent = String(this.count); }
    if (previous && previous.text === text && previous.level === entry.level && previous.file === entry.file && previous.line === entry.line) { previous.repeats++; previous.repeatNode.textContent = '×' + previous.repeats; return; }
    if (this.entries.length >= 500) { this.entries.shift(); this.list.firstChild?.remove(); }
    const row = document.createElement('div'); row.className = 'console-entry ' + entry.level;
    const content = document.createElement(entry.args.some(a=>a && typeof a === 'object') ? 'details' : 'span');
    if (content.tagName === 'DETAILS') { const summary = document.createElement('summary'); summary.textContent = text.slice(0,130); const pre = document.createElement('pre'); pre.textContent = text; content.append(summary,pre); } else content.textContent = text;
    const repeatNode = document.createElement('small'); repeatNode.className = 'repeat'; row.append(content,repeatNode);
    if (entry.file) { const button = document.createElement('button'); button.textContent = entry.file+':'+entry.line; button.className = 'console-location'; button.onclick = () => this.onLocation(entry.file,entry.line); row.append(button); }
    this.entries.push({...entry,text,repeats:1,repeatNode}); this.list.append(row); this.list.scrollTop = this.list.scrollHeight;
  }
}
globalThis.ConsoleView = ConsoleView;
})();
