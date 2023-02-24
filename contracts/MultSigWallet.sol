// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "hardhat/console.sol";

error MultiSigWallet__Error5000();
error MultiSigWallet__Error5001();
error MultiSigWallet__Error5002();
error MultiSigWallet__Siged();

contract MultiSigWallet {
    using EnumerableSet for EnumerableSet.AddressSet;

    event ExecutionSuccess(bytes32 txHash);
    event ExecutionFailure(bytes32 txHash);

    EnumerableSet.AddressSet private mySet;
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public ownerCount;
    uint256 public threshold;
    uint256 public nonce;

    receive() external payable {}

    constructor(address[] memory _owners, uint256 _threshold) {
        _setupOwners(_owners, _threshold);
    }

    function _setupOwners(
        address[] memory _owners,
        uint256 _threshold
    ) internal {
        // 还没设置过
        if (threshold != 0) {
            revert MultiSigWallet__Error5000();
        }
        // 多签门槛不能大于所有者人数
        if (_threshold > _owners.length) {
            revert MultiSigWallet__Error5001();
        }
        // 多签门槛至少大于1
        if (_threshold < 1) {
            revert MultiSigWallet__Error5002();
        }

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            // owner 不能为空 不能为合约地址并且还没设置过
            require(
                owner != address(0) &&
                    owner != address(this) &&
                    !isOwner[owner],
                "WTF5003"
            );

            owners.push(owner);
            isOwner[owner] = true;
        }
        ownerCount = _owners.length;
        threshold = _threshold;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes memory data,
        bytes memory signatures
    ) public payable virtual returns (bool success) {
        bytes32 txHash = encodeTransactionData(to, value, data);
        nonce++;
        checkSignatures(txHash, signatures);
        (success, ) = to.call{value: value}(data);
        require(success, "WTF5004");
        if (success) emit ExecutionSuccess(txHash);
        else emit ExecutionFailure(txHash);
    }

    function checkSignatures(
        bytes32 dataHash,
        bytes memory signatures
    ) public view {
        uint256 _threshold = threshold;
        require(_threshold > 0, "WTF5005");

        require(signatures.length >= _threshold * 65, "WTF5006");

        address lastOwner = address(0);
        address currentOwner;

        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 i;

        for (i = 0; i < _threshold; i++) {
            (r, s, v) = signatureSplit(signatures, i);
            currentOwner = ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        dataHash
                    )
                ),
                v,
                r,
                s
            );
            require(
                currentOwner > lastOwner && isOwner[currentOwner],
                "WTF5007"
            );
            lastOwner = currentOwner;
        }
    }

    function signatureSplit(
        bytes memory signatures,
        uint256 pos
    ) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            v := byte(0, mload(add(signatures, add(signaturePos, 0x60))))
        }
    }

    function encodeTransactionData(
        address to,
        uint256 value,
        bytes memory data
    ) public view returns (bytes32) {
        bytes32 safeTxHash = keccak256(
            abi.encode(to, value, keccak256(data), nonce, block.chainid)
        );
        return safeTxHash;
    }

    function concatenateAddresses(
        address addr1,
        address addr2
    ) public pure returns (address) {
        bytes memory concatenatedBytes = abi.encodePacked(addr1, addr2);
        return address(bytes20(keccak256(concatenatedBytes)));
    }
}
