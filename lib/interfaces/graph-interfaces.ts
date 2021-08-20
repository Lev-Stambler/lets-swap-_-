import { AccountId } from "@malloc/sdk"

/**
 *  GraphEdges is equivalent to [nextIndexInGraph, [a, b, p, pool info id, index of token in in pool, index of token out in pool]]
 */
export type GraphEdge = [number, [string, string, number, number, number, number]]
export type GraphNode = GraphEdge[]

/**
 * A directed graph where the 0th node should be the input token and the 1st node the output token
 */
export type DirectedGraph = {
	graph: GraphNode[],
	// metadata: {
	// 	indexToToken: AccountId[]
	// }
}