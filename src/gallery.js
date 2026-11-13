import {mountGalleryAi,aiCallback} from './ai-client.js';
import {config,type} from './fragment-config.mjs';
if(aiCallback()) await new Promise(()=>{});
function mountGallery(options){const gallery=mountOriginalGallery(options);queueMicrotask(()=>void mountGalleryAi({config,type,...options}).catch(error=>{const p=document.createElement('p');p.setAttribute('role','status');p.textContent=error.message;options.container.before(p);}));return gallery;}
import {mountGallery as mountOriginalGallery} from '../vendor/fragment-kit-v0.4.3/src/index.js';
import {urlState} from './fragment-config.mjs';
const container=document.getElementById('gallery-cards'),samples=Examples.catalog;
mountGallery({container,urlState:{build:doc=>urlState.build(doc,{url:new URL('./',location.href).href,view:false})},catalog:samples.map(sample=>({id:sample.id,title:sample.title,tags:sample.tags,description:sample.description,document:{pages:sample.project},cover:'gallery/covers/'+sample.id+'.png'}))});
container.querySelector('input').id='search';container.querySelector('select').id='tag';container.querySelector('[role=status]').id='gallery-count';
const grid=container.querySelector('.fk-gallery-grid');function decorate(){for(const card of grid.children){if(card.dataset.pages)continue;const sample=samples.find(sample=>sample.title===card.querySelector('h2').textContent);if(!sample)continue;card.dataset.pages=sample.id;card.id=sample.id;card.classList.add('gallery-card');const view=document.createElement('a');view.textContent='View page ↗';view.href=urlState.build({pages:sample.project},{url:new URL('./',location.href).href,view:true}).href;view.target='_blank';view.rel='noopener noreferrer';const mdn=document.createElement('a');mdn.textContent='MDN ↗';mdn.href=sample.mdn;mdn.target='_blank';mdn.rel='noopener noreferrer';card.append(view,mdn);}}
new MutationObserver(decorate).observe(grid,{childList:true});decorate();
