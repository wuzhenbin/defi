// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.17;

// import "hardhat/console.sol";

error Timelock__CallerNotOwner();
error Timelock__CallerNotTimeLock();
error Timelock__NotTime();
error Timelock__NotInQueued();
error Timelock__TimeExceed();
error Timelock__ExecuteReverted();

contract Timelock {
    // 交易取消事件
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint value,
        string signature,
        bytes data,
        uint executeTime
    );
    // 交易执行事件
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint value,
        string signature,
        bytes data,
        uint executeTime
    );
    // 交易创建并进入队列 事件
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint value,
        string signature,
        bytes data,
        uint executeTime
    );
    // 修改管理员地址的事件
    event NewAdmin(address indexed newAdmin);

    // 状态变量
    // 管理员地址
    address public admin;
    // 交易有效期, 过期的交易作废
    uint public constant GRACE_PERIOD = 7 days;
    // 交易锁定时间 （秒）
    uint public delay;
    // txHash到bool, 记录所有在时间锁队列中的交易
    mapping(bytes32 => bool) public queuedTransactions;

    // onlyOwner modifier
    modifier onlyOwner() {
        if (msg.sender != admin) {
            revert Timelock__CallerNotOwner();
        }
        _;
    }

    // onlyTimelock modifier
    modifier onlyTimelock() {
        if (msg.sender != address(this)) {
            revert Timelock__CallerNotTimeLock();
        }
        _;
    }

    // 初始化交易锁定时间 （秒）和管理员地址
    constructor(uint delay_) {
        delay = delay_;
        admin = msg.sender;
    }

    // 改变管理员地址, 调用者必须是Timelock合约.
    function changeAdmin(address newAdmin) public onlyTimelock {
        admin = newAdmin;
        emit NewAdmin(newAdmin);
    }

    /**
     创建交易并添加到时间锁队列中. 
        target: 目标合约地址
        value: 发送eth数额
        signature: 要调用的函数签名（function signature）
        data: call data, 里面是一些参数
        executeTime: 交易执行的区块链时间戳
     
        要求: 要超过锁定时间才能执行
    */
    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executeTime
    ) public onlyOwner returns (bytes32) {
        // 检查: 交易执行时间满足锁定时间
        if (executeTime < block.timestamp + delay) {
            revert Timelock__NotTime();
        }
        // 计算交易的唯一识别符: 一堆东西的hash
        bytes32 txHash = getTxHash(target, value, signature, data, executeTime);
        // 将交易添加到队列
        queuedTransactions[txHash] = true;

        emit QueueTransaction(
            txHash,
            target,
            value,
            signature,
            data,
            executeTime
        );
        return txHash;
    }

    /**
        取消特定交易. 
        要求: 交易在时间锁队列中
    */
    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executeTime
    ) public onlyOwner {
        // 计算交易的唯一识别符: 一堆东西的hash
        bytes32 txHash = getTxHash(target, value, signature, data, executeTime);
        // 检查: 交易在时间锁队列中
        if (!queuedTransactions[txHash]) {
            revert Timelock__NotInQueued();
        }
        // 将交易移出队列
        queuedTransactions[txHash] = false;

        emit CancelTransaction(
            txHash,
            target,
            value,
            signature,
            data,
            executeTime
        );
    }

    /**
        @dev 执行特定交易. 
        要求: 
        1. 交易在时间锁队列中
        2. 达到交易的执行时间
        3. 交易没过期
    */
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executeTime
    ) public payable onlyOwner returns (bytes memory) {
        bytes32 txHash = getTxHash(target, value, signature, data, executeTime);
        // 检查: 交易是否在时间锁队列中
        if (!queuedTransactions[txHash]) {
            revert Timelock__NotInQueued();
        }

        // 检查: 达到交易的执行时间
        if (block.timestamp < executeTime) {
            revert Timelock__NotTime();
        }

        // 检查: 交易没过期
        if (block.timestamp > executeTime + GRACE_PERIOD) {
            revert Timelock__TimeExceed();
        }

        // 将交易移出队列
        queuedTransactions[txHash] = false;

        // 获取call data
        bytes memory callData;

        // 没有signature的时候 data就包含selecor和参数
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        // 利用call执行交易
        (bool success, bytes memory returnData) = target.call{value: value}(
            callData
        );

        if (!success) {
            revert Timelock__ExecuteReverted();
        }

        emit ExecuteTransaction(
            txHash,
            target,
            value,
            signature,
            data,
            executeTime
        );

        return returnData;
    }

    // 将一堆东西拼成交易的标识符
    function getTxHash(
        address target,
        uint value,
        string memory signature,
        bytes memory data,
        uint executeTime
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encode(target, value, signature, data, executeTime));
    }
}
