// Complete source clause/description pairs, loaded only when the reader opens the catalogue.
(()=>{
 const box=document.querySelector('#labor-pattern-browser');
 if(!box)return;
 const select=box.querySelector('select'),input=box.querySelector('input');
 const status=box.querySelector('[role="status"]'),list=box.querySelector('ol');
 const previous=box.querySelector('[data-page="previous"]'),next=box.querySelector('[data-page="next"]');
 const retry=box.querySelector('[data-retry]'),cache=new Map();
 let rows=[],filtered=[],page=0,request=0,ready=false,busy=false;
 const size=20,format=n=>n.toLocaleString('zh-TW');
 function render(){
  const term=input.value.trim().toLocaleLowerCase();
  filtered=rows.filter(row=>row.some(text=>text.toLocaleLowerCase().includes(term)));
  const total=filtered.length,pages=Math.max(1,Math.ceil(total/size));
  page=Math.min(page,pages-1);list.replaceChildren();list.start=page*size+1;
  for(const [clause,description] of filtered.slice(page*size,(page+1)*size)){
   const item=document.createElement('li'),heading=document.createElement('strong'),body=document.createElement('p');
   heading.textContent=clause||'原始公告未填法條';body.textContent=description||'原始公告未填違反內容';
   item.append(heading,body);list.append(item);
  }
  status.textContent=total?`${select.selectedOptions[0].textContent}｜${format(total)} 組${term?'符合搜尋條件的':''}公告文字；第 ${page+1}／${pages} 頁（每頁 ${size} 組）。`:'沒有符合的公告文字；可更換關鍵字或法規。';
  list.scrollTop=0;previous.disabled=page===0;next.disabled=page+1>=pages;
 }
 async function load(){
  const token=++request,id=select.value;busy=true;rows=[];page=0;
  list.replaceChildren();retry.hidden=true;previous.disabled=next.disabled=true;
  status.textContent='載入完整公告文字中…';box.setAttribute('aria-busy','true');
  try{
   if(!cache.has(id)){
    const response=await fetch(`labor-patterns/law-${id}.json.gz`);
    if(!response.ok)throw Error('Unavailable');
    if(!('DecompressionStream' in window))throw Error('Unsupported browser');
    const data=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    if(!Array.isArray(data)||!data.every(row=>Array.isArray(row)&&row.length===2&&row.every(s=>typeof s==='string')))throw Error('Invalid data');
    cache.set(id,data);
   }
   if(token!==request)return;
   rows=cache.get(id);render();
  }catch(error){
   if(token!==request)return;
   status.textContent='清單暫時無法載入，請重試或改用新版瀏覽器；也可由下方連結前往勞動部查詢原始公告。';retry.hidden=false;
  }finally{if(token===request){busy=false;box.removeAttribute('aria-busy');}}
 }
 box.addEventListener('toggle',()=>{if(box.open&&!ready){ready=true;load();}});
 select.addEventListener('change',load);
 input.addEventListener('input',()=>{page=0;if(!busy)render();});
 retry.addEventListener('click',load);
 function move(delta){page+=delta;render();status.focus();}
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
})();
