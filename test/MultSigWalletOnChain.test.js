const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { eth2big, getBalance, getSignature } = require("../utils/utils")

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("MultiSigWalletOnChain Unit Tests", function () {
        let owner, user1, user2, user3, user4, MultiSigWallet
        beforeEach(async () => {
            ;[owner, user1, user2, user3, user4] = await ethers.getSigners()
            const MultiSigWalletContract = await ethers.getContractFactory(
                "MultiSigWalletOnChain"
            )
            MultiSigWallet = await MultiSigWalletContract.deploy(
                [owner.address, user1.address, user2.address, user3.address],
                2
            )
            // send 2 eth to contract
            const tx = await owner.sendTransaction({
                to: MultiSigWallet.address,
                value: eth2big(2),
            })
            await tx.wait()
        })

        describe("Constructor", () => {
            it("Initializes Correctly", async () => {
                expect(await getBalance(MultiSigWallet.address)).to.equal(
                    eth2big(2)
                )
                expect(await MultiSigWallet.isOwner(user1.address)).to.equal(
                    true
                )
                expect(await MultiSigWallet.isOwner(user2.address)).to.equal(
                    true
                )
                expect(await MultiSigWallet.isOwner(user3.address)).to.equal(
                    true
                )
                expect(await MultiSigWallet.isOwner(owner.address)).to.equal(
                    true
                )
                expect((await MultiSigWallet.getOwners()).length).to.equal(4)
                expect(
                    await MultiSigWallet.numConfirmationsRequired()
                ).to.equal(2)
            })
        })

        describe("submitTransaction", () => {
            it("onlyOwner can submit", async () => {
                let to = user4.address
                let data = "0x"

                await expect(
                    MultiSigWallet.connect(user4).submitTransaction(
                        to,
                        eth2big(2),
                        data
                    )
                ).to.be.revertedWith("MultiSigWalletOnChain__NotOwner")
            })
            it("submit success", async () => {
                let to = user4.address
                let data = "0x"

                expect(await MultiSigWallet.getTransactionCount()).to.equal(0)

                await MultiSigWallet.submitTransaction(to, eth2big(2), data)
                expect(await MultiSigWallet.getTransactionCount()).to.equal(1)
            })
        })

        describe("confirmTransaction", () => {
            beforeEach(async () => {
                let to = user4.address
                let data = "0x"

                await MultiSigWallet.submitTransaction(to, eth2big(2), data)
            })
            it("onlyOwner can confirm", async () => {
                await expect(
                    MultiSigWallet.connect(user4).confirmTransaction(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__NotOwner")
            })
            it("tx not exist", async () => {
                await expect(
                    MultiSigWallet.confirmTransaction(1)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxNotExist")
            })
            it("tx already confirmed", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await expect(
                    MultiSigWallet.confirmTransaction(0)
                ).to.be.revertedWith(
                    "MultiSigWalletOnChain__TxAlreadyConfirmed"
                )
            })
            it("tx is executed", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)
                await MultiSigWallet.executeTransaction(0)

                await expect(
                    MultiSigWallet.confirmTransaction(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxAlreadyExecuted")
            })
            it("confirmed success", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)

                let { numConfirmations, executed } =
                    await MultiSigWallet.getTransaction(0)
                expect(numConfirmations).to.equal(2)
                expect(executed).to.equal(false)
            })
        })

        describe("revokeConfirmation", () => {
            beforeEach(async () => {
                let to = user4.address
                let data = "0x"

                await MultiSigWallet.submitTransaction(to, eth2big(2), data)
            })
            it("onlyOwner can revoke", async () => {
                await expect(
                    MultiSigWallet.connect(user4).revokeConfirmation(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__NotOwner")
            })
            it("tx not exist", async () => {
                await expect(
                    MultiSigWallet.revokeConfirmation(1)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxNotExist")
            })
            it("tx is executed", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)
                await MultiSigWallet.executeTransaction(0)

                await expect(
                    MultiSigWallet.revokeConfirmation(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxAlreadyExecuted")
            })
            it("tx is not confirmed", async () => {
                await MultiSigWallet.connect(user2).confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)

                await expect(
                    MultiSigWallet.revokeConfirmation(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxNotConfirmed")
            })
            it("revokeConfirmation success", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)

                await MultiSigWallet.revokeConfirmation(0)

                let { numConfirmations, executed } =
                    await MultiSigWallet.getTransaction(0)
                expect(numConfirmations).to.equal(1)
                expect(executed).to.equal(false)
            })
        })

        describe("executeTransaction", function () {
            beforeEach(async () => {
                let to = user4.address
                let data = "0x"

                await MultiSigWallet.submitTransaction(to, eth2big(2), data)
            })
            it("onlyOwner can execute", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)

                await expect(
                    MultiSigWallet.connect(user4).executeTransaction(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__NotOwner")
            })
            it("tx not exist", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)
                await expect(
                    MultiSigWallet.executeTransaction(1)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxNotExist")
            })
            it("tx is executed", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)
                await MultiSigWallet.executeTransaction(0)

                await expect(
                    MultiSigWallet.executeTransaction(0)
                ).to.be.revertedWith("MultiSigWalletOnChain__TxAlreadyExecuted")
            })
            it("num required not enought", async () => {
                await MultiSigWallet.connect(user1).confirmTransaction(0)

                await expect(
                    MultiSigWallet.executeTransaction(0)
                ).to.be.revertedWith(
                    "MultiSigWalletOnChain__NumRequireNotEnough"
                )
            })
            it("executeTransaction success", async () => {
                await MultiSigWallet.confirmTransaction(0)
                await MultiSigWallet.connect(user1).confirmTransaction(0)

                let balance = await user4.getBalance()
                await MultiSigWallet.executeTransaction(0)
                expect((await user4.getBalance()).sub(balance)).to.equal(
                    eth2big(2)
                )
            })
        })
    })
}
