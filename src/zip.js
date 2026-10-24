(() => {
'use strict';
const table = Array.from({length:256},(_,n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), chunks = [], directory = []; let offset = 0;
  function header(size,values) { const buffer = new Uint8Array(size), view = new DataView(buffer.buffer); for (const [at,value,width] of values) width === 2 ? view.setUint16(at,value,true) : view.setUint32(at,value,true); return buffer; }
  for (const file of files) {
    const name = enc.encode(file.name), data = enc.encode(file.text), crc = crc32(data);
    const local = header(30,[[0,0x04034b50],[4,20,2],[6,0x800,2],[12,0x21,2],[14,crc],[18,data.length],[22,data.length],[26,name.length,2]]);
    chunks.push(local,name,data);
    const central = header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[8,0x800,2],[14,0x21,2],[16,crc],[20,data.length],[24,data.length],[28,name.length,2],[42,offset]]);
    directory.push(central,name); offset += local.length + name.length + data.length;
  }
  const size = directory.reduce((sum,part)=>sum+part.length,0);
  const end = header(22,[[0,0x06054b50],[8,files.length,2],[10,files.length,2],[12,size],[16,offset]]);
  const result = new Uint8Array(offset+size+end.length); let at = 0;
  for (const part of [...chunks,...directory,end]) { result.set(part,at); at += part.length; } return result;
}
const Zip = { crc32, zip };
if (typeof module !== 'undefined') module.exports = Zip; else globalThis.Zip = Zip;
})();
