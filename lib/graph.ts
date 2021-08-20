import { AccountId } from "@malloc/sdk";
import assert from "assert";
import { config } from "./config";
import { findOpt } from "./get-optimized";
import { getPoolsTouchingInOrOut, poolHasToken } from "./get-pools";
import {
  DirectedGraph,
  GraphEdge,
  GraphNode,
} from "./interfaces/graph-interfaces";
import { PoolInfo } from "./interfaces/ref-interfaces";
import { near } from "./near";

interface PoolInfoWithIndex extends PoolInfo {
  index: number;
}

const tokenToGraphNode = (
  current_token: AccountId,
  pools: PoolInfo[],
  tokens: AccountId[]
): GraphNode => {
  const poolsWithTokenIn = pools.filter(poolHasToken(current_token));
  const outgoingAccountsFromPoolsWithIn: string[] = poolsWithTokenIn
    .map((pool) =>
      pool.token_account_ids.filter((token) => token !== current_token)
    )
    .flat();
  const edges: GraphEdge[] = outgoingAccountsFromPoolsWithIn
    .map((next_token) => {
      const poolsWithBoth = poolsWithTokenIn.filter(poolHasToken(next_token));
      return poolsWithBoth.map((pool): GraphEdge => {
        const tokInIdx = pool.token_account_ids.indexOf(current_token);
        const tokOutIdx = pool.token_account_ids.indexOf(next_token);
        const a = pool.amounts[tokInIdx];
        const b = pool.amounts[tokOutIdx];
        const p = pool.total_fee / config.ref.FEE_DIVISOR;
        return [
          tokens.indexOf(next_token),
          [a, b, p, pool.id, tokInIdx, tokOutIdx],
        ] as GraphEdge;
      });
    })
    .flat();
  return edges;
};

// TODO: TO UTILS
const dedup = <T>(arr: T[]): T[] => Array.from(new Set(arr));

const swapArr = <T>(arr: T[], i: number, j: number): T[] => {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
  return arr;
};

/**
 *  Rearrange all tokens such that the 0th is the tokenIn and the 1st is the tokenOut
 */
const rearrangeTokenList = (
  allTokens: AccountId[],
  tokenIn: AccountId,
  tokenOut: AccountId
): AccountId[] => {
  const tokInIdx = allTokens.indexOf(tokenIn);
  assert(
    tokInIdx >= 0,
    "expected the token in and out to be in the list of all tokens used"
  );
  allTokens = swapArr(allTokens, 0, tokInIdx);
  const tokOutIdx = allTokens.indexOf(tokenOut);
  assert(
    tokOutIdx >= 0,
    "expected the token in and out to be in the list of all tokens used"
  );
  allTokens = swapArr(allTokens, 1, tokOutIdx);
  return allTokens;
};

/**
 * This graph is relatively straight forward to build if the diameter is limited to 2
 *
 */
const buildDirectedGraph = (
  pools: PoolInfo[],
  tokenIn: AccountId,
  tokenOut: AccountId
): DirectedGraph => {
  const poolsWithIdx = pools.map((pool, i) => {
    return { ...pool, index: i };
  });
  const allTokensBadOrder = dedup(
    pools.map((pool) => pool.token_account_ids).flat()
  );
  const allTokens = rearrangeTokenList(allTokensBadOrder, tokenIn, tokenOut);

  const nodes = allTokens.map((tok) =>
    tokenToGraphNode(tok, poolsWithIdx, allTokens)
  );
  console.log(JSON.stringify(nodes), allTokens);
  return {
    graph: nodes,
    // metadata: {
    // }
  };
  // const allTokens = getAllTokensUsed(pools);
  // const poolsWithInputToken = pools.filter(poolHasToken(tokenIn));
  // return {
  //   graph: [],
  //   metadata: {
  //     indexToToken: [],
  //   },
  // };
};

near.account(config.near.PROXY_ACCOUNT).then(async (account) => {
  const tokenIn = "wrap.testnet";
  const tokenOut = "ndai.ft-fin.testnet";
  const pools = await getPoolsTouchingInOrOut(account, tokenIn, tokenOut);
  console.log(pools);
  buildDirectedGraph(pools, tokenIn, tokenOut);
  // await findOpt(tokenIn, tokenOut, pools, 10);
});
