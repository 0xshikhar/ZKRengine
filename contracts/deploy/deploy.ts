import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts();
    const { deploy } = hre.deployments;

    // Deploy NFTMetadata helper
    const metadataHelper = await deploy("NFTMetadata", {
        from: deployer,
        args: [],
        log: true,
    });

    console.log(`NFTMetadata deployed to: ${metadataHelper.address}`);

    // Deploy CampaignNFTFactory
    const factory = await deploy("CampaignNFTFactory", {
        from: deployer,
        args: [],
        log: true,
    });

    console.log(`CampaignNFTFactory deployed to: ${factory.address}`);

    // Deploy AkashicNFTRegistry
    const registry = await deploy("AkashicNFTRegistry", {
        from: deployer,
        args: [factory.address],
        log: true,
    });

    console.log(`AkashicNFTRegistry deployed to: ${registry.address}`);
};

export default func;
func.id = "deploy_campaign_nft_factory";
func.tags = ["CampaignNFTFactory"]; 