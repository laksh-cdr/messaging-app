// const socket = io();

let fUsers = [];
let currentId = "";
let selectedConv = '';
let myConversations = {};

const storedUserName = localStorage.getItem('userName');
if (!storedUserName) {
  window.location.replace('/login');
}

let userName = storedUserName ? storedUserName.trim().toLowerCase() : '';

// Query
const queryInp = document.getElementById("queryInp");
let query = "";

// Send Button
const sendBtn = document.querySelector(".sendBtn");

// Display Text
const uid = document.querySelector(".uid");
let uidText = "";

// Message Container
const messageContainer = document.querySelector('.messageContainer');

// Conversations
const convs = document.querySelectorAll('.conv');
const convContainer = document.querySelector('.convs');

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}
const socket = io({
  auth: { token }
})

// Getting query
queryInp.addEventListener("input", (e) => {
  query = queryInp.value;
});

// Assigning current Id;
socket.on("connected", (id) => {
  currentId = id;
});

if (userName) {
  socket.emit('register', userName);
}

// Getting messages of conversation
socket.on('getMsgs', (messages) => {
  messages.forEach(({query, uName}) => {
    appendTextMessage(messageContainer, query, uName === userName ? 'self': 'other');
  })
})

socket.on('updateUser', (user) => {
  convContainer.innerHTML = '';
  const conversations = user.conversations;

  conversations.forEach(conv => {
    const convDiv = document.createElement('div');
    convDiv.classList.add('conv');
    convDiv.id = conv;
    convDiv.innerHTML = `<span>${conv}</span>`;
    convContainer.appendChild(convDiv);
  })
})

// Getting conversations of user
socket.on('updateConvs', (conversations) => {
  const myConvs = Object.values(conversations).filter(conv => conv.users.includes(userName));

  myConversations = conversations;

  convContainer.innerHTML = '';

  myConversations.forEach(myConv => {
    const convDiv = document.createElement('div');
    if (myConv.convId === selectedConv) {
      convDiv.classList.add('active');
    }

    const span = document.createElement('span');
    span.className = 'convName';
    span.textContent = myConv.name;
    
    convDiv.appendChild(span);
    convDiv.classList.add('conv');
    convDiv.id = myConv.convId;
    convDiv.innerHTML = `
    <span class="convName">${myConv.name}</span>
    <span class="options material-symbols-outlined">more_vert</span>
    `;
    convContainer.appendChild(convDiv);
  });
})

// Getting query from other users
socket.on('getQuery', (message) => {
  if (message.conv !== selectedConv) return;
  const messageDiv = document.createElement('div');

  // If the query is from self, then add self class else add other class
  if (message.uName === userName) {
    messageDiv.classList.add('message', 'self');
  } else {
    messageDiv.classList.add('message', 'other');
  }
  messageDiv.innerHTML = `<span>${message.query}</span>`;

  messageContainer.appendChild(messageDiv);
})


// Sending queries
sendBtn.addEventListener('click', (e) => {
  sendQuery()
})

queryInp.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendQuery();
  }
})

function sendQuery() {
  if (query === '') return;
  if (selectedConv === '') return;
  socket.emit('query', {q: query, uName: userName, conv: selectedConv});

  queryInp.value = '';
  query = '';
}

// -*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
// Handling other functions
const addConvPopup = document.querySelector('.newConv');
const closeBtn = document.querySelector('.closeBtn');
const convPopup = document.querySelector('.addConvPopup');
const addBtn = document.querySelector('.addBtn');
const popupTitle = convPopup.querySelector('.title');
const inp = document.querySelector('#convIdInp');

const joinBtn = document.querySelector('.joinConv');

const convOptionBtn = document.querySelectorAll('.conv .options');
const optionMenu = document.querySelector('.optionsMenu');
const deleteConv = document.querySelector('.deleteConv');
const copyConvId = document.querySelector('.copyConvId');

// Info Message
const infoMsg = document.querySelector('.infoMsg');
const infoText = infoMsg.querySelector('.msg');

socket.on('infoMsg', (msg) => {
  infoMessage(msg);
})

infoMsg.addEventListener('click', () => {
  infoMsg.style.opacity = '0';
  infoMsg.style.display = 'none';
})

closeBtn.addEventListener('click', () => {
  convPopup.style.display = 'none';
})

addConvPopup.addEventListener('click', () => {
  convPopup.style.display = 'flex';
  popupTitle.innerHTML = 'Create Conversation';
  inp.placeholder = 'Enter conversation name...'
})

addBtn.addEventListener('click', () => {
  const input = inp.value;
  if (popupTitle.innerHTML === 'Create Conversation') {
  socket.emit('addConv', {input, userName});
  } else if (popupTitle.innerHTML === 'Join Conversation') {
    socket.emit('joinConv', {input, userName});
  }
})

convContainer.addEventListener('click', (e) => {
  const optionBtn = e.target.closest('.options');
  if (optionBtn) {
    e.stopPropagation();
    const convId = optionBtn.parentElement.id;
    const rect = optionBtn.getBoundingClientRect();
    optionMenu.id = convId;
    optionMenu.style.display = 'block';
    optionMenu.style.top = `${rect.bottom + 6}px`;
    optionMenu.style.left = `${rect.right - 16}px`;
  }

  const conv = e.target.closest('.conv');
  if (!conv) return;
  if (e.target.closest('.options')) return;
  
  document.querySelectorAll('.conv').forEach(conv => conv.classList.remove('active'));

  conv.classList.add('active');
  sendBtn.classList.remove('disabled');

  if (selectedConv === conv.id) return;
  messageContainer.innerHTML = '';
  selectedConv = conv.id;
  socket.emit('getMsgs', {convId: selectedConv, uName: userName});
})

joinBtn.addEventListener('click', (e) => {
  convPopup.style.display = 'flex';
  popupTitle.innerHTML = 'Join Conversation';
  inp.placeholder = 'Enter conversation id...'
})

document.addEventListener('click', (e) => {
  if (!e.target.closest('.optionsMenu') && !e.target.closest('.options')) {
    optionMenu.style.display = 'none';
    optionMenu.id = '';
  }
})

copyConvId.addEventListener('click', async (e) => {
  const parent = e.target.closest('.optionsMenu');
  const id = parent.id;
  try {
    await navigator.clipboard.writeText(id);
    console.log('text copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy: ', err);
  }

  optionMenu.style.display = 'none';
  infoMessage('Conversation Id copied to clipboard!');
})

deleteConv.addEventListener('click', () => {
  const convId = optionMenu.id;
  if (!convId) return;

  socket.emit('deleteConv', { convId });

  if (selectedConv === convId) {
    selectedConv = '';
    messageContainer.innerHTML = '<p>NO CONVERSATION SELECTED!</p>';
    sendBtn.classList.add('disabled');
  }

  optionMenu.style.display = 'none';
  optionMenu.id = '';
})

// Functions

function appendTextMessage(container, text, className) {
  const message = document.createElement('div');
  message.classList.add('message', className);

  const span = document.createElement('span');
  span.textContent = text;

  message.appendChild(span);
  container.appendChild(message);
}


function infoMessage(msg) {
  infoText.textContent = msg;
  infoMsg.style.display = 'block';
  infoMsg.style.opacity = '1';

  setTimeout(() => {
    infoMsg.style.opacity = '0';
    infoMsg.style.display = 'none';
  }, 4000);
}
