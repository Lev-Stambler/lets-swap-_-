import { AccountId } from "@malloc/sdk";
import assert from "assert";
import { config } from "../config";
import { findOptV2 } from "./get-optimized";
import {
  getAllTokensUsed,
  getPoolsTouchingInOrOut,
  poolHasToken,
} from "./get-pools";
import {
  DirectedGraph,
  GraphEdge,
  GraphNode,
} from "../interfaces/graph-interfaces";
import { PoolInfo, PoolInfoFloats } from "../interfaces/ref-interfaces";
import { swapArr } from "../utils";

interface PoolInfoWithIndex extends PoolInfo {
  index: number;
}

const tokenToGraphNode = (
  current_token: AccountId,
  pools: PoolInfoFloats[],
  tokens: AccountId[],
  node_id: number
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
      return poolsWithBoth.map(
        (pool): GraphEdge => {
          const tokInIdx = pool.token_account_ids.indexOf(current_token);
          const tokOutIdx = pool.token_account_ids.indexOf(next_token);
          const a = pool.amounts[tokInIdx];
          const b = pool.amounts[tokOutIdx];
          const p = pool.total_fee / config.ref.FEE_DIVISOR;
          return {
            next_node_indx: tokens.indexOf(next_token),
            token_in_amount: a,
            token_out_amount: b,
            fee: p,
            pool_id: pool.id,
          };
          // [
          //   tokens.indexOf(next_token),
          //   [a, b, p, pool.id, tokInIdx, tokOutIdx],
          // ] as GraphEdge;
        }
      );
    })
    .flat();

  const dedupSamePools = (edges: GraphEdge[]) =>
    edges.filter(
      (edge, i) =>
        i ===
        edges.findIndex((checkedEdge) => checkedEdge.pool_id === edge.pool_id)
    );
  return {
    id: node_id,
    edges_out: dedupSamePools(edges),
  };
};

// Removes all edges which are not coming from the 0th node and do not go to the 0th node
// It then removes all nodes w/o outgoing edges from the 0th node
// It also sets the outgoing edges from the out token (1st index) to []
const removeEdgesNotTouchingInOrOut = (g: GraphNode[]): GraphNode[] => {
  const isEdgeValid = (e: GraphEdge, nodeIndex: number) =>
    e.next_node_indx === 1 || nodeIndex === 0;
  const gFiltered = g.map((edges, i) => {
    const e = edges.edges_out.filter((edge) => isEdgeValid(edge, i));
    return {
      id: edges.id,
      edges_out: e,
    };
  });
  return gFiltered;
};

// Remove any empty nodes from outgoing edges
const removeEmptyNodes = (g: GraphNode[]): GraphNode[] => {
  // Get a list of indexes which have no outgoing edges, except for the 1st node as that can have no outgoing edges
  const emptyNodes: number[] = g
    .map((edges, i) => (edges.edges_out.length === 0 ? i : null))
    .filter((elem) => elem !== null && elem !== 1) as number[];

  // Prune the empty nodes from the start's outgoing nodes
  const newFirstNodeEdges = g[0].edges_out.filter(
    (edge: GraphEdge) => !emptyNodes.includes(edge.next_node_indx)
  );
  g[0] = { edges_out: newFirstNodeEdges, id: 0 };

  if (g[0].edges_out.length === 0)
    throw "Looks like there is no match pair between the given input and output token";
  return g;
};

const removeOutputOutgoingEdges = (g: GraphNode[]): GraphNode[] => {
  g[1].edges_out = [];
  return g;
};

const removeEdgesBackToInToken = (g: GraphNode[]): GraphNode[] => {
  const gFiltered = g.map((edges) => {
    const e = edges.edges_out.filter((edge) => edge.next_node_indx !== 0);
    return {
      id: edges.id,
      edges_out: e,
    };
  });
  return gFiltered;
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
 * @param pools should only be pools which touch the input or output token
 */
export const buildDirectedGraph = (
  pools: PoolInfoFloats[],
  tokenIn: AccountId,
  tokenOut: AccountId
): { graph: DirectedGraph; tokens: AccountId[] } => {
  const poolsWithIdx = pools.map((pool, i) => {
    return { ...pool, index: i };
  });
  const allTokensBadOrder = getAllTokensUsed(pools);
  const allTokens = rearrangeTokenList(allTokensBadOrder, tokenIn, tokenOut);

  console.log("Pools used", pools);
  const nodes = allTokens.map((tok, i) =>
    tokenToGraphNode(tok, poolsWithIdx, allTokens, i)
  );

  const filteredNodes = removeEmptyNodes(
    removeOutputOutgoingEdges(
      removeEdgesBackToInToken(removeEdgesNotTouchingInOrOut(nodes))
    )
  );
  return {
    graph: {
      nodes: filteredNodes,
    },
    tokens: allTokens,
  };
};

// near.account(config.near.PROXY_ACCOUNT).then(async (account) => {
//   const tokenIn = "banana.ft-fin.testnet";
//   const tokenOut = "shawn.testnet";
//   const pools = await getPoolsTouchingInOrOut(account, tokenIn, tokenOut);
//   const G = buildDirectedGraph(pools, tokenIn, tokenOut);
//   console.log("The driected graph", JSON.stringify(G))
//   await findOptV2(G, 1000.222);
// });
