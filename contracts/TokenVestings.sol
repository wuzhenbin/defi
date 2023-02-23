// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

error TokenVesting_ZeroAddress();

contract TokenVesting {
    // 代币地址->释放数量的映射, 记录已经释放的代币
    mapping(address => uint256) public erc20Released;
    // 受益人地址
    address public immutable beneficiary;
    // 起始时间戳
    uint256 public immutable start;
    // 归属期
    uint256 public immutable duration;

    // 事件
    event ERC20Released(address indexed token, uint256 amount);

    // 初始化受益人地址, 释放周期(秒), 起始时间戳(当前区块链时间戳)
    constructor(address beneficiaryAddress, uint256 durationSeconds) {
        if (beneficiaryAddress == address(0)) {
            revert TokenVesting_ZeroAddress();
        }

        beneficiary = beneficiaryAddress;
        start = block.timestamp;
        duration = durationSeconds;
    }

    function getNow() public view returns (uint256) {
        return block.timestamp;
    }

    /**
        @dev 受益人提取已释放的代币。
        调用vestedAmount()函数计算可提取的代币数量, 然后transfer给受益人。
        释放 {ERC20Released} 事件.
    */
    function release(address token) public {
        uint256 releasable = vestedAmount(token, uint256(block.timestamp)) -
            erc20Released[token];

        erc20Released[token] += releasable;
        emit ERC20Released(token, releasable);
        IERC20(token).transfer(beneficiary, releasable);
    }

    /*
        根据线性释放公式, 计算已经释放的数量。开发者可以通过修改这个函数, 自定义释放方式。
        token: 代币地址
        timestamp: 查询的时间戳
    */
    function vestedAmount(
        address token,
        uint256 timestamp
    ) public view returns (uint256) {
        // 合约里总共收到了多少代币（当前余额 + 已经提取）
        uint256 totalAllocation = IERC20(token).balanceOf(address(this)) +
            erc20Released[token];
        // 根据线性释放公式, 计算已经释放的数量
        if (timestamp < start) {
            return 0;
        } else if (timestamp > start + duration) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - start)) / duration;
        }
    }
}
