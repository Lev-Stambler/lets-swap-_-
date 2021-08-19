import torch
import geotorch

def get_return_numerator(a, b, p, m, x):
	return x * m * (1 - p) * b
    
def get_return_denominator(a, b, p, m, x):
	return x * m * (1 - p) + a

def get_return_fn(a, b, p, m):
	def f(x):
		return get_return_numerator(a,b, p, m, x) / get_return_denominator(a, b, p, m, x)
	return f

a = torch.IntTensor([1000, 100, 10])
b = torch.IntTensor([1000, 100, 10])
p = torch.FloatTensor([0.01, 0.01, 0.01])
m = torch.FloatTensor([10.5]).repeat(3)

x = torch.FloatTensor([0.1, 0.3, 0.6])
x.requires_grad = True
x.retain_grad()

class OutputOptimizer(torch.nn.Module):
	"""
		N is an int
		a is of size (N)
		b is of size (N)
		p is of size (N)
		m is of size (N)
	"""
	def __init__(self, N, a, b, p, m):
		super(OutputOptimizer, self).__init__()
		self.linear1 = torch.nn.Linear(1, N)
		self.linear1_constrained = geotorch.sphere(self.linear1, "bias")
		self.return_fn = get_return_fn(a, b, p, m)

	# x's -1s column is of size 1 and should always equal 1
	def forward(self, x):
		o = self.linear1_constrained(x)
		# Square the output because the input weights are constrained to a L2 norm, so squaring the outputs
		# mimics and L1 constraint when the input (x) is 1, which is what we are looking for
		o = torch.square(o)
		o = self.return_fn(o)
		# Return * -1 because gradient descent optimizes for minimum
		o = torch.sum(o) * -1
		return o

model = OutputOptimizer(3, a, b, p, m)

optimizer = torch.optim.SGD(model.parameters(), lr=1e-3)

inp_tensor = torch.FloatTensor(1)

print(model.linear1_constrained.bias)

expected_out = torch.FloatTensor([float('-inf')])[0]
criterion = torch.nn.MSELoss(reduction='sum')

start_output = model(inp_tensor)

for t in range(10000):
	y_pred = model(inp_tensor)
	loss =  y_pred - expected_out
	# loss.requires_grad = True
	optimizer.zero_grad()
	loss.backward()
	optimizer.step()

end_output = model(inp_tensor)
pool_weights = torch.square(model.linear1_constrained.bias)

print(f"Initial Output = {start_output}, End Output = {end_output}, Pool Weights = {pool_weights}")