// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract DeadSwitchVault {
    IERC20 public usdc;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

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

    function createSwitch(address _backup, uint256 _amount, uint256 _days) external returns (uint256) {
        require(_backup != address(0), "Invalid backup");
        require(_amount > 0, "Amount must be greater than 0");
        usdc.transferFrom(msg.sender, address(this), _amount);
        switchCount++;
        uint256 deadline = block.timestamp + (_days * 1 days);
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
        usdc.transfer(sw.backup, sw.amount);
        emit Executed(id, sw.backup, sw.amount);
    }

    function cancel(uint256 id) external {
        Switch storage sw = switches[id];
        require(msg.sender == sw.owner, "Not owner");
        require(!sw.executed, "Already executed");
        require(!sw.cancelled, "Already cancelled");
        sw.cancelled = true;
        usdc.transfer(sw.owner, sw.amount);
        emit Cancelled(id, sw.owner);
    }

    function checkIn(uint256 id, uint256 _days) external {
        Switch storage sw = switches[id];
        require(msg.sender == sw.owner, "Not owner");
        require(!sw.executed, "Already executed");
        require(!sw.cancelled, "Cancelled");
        sw.deadline = block.timestamp + (_days * 1 days);
        emit CheckIn(id, sw.owner, sw.deadline);
    }

    // ── Chainlink Automation ──────────────────────────────────
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
}