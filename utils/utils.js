const { ethers } = require("hardhat")

// eth => BigNumber
const eth2big = (eth) => ethers.utils.parseEther(eth.toString())
// BigNumber => eth
const big2eth = (bigNumber) => ethers.utils.formatEther(bigNumber)

const getBlockTime = async () => {
    let blockNumBefore = await ethers.provider.getBlockNumber()
    let blockBefore = await ethers.provider.getBlock(blockNumBefore)
    return blockBefore.timestamp
}

const increaseTime = async (increaseTime) => {
    await network.provider.send("evm_increaseTime", [increaseTime])
    await network.provider.send("evm_mine")
}

// 多签 按顺序 从小到大签
const getSignature = async (users, hash) => {
    // sort the users
    let newSort = users.sort((a, b) => a.address - b.address)
    let signature = "0x"

    for (let i = 0; i < newSort.length; i++) {
        let sigItem = await newSort[i].signMessage(ethers.utils.arrayify(hash))
        signature = `${signature}${sigItem.replace("0x", "")}`
    }

    return signature
}

// 获取合约或账户余额
const getBalance = ethers.provider.getBalance

module.exports = {
    eth2big,
    big2eth,
    getBlockTime,
    getBalance,
    increaseTime,
    getSignature,
}
