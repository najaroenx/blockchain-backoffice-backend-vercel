# Smart Contract Interface Documentation

This document provides comprehensive interface information for backend developers to interact with the THB Token, Voucher NFT, and Marketplace contracts.

## Contract ABIs

The ABI files can be found in the `artifacts/contracts/` directory after compilation:

- `artifacts/contracts/THB.sol/THB.json`
- `artifacts/contracts/Voucher.sol/Voucher.json`
- `artifacts/contracts/Marketplace.sol/Marketplace.json`

## THB Token Contract Interface

### Overview

THB is an ERC20 token with centralized control features for regulatory compliance.

### Key Functions

#### Owner Functions (Restricted)

```solidity
// Mint new THB tokens
function mint(address to, uint256 amount) external onlyOwner;

// Burn THB tokens from address
function burn(address from, uint256 amount) external onlyOwner;

// Force transfer (bypasses approval)
function forceTransfer(address from, address to, uint256 amount) external onlyOwner;

// Batch transfer to multiple recipients
function batchTransfer(address[] recipients, uint256[] amounts) external onlyOwner;
```

#### Standard ERC20 Functions

```solidity
// Get token balance
function balanceOf(address account) external view returns (uint256);

// Transfer tokens
function transfer(address to, uint256 amount) external returns (bool);

// Approve spending
function approve(address spender, uint256 amount) external returns (bool);

// Transfer from (with approval)
function transferFrom(address from, address to, uint256 amount) external returns (bool);

// Get allowance
function allowance(address owner, address spender) external view returns (uint256);

// Get total supply
function totalSupply() external view returns (uint256);

// Get decimals (18)
function decimals() external view returns (uint8);
```

### Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
event ForceTransfer(address indexed operator, address indexed from, address indexed to, uint256 amount);
```

### Custom Errors

```solidity
error ZeroAddress();
error InsufficientBalance(uint256 available, uint256 required);
error InvalidAmount();
```

---

## Voucher NFT Contract Interface

### Overview

Voucher is an ERC721 NFT contract with redeemable codes functionality.

### Key Functions

#### Owner Functions (Restricted)

```solidity
// Mint voucher with redeem code
function mint(address to, string redeemCode) external onlyOwner returns (uint256 tokenId);

// Batch mint vouchers
function batchMint(address to, string[] redeemCodes) external onlyOwner;

// Mark voucher as redeemed
function redeem(uint256 tokenId) external returns (bool);

// Burn voucher
function burn(uint256 tokenId) external onlyOwner;
```

#### View Functions

```solidity
// Get voucher data (code and redemption status)
function getVoucherData(uint256 tokenId) external view returns (string redeemCode, bool isRedeemed);

// Check if voucher is redeemed
function isRedeemed(uint256 tokenId) external view returns (bool);

// Get redeem code
function getRedeemCode(uint256 tokenId) external view returns (string);

// Get total supply
function totalSupply() external view returns (uint256);
```

#### Standard ERC721 Functions

```solidity
// Get token owner
function ownerOf(uint256 tokenId) external view returns (address);

// Transfer token
function transferFrom(address from, address to, uint256 tokenId) external;

// Approve transfer
function approve(address to, uint256 tokenId) external;

// Set approval for all
function setApprovalForAll(address operator, bool approved) external;

// Get approved address
function getApproved(uint256 tokenId) external view returns (address);

// Check if approved for all
function isApprovedForAll(address owner, address operator) external view returns (bool);
```

### Events

```solidity
event VoucherMinted(uint256 indexed tokenId, address indexed to, string redeemCode);
event VoucherRedeemed(uint256 indexed tokenId, address indexed owner);
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
```

### Custom Errors

```solidity
error VoucherAlreadyRedeemed();
error VoucherNotFound();
error ZeroAddress();
error EmptyRedeemCode();
```

---

## Marketplace Contract Interface

### Overview

Marketplace allows whitelisted users to trade voucher NFTs using THB tokens.

### Key Functions

#### Owner Functions (Restricted)

```solidity
// Add address to whitelist
function addToWhitelist(address account) external onlyOwner;

// Remove from whitelist
function removeFromWhitelist(address account) external onlyOwner;

// Batch add to whitelist
function batchAddToWhitelist(address[] accounts) external onlyOwner;

// Emergency recover voucher
function emergencyRecoverVoucher(uint256 tokenId, address recipient) external onlyOwner;
```

#### Trading Functions (Whitelisted Users Only)

```solidity
// List voucher for sale
function listVoucher(uint256 tokenId, uint256 price) external;

// Buy listed voucher
function buyVoucher(uint256 tokenId) external;

// Remove voucher from sale
function delistVoucher(uint256 tokenId) external;

// Update voucher price
function updatePrice(uint256 tokenId, uint256 newPrice) external;
```

#### View Functions

```solidity
// Get listing details
function getListing(uint256 tokenId) external view returns (
    address seller,
    uint256 price,
    bool active,
    uint256 listedAt
);

