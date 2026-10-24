const {test}=require('node:test'),assert=require('node:assert/strict'),Scheduler=require('../src/render-scheduler.js');
test('scheduled edits coalesce and stale callbacks cannot render after a new version or manual Run',()=>{
 const callbacks=new Map();let id=0,renders=0;const timers={setTimeout:fn=>{callbacks.set(++id,fn);return id;},clearTimeout:key=>callbacks.delete(key)};
 const scheduler=new Scheduler({detect:()=>{},render:()=>renders++,timers,renderDelay:500});
 scheduler.schedule({detect:false});const stale=[...callbacks.values()][0];scheduler.schedule({detect:false});stale();assert.equal(renders,0);assert.equal(callbacks.size,1);[...callbacks.values()][0]();assert.equal(renders,1);
 scheduler.schedule({detect:false});const cancelled=[...callbacks.values()].at(-1);scheduler.cancel();cancelled();assert.equal(renders,1);
});
