import {
  clusterApiUrl,
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  ParsedInstruction,
  LogsCallback,
} from "@solana/web3.js";

const PREFIX = "3d"; 
const SUFFIX = "5M";   


const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");


const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=c3f33946-3012-4d3d-bd1e-b8f2da31a29e', "confirmed");

console.log("Listening for SOL transfer transactions...");

function isParsedSystemTransfer(
  instr: any
): instr is ParsedInstruction {
  return (
    instr.program === "system" &&
    instr.parsed !== undefined &&
    instr.parsed.type === "transfer"
  );
}

connection.onLogs(
  SYSTEM_PROGRAM_ID,
  async (logInfo, context) => {
    try {
      const signature: string = logInfo.signature;

      // Retrieve the parsed transaction details.
      // (If the transaction is too old or unavailable, this may return null.)
      const parsedTx: ParsedTransactionWithMeta | null =
        await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      if (!parsedTx) return;

      // Check if any instruction in the transaction is a SOL transfer.
      let isSolTransfer = false;
      for (const instr of parsedTx.transaction.message.instructions) {
        // We check only parsed instructions.
        if (isParsedSystemTransfer(instr)) {
          isSolTransfer = true;
          break;
        }
      }
      if (!isSolTransfer) return; // Skip if there is no SOL transfer.

      // Now, iterate through all account keys in the transaction.
      for (const keyInfo of parsedTx.transaction.message.accountKeys) {
        const pubkeyStr: string = keyInfo.pubkey.toBase58();
        // Check if the public key starts with the PREFIX and ends with the SUFFIX.
        if (pubkeyStr.startsWith(PREFIX) && pubkeyStr.endsWith(SUFFIX)) {
          console.log(`Found matching wallet: ${pubkeyStr} in transaction ${signature}`);
        }
      }
    } catch (err) {
      console.error("Error processing transaction:", err);
    }
  }
);
