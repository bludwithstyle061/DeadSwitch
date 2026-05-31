const hre = require("hardhat");

async function main() {
  console.log("Deploying DeadSwitchVault to Arc Testnet...");

  // Arc Testnet USDC contract address
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

  const DeadSwitchVault = await hre.ethers.getContractFactory("DeadSwitchVault");
  const PLATFORM_WALLET = "0x8EeC953a4E647F19ee7DACd84B5CDB69614ad62f";
  const vault = await DeadSwitchVault.deploy(USDC_ADDRESS, PLATFORM_WALLET);

  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("DeadSwitchVault deployed to:", address);
  console.log("Save this address — you'll need it to connect the frontend.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});