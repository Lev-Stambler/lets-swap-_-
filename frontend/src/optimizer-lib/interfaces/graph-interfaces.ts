import { AccountId } from "@malloc/sdk";

/**
 *  GraphEdges is equivalent to [nextIndexInGraph, [a, b, p, pool info id, index of token in in pool, index of token out in pool]]
 */
export type GraphEdge = {
  next_node_indx: number;
  token_in_amount: number;
  token_out_amount: number;
  fee: number;
  pool_id: number;
  fraction?: number;
};

export type GraphNode = {
  id: number;
  edges_out: GraphEdge[];
};

/**
 * A directed graph where the 0th node should be the input token and the 1st node the output token
 */
export type DirectedGraph = {
  nodes: GraphNode[];
};
