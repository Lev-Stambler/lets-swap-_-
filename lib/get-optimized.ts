import { AccountId } from "@malloc/sdk";
import { spawn } from "child_process";
import { join } from "path";
import { config } from "./config";
import { PoolInfo } from "./interfaces/ref-interfaces";

interface OptRet {
	start_output: number,
	end_output: number,
	pool_weights: string[]
}

export const findOpt = async (
  tokenIn: AccountId,
  tokenOut: AccountId,
  pools: PoolInfo[],
  amountIn: number
): Promise<void> => {
  console.log("Finding optimizations");
  const infos = pools.map((pool) =>
    getInfoPerPool(tokenIn, tokenOut, amountIn, pool)
  );
  const a = JSON.stringify(infos.map((info) => info.a));
  const b = JSON.stringify(infos.map((info) => info.b));
  const m = JSON.stringify(infos.map((info) => info.m));
  const p = JSON.stringify(infos.map((info) => info.p));
  const pathToPyFile = join(__dirname, "../py/model.py");
  // a b p m

  const pythonProcess = spawn("python3", [
    pathToPyFile,
    a,
    b,
    p,
    m,
  ]);
  const ret = await new Promise<string>((resolve, reject) => {
    pythonProcess.stderr.on("data", (data) => {
      reject(data.toString());
    });
    pythonProcess.stdout.on("data", (data) => {
      resolve(data.toString());
    });
  });
  console.log(ret);
	const retParse: OptRet = JSON.parse(ret) as OptRet
	console.log(retParse)
};

// Assumes that pool contains tokenIn and out
const getInfoPerPool = (
  tokenIn: AccountId,
  tokenOut: AccountId,
  m: number,
  pool: PoolInfo
) => {
  const a = pool.amounts[pool.token_account_ids.indexOf(tokenIn)].toString();
  const b = pool.amounts[pool.token_account_ids.indexOf(tokenOut)].toString();
  const p = pool.total_fee / config.ref.FEE_DIVISOR;
  return { a, b, p, m };
};
