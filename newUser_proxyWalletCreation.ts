import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);
const signer = new ethers.Wallet(process.env.WALLET_PVT_KEY!, provider);

const abiFragment = [{"inputs":[{"internalType":"address","name":"_masterCopy","type":"address"},{"internalType":"address","name":"_fallbackHandler","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract GnosisSafe","name":"proxy","type":"address"},{"indexed":false,"internalType":"address","name":"owner","type":"address"}],"name":"ProxyCreation","type":"event"},{"inputs":[],"name":"CREATE_PROXY_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DOMAIN_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"NAME","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"computeProxyAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"uint256","name":"payment","type":"uint256"},{"internalType":"address payable","name":"paymentReceiver","type":"address"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct SafeProxyFactory.Sig","name":"createSig","type":"tuple"}],"name":"createProxy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"domainSeparator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fallbackHandler","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getContractBytecode","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getSalt","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"masterCopy","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxyCreationCode","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"}];

const contractAddress = "0xaacfeea03eb1561c4e67d661e40682bd20e3541b";
const contract = new ethers.Contract(contractAddress, abiFragment, signer);

// Structure to sign
const domain = {
    name: "Polymarket Contract Proxy Factory",
    chainId: 137,
    verifyingContract: contractAddress
};

const types = {
    CreateProxy: [
        { name: "paymentToken", type: "address" },
        { name: "payment", type: "uint256" },
        { name: "paymentReceiver", type: "address" }
    ]
};

const value = {
    paymentToken: ethers.constants.AddressZero,
    payment: ethers.constants.Zero,
    paymentReceiver: ethers.constants.AddressZero
};

async function main() {
    try {
        const signerAddress = await signer.getAddress();
        console.log("Signing address:", signerAddress);
        
        // Check if proxy already exists
        const computedProxyAddress = await contract.computeProxyAddress(signerAddress);
        console.log("Computed proxy address:", computedProxyAddress);
        
        // Check if proxy already exists by checking if it has code
        const existingCode = await provider.getCode(computedProxyAddress);
        if (existingCode !== "0x") {
            console.log("❌ Proxy already exists at:", computedProxyAddress);
            return;
        }
        console.log("✅ Proxy does not exist yet, proceeding with creation");
        
        const signature = await signer._signTypedData(domain, types, value);
        const sig = ethers.utils.splitSignature(signature);
        console.log("✅ Signature generated successfully");
        
        console.log("Signature components:");
        console.log("v:", sig.v);
        console.log("r:", sig.r);
        console.log("s:", sig.s);
        
        // Verify the signature recovers to the correct address
        const recoveredSigner = ethers.utils.verifyTypedData(domain, types, value, signature);
        console.log("Recovered signer:", recoveredSigner);
        console.log("Expected signer:", signerAddress);
        if (recoveredSigner.toLowerCase() !== signerAddress.toLowerCase()) {
            console.log("❌ Signature verification failed!");
            return;
        }
        console.log("✅ Signature verification passed");

        // Estimate gas first
        try {
            const gasEstimate = await contract.estimateGas.createProxy(
                value.paymentToken,
                value.payment,
                value.paymentReceiver,
                {
                    v: sig.v,
                    r: sig.r,
                    s: sig.s
                }
            );
            console.log("✅ Gas estimation successful:", gasEstimate.toString());
        } catch (gasError) {
            const error = gasError as any;
            console.error("❌ Gas estimation failed:", error.reason || error.message);
            // Try to get more details
            if (error.error && error.error.data) {
                console.error("Error data:", error.error.data);
            }
            if (error.error && error.error.message) {
                console.error("Detailed error:", error.error.message);
            }
            return;
        }
        
  
        const tx = await contract.createProxy(
            value.paymentToken,
            value.payment,
            value.paymentReceiver,
            {
                v: sig.v,
                r: sig.r,
                s: sig.s
            },
            {
                gasLimit: 10000000,
                maxFeePerGas: ethers.utils.parseUnits('50', 'gwei'), // 50 gwei max fee
                maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei') // 30 gwei tip
            }
        );
        await tx.wait();
        console.log("Transaction sent! Hash:", tx.hash);
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();