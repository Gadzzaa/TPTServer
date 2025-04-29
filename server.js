require('dotenv').config();
const express = require('express');
const { ObjectId } = require('mongodb');
const utils = require('./utils');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  const userId = await utils.validateSession(token);

  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = userId;
  next();
}

// Auth endpoints
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await utils.login({ username, password });

  if (!result) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    token: result.token,
    userId: result.userId,
    username: result.username
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
app.post('/api/buy', authenticate, async (req, res) => {
  try {
    const { tokenMint, solAmount, slippage = 2, fee = 0.1 } = req.body;
    const userId = req.userId;

    if (!tokenMint || !solAmount || solAmount <= 0) {
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

app.post('/api/sell', authenticate, async (req, res) => {
  try {
    const { tokenMint, tokenAmount, slippage = 2, fee = 0.1 } = req.body;
    const userId = req.userId;

    if (!tokenMint || !tokenAmount || tokenAmount <= 0) {
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

app.post('/api/get-balance', authenticate, async (req, res) => {
  try {
    const balance = await utils.getBalance(req.userId);
    res.json(balance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Portfolio endpoint
app.get('/api/portfolio/:userId', authenticate, async (req, res) => {
  try {

    const portfolio = await utils.getPortfolio(req.userId);
    res.json(portfolio);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset User's portofolio
app.get('/api/reset/:userId', authenticate, async (req, res) => {
  try {

    const portfolio = await utils.resetPortfolio(req.userId);
    res.json(portfolio);
    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Set a user's balance

app.post('/api/set-balance', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.userId;

    if (typeof amount !== 'number' || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount - must be higher than 1 SOL.' });
    }

    await utils.setBalance(userId, amount);

    const portfolio = await utils.getPortfolio(userId);
    res.json({
      success: true,
      newBalance: portfolio.solBalance,
      message: `Balance successfully set to ${amount} SOL`
    });
    
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// check session token
app.get('/api/check-session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.json({ valid: false });
    }

    const token = authHeader.split(' ')[1];
    const isValid = await utils.validateSession(token) !== null;
    
    res.json({ valid: isValid });
  } catch (error) {
    res.status(500).json({ valid: false });
  }
});

// Start server
utils.connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
