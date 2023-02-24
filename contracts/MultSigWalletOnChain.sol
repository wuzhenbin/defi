// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

error MultiSigWalletOnChain__NotOwner();
error MultiSigWalletOnChain__TxNotExist();
error MultiSigWalletOnChain__TxAlreadyExecuted();
error MultiSigWalletOnChain__TxAlreadyConfirmed();
error MultiSigWalletOnChain__InvalidNumber();
error MultiSigWalletOnChain__InvalidOwner();
error MultiSigWalletOnChain__OwnerNotUnique();
error MultiSigWalletOnChain__OwnerRequired();
error MultiSigWalletOnChain__TxNotConfirmed();
error MultiSigWalletOnChain__NumRequireNotEnough();

contract MultiSigWalletOnChain {
    event Deposit(address indexed sender, uint amount, uint balance);
    event SubmitTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed to,
        uint value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    // mapping from tx index => owner => bool
    mapping(uint => mapping(address => bool)) public isConfirmed;

    Transaction[] public transactions;

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) {
            revert MultiSigWalletOnChain__NotOwner();
        }
        _;
    }

    modifier txExists(uint _txIndex) {
        if (_txIndex >= transactions.length) {
            revert MultiSigWalletOnChain__TxNotExist();
        }
        _;
    }

    modifier notExecuted(uint _txIndex) {
        if (transactions[_txIndex].executed) {
            revert MultiSigWalletOnChain__TxAlreadyExecuted();
        }
        _;
    }

    modifier notConfirmed(uint _txIndex) {
        if (isConfirmed[_txIndex][msg.sender]) {
            revert MultiSigWalletOnChain__TxAlreadyConfirmed();
        }
        _;
    }

    modifier confirmed(uint _txIndex) {
        if (!isConfirmed[_txIndex][msg.sender]) {
            revert MultiSigWalletOnChain__TxNotConfirmed();
        }
        _;
    }

    constructor(address[] memory _owners, uint _numConfirmationsRequired) {
        // 至少一个管理员
        if (_owners.length <= 0) {
            revert MultiSigWalletOnChain__OwnerRequired();
        }
        // 确认条件大于0 && 小于管理员人数
        if (
            _numConfirmationsRequired <= 0 ||
            _numConfirmationsRequired > _owners.length
        ) {
            revert MultiSigWalletOnChain__InvalidNumber();
        }

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            if (owner == address(0)) {
                revert MultiSigWalletOnChain__InvalidOwner();
            }

            if (isOwner[owner]) {
                revert MultiSigWalletOnChain__OwnerNotUnique();
            }

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) public onlyOwner {
        uint txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    function confirmTransaction(
        uint _txIndex
    )
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    function executeTransaction(
        uint _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        if (transaction.numConfirmations < numConfirmationsRequired) {
            revert MultiSigWalletOnChain__NumRequireNotEnough();
        }

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    function revokeConfirmation(
        uint _txIndex
    )
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        confirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint) {
        return transactions.length;
    }

    function getTransaction(
        uint _txIndex
    )
        public
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
