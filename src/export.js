(() => {
'use strict';
const Export = {
  download(name,body,type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([body],{type})), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
  },
  file(project) { const file = project.files.find(f=>f.name === project.active); this.download(file.name.split('/').pop(),file.text); },
  html(project,page) { this.download(page.replace(/\.[^.]+$/,'.html').split('/').pop(),Bundler.build(project,page,{runtime:false,guard:false}).html,'text/html;charset=utf-8'); },
  project(project) { this.download('pages-project.zip',Zip.zip(project.files),'application/zip'); },
  async importFiles(list,project,replace = false) {
    if (!list.length) return project;
    if (list.length > 50 || [...list].reduce((n,f)=>n+f.size,0) > 5*1024*1024) throw Error('Import at most 50 text files and 5 MiB.');
    const files = replace ? [] : project.files.map(f=>({...f}));
    for (const file of list) {
      const name = file.webkitRelativePath || file.name;
      if (!Project.validName(name)) throw Error('Unsupported file: ' + name);
      const text = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const old = files.find(f=>f.name === name); if (old) old.text = text; else files.push({name,text});
    }
    return Project.validate({files,entry:replace ? undefined : project.entry,active:list[0].webkitRelativePath || list[0].name});
  }
};
globalThis.Export = Export;
})();
