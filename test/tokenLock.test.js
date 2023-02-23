const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { eth2big } = require("../utils/utils")

// 获取合约或账户余额
const getBalance = ethers.provider.getBalance

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("TokenLock Unit Tests", function () {
        let owner, user1, Token, TokenLock
        beforeEach(async () => {
            ;[owner, user1] = await ethers.getSigners()
            const TokenContract = await ethers.getContractFactory(
                "ERC20FixedSupply"
            )
            // default mint 10 eth
            Token = await TokenContract.deploy("Bitcoin", "BTC", 10)

            // deploy token_lock 部署TokenLocker合约, 代币地址为ERC20合约地址, 受益人为user1, 锁仓期填180秒
            const TokenLockContract = await ethers.getContractFactory(
                "TokenLocker"
            )
            TokenLock = await TokenLockContract.deploy(
                Token.address,
                user1.address,
                180
            )
        })

        it("release wrong time", async () => {
            await expect(
                TokenLock.connect(user1).release()
            ).to.be.revertedWithCustomError(TokenLock, "TokenLocker__IllTime")
        })

        it("release no token", async () => {
            const ts = parseInt(new Date().valueOf() / 1000) + 180
            await network.provider.send("evm_increaseTime", [ts])
            await network.provider.send("evm_mine")

            await expect(
                TokenLock.connect(user1).release()
            ).to.be.revertedWithCustomError(TokenLock, "TokenLocker__NoTokens")
        })
        it("release", async () => {
            const ts = parseInt(new Date().valueOf() / 1000) + 180
            await network.provider.send("evm_increaseTime", [ts])
            await network.provider.send("evm_mine")

            // for TokenLock mint 10000
            Token.mint(TokenLock.address, 10000)

            await TokenLock.connect(user1).release()

            let balance = await Token.balanceOf(user1.address)
            expect(balance).to.equal(10000)
        })
    })
}
