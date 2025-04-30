const axios = require('axios');
require('dotenv').config();
const { getPumpFunPrice } = require('./utils')
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  username: 'testtrader',
  password: 'testpassword123'
};
const TEST_TOKENS = {
  COIN1: 'EqxkbawiqXvqbHbPPQK14o9Mn2ZHdujjq9xuS3V4pump',
  COIN2: 'J8dRS5coBftCrhVcbH93cZq748jTBVp4ErtWgbnbpump'
};

let userId;
let authToken;

async function createAccount() {
  try {
    console.log('🆕 Creating test account...');
    const response = await axios.post(`${API_BASE_URL}/create-account`, TEST_USER);
    userId = response.data._id;
    console.log('✅ Account created:', userId);
    return true;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('ℹ️ Account already exists');
      return true;
    }
    console.error('❌ Account creation failed:', error.response?.data || error.message);
    return false;
  }
}

async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/login`, TEST_USER);
    userId = response.data.userId;
    authToken = response.data.token; // 🛡️ Save the session token!
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

function authHeader() {
  return {
    headers: {
      Authorization: `Bearer ${authToken}`,
    }
  };
}

async function getPortfolio() {
  try {
    const response = await axios.get(`${API_BASE_URL}/portfolio/${userId}`, authHeader());
    console.log('💰 Portfolio:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get portfolio:', error.response?.data || error.message);
    return null;
  }
}

async function resetWallet() {
  try {
    const response = await axios.get(`${API_BASE_URL}/reset/${userId}`, authHeader());
    console.log('Wallet Reseted:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to reset.:', error.response?.data || error.message);
    return null;
  }
}

async function setWallet(amount = 1000) {
  try {
    const response = await axios.post(`${API_BASE_URL}/set-balance`, {
      amount
    }, authHeader());
    
    console.log('💰 New balance:', response.data.newBalance);
    console.log(response.data.message);
    return response.data.success;
  } catch (error) {
    console.error('❌ Failed to set balance:', error.response?.data || error.message);
    return null;
  }
}

async function testBuy(tokenMint, solAmount, slippage = 2, fee = 0.1) {
  try {
    console.log(`\n🛒 Buying ${solAmount} SOL of ${tokenMint.substring(0, 10)}...`);
    const response = await axios.post(`${API_BASE_URL}/buy`, {
      tokenMint,
      solAmount,
      slippage,
      fee
    }, authHeader());
    console.log('✅ Buy successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Buy failed:', error.response?.data || error.message);
    return null;
  }
}

async function testSell(tokenMint, tokenAmount, slippage = 2, fee = 0.1) {
  try {
    console.log(`\n💰 Selling ${tokenAmount} of ${tokenMint.substring(0, 10)}...`);
    const response = await axios.post(`${API_BASE_URL}/sell`, {
      tokenMint,
      tokenAmount,
      slippage,
      fee
    }, authHeader());
    console.log('✅ Sell successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Sell failed:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting trading tests...');
  
  // await createAccount(); // Uncomment if you want auto-creation
  if (!(await login())) return;


  const buy1 = await testBuy(TEST_TOKENS.COIN1, 0.5);
  await getPortfolio();


  const buy2 = await testBuy(TEST_TOKENS.COIN2, 0.3, 3, 0.5);
  
  await getPortfolio();
  if (buy1) await testSell(TEST_TOKENS.COIN1, buy1.tokensReceived / 2);
  if (buy2) await testSell(TEST_TOKENS.COIN2, buy2.tokensReceived / 2, 1.5, 0.2);
  
  await getPortfolio();

  console.log('\n🏁 All tests completed');


  await resetWallet();
  await setWallet()
}

// runTests().catch(err => {
//   console.error('🔥 Test suite failed:', err);
// });

const TOKEN_MINT = 'DwtbAzwg5PkRMarRHjFTBGHq7HW3AnMPWmW5wQ917WAZ';

getPumpFunPrice(TOKEN_MINT)
  .then(priceData => {
    if (priceData) {
      console.log(`Last ${priceData.type} price: ${priceData.price} SOL`);
      console.log(`Transaction: https://solscan.io/tx/${priceData.signature}`);
    }
  });