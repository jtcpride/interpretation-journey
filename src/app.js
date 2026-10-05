(() => {
  'use strict';
  const story = globalThis.STORY, engine = globalThis.JourneyState;
  const AUTO = 'interpretation-journey:auto:v1', MANUAL = 'interpretation-journey:manual:v1';
  const main = document.querySelector('#main'), header = document.querySelector('#header');
  const dialog = document.querySelector('#dialog'), notice = document.querySelector('#notice');
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const paragraphs = lines => (Array.isArray(lines) ? lines : [lines || '']).map(line => `<p>${esc(line)}</p>`).join('');
  const reel = '<svg class="reel" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="none" stroke="currentColor"/><g fill="currentColor"><circle cx="18" cy="10" r="4"/><circle cx="11" cy="23" r="4"/><circle cx="25" cy="23" r="4"/></g></svg>';
  let storageOk = true, state = engine.createState(), hasSave = false, cover = true;
  let selectedEvidence = [], selectedHypothesis = '', puzzleFeedback = '', journalTab = 'documents';
  let toastTimer;

  function warn(message) { notice.textContent = message; notice.hidden = false; }
  function readSlot(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = engine.deserialize(raw, story);
      if (!parsed) warn('保存データを読み込めませんでした。「はじめから」で新しく遊べます。');
      return parsed;
    } catch { storageOk = false; warn('このブラウザでは保存が使えません。このタブを閉じると進行が失われます。'); return null; }
  }
  const restored = readSlot(AUTO);
  if (restored) { state = restored; hasSave = true; }
  function save(key = AUTO) {
    try { localStorage.setItem(key, engine.serialize(state)); storageOk = true; if (key === AUTO) hasSave = true; return true; }
    catch { storageOk = false; warn('保存できませんでした。このタブを開いたまま遊べますが、閉じると進行が失われます。'); return false; }
  }
  function toast(message) {
    const el = document.querySelector('#toast'); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function dispatch(action, focus = true) {
    const next = engine.transition(state, action, story);
    if (next === state) return false;
    state = next; save(); render();
    if (focus) { main.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
    return true;
  }
  function renderHeader() {
    header.innerHTML = `<button class="brand" data-action="cover" aria-label="解釈の旅路の表紙へ">${reel}<span>解釈の旅路</span></button><nav class="header-tools" aria-label="ゲームのメニュー"><button class="quiet" data-action="journal">手帖 <span class="small-count">${state.evidence.length}/${story.evidence.length}</span></button><button class="quiet" data-action="textsize" aria-label="文字サイズを切り替える" aria-pressed="${document.body.classList.contains('large-text')}">文字 大</button><button class="quiet" data-action="settings">保存・設定</button></nav>`;
  }
  function coverView() {
    return `<section class="cover"><div class="cover-copy"><p class="eyebrow">A SHORT STORY ABOUT WHAT REMAINS</p><h1>解釈の旅路</h1><p class="cover-subtitle">${esc(story.subtitle)}</p><p class="cover-description">あの夜、スクリーンは白くなった。<br>何度戻っても、最後の上映は変わらない。<br>変わるのは、その夜を見つめる私だった。</p><button class="primary" data-action="${hasSave?'resume':'start'}">${hasSave?'つづきから':'旅をはじめる'} <span aria-hidden="true">→</span></button><div class="cover-secondary"><span class="meta">短編ADV / ${esc(story.duration || '約20分')}</span>${hasSave?'<button class="link-button" data-action="new">はじめから</button>':'<button class="link-button" data-action="about">作品について</button>'}</div><p class="cover-notes">選ぶのは、行動ではなく心の声。<br>三度の読み返しと、ひとつの小さな謎。<br>自動保存 ／ 音声なし ／ 時間制限なし</p></div><div class="cover-art">${JourneyArt('entrance')}<div class="art-caption">灯標館 ── 最後の上映</div></div></section>`;
  }
  function proseView(eyebrow,title,body,button,action) {
    return `<section class="prose-page"><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><div class="prose-body">${paragraphs(body)}</div><button class="primary" data-action="${action}">${esc(button)} <span aria-hidden="true">→</span></button>${state.history.length?'<div><button class="link-button" data-action="back">← 前の場面へ戻る</button></div>':''}</section>`;
  }
  function sceneView() {
    const scene = story.scenes[state.scene], perspective = scene.perspectives[state.loop];
    const selected = engine.selectedChoice(state,story), loop = story.loops[state.loop];
    const previous = state.loop > 0 && state.choices[`${state.loop-1}:${state.scene}`];
    const previousChoice = previous && scene.perspectives[state.loop-1].choices.find(c=>c.id===previous);
    const timeline = story.scenes.map((s,i)=>`<div class="timeline-item ${i===state.scene?'current':i<state.scene?'past':''}" ${i===state.scene?'aria-current="step"':''}><span class="timeline-dot"></span><span>${esc(s.clock || s.time)}</span></div>`).join('');
    const documents = scene.evidenceIds.map(id=>documentButton(id)).join('');
    return `<div class="chapter-strip"><div class="chapter-heading"><p class="eyebrow">READING ${String(state.loop+1).padStart(2,'0')} / 03</p><h2>${esc(loop.name)}</h2></div><div class="loop-pips" aria-label="${state.loop+1}周目 / 全3周">${story.loops.map((_,i)=>`<span class="${i<=state.loop?'active':''}"></span>`).join('')}</div></div>
    <div class="game-grid"><aside class="scene-side" aria-label="情景と資料"><div class="scene-art">${JourneyArt(scene.art)}<span class="frame-corner">RECORD ${String(state.scene+1).padStart(2,'0')} / 06</span></div><div class="scene-caption"><span>${esc(scene.place)}</span><span>${esc(scene.time)}</span></div><div class="timeline" aria-label="訪問の時間軸">${timeline}</div><section class="documents"><h3 class="documents-title">この場面にある資料</h3>${documents}</section>${previousChoice?`<details class="previous-thought"><summary>前の周で、私はこう読んだ</summary><p>「${esc(previousChoice.label)}」</p>${paragraphs(previousChoice.text)}</details>`:''}</aside>
    <section class="reading" aria-labelledby="scene-heading"><div class="scene-title"><span class="scene-number">${String(state.scene+1).padStart(2,'0')}.</span><h3 id="scene-heading">${esc(scene.title)}</h3></div><div class="record"><div class="label">変わらない記録</div>${paragraphs(scene.fact)}</div><div class="inner"><div class="label">いまの私の声</div>${state.scene===0?paragraphs(loop.intro):''}${paragraphs(perspective.intro)}</div><p class="choice-prompt">${esc(perspective.prompt)}</p><div class="choices">${perspective.choices.map((choice,i)=>`<button class="choice" data-action="choose" data-id="${esc(choice.id)}" aria-pressed="${selected?.id===choice.id}"><span class="number">0${i+1}</span><span class="chosen-label">${esc(choice.label)}</span>${state.readChoices.includes(`${state.loop}:${state.scene}:${choice.id}`)?'<span class="read-tag">既読</span>':''}</button>`).join('')}</div>${selected?`<div class="thought" id="thought" tabindex="-1"><div class="label">心に浮かんだこと</div>${paragraphs(selected.text)}</div>`:''}<div class="scene-actions"><button class="quiet" data-action="back" ${!state.history.length?'disabled':''}>← 戻る</button><button class="primary" data-action="next" ${!engine.canAdvance(state,story)?'disabled':''}>${state.scene===story.scenes.length-1?'この夜を閉じる':'次の場面へ'} <span aria-hidden="true">→</span></button></div><p class="autosave-note">${storageOk?'ここまで自動保存':'保存できていません'}</p></section></div>`;
  }
  function documentButton(id, locked = false) {
    const doc = story.evidence.find(e=>e.id===id);
    return `<button class="document-button ${locked?'unavailable':''}" data-action="document" data-id="${esc(id)}" ${locked?'disabled':''}><span class="document-icon" aria-hidden="true">▤</span><span class="document-text"><strong>${esc(doc.title)}</strong><small>${locked?'まだ訪れていない場面の資料':state.evidence.includes(id)?'手帖に記録済み':'開いて確かめる'}</small></span><span aria-hidden="true">↗</span></button>`;
  }
  function reflectionView() {
    return `<section class="reflection"><p class="eyebrow">THE SAME NIGHT, ANOTHER READING</p><h2>白い四十秒を、読み直す。</h2><p class="reflection-intro">同じ夜を三度たどった。机の上には、はじめからあった資料が並んでいる。<br>確かめられることと、まだ分からないこと。その境目に線を引いてみる。</p>${state.solved?`<div class="feedback"><p class="eyebrow">記録から分かったこと</p>${paragraphs(story.puzzle.explanation)}</div><h2>どんな言葉を、余白に残す？</h2><p class="reflection-intro">夜の出来事は、どれを選んでも変わりません。<br>ここに、気持ちの正解や優劣はありません。</p><div class="ending-choices">${story.endings.map(e=>`<button class="ending-choice" data-action="end" data-id="${esc(e.id)}">${esc(e.label)}<span aria-hidden="true">→</span></button>`).join('')}</div>`:`<form id="puzzle-form" class="puzzle"><h3>${esc(story.puzzle.question)}</h3><fieldset style="border:0;padding:0;margin:0"><legend class="label">いま立てられる仮説をひとつ</legend><div class="puzzle-options">${story.puzzle.hypotheses.map(h=>`<label class="radio-row"><input type="radio" name="hypothesis" value="${esc(h.id)}" ${selectedHypothesis===h.id?'checked':''} required><span>${esc(h.label)}</span></label>`).join('')}</div></fieldset><fieldset style="border:0;padding:0;margin:0"><legend class="label">根拠となる資料をふたつ選ぶ</legend><div class="evidence-grid">${story.evidence.map(e=>`<div class="evidence-select"><label class="check-row"><input type="checkbox" name="evidence" value="${esc(e.id)}" ${selectedEvidence.includes(e.id)?'checked':''}><span>${esc(e.title)}</span></label><button type="button" class="quiet" data-action="document" data-id="${esc(e.id)}" aria-label="${esc(e.title)}を読む">読む</button></div>`).join('')}</div></fieldset><button class="primary" type="submit">資料を照らし合わせる <span aria-hidden="true">→</span></button>${puzzleFeedback?`<div class="feedback" id="puzzle-feedback" role="status">${esc(puzzleFeedback)}</div>`:''}<details class="hint"><summary>考える手がかり</summary>${esc(story.puzzle.hint)}</details></form>`}<div class="scene-actions"><button class="quiet" data-action="back">← 前の場面へ戻る</button><button class="quiet" data-action="journal">手帖をひらく ↗</button></div></section>`;
  }
  function endingView() {
    const ending = story.endings.find(e=>e.id===state.ending);
    return `<section class="prose-page"><p class="eyebrow">EPILOGUE / ${esc(ending.id)}</p><h2>${esc(ending.title)}</h2><div class="prose-body">${paragraphs(ending.text)}<div class="small-rule"></div>${paragraphs(story.outro)}</div><div class="end-art">${JourneyArt('rain')}</div><p class="end-sign">解釈の旅路　／　了</p><div class="ending-footer"><button class="primary" data-action="back">余白の言葉を選び直す <span aria-hidden="true">↶</span></button><button class="link-button" data-action="cover">表紙へ</button><button class="link-button" data-action="about">作品について</button></div><p class="content-warning">最後まで読んでくださって、ありがとうございました。<br>あなたの読み方も、この夜に残ります。</p></section>`;
  }
  function render() {
    renderHeader();
    if (cover) main.innerHTML = coverView();
    else if (state.screen === 'intro') main.innerHTML = proseView('PROLOGUE / 灯標館','雨のあとに残るもの',story.intro,'あの夜へ','begin');
    else if (state.screen === 'play') main.innerHTML = sceneView();
    else if (state.screen === 'interlude') main.innerHTML = proseView(`BETWEEN READINGS / ${state.loop+1}`,story.loops[state.loop].subtitle,story.loops[state.loop].interlude,'もう一度、同じ夜へ','repeat');
    else if (state.screen === 'reflection') main.innerHTML = reflectionView();
    else main.innerHTML = endingView();
  }
  function openDialog(title, body) {
    dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="quiet" data-action="close" aria-label="閉じる">閉じる ×</button></div><div class="dialog-body">${body}</div>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function showDocument(id) {
    const doc = story.evidence.find(d=>d.id===id); if (!doc) return;
    const next = engine.transition(state,{type:'INSPECT',evidenceId:id},story);
    if (!next.evidence.includes(id)) return;
    state = next; save(); render();
    openDialog(doc.title,`<article class="document-paper"><div class="eyebrow">${esc(doc.subtitle)}</div>${paragraphs(doc.body)}</article><p class="journal-note" style="margin-top:20px;margin-bottom:0">この資料の内容は、何度読み返しても変わりません。</p><div class="dialog-actions"><button class="secondary" data-action="close">物語に戻る</button><button class="quiet" data-action="journal">手帖の一覧へ</button></div>`);
  }
  function showJournal() {
    const available = new Set(state.evidence);
    if (state.screen==='play') story.scenes[state.scene].evidenceIds.forEach(id=>available.add(id));
    if (state.screen==='reflection'||state.screen==='ending') story.evidence.forEach(e=>available.add(e.id));
    let body = `<div class="tabs"><button class="secondary ${journalTab==='documents'?'active':''}" data-action="journal-tab" data-id="documents">変わらない資料</button><button class="secondary ${journalTab==='trace'?'active':''}" data-action="journal-tab" data-id="trace">私の読み跡</button></div>`;
    if (journalTab==='documents') body+=`<p class="journal-note">資料は最初の周から同じ場所にあります。場面を進めると、開ける資料が増えます。</p><div class="journal-list">${story.evidence.map(e=>documentButton(e.id,!available.has(e.id))).join('')}</div>`;
    else {
      const entries = [];
      story.loops.forEach((loop,l)=>story.scenes.forEach((scene,s)=>{
        const choice = scene.perspectives[l].choices.find(c=>c.id===state.choices[`${l}:${s}`]);
        if (choice) entries.push(`<div class="trace-entry"><strong>${esc(loop.name)} / ${esc(scene.title)}</strong><p>「${esc(choice.label)}」</p>${paragraphs(choice.text)}</div>`);
      }));
      body+=`<p class="journal-note">各場面で最後に選んだ心の声を記録しています。「戻る」で選び直すと、その場面の記録も書き替わります。</p>${entries.join('')||'<p class="journal-note">まだ、言葉は書き込まれていません。</p>'}`;
    }
    openDialog('記録と、余白の手帖',body);
  }
  function showSettings() {
    openDialog('保存・設定',`<p class="journal-note">選択と場面の移動は自動保存されます。「ここで保存」で、別のしおりも一つ残せます。保存先はこのブラウザです。</p><div class="setting-row"><div>しおりを残す<p>今いる場面と読み跡を保存</p></div><button class="secondary" data-action="save-manual">ここで保存</button></div><div class="setting-row"><div>しおりから再開<p>現在の進行を保存時点へ戻す</p></div><button class="secondary" data-action="load-manual">読み込む</button></div><div class="setting-row"><div>文字の大きさ<p>本文を少し大きくできます</p></div><button class="secondary" data-action="textsize">切り替える</button></div><div class="setting-row"><div>すべて初期化<p>自動保存・しおり・既読を消去</p></div><button class="quiet" data-action="reset">初期化</button></div><div class="dialog-actions"><button class="quiet" data-action="about">作品と操作について</button></div>`);
  }
  function confirm(title,message,action,label) {
    openDialog(title,`<p class="confirmation">${esc(message)}</p><div class="dialog-actions"><button class="primary" data-action="${action}">${esc(label)}</button><button class="secondary" data-action="close">やめる</button></div>`);
  }
  function about() {
    openDialog('この作品について',`<div class="prose-body" style="font-size:14px"><p>『解釈の旅路 — ${esc(story.subtitle)}』</p><p>架空の上映館の最後の夜を、三度読み返す短編です。選択肢は律の内面を変えます。登場人物の言葉、出来事、資料の内容は変わりません。</p><p>資料で確認できる謎と、人の気持ちの分からなさを、別々に扱っています。喪失や自責の描写があります。音声と時間制限はありません。</p><p>操作：心の声を選んで「次の場面へ」。資料ボタンで文書を開きます。「戻る」で前の場面を読み直せます。キーボードはTabで移動、Enterで選択、Escで手帖を閉じられます。</p><p>「出来事は変わらず、その解釈が変わる」という構想から生まれたオリジナル作品です。登場する人物・場所・出来事はフィクションです。</p><p>外部API・外部素材・外部ライブラリなし。画面の情景はこの作品のためのSVG画です。</p></div>`);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
    const action = button.dataset.action, id = button.dataset.id;
    if (action==='close') { dialog.close(); return; }
    if (action==='cover') { cover=true; render(); window.scrollTo({top:0,behavior:'instant'}); return; }
    if (action==='resume') { cover=false; render(); main.focus(); return; }
    if (action==='start'||action==='new-confirmed') { state=engine.createState(); selectedEvidence=[];selectedHypothesis='';puzzleFeedback='';cover=false;dialog.close();save();render();main.focus();return; }
    if (action==='new') { confirm('はじめから読み直す','自動保存と読み跡を新しい旅で置き換えます。手動のしおりは残ります。','new-confirmed','はじめから');return; }
    if (action==='begin') {dispatch({type:'BEGIN'});return;}
    if (action==='choose') {dispatch({type:'CHOOSE',choiceId:id},false);document.querySelector('#thought')?.focus();return;}
    if (action==='next') {dispatch({type:'NEXT'});return;}
    if (action==='repeat') {dispatch({type:'REPEAT'});return;}
    if (action==='back') {dispatch({type:'BACK'});return;}
    if (action==='end') {dispatch({type:'END',endingId:id});return;}
    if (action==='document') {showDocument(id);return;}
    if (action==='journal') {showJournal();return;}
    if (action==='journal-tab') {journalTab=id;showJournal();return;}
    if (action==='settings') {showSettings();return;}
    if (action==='textsize') {document.body.classList.toggle('large-text');renderHeader();toast(document.body.classList.contains('large-text')?'本文を大きくしました':'本文を標準サイズに戻しました');return;}
    if (action==='save-manual') {if(save(MANUAL))toast('しおりを保存しました');return;}
    if (action==='load-manual') {if(!readSlot(MANUAL)){toast('保存したしおりがありません');return;}confirm('しおりを読み込む','現在の進行を、しおりに保存した場面へ戻します。','load-confirmed','読み込む');return;}
    if (action==='load-confirmed') {const slot=readSlot(MANUAL);if(slot){state=slot;cover=false;selectedEvidence=[];selectedHypothesis='';puzzleFeedback='';save();dialog.close();render();main.focus();toast('しおりから再開しました');}return;}
    if (action==='reset') {confirm('すべて初期化','この作品の自動保存・しおり・既読・資料をすべて消します。初期化後は元に戻せません。','reset-confirmed','初期化する');return;}
    if (action==='reset-confirmed') {try{localStorage.removeItem(AUTO);localStorage.removeItem(MANUAL);}catch{warn('保存データの削除を確認できませんでした。ブラウザのサイトデータから削除してください。');}state=engine.createState();hasSave=false;cover=true;selectedEvidence=[];selectedHypothesis='';puzzleFeedback='';dialog.close();render();main.focus();toast('新しい旅の表紙に戻りました');return;}
    if (action==='about') about();
  });
  document.addEventListener('change',event=>{
    if(event.target.closest('#puzzle-form')){
      const form = document.querySelector('#puzzle-form');
      selectedHypothesis = new FormData(form).get('hypothesis') || '';
      selectedEvidence = new FormData(form).getAll('evidence');
    }
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='puzzle-form')return;event.preventDefault();
    const data = new FormData(event.target), hypothesis=String(data.get('hypothesis')||''), evidenceIds=data.getAll('evidence');
    selectedHypothesis=hypothesis;selectedEvidence=evidenceIds;
    if(evidenceIds.length!==2)puzzleFeedback='資料をふたつ選んで、並べてみてください。';
    else if(evidenceIds.some(id=>!state.evidence.includes(id)))puzzleFeedback='選んだ資料の「読む」を押して、内容を確かめてみてください。';
    else {
      const next=engine.transition(state,{type:'SOLVE',hypothesis,evidenceIds},story);state=next;save();
      if(!state.solved) puzzleFeedback=hypothesis!==story.puzzle.answer?(story.puzzle.hypotheses.find(h=>h.id===hypothesis)?.feedback||'記録をもう一度照らし合わせてみよう。'):'その見方を、予定と実際の動きの両方から確かめられる資料はどれだろう。';
      else puzzleFeedback='';
    }
    render(); document.querySelector(state.solved?'h2':'#puzzle-feedback')?.scrollIntoView({block:'center'});
  });
  render();
})();
