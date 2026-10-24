(() => {
'use strict';
const search = document.getElementById('search'), tags = document.getElementById('tags'), cards = document.getElementById('gallery-cards');
let selected = 'All';
function draw() {
  cards.replaceChildren();
  const query = search.value.toLowerCase().trim();
  const items = Examples.catalog.filter(sample=>(selected === 'All' || sample.tags.includes(selected)) && [sample.title,sample.description,...sample.tags].join(' ').toLowerCase().includes(query));
  document.getElementById('gallery-count').textContent = `${items.length} starting point${items.length === 1 ? '' : 's'}`;
  for (const sample of items) {
    const card = document.createElement('article'); card.className = 'gallery-card';
    const imageLink = document.createElement('a'); imageLink.href = './?example='+sample.id; imageLink.tabIndex = -1; imageLink.setAttribute('aria-hidden','true');
    const image = document.createElement('img'); image.src = 'gallery/previews/'+sample.id+'.png'; image.alt = ''; image.width = 480; image.height = 270; image.loading = 'lazy'; imageLink.append(image);
    const content = document.createElement('div'); content.className = 'card-content';
    const label = document.createElement('p'); label.className = 'card-tag'; label.textContent = sample.tags.join(' / ');
    const title = document.createElement('h2'); title.textContent = sample.title;
    const description = document.createElement('p'); description.textContent = sample.description;
    const actions = document.createElement('div'); actions.className = 'card-actions';
    for (const [text,href] of [['Load in editor →','./?example='+sample.id],['View page ↗','./?example='+sample.id+'&view'],['MDN ↗',sample.mdn]]) {
      const link = document.createElement('a'); link.textContent = text; link.href = href; if (text !== 'Load in editor →') { link.target = '_blank'; link.rel = 'noopener'; } actions.append(link);
    }
    content.append(label,title,description,actions); card.append(imageLink,content); cards.append(card);
  }
  for (const button of tags.children) button.setAttribute('aria-pressed',String(button.textContent === selected));
}
for (const tag of ['All',...new Set(Examples.catalog.flatMap(s=>s.tags))]) { const button = document.createElement('button'); button.textContent = tag; button.onclick = ()=>{selected = tag;draw();}; tags.append(button); }
search.oninput = draw; draw();
})();