// Get all active listings
function getActiveListings() external view returns (uint256[] memory);

// Get active listings count
function getActiveListingsCount() external view returns (uint256);

// Check if address is whitelisted
function isWhitelisted(address account) external view returns (bool);

// Get contract addresses
function thbToken() external view returns (address);
function voucherContract() external view returns (address);
```

### Events

```solidity
event AddressWhitelisted(address indexed account);
event AddressRemovedFromWhitelist(address indexed account);
event VoucherListed(uint256 indexed tokenId, address indexed seller, uint256 price);
event VoucherSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
event VoucherDelisted(uint256 indexed tokenId, address indexed seller);
```

### Custom Errors

```solidity
error NotWhitelisted();
error VoucherNotFound();
error NotVoucherOwner();
error VoucherNotApproved();
error InsufficientPayment();
error VoucherNotForSale();
error CannotBuyOwnVoucher();
error ZeroAddress();
error ZeroPrice();
```

---

## Backend Integration Guide

### Prerequisites

1. Install ethers.js or web3.js for contract interaction
2. Obtain contract addresses from deployment
3. Load contract ABIs from artifacts directory

### Example: Node.js with Ethers.js

```javascript
const { ethers } = require('ethers');
const fs = require('fs');

// Load contract ABIs
const THB_ABI = JSON.parse(fs.readFileSync('artifacts/contracts/THB.sol/THB.json')).abi;
const VOUCHER_ABI = JSON.parse(fs.readFileSync('artifacts/contracts/Voucher.sol/Voucher.json')).abi;
const MARKETPLACE_ABI = JSON.parse(fs.readFileSync('artifacts/contracts/Marketplace.sol/Marketplace.json')).abi;

