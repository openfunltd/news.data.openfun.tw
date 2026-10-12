(()=>{'use strict';
const data=JSON.parse(document.getElementById('cool-data').textContent);
const labels=['冷氣','廁所','座位','飲水機','無障礙設施'];
const maps={},layers={},groups={};
const centres={cool:[25.033,121.522],aerial:[23.683,121.425],soil:[25.036,121.45]};
const soilAreas={xinzhuang:[25.036,121.45],zhongzheng:[25.033,121.522]};
const urls='https://wmts.nlsc.gov.tw/wmts/';
const attr={EMAP6:'<a href="https://maps.nlsc.gov.tw/">國土測繪中心</a>｜臺灣通用電子地圖',EMAP2:'國土測繪中心｜道路地名',TOWN:'國土測繪中心｜鄉鎮市區界',SoilLiquefaction2:'地礦中心／國土測繪中心｜土壤液化潛勢',Asrs_2025_ortho:'林業保育署航測及遙測分署｜2024–2025 災前航照',Asrs_20250925_1:'林業保育署航測及遙測分署｜2025/9/25 航照',Asrs_20250925_2:'林業保育署航測及遙測分署｜2025/9/25 航照',Asrs_20250925_3:'林業保育署航測及遙測分署｜2025/9/25 航照'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tile(code,id,options={}){const t=L.tileLayer(urls+code+'/default/GoogleMapsCompatible/{z}/{y}/{x}',{minZoom:11,maxZoom:18,maxNativeZoom:18,keepBuffer:0,updateWhenIdle:true,attribution:attr[code],...options});let errors=0,success=0;t.on('tileload',()=>{success++;const n=document.getElementById('map-'+id+'-error');if(n)n.hidden=true;});t.on('tileerror',()=>{errors++;if(errors>=3&&success===0){let n=document.getElementById('map-'+id+'-error');if(!n){n=document.createElement('p');n.id='map-'+id+'-error';n.className='map-error';document.getElementById('map-'+id).after(n);}n.textContent='官方圖層暫時無法載入；其他資料與下方來源連結仍可使用。';n.hidden=false;}});return t;}
function popup(p){const present=labels.filter((_,i)=>p[5][i]==='1').join('、');return '<b>'+escape(p[1])+'</b><p>名錄設施：'+present+'</p><p>開放時間：'+escape(p[4])+'</p><p>座標：'+p[2].toFixed(6)+', '+p[3].toFixed(6)+'</p><p style="color:#59675f">資料更新 2026/8/6；請依場所公告確認。</p>';}
function points(group,list,color){group.clearLayers();const by={};list.forEach(p=>{const m=L.circleMarker([p[2],p[3]],{radius:7,color:'#fff',weight:2,fillColor:color,fillOpacity:.95}).addTo(group).bindPopup(popup(p));m.bindTooltip(p[1],{direction:'top'});by[p[0]]=m;});return by;}
let coolMarkers={};
function filterCool(){const filters=[...document.querySelectorAll('#cool-filters input:checked')].map(x=>+x.value);const selected=data.filter(p=>filters.every(i=>p[5][i]==='1'));document.getElementById('cool-count').textContent='符合條件 '+selected.length+'／'+data.length+' 筆公有涼爽點（臺北市中正區）';const select=document.getElementById('cool-place');select.replaceChildren(new Option('選擇場所並在地圖上查看',''));selected.forEach(p=>select.add(new Option(p[1],p[0])));if(groups.cool)coolMarkers=points(groups.cool,selected,'#174e3c');}
function start(id){if(maps[id])return maps[id];const el=document.getElementById('map-'+id);el.replaceChildren();if(!window.L){el.textContent='地圖未能載入，請重新整理或使用下方資料來源。';return null;}
const m=L.map(el,{scrollWheelZoom:false,zoomControl:true,minZoom:11,maxZoom:18,attributionControl:true}).setView(centres[id],id==='aerial'?15:14);maps[id]=m;L.control.scale({imperial:false,position:'bottomleft'}).addTo(m);m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
if(id==='cool'){layers.cool=tile('EMAP6',id).addTo(m);groups.cool=L.layerGroup().addTo(m);m.fitBounds(data.map(p=>[p[2],p[3]]),{padding:[25,25],maxZoom:15});m.attributionControl.addAttribution('涼適點：環境部');filterCool();}
if(id==='soil'){
tile('EMAP6',id).addTo(m);layers.soilOverlay=tile('SoilLiquefaction2',id,{opacity:.64,zIndex:2});if(document.getElementById('soil-overlay').checked)layers.soilOverlay.addTo(m);
tile('EMAP2',id,{opacity:.8,zIndex:3}).addTo(m);layers.soilBoundaries=tile('TOWN',id,{maxNativeZoom:17,zIndex:4});if(document.getElementById('soil-boundaries').checked)layers.soilBoundaries.addTo(m);
m.setView(soilAreas[document.getElementById('soil-area').value],14);
}
if(id==='aerial'){
const beforeEl=document.getElementById('map-aerial-before');beforeEl.replaceChildren();
const before=L.map(beforeEl,{scrollWheelZoom:false,minZoom:11,maxZoom:18}).setView(m.getCenter(),m.getZoom());maps.aerialBefore=before;
L.control.scale({imperial:false,position:'bottomleft'}).addTo(before);before.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
tile('EMAP6',id).addTo(m);tile('EMAP6','aerial-before').addTo(before);
['Asrs_20250925_1','Asrs_20250925_2','Asrs_20250925_3'].forEach(code=>tile(code,id).addTo(m));layers.aerialBefore=tile('Asrs_2025_ortho','aerial-before').addTo(before);
layers.aerialRoads=tile('EMAP2',id,{opacity:.8});layers.aerialBeforeRoads=tile('EMAP2','aerial-before',{opacity:.8});
if(document.getElementById('aerial-roads').checked){layers.aerialRoads.addTo(m);layers.aerialBeforeRoads.addTo(before);}
let syncing=false;const updateCentre=()=>{const c=m.getCenter();document.getElementById('aerial-centre').textContent='兩圖對照中心：北緯 '+c.lat.toFixed(6)+'、東經 '+c.lng.toFixed(6)+'；縮放層級 '+m.getZoom()+'。';};
function sync(source,target){if(syncing)return;syncing=true;target.setView(source.getCenter(),source.getZoom(),{animate:false});syncing=false;updateCentre();}
m.on('move',()=>sync(m,before));before.on('move',()=>sync(before,m));updateCentre();
}
return m;}
filterCool();
document.getElementById('cool-filters').addEventListener('change',()=>{start('cool');filterCool();});document.getElementById('cool-reset').addEventListener('click',()=>{document.querySelectorAll('#cool-filters input').forEach(i=>i.checked=false);start('cool');filterCool();maps.cool.fitBounds(data.map(p=>[p[2],p[3]]),{padding:[25,25]});});
document.getElementById('cool-place').addEventListener('change',e=>{start('cool');const marker=coolMarkers[e.target.value];if(marker){maps.cool.setView(marker.getLatLng(),16);marker.openPopup();}});
document.getElementById('aerial-roads').addEventListener('change',e=>{const m=start('aerial');if(!m)return;if(e.target.checked){layers.aerialRoads.addTo(m);layers.aerialBeforeRoads.addTo(maps.aerialBefore);}else{layers.aerialRoads.remove();layers.aerialBeforeRoads.remove();}});
document.getElementById('soil-overlay').addEventListener('change',e=>{const m=start('soil');if(m)e.target.checked?layers.soilOverlay.addTo(m):layers.soilOverlay.remove();});
document.getElementById('soil-boundaries').addEventListener('change',e=>{const m=start('soil');if(m)e.target.checked?layers.soilBoundaries.addTo(m):layers.soilBoundaries.remove();});
document.getElementById('soil-area').addEventListener('change',e=>{const m=start('soil');if(m)m.setView(soilAreas[e.target.value],14);});
document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.reset,m=start(id);if(m)m.setView(id==='soil'?soilAreas[document.getElementById('soil-area').value]:centres[id],id==='aerial'?15:14);}));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){start(e.target.id.replace('map-',''));observer.unobserve(e.target);}}),{rootMargin:'100px'});document.querySelectorAll('.application-map:not([data-linked-map])').forEach(el=>observer.observe(el));
})();
