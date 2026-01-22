## Summary
This PR migrates the wallet storage from storing raw `privateKey` to using HD wallet with `seedPhrase`, `chainCode`, and `derivationIndex`.

## Breaking Changes ⚠️
- **Wallet model no longer stores `privateKey` field**
- All existing wallets need to be re-created with new structure
- `SALT` environment variable required for encryption/decryption

## Changes

### Database Schema (`prisma/schema.prisma`)
- ❌ Removed: `privateKey` field from Wallet model
- ✅ Added: `seedPhrase` (encrypted BIP39 mnemonic)
- ✅ Added: `chainCode` (for future xpub derivation)
- ✅ Added: `derivationIndex` (default 0, for multi-wallet support)

### New Utility (`src/libs/derive-wallet.ts`)
- `deriveChildWallet()`: Derive wallet at specific index from seedPhrase
- `getSignerFromSeedPhrase()`: Get ethers Wallet signer for transactions
- `deriveMultipleWallets()`: Batch derive multiple wallets
- `getMasterHDNode()`: Get master HD node for advanced operations

### Updated Handlers
| Handler | Changes |
|---------|---------|
| `createCustomer.handler.ts` | Store encrypted seedPhrase/chainCode |
| `createMerchant.handler.ts` | Store encrypted seedPhrase/chainCode |
| `activateVoucher.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `batchListOnMarketplace.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `buyCouponFromMarketplace.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `merchantBuyCouponFromSeller.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `redeemVoucher.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `sellerListOnMarketplace.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `burnTransaction.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `createTransactionB2C.handler.ts` | Use `getSignerFromSeedPhrase()` |
| `createTransactionC2C.handler.ts` | Use `getSignerFromSeedPhrase()` |

## Security Improvements
- ✅ Private keys are now derived on-demand, never stored in database
- ✅ BIP44 derivation path: `m/44'/60'/0'/0/{index}`
- ✅ All sensitive data (seedPhrase, chainCode) encrypted with AES via TokenService
- ✅ `getWalletByPhoneOrEmail` excludes sensitive fields from API response

## Migration
Run the following after deploying:
```bash
npx prisma migrate deploy
```

## Testing
- [x] Build passes
- [x] Seed runs successfully
- [x] `create-wallet.spec.ts` updated for new fields
