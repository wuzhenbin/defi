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
    describe("TimeLock Unit Tests", function () {
        let owner, user1, TimeLock
        beforeEach(async () => {
            ;[owner, user1] = await ethers.getSigners()
            const timeLockContract = await ethers.getContractFactory("Timelock")
            // set delay 120s
            TimeLock = await timeLockContract.deploy(120)
        })

        describe("Constructor", () => {
            it("Initializes Correctly", async () => {
                expect(await TimeLock.admin()).to.equal(owner.address)
                expect(await TimeLock.delay()).to.equal(120)
            })

            it("Call changeAdmin should Error", async () => {
                await expect(
                    TimeLock.changeAdmin(user1.address)
                ).to.be.revertedWithCustomError(
                    TimeLock,
                    "Timelock__CallerNotTimeLock"
                )
            })
        })

        describe("queueTransaction", () => {
            let transactionData
            beforeEach(async () => {
                /* 
                user1 - 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
                abi - 0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8
                */
                transactionData = (now) => {
                    return [
                        TimeLock.address,
                        0,
                        "changeAdmin(address)",
                        "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8",
                        now,
                    ]
                }
            })

            it("transaction not in time excute", async () => {
                let now = await getBlockTime()
                await expect(
                    TimeLock.queueTransaction(...transactionData(now))
                ).to.be.revertedWithCustomError(TimeLock, "Timelock__NotTime")
            })

            it("add transaction success", async () => {
                let now = (await getBlockTime()) + 150
                let txHash = await TimeLock.getTxHash(...transactionData(now))
                await TimeLock.queueTransaction(...transactionData(now))
                expect(await TimeLock.queuedTransactions(txHash)).to.equal(true)
            })

            it("cancel transaction not in queued", async () => {
                let now = (await getBlockTime()) + 150
                await TimeLock.queueTransaction(...transactionData(now))

                await expect(
                    TimeLock.cancelTransaction(
                        ...[
                            user1.address,
                            0,
                            "changeAdmin(address)",
                            "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8",
                            now,
                        ]
                    )
                ).to.be.revertedWithCustomError(
                    TimeLock,
                    "Timelock__NotInQueued"
                )
            })

            it("cancel transaction success", async () => {
                let now = (await getBlockTime()) + 150
                let txHash = await TimeLock.getTxHash(...transactionData(now))
                await TimeLock.queueTransaction(...transactionData(now))
                await TimeLock.cancelTransaction(...transactionData(now))
                expect(await TimeLock.queuedTransactions(txHash)).to.equal(
                    false
                )
            })
        })

        describe("executeTransaction", () => {
            let transactionData
            beforeEach(async () => {
                /*
                user1 - 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
                abi - 0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8
                */
                transactionData = (now) => {
                    return [
                        TimeLock.address,
                        0,
                        "changeAdmin(address)",
                        "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8",
                        now,
                    ]
                }
            })
            it("transaction not in queued", async () => {
                let now = (await getBlockTime()) + 150
                await expect(
                    TimeLock.executeTransaction(
                        ...[
                            user1.address,
                            0,
                            "changeAdmin(address)",
                            "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8",
                            now,
                        ]
                    )
                ).to.be.revertedWithCustomError(
                    TimeLock,
                    "Timelock__NotInQueued"
                )
            })
            it("transaction not in time", async () => {
                let now = (await getBlockTime()) + 150
                await TimeLock.queueTransaction(...transactionData(now))
                await expect(
                    TimeLock.executeTransaction(...transactionData(now))
                ).to.be.revertedWithCustomError(TimeLock, "Timelock__NotTime")
            })
            it("transaction time is over limit", async () => {
                let now = (await getBlockTime()) + 150
                await TimeLock.queueTransaction(...transactionData(now))

                // pass 7 days
                await increaseTime(7 * 24 * 60 * 60 + 150)

                await expect(
                    TimeLock.executeTransaction(...transactionData(now))
                ).to.be.revertedWithCustomError(
                    TimeLock,
                    "Timelock__TimeExceed"
                )
            })
            it("success call change admin", async () => {
                let now = (await getBlockTime()) + 150
                await TimeLock.queueTransaction(...transactionData(now))

                // pass 150
                await increaseTime(150)

                await TimeLock.executeTransaction(...transactionData(now))
                expect(await TimeLock.admin()).to.equal(user1.address)
            })
        })
    })
}
