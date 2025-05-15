
# TPTServer 🛠️

This is the backend server for **Trenchers Paper Trading**. It handles authentication, portfolio tracking, session management, and communication with Solana's blockchain via Helius RPC.

---

## 🚀 Features

- Secure session-based login system
- Encrypted user passwords
- MongoDB-based portfolio and user management
- RPC integration for SOL transactions
- RESTful API for extension frontend

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/Gadzzaa/TPTServer.git
cd TPTServer
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create `.env` File
```env
MONGODB=mongodb+srv://<your-mongodb-url>
ENCRK=yourRandomEncryptionKey
RPC=https://your-helius-rpc-endpoint
```

### 4. Start the Server
```bash
node server.js
```

> The server will run on `http://localhost:5000/` by default

---

## 🗃️ MongoDB Configuration

### 📁 Database: `PaperTrade`

#### 🟢 Collection: `users`
```json
{
  "_id": ObjectId,
  "username": "User1",
  "password": "<encrypted>",
  "balance": 100,
  "createdAt": "ISODate"
}
```

#### 🟢 Collection: `portfolios`
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "tokens": {},
  "updatedAt": "ISODate"
}
```

#### 🟢 Collection: `sessions`
```json
{
  "_id": ObjectId,
  "token": "randomstring",
  "expiresAt": "ISODate"
}
```

Ensure these indexes are configured:
- `token` ➝ `unique`
- `expiresAt` ➝ `TTL`

---

## 🔗 Required For

This server is mandatory for [TrenchersPaperTrading](https://github.com/Gadzzaa/TrenchersPaperTrading) to function correctly.

---

## 📄 License

MIT License © 2025 Gadzzaa
