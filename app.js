/* ============================================================
   GHOSTCHAT — app.js  (Socket.io real-time version)
   ============================================================ */

/* ---- Identity ---- */
const AVATAR_POOL = [
  { e: '🐺', bg: '#1e1b4b' }, { e: '🦊', bg: '#1f1007' },
  { e: '🐸', bg: '#052e16' }, { e: '🦋', bg: '#1f0a0a' },
  { e: '🐙', bg: '#0c1a35' }, { e: '🦄', bg: '#2e1065' },
  { e: '🐉', bg: '#042f2e' }, { e: '🦁', bg: '#1c1003' },
];
const CODENAMES = ['Shadow','Ghost','Phantom','Cipher','Wraith','Specter','Veil','Mist','Echo','Void','Raven','Neon'];

const myAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
const myName   = 'Anon ' + CODENAMES[Math.floor(Math.random() * CODENAMES.length)];
let   currentRoom = 'general';

/* ---- DOM ---- */
const messagesEl   = document.getElementById('messages');
const msgInput     = document.getElementById('msgInput');
const sendBtn      = document.getElementById('sendBtn');
const typingWrap   = document.getElementById('typingWrap');
const modNotice    = document.getElementById('modNotice');
const onlineCount  = document.getElementById('onlineCount');
const menuBtn      = document.getElementById('menuBtn');
const sidebar      = document.getElementById('sidebar');
const overlay      = document.getElementById('overlay');
const sidebarClose = document.getElementById('sidebarClose');
const emojiToggle  = document.getElementById('emojiToggle');
const quickEmojis  = document.getElementById('quickEmojis');
const shareBtn     = document.getElementById('shareBtn');
const shareToast   = document.getElementById('shareToast');
const createRoomBtn    = document.getElementById('createRoomBtn');
const createRoomForm   = document.getElementById('createRoomForm');
const createRoomSubmit = document.getElementById('createRoomSubmit');
const createRoomCancel = document.getElementById('createRoomCancel');
const roomNameInput    = document.getElementById('roomNameInput');

/* ---- Set identity ---- */
document.getElementById('myAvatarSidebar').textContent = myAvatar.e;
document.getElementById('myAvatarSidebar').style.background = myAvatar.bg;
document.getElementById('myNameSidebar').textContent = myName;

/* ---- Socket.io ---- */
const socket = io();

socket.on('connect', () => {
  // Check URL for room param
  const urlRoom = new URLSearchParams(window.location.search).get('room') || 'general';
  joinRoom(urlRoom);
});

socket.on('history', (msgs) => {
  clearMessages();
  if (msgs.length === 0) showWelcome();
  else msgs.forEach(m => renderMessage(m));
});

socket.on('message', (msg) => {
  removeWelcome();
  renderMessage(msg);
});

socket.on('user-count', (count) => {
  onlineCount.textContent = count;
});

socket.on('moderated', (data) => {
  modNotice.style.display = 'flex';
  setTimeout(() => modNotice.style.display = 'none', 5000);
});

socket.on('reaction', (data) => {
  updateReaction(data.msgId, data.emoji, data.delta);
});

/* ---- Join room ---- */
function joinRoom(room) {
  currentRoom = room;
  socket.emit('join-room', room);
  document.getElementById('currentRoom').textContent = room;
  document.querySelectorAll('.room-item').forEach(b => {
    b.classList.toggle('active', b.dataset.room === room);
  });
  document.querySelectorAll('.wroom').forEach(el => el.textContent = room);
}

/* ---- Room switching ---- */
document.getElementById('roomList').addEventListener('click', (e) => {
  const btn = e.target.closest('.room-item');
  if (!btn) return;
  joinRoom(btn.dataset.room);
  if (window.innerWidth <= 680) closeSidebar();
});

/* ---- Create room ---- */
createRoomBtn.addEventListener('click', () => {
  createRoomForm.style.display = createRoomForm.style.display === 'none' ? 'block' : 'none';
  if (createRoomForm.style.display === 'block') roomNameInput.focus();
});
createRoomCancel.addEventListener('click', () => { createRoomForm.style.display = 'none'; roomNameInput.value = ''; });

createRoomSubmit.addEventListener('click', async () => {
  const name = roomNameInput.value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.slug) {
      addRoomToSidebar(data.slug, true);
      joinRoom(data.slug);
      createRoomForm.style.display = 'none';
      roomNameInput.value = '';
      if (window.innerWidth <= 680) closeSidebar();
    }
  } catch (e) { console.error(e); }
});

roomNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createRoomSubmit.click(); });

function addRoomToSidebar(slug, switchTo = false) {
  if (document.querySelector(`[data-room="${slug}"]`)) return;
  const btn = document.createElement('button');
  btn.className = 'room-item custom-room';
  btn.dataset.room = slug;
  btn.innerHTML = `<span class="room-hash">#</span> ${slug} <span class="room-badge" id="badge-${slug}">0</span>`;
  document.getElementById('roomList').appendChild(btn);
}

/* ---- Share room ---- */
shareBtn.addEventListener('click', () => {
  const url = `${window.location.origin}?room=${currentRoom}`;
  navigator.clipboard.writeText(url).then(() => {
    shareToast.style.display = 'block';
    setTimeout(() => shareToast.style.display = 'none', 3000);
  });
});

/* ---- Sidebar ---- */
menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('visible'); });
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }
sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

