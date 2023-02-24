const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const {
    eth2big,
    getBlockTime,
    increaseTime,
    getBalance,
} = require("../utils/utils")

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("CrowdFund Unit Tests", function () {
        let owner, user1, user2, user3, CrowdFund
        beforeEach(async () => {
            ;[owner, user1, user2, user3] = await ethers.getSigners()

            const TokenContract = await ethers.getContractFactory(
                "ERC20FixedSupply"
            )
            // defalut mint 10eth
            Token = await TokenContract.deploy("Bitcoin", "BTC", 20)
            await Token.mint(user1.address, eth2big(5))
            await Token.mint(user2.address, eth2big(5))
            await Token.mint(user3.address, eth2big(5))

            const CrowdFundContract = await ethers.getContractFactory(
                "CrowdFund"
            )
            CrowdFund = await CrowdFundContract.deploy(Token.address)
        })

        describe("launch", () => {
            it("launch set start time", async () => {
                let start = await getBlockTime()
                await expect(
                    CrowdFund.launch(eth2big(5), start - 5, start + 100)
                ).to.be.revertedWith("CrowdFund__InvaildStartTime")

                start = await getBlockTime()
                await expect(
                    CrowdFund.launch(
                        eth2big(5),
                        start + 1,
                        start + 90 * 24 * 60 * 60 + 10
                    )
                ).to.be.revertedWith("CrowdFund__InvaildEndTime")

                start = await getBlockTime()
                await expect(
                    CrowdFund.launch(eth2big(5), start + 10, start + 9)
                ).to.be.revertedWith("CrowdFund__InvaildEndTime")
            })
            it("launch success", async () => {
                let start = await getBlockTime()
                await CrowdFund.launch(eth2big(5), start + 5, start + 1000)
                expect(await CrowdFund.count()).to.equal(1)
                let { creator, goal, startAt, endAt } =
                    await CrowdFund.campaigns(1)
                expect(creator).to.equal(owner.address)
                expect(goal).to.equal(eth2big(5))
                expect(startAt).to.equal(start + 5)
                expect(endAt).to.equal(start + 1000)
            })
        })

        describe("cancel", () => {
            beforeEach(async () => {
                let start = await getBlockTime()
                await CrowdFund.launch(eth2big(5), start + 5, start + 1000)
            })
            it("only owner can cancel", async () => {
                await expect(
                    CrowdFund.connect(user1).cancel(1)
                ).to.be.revertedWith("CrowdFund__NotOwner")
            })
            it("campaign is start", async () => {
                let current = await getBlockTime()
                await increaseTime(current + 1000)
                await expect(CrowdFund.cancel(1)).to.be.revertedWith(
                    "CrowdFund__Started"
                )
            })
            it("cancel success", async () => {
                await CrowdFund.cancel(1)
                let { startAt } = await CrowdFund.campaigns(1)
                expect(startAt).to.equal(0)
            })
        })

        describe("pledge", () => {
            beforeEach(async () => {
                let start = await getBlockTime()
                await CrowdFund.launch(eth2big(5), start + 5, start + 1000)
            })

            it("campaign not start", async () => {
                await expect(
                    CrowdFund.pledge(1, eth2big(0.05))
                ).to.be.revertedWith("CrowdFund__NotStarted")
            })

            it("campaign is ended", async () => {
                await increaseTime(1000)

                await expect(
                    CrowdFund.pledge(1, eth2big(0.05))
                ).to.be.revertedWith("CrowdFund__Ended")
            })

            it("pledge success", async () => {
                await increaseTime(10)

                await Token.approve(CrowdFund.address, eth2big(0.05))
                await CrowdFund.pledge(1, eth2big(0.05))
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(0.05)
                )
                await CrowdFund.connect(user1).pledge(1, eth2big(0.05))

                expect(await Token.balanceOf(CrowdFund.address)).to.equal(
                    eth2big(0.1)
                )
                expect(
                    await CrowdFund.pledgedAmount(1, owner.address)
                ).to.equal(eth2big(0.05))
                expect(
                    await CrowdFund.pledgedAmount(1, user1.address)
                ).to.equal(eth2big(0.05))
            })
        })

        describe("unpledge", () => {
            beforeEach(async () => {
                let start = await getBlockTime()
                await CrowdFund.launch(eth2big(5), start + 5, start + 1000)
                await increaseTime(10)

                await Token.approve(CrowdFund.address, eth2big(0.05))
                await CrowdFund.pledge(1, eth2big(0.05))
            })

            it("unpledge success", async () => {
                await increaseTime(10)

                await CrowdFund.unpledge(1, eth2big(0.02))
                expect(
                    await CrowdFund.pledgedAmount(1, owner.address)
                ).to.equal(eth2big(0.03))

                await CrowdFund.unpledge(1, eth2big(0.03))

                expect(
                    await CrowdFund.pledgedAmount(1, owner.address)
                ).to.equal(eth2big(0))

                let { pledged } = await CrowdFund.campaigns(1)
                expect(pledged).to.equal(eth2big(0))

                expect(await Token.balanceOf(CrowdFund.address)).to.equal(
                    eth2big(0)
                )
            })

            it("campaign is ended", async () => {
                await increaseTime(1000)
                await expect(
                    CrowdFund.unpledge(1, eth2big(0.05))
                ).to.be.revertedWith("CrowdFund__Ended")
            })
        })

        describe("claim", () => {
            beforeEach(async () => {
                let start = await getBlockTime()
                await CrowdFund.launch(eth2big(5), start + 5, start + 1000)
                await increaseTime(10)
            })

            it("only owner can claim", async () => {
                await expect(
                    CrowdFund.connect(user1).claim(1)
                ).to.be.revertedWith("CrowdFund__NotOwner")
            })

            it("not ended", async () => {
                await Token.approve(CrowdFund.address, eth2big(2))
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(3)
                )
                await CrowdFund.pledge(1, eth2big(2))
                await CrowdFund.connect(user1).pledge(1, eth2big(3))

                await expect(CrowdFund.claim(1)).to.be.revertedWith(
                    "CrowdFund__NotEnded"
                )
            })

            it("claim success", async () => {
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(2)
                )
                await Token.connect(user2).approve(
                    CrowdFund.address,
                    eth2big(3)
                )
                await CrowdFund.connect(user1).pledge(1, eth2big(2))
                await CrowdFund.connect(user2).pledge(1, eth2big(3))

                await increaseTime(1000)

                let balance = await Token.balanceOf(owner.address)
                await CrowdFund.claim(1)

                let { claimed } = await CrowdFund.campaigns(1)
                expect(claimed).to.equal(true)
                expect(
                    (await Token.balanceOf(owner.address)).sub(balance)
                ).to.equal(eth2big(5))
                expect(await Token.balanceOf(CrowdFund.address)).to.equal(0)
            })

            it("be claimed", async () => {
                await Token.approve(CrowdFund.address, eth2big(2))
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(3)
                )
                await CrowdFund.pledge(1, eth2big(2))
                await CrowdFund.connect(user1).pledge(1, eth2big(3))

                await increaseTime(1000)
                await CrowdFund.claim(1)
                await expect(CrowdFund.claim(1)).to.be.revertedWith(
                    "CrowdFund__Claimed"
                )
            })

            it("goal fail", async () => {
                await Token.approve(CrowdFund.address, eth2big(2))
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(2)
                )
                await CrowdFund.pledge(1, eth2big(2))
                await CrowdFund.connect(user1).pledge(1, eth2big(2))

                await increaseTime(1000)
                await expect(CrowdFund.claim(1)).to.be.revertedWith(
                    "CrowdFund__GoalFail"
                )
            })
        })

        describe("refund", () => {
            beforeEach(async () => {
                let start = await getBlockTime()
                await CrowdFund.launch(eth2big(5), start + 5, start + 1000)
                await increaseTime(10)
            })

            it("not ended", async () => {
                await expect(CrowdFund.refund(1)).to.be.revertedWith(
                    "CrowdFund__NotEnded"
                )
            })

            it("goal success can't refund", async () => {
                await Token.approve(CrowdFund.address, eth2big(2))
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(3)
                )
                await CrowdFund.pledge(1, eth2big(2))
                await CrowdFund.connect(user1).pledge(1, eth2big(3))

                await increaseTime(1000)

                await expect(CrowdFund.refund(1)).to.be.revertedWith(
                    "CrowdFund__GoalSuccess"
                )
            })

            it("refund success", async () => {
                await Token.connect(user1).approve(
                    CrowdFund.address,
                    eth2big(3)
                )
                await CrowdFund.connect(user1).pledge(1, eth2big(3))
                await increaseTime(1000)

                let balance = await Token.balanceOf(user1.address)
                await CrowdFund.connect(user1).refund(1)
                expect(
                    (await Token.balanceOf(user1.address)).sub(balance)
                ).to.equal(eth2big(3))
            })
        })
    })
}
