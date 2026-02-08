import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys MockUSDC + BeatStreamVault
 * MockUSDC is deployed first, then passed to vault as the USDC token.
 */
const deployBeatStream: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // 1. Deploy MockUSDC (hackathon faucet)
  const mockUSDC = await deploy("MockUSDC", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log("💰 MockUSDC deployed at:", mockUSDC.address);

  // 2. Deploy BeatStreamVault with deployer as owner and MockUSDC address
  const vault = await deploy("BeatStreamVault", {
    from: deployer,
    args: [deployer, mockUSDC.address],
    log: true,
    autoMine: true,
  });

  console.log("🎵 BeatStreamVault deployed at:", vault.address);

  // 3. Mint some test USDC to deployer for testing
  const mockUSDCContract = await hre.ethers.getContract<Contract>("MockUSDC", deployer);
  const mintTx = await mockUSDCContract.mint(deployer, 1000_000_000n, { gasLimit: 100_000 });
  await mintTx.wait();
  console.log("🪙 Minted 1000 USDC to deployer:", deployer);
};

export default deployBeatStream;

deployBeatStream.tags = ["BeatStream"];
