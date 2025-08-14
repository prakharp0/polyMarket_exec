// orderPut.ts
import { Side, OrderType, ClobClient } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { Wallet } from "@ethersproject/wallet";
import dotenv from "dotenv";
dotenv.config();

const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // Polymarket Exchange
const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
];

async function main() {
  const host = "https://clob.polymarket.com";
  const chainId = 137; // Polygon
  const proxyAddress = process.env.PROXY_WALLET!; // your Safe wallet proxy address

  const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);

  // Override gas to avoid Polygon minimum gas errors
  provider.getFeeData = async () => ({
    lastBaseFeePerGas: null,
    maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"),
    maxFeePerGas: ethers.utils.parseUnits("60", "gwei"),
    gasPrice: null,
  });

  const eoaSigner = new Wallet(process.env.WALLET_PVT_KEY!, provider);

  console.log("Controller (EOA):", await eoaSigner.getAddress());
  console.log("Proxy (maker):", proxyAddress);

  // USDC contract connected to provider
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

  // 1️⃣ Check Safe USDC balance
  const balance = await usdc.balanceOf(proxyAddress);
  console.log(`Safe USDC Balance: ${ethers.utils.formatUnits(balance, 6)} USDC`);

  if (balance.lt(ethers.utils.parseUnits("1", 6))) {
    console.warn("⚠ Not enough USDC in the Safe to place order!");
  }

  // 2️⃣ Check allowance to the Exchange
  const allowance = await usdc.allowance(proxyAddress, EXCHANGE_ADDRESS);
  console.log(`Safe Allowance to Exchange: ${ethers.utils.formatUnits(allowance, 6)} USDC`);

  if (allowance.lt(ethers.utils.parseUnits("1", 6))) {
    console.warn("⚠ Safe allowance too low. You must approve USDC for the Exchange first!");
    process.exit(1);
  }

  // 3️⃣ Initialize CLOB client
  const signatureType = 2; // Safe-controlled proxy
  const client = new ClobClient(host, chainId, eoaSigner, undefined, signatureType, proxyAddress);
  const creds = await client.createOrDeriveApiKey();
  const authedClient = new ClobClient(host, chainId, eoaSigner, creds, signatureType, proxyAddress);

  // 4️⃣ Build the order
  // // // // here change accordingly
  const order = await authedClient.createOrder({
    tokenID: "56831000532202254811410354120402056896323359630546371545035370679912675847818",
    price: 0.795,
    side: Side.BUY,
    size: 1.5,
    feeRateBps: 0,
  });
  console.log("Created Order:", order);

  // 5️⃣ Post as GTC
  const resp = await authedClient.postOrder(order, OrderType.GTC);
  console.log("Order Response:", resp);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
