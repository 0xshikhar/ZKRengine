import { run } from "hardhat";

export async function verify(contractAddress: string, constructorArguments: any[] = []) {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: constructorArguments,
        });
        console.log("Contract verified successfully");
    } catch (error: any) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log("Contract is already verified!");
        } else {
            console.log("Error verifying contract:", error.message);
        }
    }
} 