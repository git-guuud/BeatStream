// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BeatStreamVault
 * @notice Manages USDC deposits, Beat minting, and artist settlement for BeatStream.
 *
 *  Flow:
 *    1. User approves USDC spend → calls deposit(amount)
 *    2. Backend listens for Deposit event → credits off-chain Beats balance
 *    3. After streaming, backend calls settle(artist, beatsUsed, user)
 *    4. User can withdraw remaining USDC via withdraw()
 *
 *  Peg: 1000 Beats = 1 USDC (6 decimals)
 *       1 Beat = 0.001 USDC = 1000 base units
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract BeatStreamVault {
    // ─── State ───
    address public immutable owner;
    IERC20  public immutable usdc;

    uint256 public constant BEATS_PER_USDC = 1000;
    uint256 public constant USDC_PER_BEAT  = 1e3; // 0.001 USDC in 6-decimal base units

    // User USDC deposits tracked (6-decimal base units)
    mapping(address => uint256) public deposits;

    // Artist total earnings tracked
    mapping(address => uint256) public artistEarnings;

    // ─── Events ───
    event Deposited(address indexed user, uint256 usdcAmount, uint256 beatsAmount);
    event Settled(address indexed artist, uint256 usdcAmount, address indexed user, uint256 beatsUsed);
    event Withdrawn(address indexed user, uint256 usdcAmount);
    event ArtistRegistered(address indexed artist, string ensName);

    // ─── Modifiers ───
    modifier onlyOwner() {
        require(msg.sender == owner, "BeatStreamVault: not owner");
        _;
    }

    constructor(address _owner, address _usdc) {
        require(_owner != address(0), "Invalid owner");
        require(_usdc  != address(0), "Invalid USDC address");
        owner = _owner;
        usdc  = IERC20(_usdc);
    }

    /**
     * @notice User deposits USDC. Must call usdc.approve(vault, amount) first.
     * @param usdcAmount Amount in USDC base units (6 decimals).
     */
    function deposit(uint256 usdcAmount) external {
        require(usdcAmount > 0, "Zero amount");

        bool ok = usdc.transferFrom(msg.sender, address(this), usdcAmount);
        require(ok, "USDC transferFrom failed");

        deposits[msg.sender] += usdcAmount;

        uint256 beats = usdcAmount / USDC_PER_BEAT;
        emit Deposited(msg.sender, usdcAmount, beats);
    }

    /**
     * @notice Backend settles streaming session - pays artist from user's deposit.
     * @param artist    Artist wallet
     * @param beatsUsed Beats consumed during session
     * @param user      Listener wallet
     */
    function settle(address artist, uint256 beatsUsed, address user) external onlyOwner {
        uint256 usdcAmount = beatsUsed * USDC_PER_BEAT;
        require(deposits[user] >= usdcAmount, "Insufficient deposit");

        deposits[user] -= usdcAmount;
        artistEarnings[artist] += usdcAmount;

        bool ok = usdc.transfer(artist, usdcAmount);
        require(ok, "Transfer to artist failed");

        emit Settled(artist, usdcAmount, user, beatsUsed);
    }

    /**
     * @notice User withdraws remaining USDC balance.
     */
    function withdraw() external {
        uint256 amount = deposits[msg.sender];
        require(amount > 0, "No deposit");

        deposits[msg.sender] = 0;

        bool ok = usdc.transfer(msg.sender, amount);
        require(ok, "USDC transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Emit event for artist registration (indexed by backend for ENS linkage).
     */
    function registerArtist(string calldata ensName) external {
        emit ArtistRegistered(msg.sender, ensName);
    }

    /**
     * @notice Total USDC held in vault.
     */
    function vaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get deposit of a specific user.
     */
    function getDeposit(address user) external view returns (uint256) {
        return deposits[user];
    }

    /**
     * @notice Get earnings of a specific artist.
     */
    function getArtistEarnings(address artist) external view returns (uint256) {
        return artistEarnings[artist];
    }
}
