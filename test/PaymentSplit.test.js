const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { eth2big } = require("../utils/utils")

// 获取合约或账户余额
const getBalance = ethers.provider.getBalance

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("PaymentSplit Unit Tests", function () {
        let owner, user1, user2, user3, user4, PaymentSplit
        beforeEach(async () => {
            ;[owner, user1, user2, user3, user4] = await ethers.getSigners()
            const PaymentSplitContract = await ethers.getContractFactory(
                "PaymentSplit"
            )

            PaymentSplit = await PaymentSplitContract.deploy(
                [owner.address, user1.address, user2.address, user3.address],
                [1, 2, 3, 4],
                { value: eth2big(1) }
            )
        })

        describe("Constructor", () => {
            it("Initializes Correctly.", async () => {
                expect(await PaymentSplit.getPayeesLength()).to.equal(4)
                expect(await getBalance(PaymentSplit.address)).to.equal(
                    eth2big(1)
                )
                expect(await PaymentSplit.shares(owner.address)).to.equal(1)
                expect(await PaymentSplit.shares(user1.address)).to.equal(2)
                expect(await PaymentSplit.shares(user2.address)).to.equal(3)
                expect(await PaymentSplit.shares(user3.address)).to.equal(4)

                expect(await PaymentSplit.totalShares()).to.equal(10)
            })
        })

        describe("release", () => {
            it("release other address", async () => {
                await expect(
                    PaymentSplit.release(user4.address)
                ).to.be.revertedWithCustomError(
                    PaymentSplit,
                    "PaymentSplit__AccountNoShares"
                )
            })

            it("release again", async () => {
                await PaymentSplit.release(owner.address)
                await expect(
                    PaymentSplit.release(owner.address)
                ).to.be.revertedWithCustomError(
                    PaymentSplit,
                    "PaymentSplit__AccountNoPayment"
                )
            })

            it("release success", async () => {
                let balance = await getBalance(owner.address)
                let tx = await PaymentSplit.release(owner.address)
                const receipt = await tx.wait()
                const gasFee = receipt.cumulativeGasUsed.mul(
                    receipt.effectiveGasPrice
                )
                balance = (await getBalance(owner.address))
                    .sub(balance)
                    .add(gasFee)

                expect(balance).to.equal(eth2big(0.1))

                expect(await PaymentSplit.totalReleased()).to.equal(
                    eth2big(0.1)
                )
                expect(await PaymentSplit.released(owner.address)).to.equal(
                    eth2big(0.1)
                )
            })
        })

        describe("releasable", () => {
            it("releasable correctly.", async () => {
                expect(await PaymentSplit.releasable(owner.address)).to.equal(
                    eth2big(0.1)
                )
                expect(await PaymentSplit.releasable(user1.address)).to.equal(
                    eth2big(0.2)
                )
                expect(await PaymentSplit.releasable(user2.address)).to.equal(
                    eth2big(0.3)
                )
                expect(await PaymentSplit.releasable(user3.address)).to.equal(
                    eth2big(0.4)
                )
            })
        })

        describe("pendingPayment", () => {
            it("calculator correctly.", async () => {
                // 1eth * 1/10
                expect(
                    await PaymentSplit.pendingPayment(
                        owner.address,
                        eth2big(1),
                        0
                    )
                ).to.equal(eth2big(0.1))

                expect(
                    await PaymentSplit.pendingPayment(
                        owner.address,
                        eth2big(2),
                        eth2big(0.2)
                    )
                ).to.equal(0)

                expect(
                    await PaymentSplit.pendingPayment(
                        owner.address,
                        eth2big(2),
                        eth2big(0.1)
                    )
                ).to.equal(eth2big(0.1))

                expect(
                    await PaymentSplit.pendingPayment(
                        user1.address,
                        eth2big(1),
                        0
                    )
                ).to.equal(eth2big(0.2))

                expect(
                    await PaymentSplit.pendingPayment(
                        user2.address,
                        eth2big(1),
                        0
                    )
                ).to.equal(eth2big(0.3))

                expect(
                    await PaymentSplit.pendingPayment(
                        user3.address,
                        eth2big(1),
                        0
                    )
                ).to.equal(eth2big(0.4))
            })
        })
    })
}