/* ---- Emoji ---- */
emojiToggle.addEventListener('click', () => { quickEmojis.style.display = quickEmojis.style.display === 'none' ? 'flex' : 'none'; });
quickEmojis.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => { msgInput.value += btn.textContent; msgInput.focus(); quickEmojis.style.display = 'none'; });
});

/* ---- Input ---- */
msgInput.addEventListener('input', () => { msgInput.style.height = 'auto'; msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px'; });
msgInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
sendBtn.addEventListener('click', handleSend);

/* ---- Send ---- */
function handleSend() {
  const text = msgInput.value.trim();
  if (!text) return;
  msgInput.value = '';
  msgInput.style.height = 'auto';
  quickEmojis.style.display = 'none';

  socket.emit('message', { text, avatar: myAvatar, name: myName });

  if (/@AI\b/i.test(text)) {
    const question = text.replace(/@AI\b/gi, '').trim() || text;
    askAI(question);
  }
}

/* ---- AI ---- */
async function askAI(question) {
  typingWrap.style.display = 'flex';
  messagesEl.scrollTop = messagesEl.scrollHeight;
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    typingWrap.style.display = 'none';
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    socket.emit('message', { text: data.answer, avatar: { e: '🤖', bg: '#2e1065' }, name: 'GhostAI', isAI: true });
  } catch {
    typingWrap.style.display = 'none';
    renderLocalAIError();
  }
}

function renderLocalAIError() {
  renderMessage({ id: 'err-' + Date.now(), text: '⚠️ AI is unavailable right now.', name: 'GhostAI', avatar: { e: '🤖', bg: '#2e1065' }, isAI: true, time: new Date().toISOString(), reactions: {} });
}

/* ---- Render message ---- */
let msgCount = 0;
function renderMessage(msg) {
  removeWelcome();
  const isMine = msg.name === myName;
  const isAI   = msg.isAI || msg.name === 'GhostAI';
  const time   = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const av     = msg.avatar || { e: '👤', bg: '#1a2a43' };

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMine ? ' mine' : '');
  row.id = 'msgrow-' + msg.id;
  row._reactions = msg.reactions || {};

  const avatarStyle = isAI ? '' : `background:${av.bg}`;
  const avatarClass = isAI ? 'msg-avatar ai-avatar' : 'msg-avatar';
  const bubbleClass = isAI ? 'msg-bubble ai-bubble' : 'msg-bubble';
  const aiLabel     = isAI ? '<div class="ai-label">✦ AI Response</div>' : '';
  const highlighted = msg.text.replace(/@AI\b/gi, '<span class="mention-ai">@AI</span>');

  row.innerHTML = `
    <div class="${avatarClass}" style="${avatarStyle}">${av.e}</div>
    <div class="msg-content">
      <div class="msg-meta">
        <span class="msg-name">${msg.name}</span>
        <span class="msg-time">${time}</span>
      </div>
      <div class="${bubbleClass}">${aiLabel}${highlighted}</div>
      <div class="reactions-row" id="rr-${msg.id}">
        <button class="add-react" onclick="openPicker('${msg.id}')">＋</button>
      </div>
      <div class="react-picker" id="picker-${msg.id}">
        ${['👍','❤️','😂','😮','🔥','💯','✨','👀','😭','💀','🙌','🤯'].map(e =>
          `<button onclick="sendReaction('${msg.id}','${e}')">${e}</button>`
        ).join('')}
      </div>
    </div>`;

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---- Reactions ---- */
window.openPicker = (id) => {
  document.querySelectorAll('.react-picker').forEach(p => { if (p.id !== 'picker-' + id) p.classList.remove('open'); });
  document.getElementById('picker-' + id)?.classList.toggle('open');
};

window.sendReaction = (msgId, emoji) => {
  socket.emit('reaction', { msgId, emoji, delta: 1 });
  document.getElementById('picker-' + msgId)?.classList.remove('open');
};

function updateReaction(msgId, emoji, delta) {
  const row = document.getElementById('msgrow-' + msgId);
  if (!row) return;
  if (!row._reactions[emoji]) row._reactions[emoji] = 0;
  row._reactions[emoji] = Math.max(0, row._reactions[emoji] + delta);
  refreshReactions(msgId, row._reactions);
}

function refreshReactions(msgId, reactions) {
  const bar = document.getElementById('rr-' + msgId);
  if (!bar) return;
  let html = '';
  Object.entries(reactions).forEach(([e, c]) => {
    if (c > 0) html += `<button class="react-btn" onclick="sendReaction('${msgId}','${e}')">${e} ${c}</button>`;
  });
  html += `<button class="add-react" onclick="openPicker('${msgId}')">＋</button>`;
  bar.innerHTML = html;
}

document.addEventListener('click', e => {
  if (!e.target.closest('.add-react') && !e.target.closest('.react-picker')) {
    document.querySelectorAll('.react-picker').forEach(p => p.classList.remove('open'));
  }
});

/* ---- Welcome / clear ---- */
function showWelcome() {
  if (document.querySelector('.welcome-msg')) return;
  const div = document.createElement('div');
  div.className = 'welcome-msg';
  div.innerHTML = `<div class="welcome-icon">👻</div><p>Welcome to <strong>#<span class="wroom">${currentRoom}</span></strong></p><p class="welcome-sub">Send a message to get started. You're completely anonymous.</p>`;
  messagesEl.appendChild(div);
}
function removeWelcome() { document.querySelector('.welcome-msg')?.remove(); }
function clearMessages() { messagesEl.innerHTML = ''; }