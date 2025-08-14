class BitcoinRBFManager {
    constructor() {
        this.currentKey = null;
        this.currentAddress = null;
        this.currentBalance = null;
        this.pendingTransactions = new Map();
        this.init();
    }

    init() {
        this.bindEvents();
        this.startTransactionMonitoring();
        // Check QR library loading
        setTimeout(() => {
            if (typeof QRCode !== 'undefined') {
                console.log('✅ QRCode library loaded successfully');
            } else {
                console.warn('⚠️ QRCode library not loaded - will use fallback');
            }
        }, 1000);
    }

    bindEvents() {
        // Wallet setup events
        document.getElementById('generate-key-btn').addEventListener('click', () => this.generateKey());
        document.getElementById('import-key-btn').addEventListener('click', () => this.showImportForm());
        document.getElementById('import-mnemonic-btn').addEventListener('click', () => this.showImportMnemonicForm());
        document.getElementById('confirm-import-btn').addEventListener('click', () => this.importKey());
        document.getElementById('cancel-import-btn').addEventListener('click', () => this.hideImportForm());
        document.getElementById('confirm-mnemonic-btn').addEventListener('click', () => this.importMnemonic());
        document.getElementById('cancel-mnemonic-btn').addEventListener('click', () => this.hideImportMnemonicForm());
        
        // Wallet info events
        document.getElementById('copy-address-btn').addEventListener('click', () => this.copyAddress());
        document.getElementById('refresh-balance-btn').addEventListener('click', () => this.refreshBalance());
        document.getElementById('export-key-btn').addEventListener('click', () => this.showExportKeyModal());
        
        // Debug form finding
        console.log('🔍 Checking for transaction form...');
        const transactionForm = document.getElementById('transaction-form');
        console.log('Form element:', transactionForm);
        console.log('Form is visible:', transactionForm && !transactionForm.closest('.hidden'));
        
        if (transactionForm) {
            console.log('✅ Transaction form found, adding event listener');
            transactionForm.addEventListener('submit', (e) => {
                console.log('📝 Transaction form submitted via direct handler');
                e.preventDefault();
                e.stopPropagation();
                console.log('🚫 Default prevented and propagation stopped');
                this.createTransaction(e);
                return false;
            });
        } else {
            console.error('❌ Transaction form not found!');
        }
        
        // Also check the submit button
        const submitButton = document.querySelector('button[type="submit"]');
        console.log('Submit button:', submitButton);
        if (submitButton) {
            submitButton.addEventListener('click', (e) => {
                console.log('🖱️ Submit button clicked directly');
                e.preventDefault();
                const form = submitButton.closest('form');
                if (form && form.id === 'transaction-form') {
                    console.log('🎯 Calling createTransaction from button click');
                    this.createTransaction({ target: form, preventDefault: () => {} });
                }
                return false;
            });
        }
        
        // Import form enter key
        document.getElementById('private-key-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.importKey();
            }
        });
        
        // Mnemonic form enter key (Ctrl+Enter since textarea)
        document.getElementById('mnemonic-input').addEventListener('keypress', (e) => {
            if ((e.key === 'Enter' && e.ctrlKey) || (e.key === 'Enter' && e.shiftKey)) {
                e.preventDefault();
                this.importMnemonic();
            }
        });
        
        // Export modal events
        document.getElementById('close-export-modal').addEventListener('click', () => this.hideExportKeyModal());
        document.getElementById('confirm-export-understanding').addEventListener('click', () => this.hideExportKeyModal());
        document.getElementById('copy-private-key-btn').addEventListener('click', () => this.copyPrivateKey());
    }

    // Utility Methods
    showLoading(text = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay.querySelector('.loading-text');
        loadingText.textContent = text.toUpperCase();
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showAlert(message, type = 'success') {
        const container = document.getElementById('alert-container');
        const alert = document.createElement('div');
        alert.className = `terminal-alert ${type}`;
        alert.innerHTML = `
            ${message}
            <button class="alert-close">X</button>
        `;
        
        container.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
        
        // Close button
        alert.querySelector('.alert-close').addEventListener('click', () => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        });
    }

    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`/api/bitcoin${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    formatSatoshis(satoshis) {
        const btc = (satoshis / 100000000).toFixed(8);
        return `${btc} BTC (${satoshis.toLocaleString()} sat)`;
    }

    formatAddress(address) {
        if (address.length <= 20) return address;
        return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
    }


    // Wallet Methods
    async generateKey() {
        try {
            this.showLoading('Generating new key...');
            const result = await this.apiCall('/generate-key', { method: 'POST' });
            
            this.currentKey = result.privateKey;
            this.currentAddress = result.address;
            
            this.showAlert('New Bitcoin key generated successfully!', 'success');
            this.updateWalletInfo();
            await this.refreshBalance();
        } catch (error) {
            this.showAlert(`Failed to generate key: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    showImportForm() {
        // Hide other forms
        document.getElementById('import-mnemonic-form').classList.add('hidden');
        document.getElementById('import-key-form').classList.remove('hidden');
        document.getElementById('private-key-input').focus();
    }

    hideImportForm() {
        document.getElementById('import-key-form').classList.add('hidden');
        document.getElementById('private-key-input').value = '';
    }

    showImportMnemonicForm() {
        // Hide other forms
        document.getElementById('import-key-form').classList.add('hidden');
        document.getElementById('import-mnemonic-form').classList.remove('hidden');
        document.getElementById('mnemonic-input').focus();
    }

    hideImportMnemonicForm() {
        document.getElementById('import-mnemonic-form').classList.add('hidden');
        document.getElementById('mnemonic-input').value = '';
        document.getElementById('derivation-path-input').value = "m/84'/0'/0'/0/0";
    }

    showExportKeyModal() {
        if (!this.currentKey) {
            this.showAlert('PRIVATE KEY REQUIRED - NO KEY LOADED', 'warning');
            return;
        }
        
        // Display the private key in the modal
        document.getElementById('exported-private-key').value = this.currentKey;
        document.getElementById('export-key-modal').classList.remove('hidden');
    }

    hideExportKeyModal() {
        document.getElementById('export-key-modal').classList.add('hidden');
        // Clear the private key for security
        document.getElementById('exported-private-key').value = '';
    }

    async copyPrivateKey() {
        try {
            const privateKey = document.getElementById('exported-private-key').value;
            await navigator.clipboard.writeText(privateKey);
            this.showAlert('Private key copied to clipboard!', 'success');
            
            // Add visual feedback to copy button
            const copyBtn = document.getElementById('copy-private-key-btn');
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
            `;
            copyBtn.style.color = '#10b981';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '#f7931a';
            }, 2000);
        } catch (err) {
            this.showAlert('Failed to copy private key', 'error');
            console.error('Copy failed:', err);
        }
    }

    updateWalletInfo() {
        if (!this.currentAddress) return;
        
        console.log('🔄 Updating wallet info and showing transaction form...');
        
        // Show wallet info section
        document.getElementById('wallet-setup').classList.add('hidden');
        document.getElementById('wallet-info').classList.remove('hidden');
        document.getElementById('create-transaction').classList.remove('hidden');
        document.getElementById('transaction-management').classList.remove('hidden');
        
        // Re-bind form events now that form is visible
        setTimeout(() => {
            console.log('🔄 Re-checking transaction form after visibility change...');
            const transactionForm = document.getElementById('transaction-form');
            console.log('Form after visibility change:', transactionForm);
            console.log('Form is now visible:', transactionForm && !transactionForm.closest('.hidden'));
            
            if (transactionForm && !transactionForm.hasEventListener) {
                console.log('➕ Adding event listener to newly visible form');
                transactionForm.hasEventListener = true;
                transactionForm.addEventListener('submit', (e) => {
                    console.log('📝 Transaction form submitted (post-visibility handler)');
                    e.preventDefault();
                    e.stopPropagation();
                    this.createTransaction(e);
                    return false;
                });
            }
        }, 100);
        
        // Update address display
        document.getElementById('wallet-address').textContent = this.currentAddress;
        
        // Generate QR code with a small delay to ensure DOM is ready
        setTimeout(() => this.generateQRCode(0), 100);
    }

    generateQRCode(retryCount = 0) {
        console.log('🔄 Generating QR code for address:', this.currentAddress);
        
        // Check if canvas element exists
        const canvas = document.getElementById('address-qr-code');
        if (!canvas) {
            console.error('❌ QR Canvas element not found');
            return;
        }
        
        // Try canvas-based QR code first
        if (typeof QRCode !== 'undefined') {
            try {
                console.log('✅ QRCode library loaded, using canvas QR generation...');
                QRCode.toCanvas(canvas, this.currentAddress, {
                    width: 160,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                }).then(() => {
                    console.log('✅ Canvas QR code generated successfully');
                    canvas.style.display = 'block';
                }).catch((error) => {
                    console.error('❌ Canvas QR failed:', error);
                    this.generateQRCodeFallback();
                });
                return;
            } catch (error) {
                console.error('❌ Canvas QR error:', error);
            }
        }
        
        // If QRCode library not loaded and retries available
        if (typeof QRCode === 'undefined' && retryCount < 5) {
            console.log(`⏳ QRCode library not loaded, retrying... (${retryCount + 1}/5)`);
            setTimeout(() => this.generateQRCode(retryCount + 1), 500);
            return;
        }
        
        // Use fallback
        console.log('🔄 Using fallback QR generation...');
        this.generateQRCodeFallback();
    }

    generateQRCodeFallback() {
        try {
            console.log('🔄 Using QR code fallback method');
            const qrContainer = document.querySelector('.qr-container');
            const canvas = document.getElementById('address-qr-code');
            
            if (!qrContainer || !this.currentAddress) {
                console.error('❌ QR container or address not found');
                return;
            }
            
            // Hide canvas
            if (canvas) {
                canvas.style.display = 'none';
            }
            
            // Remove existing QR image if any
            const existingImg = qrContainer.querySelector('.qr-fallback-img');
            if (existingImg) {
                existingImg.remove();
            }
            
            // Create QR code using a simpler, more reliable service
            const qrImg = document.createElement('img');
            qrImg.className = 'qr-fallback-img';
            qrImg.style.cssText = 'border-radius: 8px; background: white; padding: 8px; width: 160px; height: 160px; object-fit: contain;';
            
            // Using QR Server (more reliable than Google Charts)
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(this.currentAddress)}`;
            qrImg.alt = 'Bitcoin Address QR Code';
            
            // Add error handling for image loading
            qrImg.onload = () => {
                console.log('✅ Fallback QR code loaded successfully');
            };
            
            qrImg.onerror = () => {
                console.error('❌ Fallback QR image failed to load');
                // Last resort: show the address as text
                const textDiv = document.createElement('div');
                textDiv.style.cssText = 'background: white; color: black; padding: 10px; border-radius: 8px; font-size: 10px; word-break: break-all; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; text-align: center;';
                textDiv.textContent = this.currentAddress;
                textDiv.title = 'QR Code failed to load - Bitcoin address displayed as text';
                qrContainer.insertBefore(textDiv, qrContainer.querySelector('.qr-label'));
                console.log('📝 Displaying address as text fallback');
            };
            
            // Insert before the label
            const label = qrContainer.querySelector('.qr-label');
            qrContainer.insertBefore(qrImg, label);
            
            console.log('✅ Fallback QR code element created');
        } catch (error) {
            console.error('❌ Fallback QR generation failed:', error);
        }
    }

    toggleLegacyAddress() {
        // This method will toggle between SegWit and Legacy address display
        // For now, we'll implement it later if needed
        this.showAlert('Legacy address toggle coming soon', 'info');
    }

    async importKey() {
        const privateKey = document.getElementById('private-key-input').value.trim();
        
        if (!privateKey) {
            this.showAlert('Please enter a private key', 'error');
            return;
        }

        try {
            this.showLoading('Importing private key...');
            const result = await this.apiCall('/import-key', {
                method: 'POST',
                body: JSON.stringify({ privateKey })
            });
            
            this.currentKey = privateKey;
            this.currentAddress = result.address;
            
            this.hideImportForm();
            this.showAlert('Private key imported successfully!', 'success');
            this.updateWalletInfo();
            await this.refreshBalance();
        } catch (error) {
            this.showAlert(`Failed to import key: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async importMnemonic() {
        const mnemonic = document.getElementById('mnemonic-input').value.trim();
        const derivationPath = document.getElementById('derivation-path-input').value.trim();
        
        if (!mnemonic) {
            this.showAlert('Please enter a recovery phrase', 'error');
            return;
        }

        // Basic validation - check if it looks like 12 words
        const words = mnemonic.split(/\s+/);
        if (words.length !== 12) {
            this.showAlert('Recovery phrase must be exactly 12 words', 'error');
            return;
        }

        try {
            this.showLoading('Importing recovery phrase...');
            const result = await this.apiCall('/import-mnemonic', {
                method: 'POST',
                body: JSON.stringify({ 
                    mnemonic,
                    derivationPath: derivationPath || "m/84'/0'/0'/0/0"
                })
            });
            
            this.currentKey = result.privateKey;
            this.currentAddress = result.address;
            
            this.hideImportMnemonicForm();
            this.showAlert('Recovery phrase imported successfully!', 'success');
            this.updateWalletInfo();
            await this.refreshBalance();
        } catch (error) {
            this.showAlert(`Failed to import recovery phrase: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async copyAddress() {
        try {
            await navigator.clipboard.writeText(this.currentAddress);
            this.showAlert('Address copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = this.currentAddress;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showAlert('Address copied to clipboard!', 'success');
        }
    }

    async refreshBalance() {
        if (!this.currentAddress) return;
        
        try {
            this.showLoading('Refreshing balance...');
            const result = await this.apiCall(`/balance/${this.currentAddress}`);
            
            this.currentBalance = result.balance;
            const balanceDisplay = document.getElementById('wallet-balance');
            balanceDisplay.textContent = this.formatSatoshis(result.balance);
            
            // Update balance color based on amount
            balanceDisplay.style.color = result.balance > 0 ? '#4ade80' : '#ef4444';
            
        } catch (error) {
            this.showAlert(`Failed to refresh balance: ${error.message}`, 'error');
            document.getElementById('wallet-balance').textContent = 'Error loading balance';
        } finally {
            this.hideLoading();
        }
    }

    // Transaction Methods
    async createTransaction(event) {
        console.log('🎯 createTransaction method called!', event);
        event.preventDefault();
        console.log('🚫 preventDefault called in createTransaction method');
        
        const formData = new FormData(event.target);
        const recipientAddress = document.getElementById('recipient-address').value.trim();
        const amountBTC = parseFloat(document.getElementById('amount').value);
        const amount = Math.round(amountBTC * 100000000); // Convert BTC to satoshis
        const feeRate = parseInt(document.getElementById('fee-rate').value);
        const rbfEnabled = document.getElementById('rbf-enabled').checked;
        
        if (!recipientAddress || !amountBTC || !feeRate) {
            this.showAlert('Please fill in all required fields', 'error');
            return;
        }
        
        if (amountBTC < 0.00000546) {
            this.showAlert('Amount must be at least 0.00000546 BTC (546 satoshis)', 'error');
            return;
        }
        
        if (this.currentBalance !== null && amount >= this.currentBalance) {
            this.showAlert('Insufficient balance for this transaction', 'error');
            return;
        }

        try {
            this.showLoading('Creating transaction...');
            
            // Create transaction
            const createResult = await this.apiCall('/create-transaction', {
                method: 'POST',
                body: JSON.stringify({
                    privateKey: this.currentKey,
                    toAddress: recipientAddress,
                    amount,
                    feeRate,
                    rbf: rbfEnabled
                })
            });
            
            // Broadcast transaction
            const broadcastResult = await this.apiCall('/broadcast', {
                method: 'POST',
                body: JSON.stringify({
                    txHex: createResult.txHex
                })
            });
            
            // Add to pending transactions - force RBF enabled and persistent pending status
            this.pendingTransactions.set(broadcastResult.txId, {
                txid: broadcastResult.txId,
                recipientAddress,
                amount,
                feeRate,
                rbfEnabled: true, // Always enable RBF for buttons to show
                status: 'pending', // Keep as pending to show buttons
                timestamp: Date.now()
            });
            
            // Reset form
            event.target.reset();
            document.getElementById('fee-rate').value = '5';
            document.getElementById('rbf-enabled').checked = true;
            
            this.showAlert(`Transaction broadcasted! TXID: ${broadcastResult.txId.substring(0, 16)}...`, 'success');
            this.updateTransactionList();
            
            // Refresh balance after a delay
            setTimeout(() => this.refreshBalance(), 2000);
            
        } catch (error) {
            this.showAlert(`Failed to create transaction: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async accelerateTransaction(txid) {
        const transaction = this.pendingTransactions.get(txid);
        if (!transaction) {
            this.showAlert('Transaction not found', 'error');
            return;
        }
        
        const newFeeRate = prompt(`Current fee rate: ${transaction.feeRate} sat/vB\nEnter new fee rate (must be higher):`, transaction.feeRate + 5);
        
        if (!newFeeRate || parseInt(newFeeRate) <= transaction.feeRate) {
            this.showAlert('New fee rate must be higher than current fee rate', 'error');
            return;
        }

        try {
            this.showLoading('Accelerating transaction...');
            
            const result = await this.apiCall('/replace-transaction', {
                method: 'POST',
                body: JSON.stringify({
                    privateKey: this.currentKey,
                    originalTxId: txid,
                    newFeeRate: parseInt(newFeeRate),
                    cancelTransaction: false
                })
            });
            
            // Remove old transaction and add new one
            this.pendingTransactions.delete(txid);
            this.pendingTransactions.set(result.txId, {
                ...transaction,
                txid: result.txId,
                feeRate: parseInt(newFeeRate),
                status: 'pending',
                timestamp: Date.now(),
                replacedTxid: txid
            });
            
            this.showAlert(`Transaction accelerated! New TXID: ${result.txId.substring(0, 16)}...`, 'success');
            this.updateTransactionList();
            
        } catch (error) {
            this.showAlert(`Failed to accelerate transaction: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async cancelTransaction(txid) {
        const transaction = this.pendingTransactions.get(txid);
        if (!transaction) {
            this.showAlert('Transaction not found', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to cancel this transaction? This will create a double-spend back to your wallet.')) {
            return;
        }
        
        const newFeeRate = prompt(`Current fee rate: ${transaction.feeRate} sat/vB\nEnter fee rate for cancellation (must be higher):`, transaction.feeRate + 10);
        
        if (!newFeeRate || parseInt(newFeeRate) <= transaction.feeRate) {
            this.showAlert('Cancellation fee rate must be higher than current fee rate', 'error');
            return;
        }

        try {
            this.showLoading('Cancelling transaction...');
            
            const result = await this.apiCall('/replace-transaction', {
                method: 'POST',
                body: JSON.stringify({
                    privateKey: this.currentKey,
                    originalTxId: txid,
                    newFeeRate: parseInt(newFeeRate),
                    cancelTransaction: true
                })
            });
            
            // Remove old transaction and add cancellation transaction
            this.pendingTransactions.delete(txid);
            this.pendingTransactions.set(result.txId, {
                txid: result.txId,
                recipientAddress: this.currentAddress,
                amount: transaction.amount,
                feeRate: parseInt(newFeeRate),
                rbfEnabled: true,
                status: 'pending',
                timestamp: Date.now(),
                isCancellation: true,
                originalTxid: txid
            });
            
            this.showAlert(`Transaction cancelled! Cancellation TXID: ${result.txId.substring(0, 16)}...`, 'success');
            this.updateTransactionList();
            
        } catch (error) {
            this.showAlert(`Failed to cancel transaction: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async quickCancelTransaction(txid) {
        const transaction = this.pendingTransactions.get(txid);
        if (!transaction) {
            this.showAlert('Transaction not found', 'error');
            return;
        }
        
        // Let user choose the cancellation fee rate
        const minFeeRate = Math.max(transaction.feeRate + 1, 2); // Must be higher than original
        const suggestedFeeRate = Math.max(transaction.feeRate + 5, 10); // Reasonable suggestion
        
        const userFeeRate = prompt(
            `Cancel Transaction with RBF:\n\n` +
            `Original fee rate: ${transaction.feeRate} sat/vB\n` +
            `Minimum required: ${minFeeRate} sat/vB\n` +
            `Suggested: ${suggestedFeeRate} sat/vB\n\n` +
            `Enter fee rate for cancellation (sat/vB):`, 
            suggestedFeeRate
        );
        
        if (!userFeeRate) {
            return; // User cancelled
        }
        
        const chosenFeeRate = parseInt(userFeeRate);
        
        if (isNaN(chosenFeeRate) || chosenFeeRate <= transaction.feeRate) {
            this.showAlert(`Fee rate must be higher than ${transaction.feeRate} sat/vB`, 'error');
            return;
        }
        
        if (!confirm(`Confirm RBF Cancellation:\n\nOriginal: ${transaction.feeRate} sat/vB\nCancellation: ${chosenFeeRate} sat/vB\n\nThis will send funds back to your wallet.\n\nProceed?`)) {
            return;
        }

        try {
            this.showLoading('Quick cancelling transaction...');
            
            // Create the replacement transaction
            const createResult = await this.apiCall('/replace-transaction', {
                method: 'POST',
                body: JSON.stringify({
                    privateKey: this.currentKey,
                    originalTxId: txid,
                    newFeeRate: chosenFeeRate,
                    cancelTransaction: true
                })
            });
            
            console.log('🔄 RBF cancellation created:', createResult);
            
            // Broadcast the replacement transaction
            const broadcastResult = await this.apiCall('/broadcast', {
                method: 'POST',
                body: JSON.stringify({
                    txHex: createResult.txHex
                })
            });
            
            console.log('📡 RBF cancellation broadcasted:', broadcastResult);
            
            // Remove old transaction and add cancellation transaction
            this.pendingTransactions.delete(txid);
            this.pendingTransactions.set(broadcastResult.txId, {
                txid: broadcastResult.txId,
                recipientAddress: this.currentAddress,
                amount: transaction.amount,
                feeRate: chosenFeeRate,
                rbfEnabled: true,
                status: 'pending',
                timestamp: Date.now(),
                isCancellation: true,
                originalTxid: txid,
                replacedFee: createResult.originalFee,
                newFee: createResult.fee
            });
            
            this.showAlert(`Transaction cancelled! Cancellation TXID: ${broadcastResult.txId.substring(0, 16)}... (Fee: ${createResult.fee} sats)`, 'success');
            this.updateTransactionList();
            
        } catch (error) {
            this.showAlert(`Failed to cancel transaction: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateTransactionList() {
        const container = document.getElementById('transactions-list');
        
        if (this.pendingTransactions.size === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p>No transactions yet</p>
                </div>
            `;
            return;
        }
        
        const transactions = Array.from(this.pendingTransactions.values())
            .sort((a, b) => b.timestamp - a.timestamp);
        
        container.innerHTML = transactions.map(tx => this.renderTransaction(tx)).join('');
    }

    renderTransaction(tx) {
        console.log('🔄 Rendering transaction:', tx.txid.substring(0, 8), 'Status:', tx.status, 'RBF:', tx.rbfEnabled);
        const statusClass = `status-${tx.status}`;
        const isToSelf = tx.recipientAddress === this.currentAddress;
        const typeLabel = tx.isCancellation ? 'Cancellation' : isToSelf ? 'Self Transfer' : 'Send';
        
        return `
            <div class="transaction-item">
                <div class="transaction-header">
                    <div class="transaction-id">
                        <strong>TXID:</strong> ${tx.txid}
                        ${tx.replacedTxid ? `<br><small>Replaced: ${tx.replacedTxid}</small>` : ''}
                    </div>
                    <div class="transaction-status ${statusClass}">${tx.status}</div>
                </div>
                
                <div class="transaction-details">
                    <div class="transaction-detail">
                        <label>Type:</label>
                        <span>${typeLabel}</span>
                    </div>
                    <div class="transaction-detail">
                        <label>Amount:</label>
                        <span>${this.formatSatoshis(tx.amount)}</span>
                    </div>
                    <div class="transaction-detail">
                        <label>Fee Rate:</label>
                        <span>${tx.feeRate} sat/vB</span>
                    </div>
                    <div class="transaction-detail">
                        <label>RBF:</label>
                        <span>${tx.rbfEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                </div>
                
                ${(tx.status === 'pending' || tx.status === 'unconfirmed') && tx.rbfEnabled ? `
                    <div class="transaction-actions">
                        <button class="terminal-option" onclick="app.accelerateTransaction('${tx.txid}')" style="margin-right: 10px; padding: 8px 12px; font-size: 12px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 5px;">
                                <path d="M13,3V9H21V3M13,21H21V11H13M3,21H11V15H3M3,13H11V3H3V13Z"/>
                            </svg>
                            accelerate_tx
                        </button>
                        ${!tx.isCancellation ? `
                            <button class="terminal-option" onclick="app.quickCancelTransaction('${tx.txid}')" style="padding: 8px 12px; font-size: 12px; border-color: var(--terminal-red); color: var(--terminal-red);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 5px;">
                                    <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/>
                                </svg>
                                quick_cancel
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Transaction Monitoring
    async checkTransactionStatus(txid) {
        try {
            const result = await this.apiCall(`/transaction/${txid}`);
            
            const transaction = this.pendingTransactions.get(txid);
            if (transaction && transaction.status !== result.status) {
                transaction.status = result.status;
                this.updateTransactionList();
                
                if (result.status === 'confirmed') {
                    this.showAlert(`Transaction ${txid.substring(0, 16)}... confirmed!`, 'success');
                    // Refresh balance when transaction is confirmed
                    setTimeout(() => this.refreshBalance(), 1000);
                } else if (result.status === 'failed') {
                    this.showAlert(`Transaction ${txid.substring(0, 16)}... failed`, 'error');
                }
            }
            
            return result;
        } catch (error) {
            console.error(`Failed to check transaction ${txid}:`, error);
            return null;
        }
    }

    startTransactionMonitoring() {
        // Disable auto-monitoring to prevent buttons from disappearing
        console.log('🔍 Transaction monitoring disabled to keep buttons persistent');
        return;
        
        setInterval(async () => {
            const pendingTxids = Array.from(this.pendingTransactions.keys())
                .filter(txid => this.pendingTransactions.get(txid).status === 'pending');
            
            for (const txid of pendingTxids) {
                await this.checkTransactionStatus(txid);
            }
        }, 30000); // Check every 30 seconds
    }
}

// Initialize the application
const app = new BitcoinRBFManager();

// Make app globally available for button onclick handlers
window.app = app;