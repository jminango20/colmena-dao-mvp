import {ethers} from "hardhat";
import { Test } from "mocha";

async function main() {
    console.log("Deploying the contract...");

    const [deployer] = await ethers.getSigners();

    console.log("Deploying the contract with the account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance));

    if (balance === 0n) {
        console.log("Você precisa de MATIC na testnet para fazer deploy.");
        return;
    }

    //Deploy the contract
    const TestDeploy = await ethers.getContractFactory("TestDeploy");
    const testDeploy = await TestDeploy.deploy("Hello World");
    
    await testDeploy.waitForDeployment();

    const address = await testDeploy.getAddress();

    console.log("\n TestDeploy deployed!");
    console.log(" Endereço:", address);
    console.log(" Ver no PolygonScan:");
    console.log(`   https://mumbai.polygonscan.com/address/${address}`);

    // Testa o contrato
    console.log("\n Testando contrato...");
    const info = await testDeploy.getInfo();
    console.log("   Mensagem:", info.currentMessage);
    console.log("   Owner:", info.contractOwner);
    console.log("   Deploy time:", new Date(Number(info.deployTime) * 1000).toLocaleString());
    
    console.log("\n Deploy de teste completo!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
