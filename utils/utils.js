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

// 获取合约或账户余额
const getBalance = ethers.provider.getBalance

module.exports = {
    eth2big,
    big2eth,
    getBlockTime,
    getBalance,
    increaseTime,
}
