const { ethers } = require("hardhat")

// eth => BigNumber
const eth2big = (eth) => ethers.utils.parseEther(eth.toString())
// BigNumber => eth
const big2eth = (bigNumber) => ethers.utils.formatEther(bigNumber)

module.exports = {
    eth2big,
    big2eth,
}
