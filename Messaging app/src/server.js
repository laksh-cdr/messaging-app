const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// MongoDB
const mongoose = require('mongoose');
const mongoURI = {your mongo URI};

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

mongoose.connect(mongoURI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));
const port = 3000;

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  conversations: {
    type: [String],
    default: []
  }
});

const User = mongoose.model('User', userSchema);

const conversationSchema = new mongoose.Schema({
  convId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  users: {
    type: [String],
    default: []
  },
  messages: [
    {
      query: String,
      uName: String,
      timeStamp: {
        type: Date,
        default: Date.now
      }
    }
  ]
});
const Conversation = mongoose.model('Conversation', conversationSchema);

// Creating server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};
const userMap = {};
const conversations = {
  // conv1: {
  //   id: 'conv1',
  //   name: 'Conversation 1',
  //   users: [],
  //   messages: []
  // },
};
app.use(express.json());
app.use(express.static('public'));

// Root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "..", 'public', 'index.html'));
})

// Login and Signup
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, "..", 'public', 'login', 'login.html'));
});


function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), userName: user.userName },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

app.post('/api/signup', async (req, res) => {
  try {
    const { userName, password } = req.body;
    if (!userName || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const normalizedUserName = userName.trim().toLowerCase();
    const existingUser = await User.findOne({ userName: normalizedUserName });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      userName: normalizedUserName,
      passwordHash,
      conversations: []
    });

    const token = signToken(user);
    res.json({ token, user: { userName: user.userName } });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { userName, password } = req.body;
    if (!userName || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const normalizedUserName = userName.trim().toLowerCase();
    const user = await User.findOne({ userName: normalizedUserName });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: { userName: user.userName } });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});


io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
})


// On Connect
io.on('connect', async (socket) => {
  const id = socket.id;
  const userName = socket.user.userName;

  const user = await User.findOne({ userName });
  if (!user) {
    socket.disconnect(true);
    return;
  }

  users[id] = { name: userName };
  userMap[id] = userName;
  socket.join(userName);

  const convs = await Conversation.find({
    convId: { $in: user.conversations }
  });

  socket.emit('updateConvs', convs);
  socket.emit('connected', socket.id);

  // Registering users
  socket.on('register', async (userName) => {
    if (!userName) return;
    userName = userName.trim().toLowerCase();
    let user = await User.findOne({ userName });

    if (!user) {
      user = new User({
        userName,
        conversations: []
      });
      await user.save();
    }
    
    userMap[socket.id] = userName;
    users[socket.id] = users[socket.id] || {};

    const convs = await Conversation.find({
      convId: { $in: user.conversations }
    })

    socket.join(userName);

    users[socket.id].name = userName;
    io.to(userName).emit('updateUser', users[socket.id]);
    io.to(userName).emit('updateConvs', convs);
  })

    // Adding a new conversation Checking if a conversation of that id exist or not
  socket.on('addConv', async ({input, userNames}) => {
    const userName = socket.user?.userName || userMap[socket.id];
    if (!userName) return;
    const convId = 'conv_' + Date.now();

    const conv = new Conversation({
      convId,
      name: input || 'New Conversation',
      users: [userName],
      messages: []
    })

    await conv.save();
    await User.updateOne(
      {userName},
      {$push: {conversations: convId}}
    )

    const updatedUser = await User.findOne({ userName });
    if (!updatedUser) return;
    const updatedConvs = await Conversation.find({
      convId: { $in: updatedUser.conversations }
    });

    socket.join(convId);

    io.to(userName).emit('updateConvs', updatedConvs);
    io.to(userName).emit('infoMsg', 'Conversation created successfully!');
  })

  // Joining an existing conversation
  socket.on('joinConv', async({input, uName}) => {
    const conversation = await Conversation.findOne({ convId: input });

    if (!conversation) return;
    if (conversation.users.includes(userName)) return;

    conversation.users.push(userName);
    user.conversations.push(input);

    socket.join(input);
    await user.save();
    await conversation.save();

    const updatedConvs = await Conversation.find({
      convId: { $in: user.conversations }
    });

    socket.emit('updateConvs', updatedConvs);
    io.to(userName).emit('infoMsg', 'Successfully joined the conversation!');
  })

  // Leaving / deleting a conversation for the current user
  socket.on('deleteConv', async ({ convId }) => {
    const userName = socket.user?.userName || userMap[socket.id];
    if (!userName || !convId) return;

    const user = await User.findOne({ userName });
    const conversation = await Conversation.findOne({ convId });

    if (!user || !conversation) return;

    conversation.users = conversation.users.filter((name) => name !== userName);
    user.conversations = user.conversations.filter((id) => id !== convId);

    await user.save();

    if (conversation.users.length === 0) {
      await Conversation.deleteOne({ convId });
    } else {
      await conversation.save();
    }

    socket.leave(convId);

    const updatedConvs = await Conversation.find({
      convId: { $in: user.conversations }
    });

    if (socket.joinedConv === convId) {
      socket.joinedConv = null;
    }

    socket.emit('updateConvs', updatedConvs);
    socket.emit('infoMsg', 'Conversation deleted successfully!');
  })
  
  // Sending conversations of user to client
  socket.on("getConvs", async () => {
    const userName = socket.user?.userName || userMap[socket.id];
    if (!userName) return;

    const user = await User.findOne({ userName });

    if (!user) return;

    const convs = await Conversation.find({
      convId: { $in: user.conversations }
    });

    socket.emit("updateConvs", convs);
  });
  
  // Load messages of conversation
  socket.on('getMsgs', async ({convId, uName}) => {
    const userName = socket.user?.userName || userMap[socket.id];
    if (!userName) return;

    const conv = await Conversation.findOne({ convId });
    if (!conv) return;
    if (!conv.users.includes(userName)) return;

    socket.join(convId);
    socket.emit('getMsgs', conv.messages);
  })

  // Emmitting users and id of current user
  socket.emit('connected', id);

  socket.on('query', async ({q, uName, conv}) => {
    const userName = socket.user.userName;
    if (!userName) return;

    const message = {
      query: q,
      uName: userName,
      conv: conv
    };
    
    const conversation = await Conversation.findOne({ convId: conv });
    
    if (!conversation) return;
    if (!conversation.users.includes(userName)) return;

    conversation.messages.push(message);
    await conversation.save();
    io.to(conv).emit('getQuery', { ...message, conv});
  })
  
  // On Disconnect
  socket.on('disconnect', () => {
    let user = users[id];
    if (user !== -1) {
      delete users[id];
    }
    if (userMap[socket.id]) {
      delete userMap[socket.id];
    }
    io.emit('update', users);
  })

});


// function createNewConversation(convId) {
//   conversations[convId] = {
//     id: convId,
//     name: `Conversation ${convId}`,
//     users: [],
//     messages: []
//   }
// }

server.listen(port);
