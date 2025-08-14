// safe_usdc_approve.ts
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// ===== ENV =====
const RPC_URL        = process.env.POLYGON_RPC!;
const EOA_PRIVATE    = process.env.WALLET_PVT_KEY!;        // owner of the Safe
const SAFE_ADDRESS   = "0x84E03893eDc70Da93E677C72a01F0A50DdCe6e27";          // your proxy wallet (Safe) address

// ===== CONSTANTS (Polygon mainnet) =====
const USDC           = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const SPENDERS = [
  // Always approve the main Exchange:
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  // Uncomment if you trade neg-risk markets:
  "0xC5d563A36AE78145C45a50134d48A1215220f80a",
  // "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296e",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// Safe v1.1–1.4 compatible fragments
const SAFE_ABI = [
  "function nonce() view returns (uint256)",
  "function getTransactionHash(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 _nonce) public view returns (bytes32)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) public payable returns (bool)"
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(EOA_PRIVATE, provider);

  const safe = new ethers.Contract(SAFE_ADDRESS, SAFE_ABI, signer);
  const usdc = new ethers.Contract(USDC, USDC_ABI, provider);

  // Helper to fetch Polygon gas (fallback to sane defaults if RPC fails)
  async function getGas(): Promise<{ maxPriorityFeePerGas: ethers.BigNumber; maxFeePerGas: ethers.BigNumber; }> {
    try {
      // Many public endpoints enforce ~25+ gwei min tip; set higher to be safe.
      const tip = ethers.utils.parseUnits("35", "gwei");
      const base = await provider.getBlock("latest").then(b => b.baseFeePerGas ?? ethers.utils.parseUnits("20", "gwei"));
      const maxFee = base.mul(2).add(tip); // 2x base + tip
      return { maxPriorityFeePerGas: tip, maxFeePerGas: maxFee };
    } catch {
      return {
        maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
        maxFeePerGas:         ethers.utils.parseUnits("70", "gwei"),
      };
    }
  }

  // Build + send a Safe tx that calls USDC.approve(spender, MaxUint256)
  async function approveFor(spender: string) {
    // 0) Quick check: if already approved big, skip
    const allowance = await usdc.allowance(SAFE_ADDRESS, spender);
    if (allowance.gt(ethers.utils.parseUnits("1000000", 6))) {
      console.log(`✔ Allowance already sufficient for ${spender}`);
      return;
    }

    // 1) Encode approve()
    const approveData = new ethers.utils.Interface(USDC_ABI)
      .encodeFunctionData("approve", [spender, ethers.constants.MaxUint256]);

    // 2) Read Safe nonce
    const nonce: ethers.BigNumber = await safe.nonce();

    // 3) Build the Safe transaction hash to sign
    const to = USDC;
    const value = 0;
    const data  = approveData;
    const operation = 0; // CALL
    const safeTxGas = 0; // let Safe do internal estimation
    const baseGas   = 0;
    const gasPrice  = 0; // no refund accounting
    const gasToken  = ethers.constants.AddressZero;
    const refundReceiver = ethers.constants.AddressZero;

    const txHash: string = await safe.getTransactionHash(
      to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce
    );

    // 4) Sign the hash with the Safe owner EOA and format r|s|v (65 bytes)
    const sig = await signer._signingKey().signDigest(txHash);
    const signature = ethers.utils.joinSignature(sig); // r + s + v

    // 5) Estimate gas for the outer tx (call to Safe.execTransaction)
    const gasOpts = await getGas();
    const gasLimit = await safe.estimateGas.execTransaction(
      to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signature,
      { ...gasOpts }
    ).then(g => g.mul(12).div(10)) // +20% buffer
     .catch(() => ethers.BigNumber.from(250000)); // fallback

    // 6) Send execTransaction (the Safe itself will call USDC.approve)
    const tx = await safe.execTransaction(
      to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signature,
      { ...gasOpts, gasLimit }
    );
    console.log(`⛽ execTransaction sent for spender ${spender}: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Approved USDC for ${spender}`);

    // 7) Confirm
    const newAllowance = await usdc.allowance(SAFE_ADDRESS, spender);
    console.log(`   New allowance: ${ethers.utils.formatUnits(newAllowance, 6)} USDC`);
  }

  // Approve all desired spenders
  for (const sp of SPENDERS) {
    await approveFor(sp);
  }
  console.log("All approvals done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