// Connect to blockchain
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Initialize contracts
const thbContract = new ethers.Contract(THB_ADDRESS, THB_ABI, wallet);
const voucherContract = new ethers.Contract(VOUCHER_ADDRESS, VOUCHER_ABI, wallet);
const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, wallet);
```

### Common Operations

#### 1. Mint THB Tokens

```javascript
async function mintTHB(toAddress, amount) {
  try {
    // Convert amount to wei (18 decimals)
    const amountInWei = ethers.parseEther(amount.toString());
    
    const tx = await thbContract.mint(toAddress, amountInWei);
    const receipt = await tx.wait();
    
    console.log('THB minted:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Error minting THB:', error);
    throw error;
  }
}
```

#### 2. Mint Voucher NFT

```javascript
async function mintVoucher(toAddress, redeemCode) {
  try {
    const tx = await voucherContract.mint(toAddress, redeemCode);
    const receipt = await tx.wait();
    
    // Extract tokenId from event
    const event = receipt.logs.find(log => 
      log.topics[0] === ethers.id('VoucherMinted(uint256,address,string)')
    );
    const tokenId = ethers.toNumber(event.topics[1]);
    
    console.log('Voucher minted:', tokenId);
    return { tokenId, receipt };
  } catch (error) {
    console.error('Error minting voucher:', error);
    throw error;
  }
}
```

#### 3. Batch Mint Vouchers

```javascript
async function batchMintVouchers(toAddress, redeemCodes) {
  try {
    const tx = await voucherContract.batchMint(toAddress, redeemCodes);
    const receipt = await tx.wait();
    
    console.log('Batch mint completed:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Error batch minting vouchers:', error);
    throw error;
  }
}
```

#### 4. Get Voucher Data

```javascript
async function getVoucherData(tokenId) {
  try {
    const [redeemCode, isRedeemed] = await voucherContract.getVoucherData(tokenId);
    
    return {
      tokenId,
      redeemCode,
      isRedeemed,
      owner: await voucherContract.ownerOf(tokenId)
    };
  } catch (error) {
    console.error('Error getting voucher data:', error);
    throw error;
  }
}
```

#### 5. Redeem Voucher

```javascript
async function redeemVoucher(tokenId) {
  try {
    const tx = await voucherContract.redeem(tokenId);
    const receipt = await tx.wait();
    
    console.log('Voucher redeemed:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Error redeeming voucher:', error);
    throw error;
  }
}
```

#### 6. Add to Marketplace Whitelist

```javascript
async function addToWhitelist(address) {
  try {
    const tx = await marketplaceContract.addToWhitelist(address);
    const receipt = await tx.wait();
    
    console.log('Address whitelisted:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    throw error;
  }
}
```

#### 7. List Voucher on Marketplace

```javascript
async function listVoucher(tokenId, priceInTHB) {
  try {
    // First approve marketplace to transfer voucher
    const approveTx = await voucherContract.approve(MARKETPLACE_ADDRESS, tokenId);
    await approveTx.wait();
    
    // Convert price to wei
    const priceInWei = ethers.parseEther(priceInTHB.toString());
    
    // List voucher
    const tx = await marketplaceContract.listVoucher(tokenId, priceInWei);
    const receipt = await tx.wait();
    
    console.log('Voucher listed:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Error listing voucher:', error);
    throw error;
  }
}
```

#### 8. Buy Voucher from Marketplace

```javascript
async function buyVoucher(tokenId) {
  try {
    // Get listing details
    const listing = await marketplaceContract.getListing(tokenId);
    
    // Approve marketplace to spend THB
    const approveTx = await thbContract.approve(MARKETPLACE_ADDRESS, listing.price);
    await approveTx.wait();
    
    // Buy voucher
    const tx = await marketplaceContract.buyVoucher(tokenId);
    const receipt = await tx.wait();
    
    console.log('Voucher purchased:', receipt.hash);
    return receipt;
  } catch (error) {
    console.error('Error buying voucher:', error);
    throw error;
  }
}
```

### Event Listening

```javascript
// Listen for voucher mints
voucherContract.on('VoucherMinted', (tokenId, to, redeemCode) => {
  console.log('New voucher minted:', { tokenId, to, redeemCode });
});

// Listen for voucher redemptions
voucherContract.on('VoucherRedeemed', (tokenId, owner) => {
  console.log('Voucher redeemed:', { tokenId, owner });
});

// Listen for marketplace sales
marketplaceContract.on('VoucherSold', (tokenId, seller, buyer, price) => {
  console.log('Voucher sold:', { tokenId, seller, buyer, price: ethers.formatEther(price) });
});
```

### Error Handling

```javascript
async function handleContractCall(contractFunction) {
  try {
    return await contractFunction();
  } catch (error) {
    // Parse custom errors
    if (error.data) {
      const errorData = error.data;
      
      // Check for specific errors
      if (errorData.includes('ZeroAddress')) {
        throw new Error('Invalid address: cannot be zero address');
      } else if (errorData.includes('VoucherAlreadyRedeemed')) {
        throw new Error('Voucher has already been redeemed');
      } else if (errorData.includes('NotWhitelisted')) {
        throw new Error('Address is not whitelisted for marketplace');
      }
    }
    
    // Generic error handling
    throw new Error(`Contract call failed: ${error.message}`);
  }
}
```

### Best Practices

1. **Gas Estimation**: Always estimate gas before sending transactions
   ```javascript
   const gasEstimate = await contract.estimateGas.functionName(...args);
   const tx = await contract.functionName(...args, { gasLimit: gasEstimate * 120n / 100n });
   ```

2. **Transaction Confirmation**: Wait for multiple confirmations for important operations
   ```javascript
   const receipt = await tx.wait(3); // Wait for 3 confirmations
   ```

3. **Batch Operations**: Use batch functions when minting multiple vouchers to save gas

4. **Event Monitoring**: Set up event listeners for real-time updates

5. **Error Handling**: Always wrap contract calls in try-catch blocks

6. **Nonce Management**: For high-frequency operations, manage nonces manually

7. **Rate Limiting**: Implement rate limiting to avoid overwhelming the RPC node

---

## Testing

### Unit Tests

```javascript
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Voucher Contract', function() {
  it('Should mint voucher with redeem code', async function() {
    const [owner, user] = await ethers.getSigners();
    const Voucher = await ethers.getContractFactory('Voucher');
    const voucher = await Voucher.deploy();
    
    await voucher.mint(user.address, 'CODE123');
    
    const [redeemCode, isRedeemed] = await voucher.getVoucherData(1);
    expect(redeemCode).to.equal('CODE123');
    expect(isRedeemed).to.be.false;
  });
});
```

### Integration Tests

Test complete workflows including multiple contract interactions:

1. Mint THB tokens to user
2. Mint voucher to user
3. Whitelist user on marketplace
4. User lists voucher
5. Another user buys voucher
6. Winner redeems voucher

---

## Deployment Information

### Contract Addresses (Update after deployment)

```json
{
  "thbToken": "0x...",
  "voucherNFT": "0x...",
  "marketplace": "0x..."
}
```

### Network Configuration

```javascript
// Testnet
const TESTNET_RPC = "https://rpc.testnet.example.com";
const TESTNET_CHAIN_ID = 11155111;

// Mainnet
const MAINNET_RPC = "https://rpc.mainnet.example.com";
const MAINNET_CHAIN_ID = 1;
```

---

## Security Considerations

1. **Private Key Management**: Never expose private keys in code or logs
2. **Access Control**: Only owner can call restricted functions
3. **Whitelist Verification**: Always verify whitelist status before marketplace operations
4. **Approval Management**: Revoke approvals after transactions complete
5. **Rate Limiting**: Implement rate limiting on backend to prevent abuse
6. **Input Validation**: Validate all inputs before sending to blockchain
7. **Gas Price Monitoring**: Monitor gas prices to avoid overpaying

---

## Support

For questions or issues, please contact the development team or create an issue in the repository.
