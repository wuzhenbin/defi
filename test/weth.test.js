const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { eth2big, getBalance } = require("../utils/utils")

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("WETH Unit Tests", function () {
        let owner, WETH
        beforeEach(async () => {
            ;[owner] = await ethers.getSigners()
            const WETHContract = await ethers.getContractFactory("WETH")
            WETH = await WETHContract.deploy()
        })

        it("deposit", async () => {
            expect(await WETH.balanceOf(owner.address)).to.equal(eth2big(0))
            await WETH.deposit({ value: eth2big(5) })
            expect(await WETH.balanceOf(owner.address)).to.equal(eth2big(5))
        })

        it("withdraw", async () => {
            await WETH.deposit({ value: eth2big(5) })
            // overflow
            await expect(WETH.withdraw(eth2big(10))).to.be.reverted

            await WETH.withdraw(eth2big(3))
            expect(await WETH.balanceOf(owner.address)).to.equal(eth2big(2))
        })
    })
}
