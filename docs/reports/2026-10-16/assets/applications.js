'use strict';
(()=>{
const data=JSON.parse(document.getElementById('applications-data').textContent);const $=id=>document.getElementById(id);
 const series=[{label:'維持現狀，以後走向統一',color:'#806329'},{label:'維持現狀，看情形再決定獨立或統一',color:'#3676a0'},{label:'永遠維持現狀',color:'#174e3c'},{label:'維持現狀，以後走向獨立',color:'#bd4b30'}];
 let mode='parts';
 const first=Date.parse(data.polls[0].date),last=Date.parse(data.polls.at(-1).date);
 const x=date=>64+(Date.parse(date)-first)/(last-first)*940,y=value=>320-value*2.65;
 function chart(){const lines=mode==='total'?[{label:'四種維持現狀選項合計',color:'#174e3c',get:r=>r.total}]:series.map((s,i)=>({...s,get:r=>r.values[i]}));$('poll-legend').innerHTML=lines.map(s=>`<span><i style="background:${s.color}"></i>${s.label}</span>`).join('');let svg=`<svg viewBox="0 0 1060 375" role="img" aria-labelledby="poll-svg-title poll-svg-desc"><title id="poll-svg-title">2016 年 3 月至 2026 年 8 月，${mode==='total'?'四種維持現狀選項合計':'四種維持現狀選項各自比例'}趨勢</title><desc id="poll-svg-desc">共 31 次調查，縱軸為 0 至 100%。可用下方日期選單閱讀精確數值，或下載完整 CSV。</desc>`;
 for(let n=0;n<=100;n+=20)svg+=`<line x1="64" x2="1004" y1="${y(n)}" y2="${y(n)}" stroke="#cad0c3"/><text x="53" y="${y(n)+5}" text-anchor="end" font-size="16" fill="#59675f">${n}%</text>`;
 for(const yr of [2016,2018,2020,2022,2024,2026])svg+=`<text x="${x(yr===2016?data.polls[0].date:yr+'-01-01')}" y="351" text-anchor="middle" font-size="16" fill="#59675f">${yr}</text>`;
 for(const s of lines){svg+=`<polyline points="${data.polls.map(r=>x(r.date)+','+y(s.get(r))).join(' ')}" fill="none" stroke="${s.color}" stroke-width="3"/>`;for(const r of data.polls)svg+=`<circle cx="${x(r.date)}" cy="${y(s.get(r))}" r="3.2" fill="${s.color}"><title>${r.date} ${s.label}：${s.get(r)}%</title></circle>`;}
 const chosen=data.polls[Number($('poll-date').value)||0];svg+=`<line x1="${x(chosen.date)}" x2="${x(chosen.date)}" y1="50" y2="320" stroke="#59675f" stroke-dasharray="5 5"/></svg>`;$('poll-chart').innerHTML=svg;document.querySelectorAll('[data-poll-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pollMode===mode)));}
 $('poll-date').innerHTML=data.polls.map((r,i)=>`<option value="${i}">${r.date}</option>`).join('');$('poll-date').value=String(data.polls.length-1);
 function readout(){const r=data.polls[Number($('poll-date').value)];$('poll-readout').innerHTML=`<h4>${r.date} 開始的調查</h4><div class="number-list">${series.map((s,i)=>`<div>${s.label}<strong>${r.values[i].toFixed(1)}%</strong></div>`).join('')}<div>四項合計<strong>${r.total.toFixed(1)}%</strong></div></div>`;chart();}
 document.querySelectorAll('[data-poll-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.pollMode;chart();}));$('poll-date').addEventListener('change',readout);readout();
})();
