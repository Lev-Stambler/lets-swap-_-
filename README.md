# Let's Swap 
## Summary
This project uses multiple liquidity pools to get optimal output for a token pair swap. It looks at all possible swap paths with distance of at most two. This means that if someone is trying to swap token a -> c, the algorithm also looks at liquidity pools from a -> b and b -> c. It then uses optimization techniques to find the best split between different trade paths. The algorithm takes into account fees as well.

### The details
Let's Swap will be a DAG (directed acyclic graph) where each node represents a token and each edge (connection between to nodes) represents a liquidity pool/ trade. The root node is the input token, and the last node in the dag is the output token. The algorithm then assigns "weights" to each edge. These weights correspond to what fraction of the input should go to each liquidity pool. Then, the algorithm uses optimization techniques and Web Assembly to find the optimal values for the weights such that the output amount is as high as possible.

**Note** This is a novel algorithm for optimizing output

The following is an illustration of what the DAG looks like when swapping from token A to B:

Here is an example of the DAG that the algorithm build
![chart](https://user-images.githubusercontent.com/18239203/132230306-769267c7-7c03-4321-bc0a-6475d437ca36.png)


## Testnet
Find the link to the testnet site: https://lets-swap.netlify.app/
