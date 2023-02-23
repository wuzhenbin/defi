const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { eth2big } = require("../utils/utils")

// 获取合约或账户余额
const getBalance = ethers.provider.getBalance

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("Faucet Unit Tests", function () {
        let owner, user1, Token, Vesting
        beforeEach(async () => {
            ;[owner, user1] = await ethers.getSigners()
            const TokenContract = await ethers.getContractFactory(
                "ERC20FixedSupply"
            )
            // default mint 10 eth
            Token = await TokenContract.deploy("Bitcoin", "BTC", 10)

            // 部署TokenVesting线性释放合约，受益人设为user1，归属期设为 180000 秒
            const VestingContract = await ethers.getContractFactory(
                "TokenVesting"
            )
            Vesting = await VestingContract.deploy(user1.address, 180000)
            // for Vesting mint 10000
            Token.mint(Vesting.address, 10000)
        })

        it("contracts deployed", async () => {
            let balance = await Token.balanceOf(Vesting.address)
            expect(balance).to.equal(10000)
        })

        it("release", async () => {
            await Vesting.release(Token.address)
            let balance = await Token.balanceOf(user1.address)
            expect(balance).to.equal(0)

            await network.provider.send("evm_increaseTime", [90000])
            await network.provider.send("evm_mine")

            await Vesting.release(Token.address)
            balance = await Token.balanceOf(user1.address)
            expect(balance).to.equal(5000)

            await network.provider.send("evm_increaseTime", [90000])
            await network.provider.send("evm_mine")

            await Vesting.release(Token.address)
            balance = await Token.balanceOf(user1.address)
            expect(balance).to.equal(10000)
        })
    })
}
