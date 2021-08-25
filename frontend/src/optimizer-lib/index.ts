import { SpecialAccount } from "@malloc/sdk";
import { getPoolsTouchingInOrOut } from "./service/get-pools";
import { buildDirectedGraph } from "./service/graph";
import { findOptV2 } from "./service/get-optimized";
import { OptimizerFn } from "./interfaces/wasm-interface";
import * as MOps from "@malloc/ops";
import getConfig from "../utils/config";
import { Construction, MallocCallAction } from "@malloc/ops";
import { ActionOutputsForConstruction } from "@malloc/ops/dist/interfaces";
import { BN } from "bn.js";
import { fromReadableNumber, ftGetTokenMetadata } from "./service/token";
import { DirectedGraph } from "./interfaces/graph-interfaces";

/**
 * @param amount - The amount as a formatted float
 */
export async function createMallocOps(
  G: DirectedGraph,
  tokens: string[],
  account: SpecialAccount,
  tokenIn: string,
  tokenOut: string,
  amount: number,
  recipient: string,
  optimizerFn: OptimizerFn
) {
  console.log("The driected graph", JSON.stringify(G));
  const optimizedRet = await findOptV2(G, tokens, amount, optimizerFn);
  console.log("Optimized return of", optimizedRet);

  const MallocSwapTemplate = MOps.MallocCallAction({
    mallocCallContractID: getConfig().refSwapContract,
    callArgNames: [
      "pool_ids",
      "token_outs",
      "min_amount_outs",
      "register_tokens",
      "recipient",
    ],
    prefilledParameters: {
      recipient,
      checkCallback: false,
      skipFtTransfer: true,
      expectedTokensOut: [tokenOut],
    },
  });

  const mallocSwaps = [];
  for (var i = 0; i < optimizedRet.fractions.length; i++) {
    const tokensToRegister = [...optimizedRet.token_outs[i], tokenIn];
    mallocSwaps.push(
      MallocSwapTemplate({
        pool_ids: optimizedRet.pool_paths[i],
        token_outs: optimizedRet.token_outs[i],
        min_amount_outs: optimizedRet.min_amount_outs[i],
        register_tokens: tokensToRegister,
      })
    );
  }
  const transfer = MOps.FtTransferCallToMallocCallAction({
    mallocCallContractID: getConfig().refSwapContract,
    tokenIn,
  });
  let out: ActionOutputsForConstruction = [
    {
      token_id: tokenIn,
      next: mallocSwaps.map((swap, i) => {
        return {
          element: swap,
          fraction: floatToBN(optimizedRet.fractions[i]),
        };
      }),
    },
  ];

  const construction = MOps.Construction({
    in: transfer(),
    out,
  });
  const compiledInst = MOps.compile({
    initialConstructionOrActions: [
      {
        element: construction(),
        fraction: 1,
      },
    ],
  });
  const inpTokenData = await ftGetTokenMetadata(account, tokenIn);
  console.log("AMOUNT", fromReadableNumber(inpTokenData.decimals, amount))
  const instr = compiledInst(fromReadableNumber(inpTokenData.decimals, amount));
  return instr;
}

const floatToBN = (f: number) =>
  new BN(f.toPrecision(12).replace(".", "")).toNumber();
