import torch
import json
import sys
import geotorch
from torch.functional import Tensor

INP_TENSOR = torch.FloatTensor([0])
EXPECTED_OUT = torch.FloatTensor([float('-inf')])[0]
LR = 7e-3


def get_return_numerator(a, b, p, m):
    return m * (1 - p) * b


def get_return_denominator(a, b, p, m):
    return m * (1 - p) + a


def get_return_fn(a, b, p):
    def f(m) -> Tensor:
        return get_return_numerator(a, b, p, m) / get_return_denominator(a, b, p, m)
    return f


criterion = torch.nn.MSELoss(reduction='sum')


class Splitter(torch.nn.Module):
    # N is the number of splits
    def __init__(self, N):
        super(Splitter, self).__init__()
        self.linear1 = torch.nn.Linear(1, N)
        self.linear1_constrained = geotorch.sphere(self.linear1, "bias")

    # X should be a uniform tensor whose values represent the value going in
    def forward(self, x: Tensor):
        # Input zeros so that the weights are effectively useless and only the bias is kept
        lin1_inp = torch.zeros(*x.size()[:-1], 1)
        o = self.linear1_constrained(lin1_inp)
        # Square the output because the input weights are constrained to a L2 norm, so squaring the outputs
        # mimics and L1 constraint when the input (x) is 1, which is what we are looking for
        o = torch.square(o)
        print(o, x)
        return o * x


# def dfs(graph: list, init_vals):


class OutputOptimizer(torch.nn.Module):
    """
            N is an int
            a is of size (N)
            b is of size (N)
            p is of size (N)
            m is of size (N)
    """

    def __init__(self, graph):
        super(OutputOptimizer, self).__init__()
        # self.return_fn = return_fn
        self.splitters = torch.nn.ModuleList(map(lambda edges: Splitter(len(edges)), graph))

    # x is the initial set of inputs
    def forward(self, x, graph):
        # (_, (aInit, bInit, pInit) = graph[0]
        # TODO: will need a lot of splitters

        stack = []
        # Append the initial value to the first inputs from the graph
        stack.append((x, 0))

        total_accum = torch.FloatTensor(0)
        # THIS IS FULLY SEQUENTIAL FOR NOW
        while len(stack) != 0:
            # TODO: this is wrong!!
            (inp_val, node_index) = stack.pop()
            edges_out = graph[node_index]
            m = self.splitters[node_index](inp_val)
            # TODO: can be made more efficient
            a = []
            b = []
            p = []
            for edge_out in edges_out:
                (_, (_a, _b, _p)) = edge_out
                a.append(_a)
                b.append(_b)
                p.append(_p)
            next_vals = get_return_fn(torch.FloatTensor(a), torch.FloatTensor(b), torch.FloatTensor(p))(m)
            print(next_vals, a, b, p)
            for i, edge_out in enumerate(edges_out):
                (next_i, _) = edge_out
                if next_i != 1:
                    stack.append((next_vals[i], next_i))
                else:
                    # print (next_vals[i])
                    total_accum = total_accum + next_vals[i]

        o = self.return_fn(m)
        # Return * -1 because gradient descent optimizes for minimum
        o = torch.sum(o) * -1
        return o


def find_optimum_splits(m, G):

    model = OutputOptimizer(G)

    optimizer = torch.optim.SGD(model.parameters(), lr=LR)
    INP_TENSOR = m
    start_output = model(INP_TENSOR, G) * -1

    for t in range(10000):
        y_pred = model(INP_TENSOR)
        loss = y_pred - EXPECTED_OUT
        # loss.requires_grad = True
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    end_output = model(INP_TENSOR) * -1
    pool_weights = torch.square(model.splitter.linear1_constrained.bias)
    # print(f"Initial Output = {start_output}, End Output = {end_output}, Pool Weights = {pool_weights}")
    print("{" + '"start_output": {}, "end_output": {}, "pool_weights": {}'.format(
        start_output, end_output, pool_weights.tolist()) + "}")

    return (
        start_output, end_output, pool_weights
    )


def run(m):
    # print(a)
    # a = torch.FloatTensor(list(map(int, a)))
    # b = torch.FloatTensor(list(map(int, b)))
    # p = torch.FloatTensor(p)
    m = torch.FloatTensor(m)
    find_optimum_splits(
        m, [[(2, (1000, 1000, 0.03)), (1, (1000, 1000, 0.03))], [], [(1, (1000, 1000, 0.03)), (1, (1000, 1000, 0.03))]])  # a in, b out.
    # Graph is a -> b, a -> c -> b, a ->c -> b


if __name__ == "__main__":
    if len(sys.argv) >= 5:
        # assert len(sys.argv) >= 5
        # print(sys.argv[1])
        a = json.loads(sys.argv[1])
        b = json.loads(sys.argv[2])
        p = json.loads(sys.argv[3])
        m = json.loads(sys.argv[4])
        run(a, b, p, m)
        sys.stdout.flush()
    # Test case
    else:
        a = [1000000000, 1000000, 100]
        b = [1000000000, 1000000, 100]
        p = [0.03, 0.09, 0.03]
        for i in range(5):
            m = [10 ** i] * 2
            print(m)
            run(m)
