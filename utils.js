require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto-js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

let mongoDBClient;

async function connectToMongoDB() {
  mongoDBClient = new MongoClient(process.env.MONGODB);
  try {
    await mongoDBClient.connect();
    console.log('✅ Connected to MongoDB');
    await initCollections();
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err);
    throw err;
  }
}

async function initCollections() {
  const db = await getDatabase();
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  await db.collection('portfolios').createIndex({ userId: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

const dbName = 'PaperTrade';

async function getDatabase() {
  return mongoDBClient.db(dbName);
}

function decryptData(encryptedData) {
  const bytes = crypto.AES.decrypt(encryptedData, process.env.ENCRK);
  return bytes.toString(crypto.enc.Utf8);
}

function encryptData(data) {
  return crypto.AES.encrypt(JSON.stringify(data), process.env.ENCRK).toString();
}

async function login({ username, password }) {
  try {
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ username });
    const decryptedPassword = JSON.parse(decryptData(user.password))

    if(!user || decryptedPassword != password) {
      return null;
    }

    // Create session  token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await db.collection('sessions').insertOne({
      token,
      userId: user._id,
      expiresAt,
      createdAt: new Date()
    });

    return { 
      token,
      userId: user._id.toString(),
      username: user.username
    };
  } catch (err) {
    console.error('Login error:', err);
    return null;
  }
}

async function validateSession(token) {
  try {
    const db = await getDatabase();
    const session = await db.collection('sessions').findOne({ 
      token,
      expiresAt: { $gt: new Date() }
    });
    
    if (!session) return null;
    return session.userId;
  } catch (err) {
    console.error('Session validation error:', err);
    return null;
  }
}

async function createAccount({ username, password }) {
  try {
    const db = await getDatabase();
    const result = await db.collection('users').insertOne({
      username,
      password: encryptData(password),
      balance: 100, // Starting balance
      createdAt: new Date()
    });

    await db.collection('portfolios').insertOne({
      userId: result.insertedId,
      tokens: {},
      updatedAt: new Date()
    });

    return result.insertedId;
  } catch (err) {
    console.error('Account creation error:', err);
    return null;
  }
}

async function getTokenPrice(tokenMint) {
  const response = await axios.get('https://lite-api.jup.ag/price/v2', {
    params: {
      ids: tokenMint,
      vsToken: 'So11111111111111111111111111111111111111112'
    }
  });
  return response.data?.data?.[tokenMint]?.price;
}

async function calculateTokenPurchase(tokenMint, solAmount, slippage = 2, fee = 0.1) {
  const tokenPrice = await getTokenPrice(tokenMint);
  if (!tokenPrice) throw new Error('Token price not found');

  const effectivePrice = tokenPrice * (1 + (slippage / 100));
  const feeAmount = solAmount * (fee / 100);
  const tokensBought = (solAmount - feeAmount) / effectivePrice;

  return { tokensBought, feeAmount, effectivePrice };
}

async function calculateTokenSale(tokenMint, tokenAmount, slippage = 2, fee = 0.1) {
  const tokenPrice = await getTokenPrice(tokenMint);
  if (!tokenPrice) throw new Error('Token price not found');

  const effectivePrice = tokenPrice * (1 - (slippage / 100));
  const grossSol = tokenAmount * effectivePrice;
  const feeAmount = grossSol * (fee / 100);
  const netSol = grossSol - feeAmount;

  return { netSol, feeAmount, effectivePrice };
}

async function updatePortfolio(userId, tokenMint, amount, isBuy) {
  const db = await getDatabase();
  const update = isBuy 
    ? { $inc: { [`tokens.${tokenMint}`]: amount } }
    : { $inc: { [`tokens.${tokenMint}`]: -amount } };

  await db.collection('portfolios').updateOne(
    { userId: userId },
    update,
    { upsert: true }
  );
}

async function updateBalance(userId, amount, isDeposit) {
  const db = await getDatabase();

  const update = isDeposit
    ? { $inc: { balance: amount } }
    : { $inc: { balance: -amount } };

    const result = await db.collection('users').updateOne(
      { _id: userId },  // Fixed filter
      update  // Direct atomic operator
    );
  
    if (result.modifiedCount === 0) {
      throw new Error("Balance update failed - user not found");
    }
}

async function setBalance(userId, amount) {
  const db = await getDatabase();
  const result = await db.collection('users').updateOne(
    { _id: userId },
    { $set: { balance: amount } }
  );
  
  if (result.modifiedCount === 0) {
    throw new Error("Balance update failed - user not found");
  }
}

async function getPortfolio(userId) {
  const db = await getDatabase();
  const [user, portfolio] = await Promise.all([
    db.collection('users').findOne({ _id: userId }),
    db.collection('portfolios').findOne({ userId: userId })
  ]);

  return {
    solBalance: user?.balance || 0,
    tokens: portfolio?.tokens || {}
  };
}

async function resetPortfolio(userId) {
  try {
    const db = await getDatabase();
    
    await db.collection('portfolios').updateOne(
      { userId: userId },
      { $set: { tokens: {}, updatedAt: new Date() } }
    );
    
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { balance: 100 } }
    );
    
    return await getPortfolio(userId);
  } catch (err) {
    console.error('Reset portfolio error:', err);
    throw err;
  }
}

module.exports = {
  connectToMongoDB,
  login,
  createAccount,
  calculateTokenPurchase,
  calculateTokenSale,
  updatePortfolio,
  updateBalance,
  getPortfolio, 
  validateSession,
  resetPortfolio,
  setBalance
};