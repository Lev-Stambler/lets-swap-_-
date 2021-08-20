import torch
import copy
import json
import sys
import geotorch
from torch.functional import Tensor

INP_TENSOR = torch.FloatTensor([0])
EXPECTED_OUT = torch.FloatTensor([float('-inf')])[0]
# It seems like LR should be dependent on the size of the input m
LR_1 = 5e-2
LR_2 = 1e-3

# Assume a test is running if no cli args are passed in for values


def running_test() -> bool:
    return len(sys.argv) < 3


def print_local(*args):
    if running_test():
        print(args)


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
        self.splitters = torch.nn.ModuleList(
            map(lambda edges: Splitter(len(edges)), graph))

    # x is the initial set of inputs
    def forward(self, x, graph):
        # TODO: well this is slow
        graph = copy.deepcopy(graph)
        # (_, (aInit, bInit, pInit) = graph[0]
        # TODO: will need a lot of splitters
        stack = []
        # Append the initial value to the first inputs from the graph
        stack.append((x, 0))

        total_accum = torch.FloatTensor([0])
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
                (_, (_a, _b, _p, _pool_id, _idx_in, _idx_out)) = edge_out
                a.append(_a)
                b.append(_b)
                p.append(_p)
            next_vals = get_return_fn(torch.FloatTensor(
                a), torch.FloatTensor(b), torch.FloatTensor(p))(m)
            # May not be the perfect output because you DFS and subtract from next_vals, bu idk
            for i, edge_out in enumerate(edges_out):
                (next_i, (_a, _b, _p, _pool_id, _idx_in, _idx_out)) = edge_out
                # Make sure to update the a and b values of the pool because they changed
                new_a = _a + m[i]
                new_b = _b - next_vals[i]

                assert new_a >= 0
                assert new_b >= 0

                graph[node_index][i] = (
                    next_i, (new_a, new_b, _p, _pool_id, _idx_in, _idx_out))

                if next_i != 1:
                    stack.append((next_vals[i], next_i))
                else:
                    total_accum = torch.add(total_accum, next_vals[i])
        # o = self.return_fn(m)
        # Return * -1 because gradient descent optimizes for minimum
        # o = torch.sum(o) * -1
        return total_accum * -1


def find_optimum_splits(m, G):
    ITERATIONS_1, ITERATIONS_2 = 2_000, 15_000

    model = OutputOptimizer(G)

    optimizer1 = torch.optim.SGD(model.parameters(), lr=LR_1)

    INP_TENSOR = m
    start_output = model(INP_TENSOR, G) * -1
    # TODO: have an actual fn for getting this
    (node_to, (a, b, p, _, _, _)) = G[0][0]
    print_local(a, b, p, m)

    one_lp_output = -1

    if node_to == 1:
        one_lp_output = get_return_fn(
            torch.FloatTensor([a]), torch.FloatTensor([b]), torch.FloatTensor([p]))(m)[0]

    print_local("Out from just using the first lp", one_lp_output)
    print_local("Starting output: ", start_output)

    for t in range(ITERATIONS_1):
        y_pred = model(INP_TENSOR, G)
        loss = y_pred - EXPECTED_OUT
        # loss.requires_grad = True
        optimizer1.zero_grad()
        loss.backward()
        optimizer1.step()
    # Remove the first optimizer to free up space
    del optimizer1.param_groups[0]

    optimizer2 = torch.optim.SGD(model.parameters(), lr=LR_2)
    for t in range(ITERATIONS_2):
        y_pred = model(INP_TENSOR, G)
        loss = y_pred - EXPECTED_OUT
        # loss.requires_grad = True
        optimizer2.zero_grad()
        loss.backward()
        optimizer2.step()

    end_output = model(INP_TENSOR, G) * -1
    # TODO: the hell how you get this out?
    pool_weights = map(lambda s: torch.square(
        s.linear1_constrained.bias).tolist(), list(model.splitters))
    # print_local(f"Initial Output = {start_output}, End Output = {end_output}, Pool Weights = {pool_weights}")
    print("{" + '"one_pool_output": {}, "start_output": {}, "end_output": {}, "pool_weights": {}'.format(one_lp_output,
                                                                                                         start_output[0], end_output[0], list(pool_weights)) + "}")

    return (
        start_output, end_output, pool_weights
    )


def clean_graph(G):
    for node_ind, node in enumerate(G):
        edges_out = node
        for i, edge_out in enumerate(edges_out):
            (next_i, (_a, _b, _p, _pool_id, _idx_in, _idx_out)) = edge_out
            node[i] = (next_i, (float(_a), float(_b),
                       _p, _pool_id, _idx_in, _idx_out))
        G[node_ind] = node
    print_local("Cleaned graph to", G)
    return G


def run(m, G):
    m = torch.FloatTensor(m)
    find_optimum_splits(
        m, clean_graph(G))


if __name__ == "__main__":
    if running_test() == False:
        G = json.loads(sys.argv[1])
        m = json.loads(sys.argv[2])
        print_local(G)
        run([float(m)] * len(G[0]), G)
        sys.stdout.flush()
    # Test case
    else:
        # G = [[[3,["3719376120606282428569104464","2753471194",0.003,11,0,1]],[1,["435340765391479209133303400","1737700686",0.003,20,1,0]]],[],[[1,["61896576","22700009774",0.003,9,1,0]]],[[0,["2753471194","3719376120606282428569104464",0.003,11,1,0]]],[[0,["1100000000","9093389106119850868418660",0.003,19,0,1]]],[[0,["9000000000000000000000000","100000000000000000000000000",0.003,22,1,0]]],[[0,["100000000000","1000000000000000000000000000",0.0025,24,0,1]]],[[0,["890","24435278191687509978181036",0.003,29,1,0]]],[[0,["87089305969684420819728","114856455105417678581596944",0.002,36,1,0]]]]
        # G = [[(2, (100000, 100000, 0.03, 0, 0, 0)), (1, (1000, 1000, 0.03, 0, 0, 0))], [], [
        #     (1, (1000, 1000, 0.01, 0, 0, 0)), (1, (100000, 100000, 0.03, 0, 0, 0))]]

        # G = [[[1, ["3719376120606282428569104464", "2753471194", 0.003, 11, 0, 1]], [1, ["13000000000000000000000000", "9312169", 0.003, 15, 0, 1]], [1, ["3719376120606282428569104464",
        #                                                                                                                                                   "2753471194", 0.003, 11, 0, 1]], [1, ["13000000000000000000000000", "9312169", 0.003, 15, 0, 1]]], [], [[1, ["99002078467998376", "891000089182548490426", 0.0035, 6, 1, 0]]]]
        G = [[[1, ["3719376120606282428569104464", "2753471194", 0.003, 11, 0, 1]], [1, ["13000000000000000000000000",
                                                                                         "9312169", 0.003, 15, 0, 1]]], [], [[1, ["99002078467998376", "891000089182548490426", 0.0035, 6, 1, 0]]]]
        for i in range(27, 28):
            m = [10 ** i] * 1
            run(m, G)

# TODO: torch has to use big numbers
