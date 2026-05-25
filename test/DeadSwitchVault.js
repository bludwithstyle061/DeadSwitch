const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("DeadSwitchVault", function () {
  async function deployVaultFixture() {
    const [owner, backup, otherAccount] = await ethers.getSigners();
    const amount = 100_000_000;
    const duration = 60;

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const DeadSwitchVault = await ethers.getContractFactory("DeadSwitchVault");
    const vault = await DeadSwitchVault.deploy(await usdc.getAddress());

    await usdc.mint(owner.address, amount);
    await usdc.approve(await vault.getAddress(), amount);

    return { vault, usdc, owner, backup, otherAccount, amount, duration };
  }

  describe("Deployment", function () {
    it("sets the USDC token address", async function () {
      const { vault, usdc } = await loadFixture(deployVaultFixture);

      expect(await vault.usdc()).to.equal(await usdc.getAddress());
    });

    it("starts with no switches", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      expect(await vault.switchCount()).to.equal(0);
    });
  });

  describe("Switch creation", function () {
    it("creates a switch and transfers funds into the vault", async function () {
      const { vault, usdc, owner, backup, amount, duration } = await loadFixture(deployVaultFixture);

      await expect(vault.createSwitch(backup.address, amount, duration))
        .to.emit(vault, "SwitchCreated")
        .withArgs(1, owner.address, backup.address, amount, anyValue);

      const sw = await vault.getSwitch(1);
      expect(sw.owner).to.equal(owner.address);
      expect(sw.backup).to.equal(backup.address);
      expect(sw.amount).to.equal(amount);
      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(amount);
    });

    it("rejects invalid creation input", async function () {
      const { vault, backup, amount, duration } = await loadFixture(deployVaultFixture);

      await expect(vault.createSwitch(ethers.ZeroAddress, amount, duration)).to.be.revertedWith("Invalid backup");
      await expect(vault.createSwitch(backup.address, 0, duration)).to.be.revertedWith("Amount must be greater than 0");
      await expect(vault.createSwitch(backup.address, amount, 0)).to.be.revertedWith("Timer required");
    });
  });

  describe("Lifecycle", function () {
    async function createSwitchFixture() {
      const fixture = await deployVaultFixture();
      await fixture.vault.createSwitch(fixture.backup.address, fixture.amount, fixture.duration);
      return fixture;
    }

    it("does not execute before the deadline", async function () {
      const { vault } = await loadFixture(createSwitchFixture);

      await expect(vault.execute(1)).to.be.revertedWith("Too early");
    });

    it("executes after the deadline and transfers funds to the backup", async function () {
      const { vault, usdc, backup, amount, duration } = await loadFixture(createSwitchFixture);

      await time.increase(duration + 1);

      await expect(vault.execute(1))
        .to.emit(vault, "Executed")
        .withArgs(1, backup.address, amount);

      expect(await usdc.balanceOf(backup.address)).to.equal(amount);
      const sw = await vault.getSwitch(1);
      expect(sw.executed).to.equal(true);
    });

    it("lets the owner cancel and refunds funds", async function () {
      const { vault, usdc, owner, amount } = await loadFixture(createSwitchFixture);

      await expect(vault.cancel(1))
        .to.emit(vault, "Cancelled")
        .withArgs(1, owner.address);

      expect(await usdc.balanceOf(owner.address)).to.equal(amount);
      const sw = await vault.getSwitch(1);
      expect(sw.cancelled).to.equal(true);
    });

    it("prevents non-owners from cancelling or checking in", async function () {
      const { vault, otherAccount, duration } = await loadFixture(createSwitchFixture);

      await expect(vault.connect(otherAccount).cancel(1)).to.be.revertedWith("Not owner");
      await expect(vault.connect(otherAccount).checkIn(1, duration)).to.be.revertedWith("Not owner");
    });

    it("lets the owner check in and extend the deadline", async function () {
      const { vault, owner, duration } = await loadFixture(createSwitchFixture);

      await time.increase(30);

      await expect(vault.checkIn(1, duration))
        .to.emit(vault, "CheckIn")
        .withArgs(1, owner.address, anyValue);

      expect(await vault.timeRemaining(1)).to.be.closeTo(duration, 2);
    });
  });
});
