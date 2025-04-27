require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto-js');
const axios = require('axios');

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
    const decryptPassword = decryptData(user.password)
    console.log(decryptPassword,password)
    if(decryptPassword != password)
      return { _id: user._id, username: user.username };
  } catch (err) {
    console.error('Login error:', err);
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
    { userId: new ObjectId(userId) },
    update,
    { upsert: true }
  );
}

async function updateBalance(userId, amount, isDeposit) {
  const db = await getDatabase();
  const update = isDeposit
    ? { $inc: { balance: amount } }
    : { $inc: { balance: -amount } };

  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    update
  );
}

async function getPortfolio(userId) {
  const db = await getDatabase();
  const [user, portfolio] = await Promise.all([
    db.collection('users').findOne({ _id: new ObjectId(userId) }),
    db.collection('portfolios').findOne({ userId: new ObjectId(userId) })
  ]);

  return {
    solBalance: user?.balance || 0,
    tokens: portfolio?.tokens || {}
  };
}

module.exports = {
  connectToMongoDB,
  login,
  createAccount,
  calculateTokenPurchase,
  calculateTokenSale,
  updatePortfolio,
  updateBalance,
  getPortfolio
};