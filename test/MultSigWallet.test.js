const { assert, expect } = require("chai")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { eth2big, getBalance, getSignature } = require("../utils/utils")

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("MultiSigWallet Unit Tests", function () {
        let owner, user1, user2, user3, user4, user5, MultiSigWallet
        beforeEach(async () => {
            ;[owner, user1, user2, user3, user4, user5] =
                await ethers.getSigners()
            const MultiSigWalletContract = await ethers.getContractFactory(
                "MultiSigWallet"
            )
            MultiSigWallet = await MultiSigWalletContract.deploy(
                [user1.address, user2.address, user3.address, user4.address],
                3
            )

            const tx = await owner.sendTransaction({
                to: MultiSigWallet.address,
                value: eth2big(2),
            })

            // Wait for the transaction to be mined
            await tx.wait()
        })

        describe("Constructor", () => {
            it("Initializes Correctly", async () => {
                expect(await getBalance(MultiSigWallet.address)).to.equal(
                    eth2big(2)
                )
                expect(await MultiSigWallet.threshold()).to.equal(3)
                expect(await MultiSigWallet.ownerCount()).to.equal(4)
            })
        })

        describe("execTransaction", () => {
            it("execTransaction signature not enough", async () => {
                let to = user5.address
                let data = "0x"

                let hash = await MultiSigWallet.encodeTransactionData(
                    to,
                    eth2big(2),
                    data
                )
                let signature = await getSignature([user1, user1], hash)
                await expect(
                    MultiSigWallet.execTransaction(
                        to,
                        eth2big(2),
                        data,
                        signature
                    )
                ).to.be.revertedWith("WTF5006")
            })

            it("execTransaction signature repeated", async () => {
                let to = user5.address
                let data = "0x"

                let hash = await MultiSigWallet.encodeTransactionData(
                    to,
                    eth2big(2),
                    data
                )
                let signature = await getSignature([user1, user2, user2], hash)
                await expect(
                    MultiSigWallet.execTransaction(
                        to,
                        eth2big(2),
                        data,
                        signature
                    )
                ).to.be.revertedWith("WTF5007")
            })

            it("execTransaction success", async () => {
                let to = user5.address
                let data = "0x"

                let hash = await MultiSigWallet.encodeTransactionData(
                    to,
                    eth2big(2),
                    data
                )
                let signature = await getSignature([user1, user2, user3], hash)

                let balance = await user5.getBalance()
                await MultiSigWallet.execTransaction(
                    to,
                    eth2big(2),
                    data,
                    signature
                )

                expect((await user5.getBalance()).sub(balance)).to.equal(
                    eth2big(2)
                )
            })
        })
    })
}
