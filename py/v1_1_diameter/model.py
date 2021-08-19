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
    def f(m):
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


class OutputOptimizer(torch.nn.Module):
    """
            N is an int
            a is of size (N)
            b is of size (N)
            p is of size (N)
            m is of size (N)
    """

    def __init__(self, N, return_fn):
        super(OutputOptimizer, self).__init__()
        self.return_fn = return_fn
        self.splitter = Splitter(N)

    # x's -1s column is of size 1 and should always equal 1
    def forward(self, x):
        o = self.splitter(x)
        o = self.return_fn(o)
        # Return * -1 because gradient descent optimizes for minimum
        o = torch.sum(o) * -1
        return o


def find_optimum_splits(a, b, p, m):
    assert a.size() == b.size()
    assert a.size() == p.size()
    assert m.size() == a.size()

    return_fn = get_return_fn(a, b, p)

    model = OutputOptimizer(a.size()[-1], return_fn)
    optimizer = torch.optim.SGD(model.parameters(), lr=LR)
    INP_TENSOR = m
    start_output = model(INP_TENSOR) * -1

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


def run(a, b, p, m):
    # print(a)
    a = torch.FloatTensor(list(map(int, a)))
    b = torch.FloatTensor(list(map(int, b)))
    p = torch.FloatTensor(p)
    m = torch.FloatTensor(m)
    find_optimum_splits(a, b, p, m)


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
            m = [10 ** i] * 3
            print(m)
            run(a, b, p, m)
