// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract DeadSwitchVault {
    IERC20 public usdc;
    address public platformWallet;
    address public owner;

    constructor(address _usdc, address _platformWallet) {
        usdc = IERC20(_usdc);
        platformWallet = _platformWallet;
        owner = msg.sender;
    }

    // ── Subscription Tiers ────────────────────────────────────

    enum Tier { FREE, MONTHLY, SIXMONTH, YEARLY }

    struct Subscription {
        Tier tier;
        uint256 expiresAt; // 0 = free forever
    }

    // Tier config
    uint256 public constant MONTHLY_PRICE  = 15 * 1e6;  // 15 USDC (6 decimals)
    uint256 public constant SIXMONTH_PRICE = 50 * 1e6;  // 50 USDC
    uint256 public constant YEARLY_PRICE   = 150 * 1e6; // 150 USDC

    uint256 public constant MONTHLY_DURATION  = 30 days;
    uint256 public constant SIXMONTH_DURATION = 180 days;
    uint256 public constant YEARLY_DURATION   = 365 days;

    // Max active switches per tier
    uint256 public constant FREE_MAX_SWITCHES      = 1;
    uint256 public constant MONTHLY_MAX_SWITCHES   = 2;
    uint256 public constant SIXMONTH_MAX_SWITCHES  = 5;
    // Yearly = unlimited (we use type(uint256).max)

    // Max timer duration per tier (in seconds)
    uint256 public constant FREE_MAX_TIMER      = 30 days;
    uint256 public constant MONTHLY_MAX_TIMER   = 90 days;
    uint256 public constant SIXMONTH_MAX_TIMER  = 180 days;
    uint256 public constant YEARLY_MAX_TIMER    = 365 days;

    mapping(address => Subscription) public subscriptions;
    mapping(address => uint256) public activeSwitchCount; // tracks active switches per user

    event Subscribed(address indexed user, Tier tier, uint256 expiresAt);

    // ── Subscribe ─────────────────────────────────────────────

    function subscribe(Tier _tier) external {
        require(_tier != Tier.FREE, "Free tier needs no payment");

        uint256 price;
        uint256 duration;

        if (_tier == Tier.MONTHLY) {
            price = MONTHLY_PRICE;
            duration = MONTHLY_DURATION;
        } else if (_tier == Tier.SIXMONTH) {
            price = SIXMONTH_PRICE;
            duration = SIXMONTH_DURATION;
        } else if (_tier == Tier.YEARLY) {
            price = YEARLY_PRICE;
            duration = YEARLY_DURATION;
        }

        require(usdc.transferFrom(msg.sender, platformWallet, price), "Payment failed");

        // If already subscribed and not expired, extend from current expiry
        uint256 currentExpiry = subscriptions[msg.sender].expiresAt;
        uint256 startFrom = (currentExpiry > block.timestamp) ? currentExpiry : block.timestamp;

        subscriptions[msg.sender] = Subscription({
            tier: _tier,
            expiresAt: startFrom + duration
        });

        emit Subscribed(msg.sender, _tier, startFrom + duration);
    }

    // ── Tier Helpers ──────────────────────────────────────────

    function getTier(address user) public view returns (Tier) {
        Subscription memory sub = subscriptions[user];
        if (sub.expiresAt == 0) return Tier.FREE; // never subscribed
        if (block.timestamp > sub.expiresAt) return Tier.FREE; // expired
        return sub.tier;
    }

    function getMaxSwitches(address user) public view returns (uint256) {
        Tier t = getTier(user);
        if (t == Tier.FREE)      return FREE_MAX_SWITCHES;
        if (t == Tier.MONTHLY)   return MONTHLY_MAX_SWITCHES;
        if (t == Tier.SIXMONTH)  return SIXMONTH_MAX_SWITCHES;
        return type(uint256).max; // YEARLY = unlimited
    }

    function getMaxTimer(address user) public view returns (uint256) {
        Tier t = getTier(user);
        if (t == Tier.FREE)      return FREE_MAX_TIMER;
        if (t == Tier.MONTHLY)   return MONTHLY_MAX_TIMER;
        if (t == Tier.SIXMONTH)  return SIXMONTH_MAX_TIMER;
        return YEARLY_MAX_TIMER;
    }

    function getSubscription(address user) external view returns (Tier tier, uint256 expiresAt, uint256 maxSwitches, uint256 maxTimer) {
        return (getTier(user), subscriptions[user].expiresAt, getMaxSwitches(user), getMaxTimer(user));
    }

    // ── Existing Switch Logic (UNTOUCHED except tier checks) ──

    struct Switch {
        address owner;
        address backup;
        uint256 amount;
        uint256 deadline;
        bool executed;
        bool cancelled;
    }

    uint256 public switchCount;
    mapping(uint256 => Switch) public switches;

    event SwitchCreated(uint256 indexed id, address indexed owner, address indexed backup, uint256 amount, uint256 deadline);
    event Executed(uint256 indexed id, address indexed backup, uint256 amount);
    event Cancelled(uint256 indexed id, address indexed owner);
    event CheckIn(uint256 indexed id, address indexed owner, uint256 newDeadline);

    function createSwitch(address _backup, uint256 _amount, uint256 _durationSeconds) external returns (uint256) {
        require(_backup != address(0), "Invalid backup");
        require(_amount > 0, "Amount must be greater than 0");
        require(_durationSeconds > 0, "Timer required");

        // ── Tier checks ──
        require(activeSwitchCount[msg.sender] < getMaxSwitches(msg.sender), "Switch limit reached for your tier");
        require(_durationSeconds <= getMaxTimer(msg.sender), "Timer exceeds your tier limit");

        usdc.transferFrom(msg.sender, address(this), _amount);
        switchCount++;
        activeSwitchCount[msg.sender]++;

        uint256 deadline = block.timestamp + _durationSeconds;
        switches[switchCount] = Switch({
            owner: msg.sender, backup: _backup, amount: _amount,
            deadline: deadline, executed: false, cancelled: false
        });
        emit SwitchCreated(switchCount, msg.sender, _backup, _amount, deadline);
        return switchCount;
    }

    function execute(uint256 id) public {
        Switch storage sw = switches[id];
        require(!sw.executed, "Already executed");
        require(!sw.cancelled, "Cancelled");
        require(block.timestamp >= sw.deadline, "Too early");
        sw.executed = true;
        activeSwitchCount[sw.owner] = activeSwitchCount[sw.owner] > 0
            ? activeSwitchCount[sw.owner] - 1
            : 0;
        usdc.transfer(sw.backup, sw.amount);
        emit Executed(id, sw.backup, sw.amount);
    }

    function cancel(uint256 id) external {
        Switch storage sw = switches[id];
        require(msg.sender == sw.owner, "Not owner");
        require(!sw.executed, "Already executed");
        require(!sw.cancelled, "Already cancelled");
        sw.cancelled = true;
        activeSwitchCount[msg.sender] = activeSwitchCount[msg.sender] > 0
            ? activeSwitchCount[msg.sender] - 1
            : 0;
        usdc.transfer(sw.owner, sw.amount);
        emit Cancelled(id, sw.owner);
    }

    function checkIn(uint256 id, uint256 _durationSeconds) external {
        Switch storage sw = switches[id];
        require(msg.sender == sw.owner, "Not owner");
        require(!sw.executed, "Already executed");
        require(!sw.cancelled, "Cancelled");
        require(_durationSeconds > 0, "Timer required");
        require(_durationSeconds <= getMaxTimer(msg.sender), "Timer exceeds your tier limit");
        sw.deadline = block.timestamp + _durationSeconds;
        emit CheckIn(id, sw.owner, sw.deadline);
    }

    // ── Chainlink Automation (untouched) ──────────────────────

    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        for (uint256 i = 1; i <= switchCount; i++) {
            Switch storage sw = switches[i];
            if (!sw.executed && !sw.cancelled && block.timestamp >= sw.deadline) {
                return (true, abi.encode(i));
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external {
        uint256 id = abi.decode(performData, (uint256));
        Switch storage sw = switches[id];
        require(!sw.executed && !sw.cancelled && block.timestamp >= sw.deadline, "Not ready");
        execute(id);
    }

    function timeRemaining(uint256 id) external view returns (uint256) {
        Switch storage sw = switches[id];
        if (block.timestamp >= sw.deadline) return 0;
        return sw.deadline - block.timestamp;
    }

    function getSwitch(uint256 id) external view returns (
        address owner, address backup, uint256 amount,
        uint256 deadline, bool executed, bool cancelled
    ) {
        Switch storage sw = switches[id];
        return (sw.owner, sw.backup, sw.amount, sw.deadline, sw.executed, sw.cancelled);
    }

    // ── Admin ─────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function updatePlatformWallet(address _newWallet) external onlyOwner {
        platformWallet = _newWallet;
    }
}
