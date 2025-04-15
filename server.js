require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto-js');

// MongoDB connection setup
let mongoDBClient;

async function connectToMongoDB() {
  mongoDBClient = new MongoClient(process.env.MONGODB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await mongoDBClient.connect();
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err);
    throw err;
  }
}
const dbName = 'PaperTrade';

async function getDatabase() {
  return mongoDBClient.db(dbName);
}

// Decrypt password for login
async function decryptData(encryptedData) {
  const bytes = crypto.AES.decrypt(encryptedData, process.env.ENCRK);
  const decrypted = bytes.toString(crypto.enc.Utf8);
  return JSON.parse(decrypted);
}

// Encrypt password for account creation
async function encryptData(data) {
  return crypto.AES.encrypt(JSON.stringify(data), process.env.ENCRK).toString();
}

// Login functionality
async function login({ username, password }) {
  try {
    if (!mongoDBClient) await connectToMongoDB();
    const db = await getDatabase();
    const usersCollection = db.collection('loginInfo');

    const user = await usersCollection.findOne({ username });
    if (!user) {
      console.log('❌ User not found');
      return false;
    }

    const decryptedStoredPassword = await decryptData(user.password);
    if (decryptedStoredPassword !== password) {
      console.log('❌ Invalid password');
      return false;
    }

    console.log('✅ Login successful');
    return user;

  } catch (err) {
    console.error('❌ Login error:', err);
    return false;
  }
}

// Create account functionality
async function createAccount({ username, password }) {
  try {
    if (!mongoDBClient) await connectToMongoDB();
    const db = await getDatabase();
    const usersCollection = db.collection('loginInfo');

    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      console.log('❌ Username already taken');
      return false;
    }

    const encryptedPassword = await encryptData(password);

    const userData = {
      username,
      password: encryptedPassword,
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(userData);
    console.log('✅ Account created:', result.insertedId);
    return true;

  } catch (err) {
    console.error('❌ Error creating account:', err);
    return false;
  }
}

// Express server setup
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());  // Middleware to parse JSON requests

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await login({ username, password });
  if (result) {
    res.status(200).json(result);
  } else {
    res.status(401).send('Invalid username or password');
  }
});

// Create account route
app.post('/api/create-account', async (req, res) => {
  const { username, password } = req.body;
  const result = await createAccount({ username, password });
  if (result) {
    res.status(201).send('Account created successfully');
  } else {
    res.status(400).send('Username already taken');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
