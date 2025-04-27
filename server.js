require('dotenv').config();
const express = require('express');
const { ObjectId } = require('mongodb');
const utils = require('./utils');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Auth endpoints
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await utils.login({ username, password });
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    _id: user._id,
    username: user.username
  });
});

app.post('/api/create-account', async (req, res) => {
  const { username, password } = req.body;
  const userId = await utils.createAccount({ username, password });

  if (!userId) {
    return res.status(400).json({ error: 'Account creation failed' });
  }

  res.status(201).json({ _id: userId, username });
});

// Trading endpoints
app.post('/api/buy', async (req, res) => {
  try {
    const { userId, tokenMint, solAmount, slippage = 2, fee = 0.1 } = req.body;
    
    if (!ObjectId.isValid(userId) || !tokenMint || !solAmount || solAmount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const { tokensBought, feeAmount } = await utils.calculateTokenPurchase(
      tokenMint, solAmount, slippage, fee
    );

    await Promise.all([
      utils.updatePortfolio(userId, tokenMint, tokensBought, true),
      utils.updateBalance(userId, solAmount, false)
    ]);

    res.json({
      success: true,
      tokensReceived: tokensBought,
      solSpent: solAmount,
      fees: { protocol: feeAmount, slippage: `${slippage}%` }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/sell', async (req, res) => {
  try {
    const { userId, tokenMint, tokenAmount, slippage = 2, fee = 0.1 } = req.body;
    
    if (!ObjectId.isValid(userId) || !tokenMint || !tokenAmount || tokenAmount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const { netSol, feeAmount } = await utils.calculateTokenSale(
      tokenMint, tokenAmount, slippage, fee
    );

    await Promise.all([
      utils.updatePortfolio(userId, tokenMint, tokenAmount, false),
      utils.updateBalance(userId, netSol, true)
    ]);

    res.json({
      success: true,
      solReceived: netSol,
      tokensSold: tokenAmount,
      fees: { protocol: feeAmount, slippage: `${slippage}%` }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Portfolio endpoint
app.get('/api/portfolio/:userId', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const portfolio = await utils.getPortfolio(req.params.userId);
    res.json(portfolio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start server
utils.connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});