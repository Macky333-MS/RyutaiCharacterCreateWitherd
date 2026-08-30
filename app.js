(() => {
  'use strict';

  const KANA = ['あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ','ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','を','ん'];
  const COLOR_DATA = [
    ['黒色','#000000'],['水色','#00d7df'],['黄緑色','#9acd32'],['緑色','#00ee00'],['黄色','#ffe600'],['だいだい色','#ffa000'],['ピンク色','#efb0bf'],['赤色','#ff1010'],['紫色','#ef00e8'],['青色','#1111ee'],
    ['茶色','#8b5a3c'],['薄だいだい色','#ffd4ae'],['山吹色','#ffbf00'],['黄土色','#bd9e4c'],['深緑色','#006633'],['群青色','#003171'],['すみれ色','#8c66b3'],['赤紫色','#993366'],['朱色','#e24200'],['こげ茶色','#4d331a'],['ねずみ色','#808080'],['白色','#ffffff'],['銀色','#c0c0c0'],['金色','#d9a621']
  ];

  const freshState = () => ({
    editingId: null,
    itemName: '',
    count: 0,
    useColor: true,
    mode: 'normal',
    palette: 10,
    selectedColor: '#000000',
    characters: Array(20).fill(''),
    colors: Array(20).fill('#000000'),
    layout: 'line',
    alias: false
  });
  let state = freshState();
  let currentStep = 1;
  let selectedSlot = 0;
  let selectedHistoryId = null;
  let favoritesOnly = false;
  let singleAwaitingColor = false;
  let db = null;

  const $ = id => document.getElementById(id);
  const qa = sel => Array.from(document.querySelectorAll(sel));

  function showView(view) {
    qa('.screen').forEach(x => x.classList.remove('active'));
    $(view).classList.add('active');
  }

  function startNew() {
    state = freshState();
    currentStep = 1;
    renderAll();
    showView('createView');
    showStep(1);
  }

  function showStep(step) {
    currentStep = Math.max(1, Math.min(7, step));
    qa('.step-page').forEach(p => p.classList.toggle('active', Number(p.dataset.step) === currentStep));
    $('stepIndicator').textContent = `${currentStep}/7`;
    const progressText = $('progressText');
    const progressFill = $('progressFill');
    if (progressText) progressText.textContent = `${currentStep} / 7`;
    if (progressFill) progressFill.style.width = `${(currentStep / 7) * 100}%`;
    renderAll();
    window.scrollTo({top:0, behavior:'auto'});
  }

  function nameText() { return state.itemName.trim() || '未入力'; }
  function updateNameStrips() {
    ['nameStrip2','nameStrip3','nameStrip4','nameStrip7'].forEach(id => { $(id).textContent = `項目名：${nameText()}`; });
  }

  function renderAll() {
    $('itemName').value = state.itemName;
    $('countDisplay').textContent = state.count;
    $('usedCount1').textContent = Math.min(state.count, 10);
    $('usedCount2').textContent = Math.max(0, state.count - 10);
    $('finalCount').textContent = state.count;
    updateNameStrips();
    $('colorToggle').classList.toggle('selected', state.useColor);
    $('colorToggle').setAttribute('aria-pressed', String(state.useColor));
    const switchLabel = $('colorToggle').querySelector('.switch-label');
    if (switchLabel) switchLabel.textContent = state.useColor ? 'ON' : 'OFF';
    qa('input[name="mode"]').forEach(r => r.checked = r.value === state.mode);
    qa('.palette-choice').forEach(b => b.classList.toggle('selected', Number(b.dataset.palette) === state.palette));
    qa('.shape-button').forEach(b => b.classList.toggle('selected', b.dataset.layout === state.layout));
    renderSlots();
    renderPalette();
    renderFinalCharacters();
  }

  function renderSlots() {
    renderSlotGroup($('slots1'), 0, 10);
    renderSlotGroup($('slots2'), 10, 20);
  }
  function renderSlotGroup(container, start, end) {
    container.innerHTML = '';
    for (let i=start; i<end; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'char-slot';
      if (i === selectedSlot) b.classList.add('active-select');
      const n = document.createElement('small'); n.textContent = String(i+1);
      const t = document.createElement('span');
      t.textContent = state.characters[i] || '';
      t.style.color = state.useColor ? state.colors[i] : '#fff';
      b.append(n,t);
      b.disabled = i >= state.count;
      b.style.opacity = i >= state.count ? '.45' : '1';
      b.addEventListener('click', () => { selectedSlot = i; renderSlots(); });
      container.appendChild(b);
    }
  }

  function renderPalette() {
    const wrap = $('paletteColors'); wrap.innerHTML = '';
    const targetWrap = $('colorTargetSlots');
    if (targetWrap) {
      targetWrap.innerHTML = '';
      for (let i=0; i<state.count; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'color-target-slot';
        if (i === selectedSlot) b.classList.add('selected');
        b.innerHTML = `<small>${i+1}</small><span>${escapeHtml(state.characters[i] || '□')}</span>`;
        b.style.color = state.colors[i] || '#000000';
        b.addEventListener('click', () => { selectedSlot = i; renderPalette(); });
        targetWrap.appendChild(b);
      }
    }

    COLOR_DATA.slice(0, state.palette).forEach(([name, hex]) => {
      const b = document.createElement('button');
      b.type='button'; b.className='color-swatch'; b.style.background=hex; b.title=name;
      if ((state.colors[selectedSlot] || state.selectedColor).toLowerCase() === hex.toLowerCase()) b.classList.add('selected');
      b.addEventListener('click', () => {
        state.selectedColor = hex;
        if (selectedSlot < state.count) state.colors[selectedSlot] = hex;
        $('selectedColorLabel').textContent = `${selectedSlot+1}文字目：${name}`;

        if (state.mode === 'single' && singleAwaitingColor) {
          singleAwaitingColor = false;
          const finishedSlot = selectedSlot;
          renderAll();
          if (finishedSlot >= state.count - 1) {
            showStep(7);
          } else {
            selectedSlot = finishedSlot + 1;
            showStep(characterStepForSlot(selectedSlot));
            setTimeout(() => openPicker(selectedSlot), 0);
          }
          return;
        }

        if (state.mode === 'normal' && selectedSlot < state.count - 1) selectedSlot++;
        renderAll();
      });
      wrap.appendChild(b);
    });
    const currentHex = state.colors[selectedSlot] || state.selectedColor;
    const found = COLOR_DATA.find(x => x[1].toLowerCase() === currentHex.toLowerCase());
    $('selectedColorLabel').textContent = `${selectedSlot+1}文字目：${found ? found[0] : currentHex}`;
  }

  function renderFinalCharacters() {
    const wrap = $('finalCharacters'); wrap.innerHTML='';
    for (let i=0; i<state.count; i++) {
      const s=document.createElement('span'); s.textContent=state.characters[i] || '□'; s.style.color=state.useColor ? state.colors[i] : '#fff'; wrap.appendChild(s);
    }
  }

  function showDialog(title, message, buttons) {
    $('dialogTitle').textContent = title;
    $('dialogMessage').textContent = message;
    const wrap = $('dialogButtons'); wrap.innerHTML='';
    buttons.forEach(({label, action}) => {
      const b=document.createElement('button'); b.type='button'; b.textContent=label;
      b.addEventListener('click', () => { $('messageDialog').close(); if (action) action(); });
      wrap.appendChild(b);
    });
    $('messageDialog').showModal();
  }

  function validateStep(step) {
    if (step === 1 && !state.itemName.trim()) {
      showDialog('入力確認','項目名を入力してください。',[{label:'閉じる'}]); return false;
    }
    if (step === 2 && state.count < 1) {
      showDialog('入力確認','使用する文字数を1〜20文字の範囲で設定してください。',[{label:'閉じる'}]); return false;
    }
    if (step === 3) {
      const end = Math.min(state.count, 10);
      const missing = state.characters.slice(0, end).some(x => !x);
      if (missing) { showDialog('文字選択',`1〜${end}文字目までの龍体文字を選択してください。`,[{label:'閉じる'}]); return false; }
    }
    if (step === 4) {
      const missing = state.characters.slice(10, state.count).some(x => !x);
      if (missing) { showDialog('文字選択','11文字目以降の龍体文字を選択してください。',[{label:'閉じる'}]); return false; }
    }
    return true;
  }

  function characterStepForSlot(slot) {
    return slot < 10 ? 3 : 4;
  }

  function lastCharacterStep() {
    return state.count > 10 ? 4 : 3;
  }

  function firstMissingSlot() {
    const index = state.characters.slice(0, state.count).findIndex(x => !x);
    return index === -1 ? Math.max(0, state.count - 1) : index;
  }

  function goNextFromStep(step) {
    if (!validateStep(step)) return;

    if (step === 1) return showStep(2);

    if (step === 2) {
      // 1文字モード＋カラーONでは、先に使う色数を決めてから
      // 「文字 → その文字の色 → 次の文字…」の流れへ入る。
      if (state.mode === 'single' && state.useColor) return showStep(5);
      selectedSlot = firstMissingSlot();
      showStep(3);
      if (state.mode === 'single') setTimeout(() => openPicker(selectedSlot), 0);
      return;
    }

    if (step === 3) {
      if (state.count > 10) return showStep(4);
      if (!state.useColor) return showStep(7);
      return showStep(5);
    }

    if (step === 4) {
      if (!state.useColor) return showStep(7);
      return showStep(5);
    }

    if (step === 5) {
      if (!state.useColor) return showStep(7);
      if (state.mode === 'single') {
        selectedSlot = firstMissingSlot();
        showStep(characterStepForSlot(selectedSlot));
        setTimeout(() => openPicker(selectedSlot), 0);
        return;
      }
      selectedSlot = 0;
      return showStep(6);
    }

    if (step === 6) return showStep(7);
  }

  function goPrevFromStep(step) {
    if (step === 2) return showStep(1);
    if (step === 3) {
      if (state.mode === 'single' && state.useColor) return showStep(5);
      return showStep(2);
    }
    if (step === 4) return showStep(3);
    if (step === 5) return showStep(lastCharacterStep());
    if (step === 6) return showStep(5);
    if (step === 7) {
      if (!state.useColor) return showStep(lastCharacterStep());
      return showStep(6);
    }
  }

  function openPicker(startIndex) {
    if (state.count === 0) return;
    selectedSlot = Math.min(Math.max(startIndex,0), state.count-1);
    $('pickerTitle').textContent = `${selectedSlot+1}文字目を選択`;
    $('pickerDialog').showModal();
  }

  function buildKanaGrid() {
    const grid=$('kanaGrid'); grid.innerHTML='';
    KANA.forEach(k => {
      const b=document.createElement('button'); b.type='button'; b.textContent=k;
      b.addEventListener('click', () => {
        if (selectedSlot < state.count) {
          const chosenSlot = selectedSlot;
          state.characters[chosenSlot] = k;

          if (state.mode === 'single') {
            if (state.useColor) {
              // 1文字モード：文字を決めた直後に、その文字の色選択へ移動。
              selectedSlot = chosenSlot;
              singleAwaitingColor = true;
              $('pickerDialog').close();
              showStep(6);
              return;
            }

            // カラーOFFなら色選択は挟まず、次の文字へそのまま進む。
            if (chosenSlot >= state.count - 1) {
              $('pickerDialog').close();
              showStep(7);
            } else {
              selectedSlot = chosenSlot + 1;
              renderAll();
              $('pickerTitle').textContent = `${selectedSlot+1}文字目を選択`;
            }
            return;
          }

          // 通常モードは、まず指定文字数分の龍体文字をまとめて選択する。
          if (selectedSlot < state.count-1) selectedSlot++;
          renderAll();
          $('pickerTitle').textContent = `${selectedSlot+1}文字目を選択`;
        }
      });
      grid.appendChild(b);
    });
  }

  function getPositions(count, layout) {
    const pos=[];
    if (!count) return pos;
    if (layout==='line') {
      const cols=Math.min(count,10); const rows=count>10?2:1;
      for(let i=0;i<count;i++) {
        const row=i<10?0:1; const rowCount=row===0?Math.min(10,count):count-10; const idx=row===0?i:i-10;
        pos.push({x:((idx+1)/(rowCount+1))*100,y:rows===1?50:(row===0?38:65),r:0});
      }
      return pos;
    }
    const dir=layout==='right'?1:-1;
    const start=-Math.PI*.85; const sweep=Math.PI*1.7;
    for(let i=0;i<count;i++) {
      const t=count===1?.5:i/(count-1); const a=start+dir*sweep*t;
      pos.push({x:50+Math.cos(a)*36,y:51+Math.sin(a)*36,r:a*180/Math.PI+90});
    }
    return pos;
  }

  function renderPreview() {
    const wrap=$('previewCanvas'); wrap.innerHTML='';
    const p=getPositions(state.count,state.layout);
    for(let i=0;i<state.count;i++) {
      if(!state.characters[i]) continue;
      const s=document.createElement('span'); s.className='preview-char'; s.textContent=state.characters[i];
      s.style.left=`${p[i].x}%`; s.style.top=`${p[i].y}%`; s.style.color=state.useColor?state.colors[i]:'#000';
      if(state.layout!=='line') s.style.transform=`translate(-50%,-50%) rotate(${p[i].r}deg)`;
      wrap.appendChild(s);
    }
  }

  function recordFromState(existing) {
    const now=new Date().toISOString();
    return {
      id: existing?.id || state.editingId || (crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`),
      itemName: state.itemName.trim(), count:state.count, useColor:state.useColor, mode:state.mode, palette:state.palette,
      characters:state.characters.slice(0,state.count), colors:state.colors.slice(0,state.count), layout:state.layout,
      favorite: existing?.favorite || false, createdAt: existing?.createdAt || now, updatedAt: now
    };
  }

  async function initDb() {
    if (!('indexedDB' in window)) return;
    await new Promise((resolve,reject)=>{
      const req=indexedDB.open('RyutaiCreateDBWizard',1);
      req.onupgradeneeded=()=>{ const d=req.result; if(!d.objectStoreNames.contains('works')) d.createObjectStore('works',{keyPath:'id'}); };
      req.onsuccess=()=>{db=req.result;resolve();}; req.onerror=()=>reject(req.error);
    });
  }
  function storePut(record){ return new Promise((res,rej)=>{ const tx=db.transaction('works','readwrite'); tx.objectStore('works').put(record); tx.oncomplete=()=>res(record); tx.onerror=()=>rej(tx.error); }); }
  function storeDelete(id){ return new Promise((res,rej)=>{ const tx=db.transaction('works','readwrite'); tx.objectStore('works').delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
  function storeAll(){ return new Promise((res,rej)=>{ const tx=db.transaction('works','readonly'); const r=tx.objectStore('works').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
  function storeGet(id){ return new Promise((res,rej)=>{ const tx=db.transaction('works','readonly'); const r=tx.objectStore('works').get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

  async function finishWork() {
    const existing=state.editingId ? await storeGet(state.editingId) : null;
    const rec=recordFromState(existing); await storePut(rec); state.editingId=rec.id;
    showDialog('保存完了','履歴へ保存しました。画像は履歴画面から任意のタイミングで保存できます。',[{label:'履歴を見る',action:openHistoryView},{label:'メニューへ',action:()=>showView('homeView')}]);
  }

  async function openHistoryView() { showView('historyView'); await renderHistory(); }
  async function renderHistory() {
    let all=(await storeAll()).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    if(favoritesOnly) all=all.filter(x=>x.favorite);
    const list=$('historyList'); list.innerHTML='';
    all.forEach(r=>{
      const b=document.createElement('button'); b.type='button'; b.className='history-item'; if(r.id===selectedHistoryId)b.classList.add('selected');
      const d=new Date(r.updatedAt); b.innerHTML=`<strong>${escapeHtml(r.itemName || '名称未設定')}${r.favorite?' ★':''}</strong><span>日付：${formatDate(d)}</span>`;
      b.addEventListener('click',()=>selectHistory(r.id)); list.appendChild(b);
    });
    if(!all.length){list.innerHTML='<div style="padding:24px;color:#777;text-align:center">保存データはありません。</div>';}
  }
  async function selectHistory(id) {
    selectedHistoryId=id; const r=await storeGet(id); if(!r)return;
    $('historyDetail').classList.remove('empty-detail');
    $('historyDetail').innerHTML=`<div>日付：<br>${formatDate(new Date(r.updatedAt),true)}</div><div>項目名：<br>${escapeHtml(r.itemName)}</div><div>龍体文字：</div><div class="detail-ryutai">${r.characters.map((c,i)=>`<span style="color:${r.useColor?r.colors[i]:'#fff'}">${escapeHtml(c)}</span>`).join('')}</div><div>形状：${layoutLabel(r.layout)}</div>`;
    $('historyActions').classList.remove('hidden');
    $('favoriteHistory').textContent=r.favorite?'★ お気に入り解除':'☆ お気に入り';
    document.querySelector('.history-layout').classList.add('detail-open');
    await renderHistory();
  }

  function applyRecordToState(r, duplicate=false) {
    state=freshState(); state.editingId=duplicate?null:r.id; state.itemName=duplicate?`${r.itemName}（複製）`:r.itemName; state.count=r.count; state.useColor=r.useColor; state.mode=r.mode||'normal'; state.palette=r.palette||10; state.characters=[...r.characters,...Array(20).fill('')].slice(0,20); state.colors=[...r.colors,...Array(20).fill('#000')].slice(0,20); state.layout=r.layout||'line'; state.selectedColor=state.colors[0]||'#000'; selectedSlot=0;
    showView('createView'); showStep(1);
  }

  async function toggleFavorite(){ if(!selectedHistoryId)return; const r=await storeGet(selectedHistoryId); r.favorite=!r.favorite; r.updatedAt=new Date().toISOString(); await storePut(r); await selectHistory(r.id); }
  async function deleteSelected(){ if(!selectedHistoryId)return; showDialog('削除確認','この保存データを削除しますか？\nこの操作は元に戻せません。',[{label:'キャンセル'},{label:'削除',action:async()=>{await storeDelete(selectedHistoryId);selectedHistoryId=null;$('historyDetail').textContent='左の保存データを選択してください。';$('historyDetail').classList.add('empty-detail');$('historyActions').classList.add('hidden');document.querySelector('.history-layout').classList.remove('detail-open');await renderHistory();}}]); }

  async function saveImageSelected(){ if(!selectedHistoryId)return; const r=await storeGet(selectedHistoryId); drawExport(r); const canvas=$('exportCanvas'); const link=document.createElement('a'); link.download=`Ryutai_${sanitizeFile(r.itemName)}_${Date.now()}.png`; link.href=canvas.toDataURL('image/png'); link.click(); }
  function drawExport(r){
    const c=$('exportCanvas'),ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='96px RyutaiWeb, sans-serif'; const p=getPositions(r.count,r.layout);
    for(let i=0;i<r.count;i++){ const x=p[i].x/100*c.width,y=p[i].y/100*c.height; ctx.save();ctx.translate(x,y); if(r.layout!=='line')ctx.rotate(p[i].r*Math.PI/180); ctx.fillStyle=r.useColor?r.colors[i]:'#000';ctx.fillText(r.characters[i]||'',0,0);ctx.restore(); }
  }

  function layoutLabel(v){return v==='right'?'右回り':v==='left'?'左回り':'直線';}
  function formatDate(d, multiline=false){ const p=n=>String(n).padStart(2,'0'); const s=`${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; return multiline?s:s; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function sanitizeFile(s){return String(s||'work').replace(/[\\/:*?"<>|]/g,'_').slice(0,40);}

  function bind() {
    $('startCreate').addEventListener('click',startNew);
    $('openHistory').addEventListener('click',openHistoryView);
    $('itemName').addEventListener('input',e=>{state.itemName=e.target.value;updateNameStrips();});
    qa('[data-next]').forEach(b=>b.addEventListener('click',()=>goNextFromStep(Number(b.closest('.step-page').dataset.step))));
    qa('[data-prev]').forEach(b=>b.addEventListener('click',()=>goPrevFromStep(Number(b.closest('.step-page').dataset.step))));
    $('exitCreate1').addEventListener('click',()=>showDialog('終了確認','龍体文字作成を終了しますか？\n未保存の内容は破棄されます。',[{label:'キャンセル'},{label:'終了',action:()=>showView('homeView')} ]));
    const wizardHome=$('wizardHomeButton'); if(wizardHome) wizardHome.addEventListener('click',()=>showDialog('終了確認','龍体文字作成を終了しますか？\n未保存の内容は破棄されます。',[{label:'キャンセル'},{label:'終了',action:()=>showView('homeView')} ]));
    qa('.show-full-name').forEach(b=>b.addEventListener('click',()=>showDialog('項目名',nameText(),[{label:'閉じる'}])));
    $('colorToggle').addEventListener('click',()=>{state.useColor=!state.useColor; singleAwaitingColor=false; renderAll();});
    $('countUp').addEventListener('click',()=>{state.count=Math.min(20,state.count+1);renderAll();});
    $('countDown').addEventListener('click',()=>{state.count=Math.max(0,state.count-1);renderAll();});
    qa('input[name="mode"]').forEach(r=>r.addEventListener('change',()=>{state.mode=r.value; renderAll();}));
    $('modeHelp').addEventListener('click',()=>showDialog('作成モード','通常：指定した文字数分の龍体文字を先に選び、その後に各文字の色を決めます。\n1文字：1文字目を選ぶ → 1文字目の色を決める → 2文字目を選ぶ…の順で、指定文字数まで繰り返します。\nカラーOFFの場合は、どちらのモードでも色選択STEPをスキップします。',[{label:'閉じる'}]));
    $('resonanceButton').addEventListener('click',()=>showDialog('共鳴練習','この試作品では共鳴練習機能は説明表示のみです。',[{label:'閉じる'}]));
    $('openPicker1').addEventListener('click',()=>openPicker(Math.min(selectedSlot,9)));
    $('openPicker2').addEventListener('click',()=>openPicker(Math.max(10,selectedSlot)));
    $('closePicker').addEventListener('click',()=>$('pickerDialog').close());
    $('clearSlots1').addEventListener('click',()=>{for(let i=0;i<10;i++)state.characters[i]='';renderAll();});
    $('clearSlots2').addEventListener('click',()=>{for(let i=10;i<20;i++)state.characters[i]='';renderAll();});
    $('toggleAlias1').addEventListener('click',()=>showDialog('仮名表示','試作品では選択ダイアログ内に仮名を直接表示しています。',[{label:'閉じる'}]));
    $('toggleAlias2').addEventListener('click',()=>showDialog('仮名表示','試作品では選択ダイアログ内に仮名を直接表示しています。',[{label:'閉じる'}]));
    qa('.palette-choice').forEach(b=>b.addEventListener('click',()=>{state.palette=Number(b.dataset.palette); const avail=COLOR_DATA.slice(0,state.palette).map(x=>x[1].toLowerCase()); if(!avail.includes(state.selectedColor.toLowerCase()))state.selectedColor='#000000';renderAll();}));
    qa('.shape-button').forEach(b=>b.addEventListener('click',()=>{state.layout=b.dataset.layout;renderAll();}));
    $('previewButton').addEventListener('click',()=>{renderPreview();$('previewDialog').showModal();});
    $('closePreview').addEventListener('click',()=>$('previewDialog').close());
    $('finishButton').addEventListener('click',()=>showDialog('保存確認','この内容で完成し、履歴へ保存しますか？',[{label:'戻る'},{label:'保存',action:finishWork}]));
    $('historyMenuButton').addEventListener('click',()=>{document.querySelector('.history-layout').classList.remove('detail-open');showView('homeView');});
    const historyBackList=$('historyBackList'); if(historyBackList) historyBackList.addEventListener('click',()=>document.querySelector('.history-layout').classList.remove('detail-open'));
    $('showAllHistory').addEventListener('click',async()=>{favoritesOnly=false;$('showAllHistory').classList.add('active');$('showFavoritesHistory').classList.remove('active');await renderHistory();});
    $('showFavoritesHistory').addEventListener('click',async()=>{favoritesOnly=true;$('showFavoritesHistory').classList.add('active');$('showAllHistory').classList.remove('active');await renderHistory();});
    $('favoriteHistory').addEventListener('click',toggleFavorite);
    $('editHistory').addEventListener('click',async()=>{const r=await storeGet(selectedHistoryId);applyRecordToState(r,false);});
    $('duplicateHistory').addEventListener('click',async()=>{const r=await storeGet(selectedHistoryId);applyRecordToState(r,true);});
    $('saveImageHistory').addEventListener('click',saveImageSelected);
    $('deleteHistory').addEventListener('click',deleteSelected);
  }

  async function init(){ buildKanaGrid(); bind(); try{await initDb();}catch(e){console.error(e);showDialog('保存機能について','この開き方ではブラウザのローカル保存が利用できない可能性があります。GitHub PagesまたはLive Server経由で開くと安定します。',[{label:'閉じる'}]);} renderAll(); }
  init();
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}
