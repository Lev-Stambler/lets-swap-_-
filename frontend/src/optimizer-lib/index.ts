import { SpecialAccount } from "@malloc/sdk";
import { getPoolsTouchingInOrOut } from "./service/get-pools";
import { buildDirectedGraph } from "./service/graph";
import { findOptV2 } from "./service/get-optimized";
import { OptimizerFn } from "./interfaces/wasm-interface";

export async function createMallocOps(
  account: SpecialAccount,
  tokenIn: string,
  tokenOut: string,
  amount: number,
  optimizerFn: OptimizerFn
) {
  const pools = await getPoolsTouchingInOrOut(account, tokenIn, tokenOut);
  const G = buildDirectedGraph(pools, tokenIn, tokenOut);
  console.log("The driected graph", JSON.stringify(G));
  const graph = await findOptV2(G, amount, optimizerFn);
	console.log(graph)
}
