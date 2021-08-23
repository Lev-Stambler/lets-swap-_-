import { AccountId } from "@malloc/sdk";
import { spawn } from "child_process";
import { join } from "path";
import { config } from "../config";
import { DirectedGraph } from "../interfaces/graph-interfaces";
import { PoolInfo } from "../interfaces/ref-interfaces";
import { OptimizerFn } from "../interfaces/wasm-interface";

export interface OptRet {
  pool_paths: number[][];
  token_outs: string[][];
  min_amount_outs: string[][];
  fractions: number[];
  expected_out: number;
}

export const findOptV2 = async (
  graph: DirectedGraph,
  tokenIds: string[],
  amountIn: number, // formatted amount, i.e. in float form
  optimizerFn: OptimizerFn
): Promise<OptRet> => {
  //@ts-ignore
  const retStr = await optimizerFn(JSON.stringify(graph), JSON.stringify(tokenIds), amountIn);
  return JSON.parse(retStr);
};
