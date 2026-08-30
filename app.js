(() => {
  'use strict';

  // V3.14: Windowsで個別保存・ZIP保存が反応しない問題を修正。File System Access APIを優先利用。
  // 左から「あ」側 → 「わ」側の順に並べ、わ列では「を」を「る」の右隣、
  // 「ん」を「ろ」の右隣に配置する。
  const GOJUON_COLUMNS = [
    { chars:['あ','い','う','え','お'] },
    { chars:['か','き','く','け','こ'] },
    { chars:['さ','し','す','せ','そ'] },
    { chars:['た','ち','つ','て','と'] },
    { chars:['な','に','ぬ','ね','の'] },
    { chars:['は','ひ','ふ','へ','ほ'] },
    { chars:['ま','み','む','め','も'] },
    { chars:['や','','ゆ','','よ'] },
    { chars:['ら','り','る','れ','ろ'] },
    { chars:['わ','','を','','ん'] }
  ];
  const GOJUON_ROWS = 5;
  const COLOR_DATA = [
    ['黒色','#000000'],['水色','#00d7df'],['黄緑色','#9acd32'],['緑色','#00ee00'],['黄色','#ffe600'],['だいだい色','#ffa000'],['ピンク色','#efb0bf'],['赤色','#ff1010'],['紫色','#ef00e8'],['青色','#1111ee'],
    ['茶色','#8b5a3c'],['薄だいだい色','#ffd4ae'],['山吹色','#ffbf00'],['黄土色','#bd9e4c'],['深緑色','#006633'],['群青色','#003171'],['すみれ色','#8c66b3'],['赤紫色','#993366'],['朱色','#e24200'],['こげ茶色','#4d331a'],['ねずみ色','#808080'],['白色','#ffffff'],['銀色','#c0c0c0'],['金色','#d9a621']
  ];

  const RESONANCE_DATA = {
    1: { name: '免疫機能', code: 'B222' },
    2: { name: '子宮', code: 'D449' },
    3: { name: '男性生殖器', code: 'D995' }
  };

  const freshState = () => ({
    editingId: null,
    itemName: '',
    count: 0,
    useColor: true,
    mode: 'normal',
    palette: 10,
    selectedColor: '#ffffff',
    characters: Array(20).fill(''),
    colors: Array(20).fill('#ffffff'),
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
  let pickerHighlightRow = null;
  let pickerHighlightColumn = null;
  let pendingPickerKana = null;

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
    ['toggleAlias1','toggleAlias2'].forEach(id => {
      const button = $(id);
      if (button) button.textContent = state.alias ? '仮名表示をOFF' : '仮名表示';
    });
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
      const char = state.characters[i] || '';
      if (state.alias && char) {
        const alias = document.createElement('span');
        alias.className = 'slot-kana-alias';
        alias.textContent = char;
        b.appendChild(alias);
      }
      const t = document.createElement('span');
      t.className = 'slot-ryutai-glyph';
      t.textContent = char;
      // STEP 3/4では選択済み文字を常に白で表示し、背景とのコントラストを確保する。
      t.style.color = '#fff';
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
        b.style.color = state.colors[i] || '#ffffff';
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
    const currentHex = state.colors[selectedSlot] || '#ffffff';
    const found = COLOR_DATA.find(x => x[1].toLowerCase() === currentHex.toLowerCase());
    $('selectedColorLabel').textContent = `${selectedSlot+1}文字目：${found ? found[0] : currentHex}`;
  }

  function renderFinalCharacters() {
    const wrap = $('finalCharacters'); wrap.innerHTML='';
    for (let i=0; i<state.count; i++) {
      const s=document.createElement('span'); s.textContent=state.characters[i] || '□'; s.style.color=state.useColor ? (state.colors[i] || '#ffffff') : '#ffffff'; wrap.appendChild(s);
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
    pickerHighlightRow = null;
    pickerHighlightColumn = null;
    // すでにこの枠に文字が入っている場合は候補として表示する。
    pendingPickerKana = state.characters[selectedSlot] || null;
    updatePickerHighlights();
    updatePickerCandidate();
    $('pickerDialog').showModal();
  }

  function buildKanaGrid() {
    const grid = $('kanaGrid');
    grid.innerHTML = '';

    // 左端には各横一列をハイライトする操作ボタンを置く。
    for (let rowIndex = 0; rowIndex < GOJUON_ROWS; rowIndex++) {
      grid.appendChild(createHighlightButton('row', rowIndex));

      GOJUON_COLUMNS.forEach((column, columnIndex) => {
        const kana = column.chars[rowIndex];
        if (!kana) {
          const empty = document.createElement('div');
          empty.className = 'gojuon-empty';
          empty.dataset.row = String(rowIndex);
          empty.dataset.column = String(columnIndex);
          grid.appendChild(empty);
          return;
        }
        grid.appendChild(createKanaButton(kana, rowIndex, columnIndex));
      });
    }

    // 最下部には各縦一列をハイライトする操作ボタンを置く。
    const corner = document.createElement('div');
    corner.className = 'gojuon-control-corner';
    grid.appendChild(corner);
    GOJUON_COLUMNS.forEach((_, columnIndex) => {
      grid.appendChild(createHighlightButton('column', columnIndex));
    });

    updatePickerHighlights();
  }

  function createKanaButton(kana, rowIndex, columnIndex) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gojuon-kana-button';
    b.setAttribute('aria-label', '龍体文字を選択');
    if (rowIndex !== null) b.dataset.row = String(rowIndex);
    if (columnIndex !== null) b.dataset.column = String(columnIndex);

    const glyph = document.createElement('span');
    glyph.className = 'picker-ryutai-glyph';
    glyph.textContent = kana;

    b.append(glyph);
    b.dataset.kana = kana;
    b.addEventListener('click', () => {
      // 文字表上では即決定せず、候補を1文字だけ選択状態にする。
      pendingPickerKana = kana;
      updatePickerCandidate();
    });
    return b;
  }

  function createHighlightButton(axis, index) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `table-highlight-control ${axis}-highlight-control`;
    b.dataset.axis = axis;
    b.dataset.index = String(index);
    b.setAttribute('aria-label', axis === 'row' ? '横一列をハイライト' : '縦一列をハイライト');
    b.innerHTML = '<span aria-hidden="true"></span>';

    // 1回押すと選択状態を保持し、同じボタンをもう1回押すと解除する。
    b.addEventListener('click', () => {
      if (axis === 'row') pickerHighlightRow = pickerHighlightRow === index ? null : index;
      else pickerHighlightColumn = pickerHighlightColumn === index ? null : index;
      updatePickerHighlights();
    });
    return b;
  }

  function updatePickerHighlights() {
    qa('#kanaGrid [data-row][data-column]').forEach(cell => {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      cell.classList.toggle('row-highlighted', pickerHighlightRow === row);
      cell.classList.toggle('column-highlighted', pickerHighlightColumn === column);
      cell.classList.toggle('cross-highlighted', pickerHighlightRow === row && pickerHighlightColumn === column);
    });

    qa('#kanaGrid .table-highlight-control').forEach(control => {
      const index = Number(control.dataset.index);
      const active = control.dataset.axis === 'row'
        ? pickerHighlightRow === index
        : pickerHighlightColumn === index;
      control.classList.toggle('active', active);
      control.setAttribute('aria-pressed', String(active));
    });
  }


  function updatePickerCandidate() {
    qa('#kanaGrid .gojuon-kana-button').forEach(button => {
      const selected = button.dataset.kana === pendingPickerKana;
      button.classList.toggle('candidate-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    const confirm = $('confirmPicker');
    if (confirm) {
      confirm.disabled = !pendingPickerKana;
      confirm.setAttribute('aria-disabled', String(!pendingPickerKana));
    }
  }

  function confirmPickerSelection() {
    if (!pendingPickerKana) return;
    const kana = pendingPickerKana;
    pendingPickerKana = null;
    chooseKana(kana);
  }

  function chooseKana(kana) {
    if (selectedSlot >= state.count) return;

    const chosenSlot = selectedSlot;
    state.characters[chosenSlot] = kana;

    if (state.mode === 'single') {
      if (state.useColor) {
        selectedSlot = chosenSlot;
        singleAwaitingColor = true;
        $('pickerDialog').close();
        showStep(6);
        return;
      }

      if (chosenSlot >= state.count - 1) {
        $('pickerDialog').close();
        showStep(7);
      } else {
        selectedSlot = chosenSlot + 1;
        pendingPickerKana = state.characters[selectedSlot] || null;
        renderAll();
        $('pickerTitle').textContent = `${selectedSlot+1}文字目を選択`;
        updatePickerCandidate();
      }
      return;
    }

    // 通常モードでは、決定した1文字だけを現在の枠へ反映して文字表を閉じる。
    // 次の枠は作成画面側で選んでから、再び「文字を選択」を押す。
    renderAll();
    $('pickerDialog').close();
  }

  function toggleKanaAlias() {
    if (state.alias) {
      state.alias = false;
      renderAll();
      return;
    }

    showDialog(
      '仮名表示について',
      '仮名表示を有効にすると、各龍体文字の上に対応するひらがなを表示します。\n\nひらがなを同時に見ることで、その文字の印象に引っ張られ、龍体文字から自由にイメージしにくくなる可能性があります。それでも仮名を表示しますか？',
      [
        {label:'キャンセル'},
        {label:'表示する', action:()=>{ state.alias = true; renderAll(); }}
      ]
    );
  }

  function openResonanceScreen() {
    $('resonanceName').textContent = '';
    $('resonanceCode').textContent = '';
    qa('.resonance-choice').forEach(button => {
      button.classList.remove('selected');
      button.setAttribute('aria-pressed', 'false');
    });
    showView('resonanceView');
    window.scrollTo({top:0, behavior:'auto'});
  }

  function selectResonance(number) {
    const data = RESONANCE_DATA[number];
    if (!data) return;
    $('resonanceName').textContent = data.name;
    $('resonanceCode').textContent = data.code;
    qa('.resonance-choice').forEach(button => {
      const selected = Number(button.dataset.resonance) === number;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function getPositions(count, layout) {
    const n = Math.max(0, Number(count) || 0);
    const positions = [];
    if (!n) return positions;

    if (layout === 'line') {
      // 10文字までは1段、11〜20文字は2段に分ける。
      const firstCount = Math.min(n, 10);
      const secondCount = Math.max(0, n - 10);
      const pushLine = (amount, startIndex, y) => {
        if (!amount) return;
        const left = amount === 1 ? 50 : 12;
        const right = amount === 1 ? 50 : 88;
        for (let i = 0; i < amount; i++) {
          const t = amount === 1 ? 0.5 : i / (amount - 1);
          positions[startIndex + i] = { x: left + (right - left) * t, y, r: 0 };
        }
      };
      pushLine(firstCount, 0, secondCount ? 40 : 50);
      pushLine(secondCount, 10, 60);
      return positions;
    }

    // 右回り / 左回りは、同じ弧を左右反転させて配置する。
    const direction = layout === 'left' ? -1 : 1;
    const startDeg = -125;
    const endDeg = 125;
    const cx = 50;
    const cy = 51;
    const radiusX = n <= 10 ? 34 : 39;
    const radiusY = n <= 10 ? 34 : 39;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const deg = startDeg + (endDeg - startDeg) * t;
      const rad = deg * Math.PI / 180;
      const x = cx + direction * radiusX * Math.cos(rad);
      const y = cy + radiusY * Math.sin(rad);
      // 文字が弧に沿う程度の回転。左右回りで向きを反転する。
      const r = direction * (deg + 90);
      positions.push({ x, y, r });
    }
    return positions;
  }

  function renderPreview() {
    const wrap=$('previewCanvas'); wrap.innerHTML='';
    const p=getPositions(state.count,state.layout);
    for(let i=0;i<state.count;i++) {
      if(!state.characters[i]) continue;
      const s=document.createElement('span'); s.className='preview-char'; s.textContent=state.characters[i];
      s.style.left=`${p[i].x}%`; s.style.top=`${p[i].y}%`; s.style.color=state.useColor ? (state.colors[i] || '#ffffff') : '#ffffff';
      if(state.layout!=='line') s.style.transform=`translate(-50%,-50%) rotate(${p[i].r}deg)`;
      wrap.appendChild(s);
    }
  }

  function recordFromState(existing) {
    const now=new Date().toISOString();
    return {
      id: existing?.id || state.editingId || ((window.crypto && typeof window.crypto.randomUUID === 'function') ? window.crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`),
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
  function requireDb() {
    if (!db) throw new Error('ローカル保存データベースを利用できません。');
    return db;
  }
  function storePut(record){ return new Promise((res,rej)=>{ try { const d=requireDb(); const tx=d.transaction('works','readwrite'); const req=tx.objectStore('works').put(record); req.onerror=()=>rej(req.error || new Error('保存要求に失敗しました。')); tx.oncomplete=()=>res(record); tx.onerror=()=>rej(tx.error || new Error('保存処理に失敗しました。')); tx.onabort=()=>rej(tx.error || new Error('保存処理が中断されました。')); } catch(e) { rej(e); } }); }
  function storeDelete(id){ return new Promise((res,rej)=>{ try { const d=requireDb(); const tx=d.transaction('works','readwrite'); tx.objectStore('works').delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); } catch(e) { rej(e); } }); }
  function storeAll(){ return new Promise((res,rej)=>{ try { const d=requireDb(); const tx=d.transaction('works','readonly'); const r=tx.objectStore('works').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); } catch(e) { rej(e); } }); }
  function storeGet(id){ return new Promise((res,rej)=>{ try { const d=requireDb(); const tx=d.transaction('works','readonly'); const r=tx.objectStore('works').get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); } catch(e) { rej(e); } }); }

  async function finishWork() {
    const finishButton = $('finishButton');
    if (finishButton) { finishButton.disabled = true; finishButton.textContent = '保存中…'; }
    try {
      if (!db) await initDb();
      const existing=state.editingId ? await storeGet(state.editingId) : null;
      const rec=recordFromState(existing);
      await storePut(rec);
      state.editingId=rec.id;
      selectedHistoryId=rec.id;
      showDialog('保存完了','履歴へ保存しました。画像・CSV・Wordは保存データ画面から任意のタイミングで保存できます。',[{label:'履歴を見る',action:openHistoryView},{label:'メニューへ',action:()=>showView('homeView')}]);
    } catch (e) {
      console.error('履歴保存に失敗しました。', e);
      showDialog('保存できませんでした',`端末内への保存に失敗しました。\n\n${e && e.message ? e.message : 'ブラウザの保存領域を確認してください。'}\n\nページを再読み込みしても改善しない場合は、Safari/Chromeのプライベートブラウズを解除し、通常タブでお試しください。`,[{label:'閉じる'}]);
    } finally {
      if (finishButton) { finishButton.disabled = false; finishButton.textContent = '保存'; }
    }
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
  function renderHistoryShapePreview(record) {
    const wrap = $('historyShapePreview');
    if (!wrap || !record) return;
    wrap.innerHTML = '';
    const count = Math.min(Number(record.count) || 0, Array.isArray(record.characters) ? record.characters.length : 0);
    const positions = getPositions(count, record.layout || 'line');
    for (let i = 0; i < count; i++) {
      const ch = record.characters[i];
      const pos = positions[i];
      if (!ch || !pos) continue;
      const glyph = document.createElement('span');
      glyph.className = 'history-preview-char';
      glyph.textContent = ch;
      glyph.style.left = `${pos.x}%`;
      glyph.style.top = `${pos.y}%`;
      glyph.style.color = normalizeHex(record.useColor ? (record.colors?.[i] || '#ffffff') : '#ffffff');
      const rotation = record.layout === 'line' ? 0 : (pos.r || 0);
      glyph.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
      wrap.appendChild(glyph);
    }
  }

  async function selectHistory(id) {
    selectedHistoryId=id; const r=await storeGet(id); if(!r)return;
    $('historyDetail').classList.remove('empty-detail');
    const charRows = r.characters.map((c,i) => {
      const hex = normalizeHex(r.useColor ? r.colors[i] : '#ffffff');
      return `<tr><td>${i+1}</td><td class="history-glyph" style="color:${hex}">${escapeHtml(c)}</td><td>${escapeHtml(c)}</td><td><code>${hex}</code></td></tr>`;
    }).join('');
    $('historyDetail').innerHTML=`
      <div class="detail-summary"><div>日付：<br>${formatDate(new Date(r.updatedAt),true)}</div><div>項目名：<br>${escapeHtml(r.itemName)}</div></div>
      <div>龍体文字：</div>
      <div class="detail-ryutai">${r.characters.map((c,i)=>`<span style="color:${normalizeHex(r.useColor?r.colors[i]:'#ffffff')}">${escapeHtml(c)}</span>`).join('')}</div>
      <div>形状：${layoutLabel(r.layout)}</div>
      <section class="detail-preview-section">
        <h3>保存した龍体文字のプレビュー</h3>
        <div id="historyShapePreview" class="history-shape-preview" aria-label="保存した龍体文字の形状プレビュー"></div>
      </section>
      <div class="detail-data-title">文字・HEXコード</div>
      <div class="detail-table-wrap"><table class="detail-data-table"><thead><tr><th>No.</th><th>龍体文字</th><th>対応するひらがな</th><th>HEX</th></tr></thead><tbody>${charRows}</tbody></table></div>`;
    renderHistoryShapePreview(r);
    $('historyActions').classList.remove('hidden');
    $('favoriteHistory').textContent=r.favorite?'★ お気に入り解除':'☆ お気に入り';
    document.querySelector('.history-layout').classList.add('detail-open');
    await renderHistory();
  }

  function applyRecordToState(r, duplicate=false) {
    state=freshState(); state.editingId=duplicate?null:r.id; state.itemName=duplicate?`${r.itemName}（複製）`:r.itemName; state.count=r.count; state.useColor=r.useColor; state.mode=r.mode||'normal'; state.palette=r.palette||10; state.characters=[...r.characters,...Array(20).fill('')].slice(0,20); state.colors=[...r.colors,...Array(20).fill('#ffffff')].slice(0,20); state.layout=r.layout||'line'; state.selectedColor=state.colors[0]||'#ffffff'; selectedSlot=0;
    showView('createView'); showStep(1);
  }

  async function toggleFavorite(){ if(!selectedHistoryId)return; const r=await storeGet(selectedHistoryId); r.favorite=!r.favorite; r.updatedAt=new Date().toISOString(); await storePut(r); await selectHistory(r.id); }
  async function deleteSelected(){ if(!selectedHistoryId)return; showDialog('削除確認','この保存データを削除しますか？\nこの操作は元に戻せません。',[{label:'キャンセル'},{label:'削除',action:async()=>{await storeDelete(selectedHistoryId);selectedHistoryId=null;$('historyDetail').textContent='左の保存データを選択してください。';$('historyDetail').classList.add('empty-detail');$('historyActions').classList.add('hidden');document.querySelector('.history-layout').classList.remove('detail-open');await renderHistory();}}]); }

  async function ensureRyutaiFontReady() {
    if (!document.fonts) return;
    try {
      await document.fonts.load('96px RyutaiWeb', 'あいうえお');
      await document.fonts.ready;
    } catch (e) {
      console.warn('龍体文字フォントの読み込み確認に失敗しました。', e);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1500);
  }

  function canvasToBlob(canvas, type='image/png', quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画像データを作成できませんでした。')), type, quality);
        return;
      }
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const [meta, data] = dataUrl.split(',');
        const mime = (meta.match(/data:([^;]+)/)||[])[1] || type;
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        resolve(new Blob([bytes], {type:mime}));
      } catch (e) { reject(e); }
    });
  }

  async function buildImageFile(r) {
    await ensureRyutaiFontReady();
    drawExport(r);
    const blob = await canvasToBlob($('exportCanvas'), 'image/png');
    return new File([blob], `Ryutai_${sanitizeFile(r.itemName)}_${Date.now()}.png`, {type:'image/png'});
  }

  function buildCsvFile(r) {
    const chars = r.characters.map(csvCell).join(',');
    const hexes = r.characters.map((_,i) => csvCell(normalizeHex(r.useColor ? r.colors[i] : '#ffffff'))).join(',');
    const csv = '\ufeff' + chars + '\r\n' + hexes + '\r\n';
    return new File([csv], `Ryutai_${sanitizeFile(r.itemName)}_${Date.now()}.csv`, {type:'text/csv;charset=utf-8'});
  }

  function buildWordFile(r) {
    const runs = r.characters.map((c,i) => {
      const color = normalizeHex(r.useColor ? r.colors[i] : '#ffffff');
      return `<span style="font-family:'pkryutaib3','RyutaiWeb';font-size:54pt;color:${color};margin-right:6pt;">${escapeHtml(c)}</span>`;
    }).join('');
    const rows = r.characters.map((c,i) => `<tr><td>${i+1}</td><td>${escapeHtml(c)}</td><td>${normalizeHex(r.useColor ? r.colors[i] : '#ffffff')}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(r.itemName)}</title><style>body{font-family:'Yu Gothic','Meiryo',sans-serif;color:#111}.ryutai-box{background:#777;padding:28pt;border-radius:10pt;margin:18pt 0;line-height:1.8}table{border-collapse:collapse;margin-top:18pt}th,td{border:1px solid #999;padding:6pt 10pt;text-align:center}h1{font-size:20pt}</style></head><body><h1>${escapeHtml(r.itemName)}</h1><p>形状：${layoutLabel(r.layout)}</p><div class="ryutai-box">${runs}</div><table><thead><tr><th>No.</th><th>対応するひらがな</th><th>HEX</th></tr></thead><tbody>${rows}</tbody></table><p style="font-size:9pt;color:#666">※龍体文字を同じ字形で表示・編集するには、Wordを開く端末に「pkryutaib3」フォントをインストールしてください。</p></body></html>`;
    return new File(['\ufeff', html], `Ryutai_${sanitizeFile(r.itemName)}_${Date.now()}.doc`, {type:'application/msword;charset=utf-8'});
  }


  function getSelectedShareTypes() {
    return {
      image: $('shareImageChoice').checked,
      csv: $('shareCsvChoice').checked,
      word: $('shareWordChoice').checked
    };
  }

  async function buildSelectedShareFiles() {
    if (!selectedHistoryId) throw new Error('保存データが選択されていません。');
    const types = getSelectedShareTypes();
    if (!types.image && !types.csv && !types.word) throw new Error('共有するデータを1つ以上選択してください。');
    const r = await storeGet(selectedHistoryId);
    const files = [];
    if (types.image) files.push(await buildImageFile(r));
    if (types.csv) files.push(buildCsvFile(r));
    if (types.word) files.push(buildWordFile(r));
    return {r, files};
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const dosDate = (((year - 1980) & 127) << 9) | ((month & 15) << 5) | (day & 31);
    return {time, date: dosDate};
  }

  function writeU16(arr, value) { arr.push(value & 255, (value >>> 8) & 255); }
  function writeU32(arr, value) { arr.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }

  async function buildZipBlob(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = new Uint8Array(await file.arrayBuffer());
      const crc = crc32(data);
      const dt = zipDosDateTime(new Date());
      const local = [];
      writeU32(local, 0x04034b50); writeU16(local, 20); writeU16(local, 0x0800); writeU16(local, 0);
      writeU16(local, dt.time); writeU16(local, dt.date); writeU32(local, crc); writeU32(local, data.length); writeU32(local, data.length);
      writeU16(local, nameBytes.length); writeU16(local, 0);
      const localHeader = new Uint8Array([...local, ...nameBytes]);
      localParts.push(localHeader, data);

      const cen = [];
      writeU32(cen, 0x02014b50); writeU16(cen, 20); writeU16(cen, 20); writeU16(cen, 0x0800); writeU16(cen, 0);
      writeU16(cen, dt.time); writeU16(cen, dt.date); writeU32(cen, crc); writeU32(cen, data.length); writeU32(cen, data.length);
      writeU16(cen, nameBytes.length); writeU16(cen, 0); writeU16(cen, 0); writeU16(cen, 0); writeU16(cen, 0); writeU32(cen, 0); writeU32(cen, offset);
      central.push(new Uint8Array([...cen, ...nameBytes]));
      offset += localHeader.length + data.length;
    }
    const centralSize = central.reduce((n, p) => n + p.length, 0);
    const end = [];
    writeU32(end, 0x06054b50); writeU16(end, 0); writeU16(end, 0); writeU16(end, files.length); writeU16(end, files.length);
    writeU32(end, centralSize); writeU32(end, offset); writeU16(end, 0);
    return new Blob([...localParts, ...central, new Uint8Array(end)], {type:'application/zip'});
  }

  async function writeFileToHandle(handle, blob) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async function saveSelectedShareFiles() {
    const button = $('saveShareFiles');
    button.disabled = true;
    $('shareStatus').textContent = '保存先を選択してください…';
    try {
      // Windows の Chrome / Edge では、最初にフォルダーを選択してもらう方式が最も安定します。
      // ファイル生成より先に picker を開くことで、ユーザー操作の権限が失われるのを防ぎます。
      let directoryHandle = null;
      if ('showDirectoryPicker' in window) {
        try {
          directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch (e) {
          if (e && e.name === 'AbortError') {
            $('shareStatus').textContent = '保存をキャンセルしました。';
            return;
          }
          throw e;
        }
      }

      $('shareStatus').textContent = 'ファイルを準備しています…';
      const {files} = await buildSelectedShareFiles();

      if (directoryHandle) {
        for (const file of files) {
          const handle = await directoryHandle.getFileHandle(file.name, { create: true });
          await writeFileToHandle(handle, file);
        }
        $('shareStatus').textContent = `${files.length}個のファイルを選択したフォルダーへ保存しました。`;
      } else {
        // Safari / Firefox など File System Access API 非対応ブラウザ向け。
        // 複数ダウンロードをブラウザが制限する場合があるため、少し間隔を空けます。
        for (let i = 0; i < files.length; i++) {
          downloadBlob(files[i], files[i].name);
          if (i < files.length - 1) await new Promise(resolve => setTimeout(resolve, 350));
        }
        $('shareStatus').textContent = `${files.length}個のファイルのダウンロードを開始しました。ブラウザから複数ダウンロードの許可を求められた場合は許可してください。`;
      }
    } catch (e) {
      console.error(e);
      $('shareStatus').textContent = `個別保存に失敗しました：${e.message || e.name || '不明なエラー'}`;
    } finally {
      button.disabled = false;
    }
  }

  async function saveSelectedShareZip() {
    const button = $('saveShareZip');
    button.disabled = true;
    $('shareStatus').textContent = '保存先を選択してください…';
    try {
      if (!selectedHistoryId) throw new Error('保存データが選択されていません。');
      const selectedRecord = await storeGet(selectedHistoryId);
      if (!selectedRecord) throw new Error('保存データを読み込めませんでした。');
      const zipName = `Ryutai_${sanitizeFile(selectedRecord.itemName)}_${Date.now()}.zip`;

      // ZIP は Save As ダイアログを最初に開く。生成処理の await 後に開くと、
      // Windows ブラウザでユーザー操作と認識されず無反応になる場合があるため。
      let fileHandle = null;
      if ('showSaveFilePicker' in window) {
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: zipName,
            types: [{
              description: 'ZIP archive',
              accept: { 'application/zip': ['.zip'] }
            }]
          });
        } catch (e) {
          if (e && e.name === 'AbortError') {
            $('shareStatus').textContent = '保存をキャンセルしました。';
            return;
          }
          throw e;
        }
      }

      $('shareStatus').textContent = 'ZIPファイルを作成しています…';
      const {files} = await buildSelectedShareFiles();
      const blob = await buildZipBlob(files);

      if (fileHandle) {
        await writeFileToHandle(fileHandle, blob);
        $('shareStatus').textContent = '選択したデータをZIPファイルとして保存しました。';
      } else {
        downloadBlob(blob, zipName);
        $('shareStatus').textContent = 'ZIPファイルのダウンロードを開始しました。';
      }
    } catch (e) {
      console.error(e);
      $('shareStatus').textContent = `ZIP保存に失敗しました：${e.message || e.name || '不明なエラー'}`;
    } finally {
      button.disabled = false;
    }
  }

  async function openShareDialog() {
    if (!selectedHistoryId) return;
    $('shareStatus').textContent = '';
    $('shareImageChoice').checked = true;
    $('shareCsvChoice').checked = false;
    $('shareWordChoice').checked = false;
    $('shareDialog').showModal();
  }

  async function executeShareSelected() {
    if (!selectedHistoryId) return;
    const button = $('executeShare');
    const oldLabel = button.textContent;
    button.disabled = true;
    button.textContent = '準備中…';
    $('shareStatus').textContent = '';
    try {
      const {r, files} = await buildSelectedShareFiles();
      if (!navigator.share) {
        $('shareStatus').textContent = 'このブラウザでは端末の共有機能を利用できません。「個別保存」または「ZIP保存」を使用してください。';
        return;
      }
      if (navigator.canShare && !navigator.canShare({files})) {
        $('shareStatus').textContent = 'このブラウザでは選択したファイルを共有画面へ渡せません。「個別保存」または「ZIP保存」を使用してください。';
        return;
      }
      await navigator.share({title:`龍体文字：${r.itemName}`, text:`「${r.itemName}」の龍体文字データです。`, files});
      $('shareDialog').close();
    } catch (e) {
      if (e && e.name === 'AbortError') $('shareStatus').textContent = '共有をキャンセルしました。';
      else { console.error(e); $('shareStatus').textContent = e.message || '端末の共有機能を利用できませんでした。「個別保存」または「ZIP保存」をお試しください。'; }
    } finally { button.disabled = false; button.textContent = oldLabel; }
  }

  async function saveImageSelected(){
    if(!selectedHistoryId)return;
    try {
      const r=await storeGet(selectedHistoryId);
      const file=await buildImageFile(r);
      downloadBlob(file, file.name);
    } catch(e) {
      console.error(e);
      showDialog('画像保存','画像データを作成できませんでした。',[{label:'閉じる'}]);
    }
  }

  function drawExport(r){
    const c=$('exportCanvas'),ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    // 黒文字・白文字のどちらも判別しやすい中間グレー背景。
    ctx.fillStyle='#777777'; ctx.fillRect(0,0,c.width,c.height);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='96px RyutaiWeb, pkryutaib3, sans-serif';
    const p=getPositions(r.count,r.layout);
    for(let i=0;i<r.count;i++){
      if (!p[i]) continue;
      const x=p[i].x/100*c.width,y=p[i].y/100*c.height;
      ctx.save();ctx.translate(x,y);
      if(r.layout!=='line')ctx.rotate(p[i].r*Math.PI/180);
      ctx.fillStyle=normalizeHex(r.useColor?r.colors[i]:'#ffffff');
      ctx.fillText(r.characters[i]||'',0,0);ctx.restore();
    }
  }

  async function saveCsvSelected() {
    if (!selectedHistoryId) return;
    const r = await storeGet(selectedHistoryId);
    const file = buildCsvFile(r);
    downloadBlob(file, file.name);
  }

  async function saveWordSelected() {
    if (!selectedHistoryId) return;
    const r = await storeGet(selectedHistoryId);
    const file = buildWordFile(r);
    downloadBlob(file, file.name);
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g,'""')}"`;
  }

  function normalizeHex(value) {
    const v = String(value || '#ffffff').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + v.slice(1).split('').map(c=>c+c).join('')).toUpperCase();
    return '#FFFFFF';
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
    $('resonanceButton').addEventListener('click',()=>showDialog(
      '共鳴練習へ移動しますか？',
      '現在の作成内容はそのまま保持されます。共鳴練習の画面へ移動してもよいですか？',
      [
        {label:'キャンセル'},
        {label:'移動する', action:openResonanceScreen}
      ]
    ));
    qa('.resonance-choice').forEach(button => {
      button.addEventListener('click', () => selectResonance(Number(button.dataset.resonance)));
    });
    $('backFromResonance').addEventListener('click', () => {
      showView('createView');
      showStep(2);
    });
    $('openPicker1').addEventListener('click',()=>openPicker(Math.min(selectedSlot,9)));
    $('openPicker2').addEventListener('click',()=>openPicker(Math.max(10,selectedSlot)));
    $('closePicker').addEventListener('click',()=>{ pendingPickerKana = null; $('pickerDialog').close(); });
    $('confirmPicker').addEventListener('click',confirmPickerSelection);
    $('clearSlots1').addEventListener('click',()=>{for(let i=0;i<10;i++)state.characters[i]='';renderAll();});
    $('clearSlots2').addEventListener('click',()=>{for(let i=10;i<20;i++)state.characters[i]='';renderAll();});
    $('toggleAlias1').addEventListener('click',toggleKanaAlias);
    $('toggleAlias2').addEventListener('click',toggleKanaAlias);
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
    $('saveCsvHistory').addEventListener('click',saveCsvSelected);
    $('saveWordHistory').addEventListener('click',saveWordSelected);
    $('shareHistory').addEventListener('click',openShareDialog);
    $('closeShare').addEventListener('click',()=>$('shareDialog').close());
    $('executeShare').addEventListener('click',executeShareSelected);
    $('saveShareFiles').addEventListener('click',saveSelectedShareFiles);
    $('saveShareZip').addEventListener('click',saveSelectedShareZip);
    $('deleteHistory').addEventListener('click',deleteSelected);
  }

  async function init(){ buildKanaGrid(); bind(); try{await initDb();}catch(e){console.error(e);showDialog('保存機能について','この開き方ではブラウザのローカル保存が利用できない可能性があります。GitHub PagesまたはLive Server経由で開くと安定します。',[{label:'閉じる'}]);} renderAll(); }
  init();
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}
