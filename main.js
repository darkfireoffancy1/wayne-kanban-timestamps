// Self-contained release build of Wayne Kanban Timestamps.
// Source modules are kept readable in this file for the public directory.
const obsidianRequire = require;
const TaskModel = (() => {
  const module = {exports: {}};
// Shared, dependency-free Kanban/Bases model. Obsidian supplies its YAML parser.
const BOARD = 'Wayne to-do list/Wayne to-do list Kanban.md';
const FOLDER = 'Wayne to-do list/任务';
const COLUMNS = ["Can't start yet", 'Not started', 'In progress', 'Done', 'Archive'];
const STATUSES = ['暂不能开始', '未开始', '进行中', '已完成', '已归档'];
const ID_RE = /^\s*%% wayne-task:([a-zA-Z0-9-]+) %%\s*$/;
const DATE_RE = /^\s*\*建 (\d{2}-\d{2}-\d{2}) · 编 (\d{2}-\d{2}-\d{2})\*\s*$/;
const BASE_RE = /^<!-- wayne-task-baseline (.+) -->$/m;
const FIELDS = ['任务', '状态', '创建日期', '更新日期', '勾选', '归档区', '详情', '移出看板'];
const OPTIONAL = ['项目', '优先级', '下次跟进', '截止日期', '下一步'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
function uid() {
  return 'wt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
function parseBoard(text) {
  if (/^(<<<<<<< |=======\s*$|>>>>>>> )/m.test(text)) throw Error('看板存在 Git 冲突标记');
  const lines = text.split('\n'), cards = [], sections = [];
  let section = null, archived = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^%% kanban:settings/.test(lines[i])) break;
    if (/^\*\*\*\s*$/.test(lines[i])) { archived = true; continue; }
    const heading = lines[i].match(/^## (.+?)\s*$/);
    if (heading) {
      if (!COLUMNS.includes(heading[1])) throw Error(`未知看板列：${heading[1]}`);
      section = { index: sections.length, heading: i, name: heading[1], archived, cards: [] };
      sections.push(section); continue;
    }
    const start = lines[i].match(/^- \[([ xX])\] (.*)$/);
    if (!start) continue;
    if (!section) throw Error('卡片缺少所属列');
    let end = i + 1;
    while (end < lines.length && !/^(?:- \[[ xX]\] |## |\*\*\*\s*$|%% kanban:settings)/.test(lines[end])) end++;
    while (end > i + 1 && !lines[end-1].trim()) end--;
    const raw = lines.slice(i, end);
    const date = raw.map(l => l.match(DATE_RE)).find(Boolean);
    const id = raw.map(l => l.match(ID_RE)).find(Boolean);
    const card = { start: i, end, raw, section: section.index, id: id ? id[1] : null, data: {
      '任务': start[2], '状态': STATUSES[COLUMNS.indexOf(section.name)],
      '创建日期': date ? '20'+date[1] : today(), '更新日期': date ? '20'+date[2] : today(),
      '勾选': start[1].toLowerCase() === 'x', '归档区': archived ? '插件归档' : '看板列',
      '详情': raw.slice(1).filter(l => !DATE_RE.test(l) && !ID_RE.test(l)).join('\n'),
      '移出看板': false,
    }};
    cards.push(card); section.cards.push(card); i = end-1;
  }
  if (sections.length < 5) throw Error('缺少原看板列，停止同步');
  return { text, lines, cards, sections };
}
function pick(data) { return Object.fromEntries(FIELDS.map(k => [k, data[k]])); }
function normalize(data) {
  const d = {...data};
  for (const k of ['创建日期', '更新日期']) {
    if (d[k] instanceof Date) d[k] = d[k].toISOString().slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d[k] || '') || Number.isNaN(Date.parse(d[k]))) throw Error(`日期格式无效：${k}`);
  }
  if (typeof d['任务'] !== 'string' || !d['任务'].trim() || /[\r\n]/.test(d['任务'])) throw Error('任务标题必须为一行非空文字');
  if (!STATUSES.includes(d['状态'])) throw Error(`状态无效：${d['状态']}`);
  if (!['看板列','插件归档'].includes(d['归档区'])) throw Error('归档区无效');
  if (typeof d['勾选'] !== 'boolean' || typeof d['移出看板'] !== 'boolean') throw Error('勾选/移出看板必须为复选框');
  if (typeof d['详情'] !== 'string') throw Error('详情必须为文本');
  if (/^(?:- \[[ xX]\] |## |\*\*\*\s*$|%% kanban:settings)/m.test(d['详情'])) throw Error('详情包含看板控制语法，请放入任务笔记正文');
  return d;
}
function readNote(text, parseYaml, newTitle) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match && !newTitle) throw Error('任务笔记缺少属性');
  let data = match ? parseYaml(match[1]) || {} : {};
  const base = text.match(BASE_RE);
  if (!data['任务ID'] && !base && newTitle) {
    data = {'任务ID':uid(), '任务':newTitle, '状态':'未开始', '创建日期':today(),
      '更新日期':today(), '勾选':false, '归档区':'看板列', '详情':'', '移出看板':false,
      '项目':'', '优先级':'', '下一步':'', '下次跟进':null, '截止日期':null, ...data};
  }
  if (!/^wt-[a-zA-Z0-9-]+$/.test(data['任务ID'] || '')) throw Error('任务ID缺失或无效');
  return { id: data['任务ID'], data: normalize(data), baseline: base ? JSON.parse(base[1]) : null,
    body: text.slice(match ? match[0].length : 0).replace(BASE_RE, '').trimEnd(), text };
}
function writeNote(note, data, stringifyYaml) {
  const next = { ...data, '任务ID': note.id, '类型': '个人任务', '数据版本': 1 };
  for (const k of ['下次跟进','截止日期']) if (next[k] instanceof Date) next[k] = next[k].toISOString().slice(0,10);
  const baseline = {...pick(next), _optional: Object.fromEntries(OPTIONAL.map(k => [k,next[k] ?? '']))};
  const marker = `<!-- wayne-task-baseline ${JSON.stringify(baseline)} -->`;
  return `---\n${stringifyYaml(next).trim()}\n---\n${note.body || '\n在这里记录跟进细节、链接和结果。'}\n\n${marker}\n`;
}
function matchCards(parsed, notes) {
  const used = new Set(parsed.cards.filter(c => c.id).map(c => c.id));
  if (used.size !== parsed.cards.filter(c => c.id).length) throw Error('看板存在重复任务ID');
  // Initial conversion: identify duplicate titles by full original record, in order.
  for (const c of parsed.cards.filter(c => !c.id)) {
    let n = notes.find(n => !used.has(n.id) && n.baseline && same(pick(c.data), pick(n.baseline)));
    if (!n) {
      const candidates = notes.filter(n => !used.has(n.id) && n.baseline && !n.baseline['移出看板'] &&
        ['任务','创建日期','详情'].every(k=>same(c.data[k],n.baseline[k])));
      if (candidates.length > 1) throw Error(`任务身份匹配有歧义：${c.data['任务']}；请核对重名卡片的ID`);
      if (candidates.length === 1) n = candidates[0];
    }
    c.id = n ? n.id : uid(); used.add(c.id);
  }
  const unmatchedOld = notes.filter(n=>n.baseline && !n.baseline['移出看板'] && !used.has(n.id));
  const unmatchedNew = parsed.cards.filter(c=>!notes.some(n=>n.id===c.id) && !c.raw.some(l=>ID_RE.test(l)));
  if(unmatchedOld.length && unmatchedNew.length && !parsed.cards.some(c=>c.raw.some(l=>ID_RE.test(l)))) {
    throw Error('首次同步前看板标题已改变，任务身份无法唯一匹配；请先核对新增与缺失任务');
  }
}
function mergeRecords(parsed, notes, date = today()) {
  if (new Set(notes.map(n => n.id)).size !== notes.length) throw Error('任务笔记存在重复ID');
  matchCards(parsed, notes);
  const cards = new Map(parsed.cards.map(c => [c.id,c]));
  const noteMap = new Map(notes.map(n => [n.id,n]));
  const merged = [], conflicts = [];
  for (const id of new Set([...cards.keys(), ...noteMap.keys()])) {
    const card = cards.get(id), note = noteMap.get(id), base = note?.baseline;
    if (!note) {
      const data = {...card.data};
      merged.push({id, card, note: {id,body:'',data:{}}, data}); continue;
    }
    if (!base && card) { conflicts.push(`${id}: 同步基线缺失`); continue; }
    const boardData = card ? card.data : base ? {...base, '移出看板':true} : note.data;
    const out = {...note.data};
    for (const field of FIELDS) {
      const b = boardData[field], n = note.data[field], old = base?.[field];
      if (!base || same(b,n)) out[field] = n;
      else if (same(n,old)) out[field] = b;
      else if (same(b,old)) out[field] = n;
      else if (field === '更新日期') out[field] = b > n ? b : n;
      else conflicts.push(`${id}: ${field}在两处同时被修改`);
    }
    // Removing a card while changing its note is a conflict, never silently hide it.
    if (!card && base && !base['移出看板'] && FIELDS.some(k => !same(note.data[k],base[k]))) {
      conflicts.push(`${id}: 看板移除与表格编辑冲突`);
    }
    if (base && (FIELDS.filter(k => !['更新日期','创建日期'].includes(k)).some(k => !same(out[k],base[k])) ||
      OPTIONAL.some(k => !same(out[k] ?? '', base._optional?.[k] ?? '')))) out['更新日期'] = date;
    if (out['状态'] !== '已归档') out['归档区'] = '看板列';
    merged.push({id,card,note,data:normalize(out)});
  }
  if (conflicts.length) throw Error(conflicts.join('\n'));
  return merged;
}

function renderCard(record) {
  const {card, data, id} = record;
  const unchanged = card && same(pick(card.data),pick(data));
  if (unchanged) {
    if (card.raw.some(l => ID_RE.test(l))) return card.raw;
    return [...card.raw, `  %% wayne-task:${id} %%`];
  }
  const raw = card ? [...card.raw] : [];
  const title = `- [${data['勾选'] ? 'x' : ' '}] ${data['任务']}`;
  const stamp = `  *建 ${data['创建日期'].slice(2)} · 编 ${data['更新日期'].slice(2)}*`;
  if (!card || data['详情'] !== card.data['详情']) {
    return [title, stamp, ...(data['详情'] ? data['详情'].split('\n') : []), `  %% wayne-task:${id} %%`];
  }
  raw[0] = title;
  const dateIndex = raw.findIndex(l => DATE_RE.test(l));
  if (dateIndex >= 0) raw[dateIndex] = stamp; else raw.splice(1,0,stamp);
  if (!raw.some(l => ID_RE.test(l))) raw.push(`  %% wayne-task:${id} %%`);
  return raw;
}
function renderBoard(parsed, records) {
  const replacements = new Map(), inserts = new Map();
  for (const record of records) {
    const {data,card} = record;
    if (data['移出看板']) { if (card) replacements.set(card.start, {end:card.end, lines:[]}); continue; }
    const name = COLUMNS[STATUSES.indexOf(data['状态'])];
    const archived = data['归档区'] === '插件归档';
    const target = parsed.sections.find(s => s.name === name && s.archived === archived);
    if (!target) throw Error(`缺少目标列 ${name}/${data['归档区']}`);
    if (card && card.section === target.index) {
      replacements.set(card.start, {end:card.end,lines:renderCard(record)});
    } else {
      if (card) replacements.set(card.start, {end:card.end,lines:[]});
      const pos = target.cards.length ? target.cards[target.cards.length-1].end : target.heading+1;
      if (!inserts.has(pos)) inserts.set(pos,[]);
      inserts.get(pos).push('',...renderCard(record));
    }
  }
  const out = [];
  for (let i=0;i<=parsed.lines.length;) {
    if (inserts.has(i)) out.push(...inserts.get(i));
    if (i === parsed.lines.length) break;
    const replacement = replacements.get(i);
    if (replacement) {out.push(...replacement.lines); i=replacement.end;}
    else {out.push(parsed.lines[i]);i++;}
  }
  return out.join('\n');
}

function fileName(record) {
  const label = record.data['任务'].replace(/[<>:"/\\|?*\[\]#^\u0000-\u001f]/g,' ').trim().slice(0,45).trim();
  return `${FOLDER}/${label || '任务'}--${record.id}.md`;
}

module.exports = { BOARD, FOLDER, COLUMNS, STATUSES, FIELDS, OPTIONAL, ID_RE, DATE_RE,
  today, uid, same, pick, parseBoard, readNote, writeNote, mergeRecords, renderBoard, fileName };

  return module.exports;
})();
const TaskStore = (() => {
  const module = {exports: {}};
  const require = name => {
    if (name === 'obsidian') return obsidianRequire('obsidian');
    if (name === './task-model') return TaskModel;
    throw new Error('Unexpected dependency: ' + name);
  };
const {Notice, Modal, parseYaml, stringifyYaml} = require('obsidian');
const M = require('./task-model');

// Both Bases table and board write these note properties. No Kanban mirror.
module.exports = class TaskStore {
  constructor(plugin) {this.plugin=plugin;this.app=plugin.app;this.timers=new Map();this.closed=false;}
  async start() {
    this.plugin.registerEvent(this.app.vault.on('modify',f=>this.schedule(f)));
    this.plugin.registerEvent(this.app.vault.on('create',f=>this.schedule(f)));
    this.plugin.register(()=>{this.closed=true;for(const t of this.timers.values())clearTimeout(t);});
    this.plugin.addCommand({id:'new-personal-task',name:'新增个人任务',callback:()=>this.promptCreate('未开始')});
    this.plugin.addCommand({id:'open-personal-tasks',name:'打开个人任务（表格 / 看板）',callback:()=>
      this.app.workspace.openLinkText('Wayne to-do list/个人任务多维表.base','',false)});
    this.app.workspace.onLayoutReady(()=>{
      for(const f of this.app.vault.getMarkdownFiles())this.schedule(f);
    });
  }
  isTask(file) {return file?.path?.startsWith(M.FOLDER+'/') && file.extension==='md';}
  schedule(file) {
    if(this.closed||!this.isTask(file))return;
    if(this.timers.has(file.path))clearTimeout(this.timers.get(file.path));
    this.timers.set(file.path,setTimeout(()=>{
      this.timers.delete(file.path);this.maintain(file).catch(e=>new Notice('任务属性未更新：'+e.message,10000));
    },600));
  }
  async maintain(file) {
    if(this.closed||!this.app.vault.getAbstractFileByPath(file.path))return;
    await this.app.vault.process(file,current=>{
      if(/^(<<<<<<< |=======\s*$|>>>>>>> )/m.test(current))throw Error('任务存在 Git 合并冲突');
      const n=M.readNote(current,parseYaml,file.basename || file.path.split('/').pop().replace(/\.md$/,''));
      const b=n.baseline;
      const optional=v=>v instanceof Date?v.toISOString().slice(0,10):v??'';
      const changed=b && (M.FIELDS.filter(k=>!['更新日期','创建日期'].includes(k)).some(k=>!M.same(n.data[k],b[k])) ||
        M.OPTIONAL.some(k=>!M.same(optional(n.data[k]),optional(b._optional?.[k]))));
      if(b&&!changed)return current;
      if(changed)n.data['更新日期']=M.today();
      return M.writeNote(n,n.data,stringifyYaml);
    });
  }
  async update(file,patch,expected={}) {
    if(!this.isTask(file))throw Error('只能编辑个人任务文件夹中的任务');
    if(patch['状态']!==undefined&&!M.STATUSES.includes(patch['状态']))throw Error('任务状态无效');
    if(patch['任务']!==undefined && (typeof patch['任务']!=='string'||!patch['任务'].trim()||/[\r\n]/.test(patch['任务'])))throw Error('任务名称不能为空或包含换行');
    if(Object.keys(patch).some(k=>!['状态','任务'].includes(k)))throw Error('不支持的看板编辑字段');
    await this.app.fileManager.processFrontMatter(file,fm=>{
      if(fm['类型']!=='个人任务'||!fm['任务ID'])throw Error('任务属性不完整');
      for(const [key,value] of Object.entries(expected))if(fm[key]!==value)throw Error('这条任务已被更新，请刷新后再操作');
      if(Object.entries(patch).every(([k,v])=>fm[k]===v))return;
      Object.assign(fm,patch);fm['更新日期']=M.today();
      if(patch['状态'] && patch['状态']!=='已归档')fm['归档区']='看板列';
    });
  }
  async create(title,status='未开始') {
    title=title.trim();if(!title||/[\r\n]/.test(title))throw Error('请输入一行任务名称');
    if(!M.STATUSES.includes(status))throw Error('任务状态无效');
    const record={id:M.uid(),data:{'任务':title,'状态':status,'创建日期':M.today(),'更新日期':M.today(),
      '勾选':false,'归档区':'看板列','详情':'','移出看板':false,'项目':'','优先级':'','下一步':'','下次跟进':null,'截止日期':null}};
    const text=M.writeNote({id:record.id,body:''},record.data,stringifyYaml);
    return this.app.vault.create(M.fileName(record),text);
  }
  promptCreate(status) {this.prompt('新增任务','',async title=>{await this.create(title,status);});}
  promptRename(file,title) {this.prompt('修改任务名称',title,value=>this.update(file,{'任务':value},{'任务':title}));}
  prompt(label,value,save) {
    const modal=new Modal(this.app);
    modal.contentEl.addClass('wayne-task-editor');
    modal.contentEl.createEl('h3',{text:label});
    const input=modal.contentEl.createEl('input',{type:'text',value,attr:{'aria-label':label}});input.style.width='100%';
    const button=modal.contentEl.createEl('button',{text:'保存',cls:'mod-cta'});button.style.marginTop='12px';
    const submit=async()=>{button.disabled=true;try{await save(input.value);modal.close();}catch(e){new Notice(e.message);button.disabled=false;}};
    button.addEventListener('click',submit);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
    modal.open();input.focus();input.select();
  }
};

  return module.exports;
})();
const TaskBoard = (() => {
  const module = {exports: {}};
  const require = name => {
    if (name === 'obsidian') return obsidianRequire('obsidian');
    if (name === './task-model') return TaskModel;
    throw new Error('Unexpected dependency: ' + name);
  };
const {BasesView,Notice} = require('obsidian');
const M = require('./task-model');
const TYPE='wayne-task-board';
function value(entry,key) {const v=entry.getValue('note.'+key);return v&&v.isTruthy()?v.toString():'';}

module.exports = class TaskBoard extends BasesView {
  constructor(controller,container,store) {
    super(controller);this.type=TYPE;this.store=store;
    this.root=container.createDiv({cls:'wayne-bases-board'});this.dragged=null;
    this.archiveOpen=false;this.columnScroll=new Map();
    this.register(()=>this.root.remove());
  }
  onDataUpdated() {
    const left=this.root.scrollLeft;
    for(const el of this.root.querySelectorAll('.wayne-task-column-body'))this.columnScroll.set(el.dataset.status,el.scrollTop);
    this.root.empty();
    const entries=this.data?.data||[];
    const buckets=new Map(M.STATUSES.map(s=>[s,[]]));
    for(const e of entries) {
      if(value(e,'移出看板')==='true')continue;
      const status=value(e,'状态');
      if(!buckets.has(status))buckets.set(status,[]);
      buckets.get(status).push(e);
    }
    for(const [status,items] of buckets) {
      const col=this.root.createDiv({cls:'wayne-task-column'});col.dataset.status=status;
      if(status==='已归档'&&!this.archiveOpen)col.classList.add('is-collapsed');
      const header=col.createDiv({cls:'wayne-task-column-header'});
      const heading=header.createEl('button',{text:status||'未设置状态',cls:'wayne-task-column-title'});
      header.createEl('span',{text:String(items.length),cls:'wayne-task-count'});
      if(status==='已归档')heading.addEventListener('click',()=>{this.archiveOpen=!this.archiveOpen;this.onDataUpdated();});
      else heading.disabled=true;
      if(M.STATUSES.includes(status)) {
        col.addEventListener('dragover',e=>{if(this.dragged){e.preventDefault();col.classList.add('is-drop-target');}});
        col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('is-drop-target');});
        col.addEventListener('drop',e=>{
          e.preventDefault();col.classList.remove('is-drop-target');
          const dragged=this.dragged;this.dragged=null;
          if(dragged)this.move(dragged.file,dragged.status,status);
        });
      }
      if(status==='已归档'&&!this.archiveOpen)continue;
      const body=col.createDiv({cls:'wayne-task-column-body'});body.dataset.status=status;
      for(const entry of items)this.card(body,entry,status);
      body.scrollTop=this.columnScroll.get(status)||0;
      if(M.STATUSES.includes(status)) {
        const add=col.createEl('button',{text:'+ 添加任务',cls:'wayne-task-add'});
        add.addEventListener('click',()=>this.store.promptCreate(status));
      }
    }
    this.root.scrollLeft=left;
  }
  card(body,entry,status) {
    const card=body.createDiv({cls:'wayne-task-card'});
    // On touch, native horizontal scrolling takes priority; the status menu moves cards.
    card.draggable=!(typeof window.matchMedia==='function' && window.matchMedia('(pointer: coarse)').matches);
    const title=value(entry,'任务')||entry.file.basename;
    const open=card.createEl('button',{text:title,cls:'wayne-task-title'});
    open.addEventListener('click',()=>this.app.workspace.openLinkText(entry.file.path,'',false));
    const dates=card.createDiv({cls:'wayne-task-dates'});
    dates.textContent=`建 ${value(entry,'创建日期').slice(0,10)} · 编 ${value(entry,'更新日期').slice(0,10)}`;
    const next=value(entry,'下一步');if(next)card.createDiv({text:next,cls:'wayne-task-next'});
    const project=value(entry,'项目'),priority=value(entry,'优先级');
    if(project||priority)card.createDiv({text:[project,priority].filter(Boolean).join(' · '),cls:'wayne-task-meta'});
    const actions=card.createDiv({cls:'wayne-task-actions'});
    const select=actions.createEl('select');select.setAttribute('aria-label',`${title}的状态`);
    for(const s of M.STATUSES)select.createEl('option',{text:s,value:s});select.value=status;
    select.addEventListener('change',()=>this.move(entry.file,status,select.value));
    const edit=actions.createEl('button',{text:'改名'});edit.addEventListener('click',()=>this.store.promptRename(entry.file,title));
    card.addEventListener('dragstart',e=>{
      if(['BUTTON','SELECT','INPUT'].includes(e.target.tagName)&&e.target!==card){e.preventDefault();return;}
      this.dragged={file:entry.file,status};e.dataTransfer.setData('text/plain',entry.file.path);e.dataTransfer.effectAllowed='move';
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend',()=>{this.dragged=null;card.classList.remove('is-dragging');
      for(const e of this.root.querySelectorAll('.is-drop-target'))e.classList.remove('is-drop-target');});
  }
  async move(file,oldStatus,status) {
    try{await this.store.update(file,{'状态':status},{'状态':oldStatus});}
    catch(e){new Notice('状态未修改：'+e.message,8000);this.onDataUpdated();}
  }
};

  return module.exports;
})();
const { Plugin, TFile } = require("obsidian");
const META_RE = /^(\s*)\*(?:建\s+(\d{2}-\d{2}-\d{2})(?:\s*·\s*编\s+\d{2}-\d{2}-\d{2})?|编\s+\d{2}-\d{2}-\d{2})\*\s*$/;
const CARD_RE = /^\s*- \[[ xX]\] /;
const HEADING_RE = /^##\s+(.+?)\s*$/;
const BOARD_FOOTER_RE = /^(?:%%\s*kanban:settings|\*\*\*\s*$)/;

function compactDate(date = new Date()) {
  return [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseCards(content) {
  const lines = content.split("\n");
  const cards = [];
  let column = "";

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(HEADING_RE);
    if (heading) {
      column = heading[1];
      continue;
    }
    if (!CARD_RE.test(lines[index])) continue;

    let end = index + 1;
    while (
      end < lines.length &&
      !CARD_RE.test(lines[end]) &&
      !HEADING_RE.test(lines[end]) &&
      !BOARD_FOOTER_RE.test(lines[end])
    ) {
      end += 1;
    }
    cards.push({ start: index, end, column, lines: lines.slice(index, end) });
    index = end - 1;
  }

  return { lines, cards };
}

function signature(card) {
  const body = card.lines.filter((line) => !META_RE.test(line) && !/^\s*%% wayne-task:[a-zA-Z0-9-]+ %%\s*$/.test(line));
  while (body.length && body[body.length - 1].trim() === "") body.pop();
  return `${card.column}\n${body.join("\n")}`;
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function withoutIndex(values, removedIndex) {
  return values.filter((_, index) => index !== removedIndex);
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const value of left) counts.set(value, (counts.get(value) || 0) + 1);
  for (const value of right) {
    const count = counts.get(value) || 0;
    if (!count) return false;
    if (count === 1) counts.delete(value);
    else counts.set(value, count - 1);
  }
  return counts.size === 0;
}

function findReorderedCardStarts(previousCards, currentCards) {
  const changedStarts = new Set();
  const columns = new Set(currentCards.map((card) => card.column));

  for (const column of columns) {
    const previous = previousCards.filter((card) => card.column === column);
    const current = currentCards.filter((card) => card.column === column);
    const previousKeys = previous.map(signature);
    const currentKeys = current.map(signature);

    if (arraysEqual(previousKeys, currentKeys) || !sameMultiset(previousKeys, currentKeys)) continue;

    // A single drag can usually be identified by removing the moved card from
    // both sequences. An adjacent swap is ambiguous, so both candidates are
    // timestamped rather than risking missing the card the user dragged.
    const candidates = new Set();
    for (let previousIndex = 0; previousIndex < previousKeys.length; previousIndex += 1) {
      for (let currentIndex = 0; currentIndex < currentKeys.length; currentIndex += 1) {
        if (
          previousIndex !== currentIndex &&
          previousKeys[previousIndex] === currentKeys[currentIndex] &&
          arraysEqual(
            withoutIndex(previousKeys, previousIndex),
            withoutIndex(currentKeys, currentIndex),
          )
        ) {
          candidates.add(current[currentIndex].start);
        }
      }
    }

    if (candidates.size) {
      for (const start of candidates) changedStarts.add(start);
      continue;
    }

    // If several cards were reordered before the debounce fired, timestamp
    // the smallest changed range so no actual move is missed.
    let first = 0;
    while (previousKeys[first] === currentKeys[first]) first += 1;
    let last = currentKeys.length - 1;
    while (last > first && previousKeys[last] === currentKeys[last]) last -= 1;
    for (let index = first; index <= last; index += 1) changedStarts.add(current[index].start);
  }

  return changedStarts;
}

function updateCard(card, date) {
  const lines = [...card.lines];
  const metaIndex = lines.findIndex((line) => META_RE.test(line));

  if (metaIndex >= 0) {
    const match = lines[metaIndex].match(META_RE);
    const indent = match[1];
    const created = match[2] || date;
    lines[metaIndex] = `${indent}*建 ${created} · 编 ${date}*`;
  } else {
    const indent = `${(lines[0].match(/^(\s*)/) || ["", ""])[1]}  `;
    lines.splice(1, 0, `${indent}*建 ${date} · 编 ${date}*`);
  }

  return lines;
}

function addMissingDates(content, date = compactDate()) {
  const parsed = parseCards(content);
  const output = [...parsed.lines];
  let changed = false;

  for (const card of [...parsed.cards].reverse()) {
    if (card.lines.some((line) => META_RE.test(line))) continue;
    output.splice(card.start, card.end - card.start, ...updateCard(card, date));
    changed = true;
  }

  return changed ? output.join("\n") : content;
}

function updateChangedCards(previousContent, currentContent, date = compactDate()) {
  const previous = parseCards(previousContent);
  const current = parseCards(currentContent);
  const remaining = new Map();

  for (const card of previous.cards) {
    const key = signature(card);
    remaining.set(key, (remaining.get(key) || 0) + 1);
  }

  const changedStarts = findReorderedCardStarts(previous.cards, current.cards);
  for (const card of current.cards) {
    const key = signature(card);
    const count = remaining.get(key) || 0;
    if (count > 0) {
      remaining.set(key, count - 1);
    } else {
      changedStarts.add(card.start);
    }
  }

  if (!changedStarts.size) return currentContent;

  const output = [...current.lines];
  for (const card of [...current.cards].reverse()) {
    if (!changedStarts.has(card.start)) continue;
    output.splice(card.start, card.end - card.start, ...updateCard(card, date));
  }
  return output.join("\n");
}

const BOARD_PATH = "Wayne to-do list/Wayne to-do list Kanban.md";

module.exports = class WayneKanbanTimestamps extends Plugin {
  async onload() {
    if (await this.app.vault.adapter.exists('Wayne to-do list/个人任务多维表.base')) {
      // Release bundle contains the task model, store, and board.
      this.taskStore = new TaskStore(this);
      const {BasesView, Notice} = require('obsidian');
      if (BasesView && typeof this.registerBasesView === 'function') {
        this.registerBasesView('wayne-task-board', {
          name: '个人任务看板', icon: 'columns-3',
          factory: (controller, container) => new TaskBoard(controller, container, this.taskStore),
        });
      } else new Notice('表格可用；同文件看板需要 Obsidian 1.10.2 或更新版本。');
      await this.taskStore.start();
      return;
    }
    this.previousContent = null;
    this.pendingTimer = null;
    this.processing = false;
    this.queued = false;

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path === BOARD_PATH) this.scheduleUpdate();
      }),
    );
    this.initializing = this.initialize();
  }

  async initialize() {
    const file = this.app.vault.getAbstractFileByPath(BOARD_PATH);
    if (!(file instanceof TFile)) return;

    const original = await this.app.vault.read(file);
    if (addMissingDates(original) === original) {
      this.previousContent = original;
      return;
    }

    // process() applies the backfill to the latest file content, so a sync or
    // user edit cannot be overwritten by an earlier read.
    await this.app.vault.process(file, (content) => {
      const updated = addMissingDates(content);
      this.previousContent = updated;
      return updated;
    });
  }

  scheduleUpdate() {
    if (this.pendingTimer) window.clearTimeout(this.pendingTimer);
    this.pendingTimer = window.setTimeout(() => this.processUpdate(), 300);
  }

  async processUpdate() {
    if (this.processing) {
      this.queued = true;
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(BOARD_PATH);
    if (!(file instanceof TFile)) return;

    this.processing = true;
    try {
      await this.initializing;
      const current = await this.app.vault.read(file);
      if (this.previousContent === null) {
        this.previousContent = current;
        return;
      }

      const previous = this.previousContent;
      if (updateChangedCards(previous, current) === current) {
        this.previousContent = current;
      } else {
        await this.app.vault.process(file, (content) => {
          const updated = updateChangedCards(previous, content);
          this.previousContent = updated;
          return updated;
        });
      }
    } finally {
      this.processing = false;
      if (this.queued) {
        this.queued = false;
        this.scheduleUpdate();
      }
    }
  }

  onunload() {
    if (this.pendingTimer) window.clearTimeout(this.pendingTimer);
  }
};
