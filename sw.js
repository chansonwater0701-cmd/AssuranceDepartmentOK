// sw.js — Background Upload Service Worker
// 支援 Android Chrome Background Sync（邊導航邊上傳）
// - 每次 fetch 有 timeout，不會在山區訊號差時永久掛住
// - 上傳結果寫入 IDB，技師重開頁面也能看到結果
'use strict';

const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbysTHCGm62yhuMABCz8a6iyKbFHsn59_BhEpUX87VNgFjoDqt7sURMMlHC5fddAh46jAA/exec';
const DB_NAME   = 'bg-upload-db';
const CHUNK_SZ  = 6 * 1024 * 1024; // 6 MB，與前端一致

// ── IndexedDB ─────────────────────────────────────────────────────────────────

function dbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 2);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('queue'))
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('results'))
        db.createObjectStore('results', { keyPath: 'id' });
    };
    r.onsuccess = e => res(e.target.result);
    r.onerror   = e => rej(e.target.error);
  });
}

function dbGetAll(db) {
  return new Promise((res, rej) => {
    const req = db.transaction('queue', 'readonly').objectStore('queue').getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function dbDelete(db, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
    tx.oncomplete = res;
    tx.onerror    = rej;
  });
}

// 儲存最後一次上傳結果（技師重開頁面後可讀取）
function dbSaveResult(db, result) {
  return new Promise((res, rej) => {
    const tx = db.transaction('results', 'readwrite');
    tx.objectStore('results').put({ id: 'last', ...result, time: Date.now() });
    tx.oncomplete = res;
    tx.onerror    = rej;
  });
}

// ── Broadcast 進度給開著的頁面 ────────────────────────────────────────────────

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(c => c.postMessage(msg));
}

// ── Fetch with timeout（避免山區訊號差永久掛住）───────────────────────────────

function fetchWithTimeout(url, options, ms) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

// ── 單一檔案上傳（自動判斷是否需要分塊）──────────────────────────────────────

async function uploadFileTask(task) {
  const bytes       = new Uint8Array(task.bytes);
  const totalChunks = Math.ceil(bytes.length / CHUNK_SZ);

  if (totalChunks <= 1) {
    // 小檔案：單次請求，60 秒 timeout
    const params = new URLSearchParams({
      _type:         'file_only',
      brand:         task.params.brand          || '',
      engineer_name: task.params.engineer_name  || '',
      customer_code: task.params.customer_code  || '',
      fileName:      task.params.fileName,
      mimeType:      task.params.mimeType       || 'application/octet-stream',
    });
    const r = await fetchWithTimeout(CLOUD_URL + '?' + params, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    new Blob([bytes]),
    }, 60000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    return json.fileUrl || null;
  }

  // 大檔案：分塊，每塊 2 分鐘 timeout
  const fileId = 'sw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  let finalUrl  = null;

  for (let i = 0; i < totalChunks; i++) {
    const chunk  = bytes.slice(i * CHUNK_SZ, (i + 1) * CHUNK_SZ);
    const params = new URLSearchParams({
      _type:         'chunk',
      fileId:        fileId,
      fileName:      task.params.fileName,
      mimeType:      task.params.mimeType       || 'application/octet-stream',
      chunkIndex:    i,
      totalChunks:   totalChunks,
      brand:         task.params.brand          || '',
      engineer_name: task.params.engineer_name  || '',
      customer_code: task.params.customer_code  || '',
    });
    const r = await fetchWithTimeout(CLOUD_URL + '?' + params, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    new Blob([chunk]),
    }, 120000);
    if (!r.ok) throw new Error('Chunk ' + i + ' HTTP ' + r.status);
    const json = await r.json();
    if (json.status === 'error') throw new Error(json.message);
    if (i === totalChunks - 1 && json.status === 'success') finalUrl = json.fileUrl;

    await broadcast({ type: 'bg-chunk', name: task.params.fileName, chunk: i + 1, total: totalChunks });
  }
  return finalUrl;
}

// ── 提交表單 ──────────────────────────────────────────────────────────────────

async function submitFormTask(params) {
  const r = await fetchWithTimeout(CLOUD_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ ...params, _type: 'form_submit' }),
  }, 30000);
  if (!r.ok) throw new Error('Form HTTP ' + r.status);
  return r.json();
}

// ── 處理整個佇列 ──────────────────────────────────────────────────────────────

// Mutex：防止 sync 事件 + PROCESS_NOW 訊息同時觸發，導致同一檔案被上傳兩次
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
  const db    = await dbOpen();
  const tasks = await dbGetAll(db);
  if (!tasks.length) return;

  const fileTasks = tasks
    .filter(t => t.taskType === 'file')
    .sort((a, b) => (a.fileIndex || 0) - (b.fileIndex || 0));
  const formTask  = tasks.find(t => t.taskType === 'form');
  const fileUrls  = new Array(fileTasks.length).fill(null);

  await broadcast({ type: 'bg-start', count: fileTasks.length });

  for (let idx = 0; idx < fileTasks.length; idx++) {
    const task = fileTasks[idx];
    try {
      fileUrls[idx] = await uploadFileTask(task);
      await dbDelete(db, task.id);
      await broadcast({ type: 'bg-task-done', name: task.params.fileName, idx, total: fileTasks.length });
    } catch (e) {
      await dbSaveResult(db, { ok: false, error: e.message });
      await broadcast({ type: 'bg-error', name: task.params.fileName, error: e.message });
      throw e; // Background Sync 會在下次連線時自動重試
    }
  }

  if (formTask) {
    const validUrls  = fileUrls.filter(Boolean);
    const formParams = {
      ...formTask.params,
      photoUrlsString: validUrls.length > 0 ? validUrls.join('\n') : '無照片',
    };
    try {
      await submitFormTask(formParams);
      await dbDelete(db, formTask.id);
      await dbSaveResult(db, { ok: true });
      await broadcast({ type: 'bg-all-done' });
    } catch (e) {
      await dbSaveResult(db, { ok: false, error: e.message });
      await broadcast({ type: 'bg-error', name: 'form', error: e.message });
      throw e;
    }
  }
  } finally {
    processing = false;
  }
}

// ── Service Worker 生命週期 ───────────────────────────────────────────────────

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// Background Sync 事件（網路恢復時自動觸發，即使頁面已關閉）
self.addEventListener('sync', event => {
  if (event.tag === 'bg-upload') {
    event.waitUntil(processQueue());
  }
});

// 頁面在前景時可直接通知 SW 立即開始
self.addEventListener('message', event => {
  if (event.data === 'PROCESS_NOW') {
    processQueue();
  }
});
