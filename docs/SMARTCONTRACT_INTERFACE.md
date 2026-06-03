Contract Interface

### THB

```solidity
    // Mint new THB tokens
    function mint(address to, uint256 amount) external onlyOwner;

    // Burn THB tokens from address
    function burn(address from, uint256 amount) external onlyOwner;

    // Force transfer (bypasses approval)
    function forceTransfer(address from, address to, uint256 amount) external onlyOwner;

    // Batch transfer to multiple recipients
    function batchTransfer(address[] recipients, uint256[] amounts) external onlyOwner;

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

### Coupon NFT

```solidity
    function createCouponType(
        string memory name,
        uint256 startDate,
        uint256 expireDate
    ) external returns (uint256);

    function mint(address to, uint256 typeId, uint256 amount) external;
    // 1000 ใบ

    // 1000 ใบ 10 ใบ

    function redeem(uint256 typeId, uint256 amount) external;

    function redeemFrom(address from, uint256 typeId, uint256 amount) external;

    function getCouponData(
        uint256 typeId
    )
        external
        view
        returns (
            string memory name,
            uint256 startDate,
            uint256 expireDate,
            uint256 totalSupply,
            uint256 totalRedeemed
        );

    function getTotalSupply(uint256 typeId) external view returns (uint256);

    function getTotalRedeemed(uint256 typeId) external view returns (uint256);

    function batchMint(
        address[] calldata recipients,
        uint256[] calldata typeIds,
        uint256[] calldata amounts
    ) external;

    function burn(address from, uint256 typeId, uint256 amount) external;

    function isCouponActive(uint256 typeId) external view returns (bool);
-> db -> smart contract 
-> smart contract -> db
-> sma


```

### Marketplace

```solidity
    function listCoupon(
        uint256 typeId,
        uint256 amount,
        uint256 pricePerUnit,
        address paymentToken
    ) external returns (uint256);

    function buyCoupon(uint256 listingId, uint256 amount) external;

    function buyCouponWithToken(uint256 listingId, uint256 amount) external;

    function redeemCoupon(uint256 typeId, uint256 amount) external;

    function getListing(
        uint256 listingId
    )
        external
        view
        returns (
            address seller,
            uint256 typeId,
            uint256 amount,
            uint256 pricePerUnit,
            address paymentToken,
            bool active
        );

    function updateListingPrice(uint256 listingId, uint256 newPricePerUnit) external;

    function delistCoupon(uint256 listingId) external;
```
 