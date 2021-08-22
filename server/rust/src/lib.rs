// #![no_std]

extern crate web_sys;
#[macro_use]
extern crate alloc;

use core::iter::successors;

use alloc::{
    borrow::ToOwned,
    fmt::format,
    string::String,
    vec::{self, Vec},
};
use optimization::{Func, GradientDescent, Minimizer, NumericalDifferentiation};
use serde::{self, de::Expected, Deserialize, Serialize};
use wasm_bindgen::prelude::*;
// use wasm_bindgen_test::__rt::node;

type PoolId = u64;

const FRACTION_OUT_OF: u64 = 1_000_000_000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Edge {
    next_node_indx: usize,
    token_in_amount: f64,
    token_out_amount: f64,
    fee: f64,
    pool_id: u64,
    fraction: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Node {
    /// The index in the Graph
    id: usize,
    edges_out: Vec<Edge>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Graph {
    pub nodes: Vec<Node>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Return {
    pub pool_paths: Vec<Vec<PoolId>>,
    // TODO: you would wanna make this exact with u128 or whatever in the future
    pub amounts: Vec<f64>,
    pub expected_out: f64,
}

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    // The `console.log` is quite polymorphic, so we can bind it with multiple
    // signatures. Note that we need to use `js_name` to ensure we always call
    // `log` in JS.
    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn log_u32(a: u32);

    // Multiple arguments too!
    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn log_many(a: &str, b: &str);
}

#[wasm_bindgen]
pub fn optimize(graph_str: String, input: f64) -> String {
    let mut g: Graph = serde_json::from_str(&graph_str).unwrap();
    let (g, expected_out) = _optimize(g, input);
    let (amounts, pool_paths) = optimized_graph_to_pool_paths_and_amounts(&g, 0, input, &vec![]);
    let ret = Return {
        expected_out,
        amounts,
        pool_paths,
    };
    serde_json::to_string(&ret).unwrap()
}

// TODO: make splits U128
// pub fn optimized_graph_to_pool_paths_and_splits(g: &Graph) -> (Vec<f64>, Vec<Vec<PoolId>>) {
//     let mut splits: Vec<f64> = vec![];
//     let mut pool_paths: Vec<Vec<PoolId>> = vec![];

//     let mut node_stack = vec![&g.nodes[0]];
//     let current_path: Vec<PoolId> = vec![];
//     while node_stack.len() != 0 {
//         let node = node_stack.pop().unwrap();
//         // current_path.push(node.)
//     }
//     // Go through the same DFS walk of the graph and append to the outputs
//     todo!()
// }

// TODO: make this iterative cause this is very inefficient w/ memory
pub fn optimized_graph_to_pool_paths_and_amounts(
    g: &Graph,
    node_id: usize,
    curr_amount: f64,
    curr_path: &[PoolId], // mut inp_fractions: Vec<f64>,
                          // mut inp_paths: Vec<Vec<PoolId>>
) -> (Vec<f64>, Vec<Vec<PoolId>>) {
    let node = &g.nodes[node_id];
    if node.id == 1 {
        return (vec![curr_amount], vec![curr_path.to_owned()]);
    }
    let mut fractions = vec![];
    let mut paths = vec![];
    for edge in node.edges_out.iter() {
        assert!(edge.fraction.is_some());
        let new_amount = curr_amount * edge.fraction.unwrap();
        let mut new_path = curr_path.to_owned();
        new_path.push(edge.pool_id);
        let (mut _inp_fractions, mut _inp_paths) = optimized_graph_to_pool_paths_and_amounts(
            g,
            edge.next_node_indx,
            new_amount,
            &new_path,
        );
        fractions.append(&mut _inp_fractions);
        paths.append(&mut _inp_paths);
    }
    (fractions, paths)
}

pub fn _optimize(g: Graph, input: f64) -> (Graph, f64) {
    let init_positions = get_initial_splits(&g);
    // numeric version of the Rosenbrock function
    let variable_end_indices = get_variable_end_indices(&g);
    let mut f = get_run_forward_fn(g.clone(), variable_end_indices.clone(), input);
    let function = NumericalDifferentiation::new(Func(|x: &[f64]| f(x)));

    // we use a simple gradient descent scheme
    let minimizer = GradientDescent::new();
    let minimizer = minimizer.max_iterations(Some(1_000));

    // perform the actual minimization, depending on the task this may
    // take some time, it may be useful to install a log sink to see
    // what's going on
    let minimizer_solution = minimizer.minimize(&function, init_positions);

    // let result_log = format!("Found solution for function: {:?}", minimizer_solution);
    // println!("{}", result_log);
    (
        minimizer_solution_to_fractions(g, minimizer_solution.position, &variable_end_indices),
        minimizer_solution.value * -1.,
    )
    // unsafe {
    //     log(format!(
    //         "Found solution for Rosenbrock function at f({:?}) = {:?}",
    //         solution.position, solution.value
    //     )
    //     .as_ref());
    // }
}

/// Fill the graph with the fraction splits derived from the optimizer
fn minimizer_solution_to_fractions(
    mut g: Graph,
    solution: Vec<f64>,
    variable_end_index: &[usize],
) -> Graph {
    let mut last_end_index = 0;
    for (i, end_index) in variable_end_index.iter().enumerate() {
        // Skip the rest of the for loop if i is 1 as that is the output node
        if i == 1 {
            continue;
        }
        if g.nodes[i].edges_out.len() == 0 {
            continue;
        }

        // For a node with n edges, this gives the the 1st to nth (exclusive, ie not the 0th) split value
        let split_vars_except_0th = &solution[last_end_index..*end_index];
        let sum: f64 = split_vars_except_0th.iter().sum();
        let split_var_0th = 1.0 - sum;
        last_end_index = *end_index;
        assert_eq!(sum + split_var_0th, 1.0);
        assert!(0.0 <= sum && sum <= 1.);
        assert!(0. <= split_var_0th && split_var_0th <= 1.);
        assert!(g.nodes[i].edges_out.len() > 0);
        assert_eq!(g.nodes[i].edges_out.len(), 1 + split_vars_except_0th.len());

        g.nodes[i].edges_out[0].fraction = Some(split_var_0th);

        for (j, split) in split_vars_except_0th.iter().enumerate() {
            g.nodes[i].edges_out[j + 1].fraction = Some(*split);
        }
    }
    g
}

fn get_run_forward_fn(
    g: Graph,
    variable_end_index: Vec<usize>,
    input: f64,
) -> impl Fn(&[f64]) -> f64 {
    assert_eq!(g.nodes.len(), variable_end_index.len());

    move |x: &[f64]| {
        // TODO: figure out a way to not have to clone the graph with each iteration.
        // It's causes a huge slowdown as this has to occur with each call to find the output
        // Right now it is necessary to ensure that the updates to the liquidity pool amounts stays local to just this iteration
        // A possibility is to store the initial amounts severalty and then restore their values with the start of each iteration
        let mut g = g.clone();

        let mut node_queue = Vec::<(f64, usize)>::with_capacity((&g.nodes).len());
        node_queue.push((input, 0));
        let mut total_out = 0.0;

        while node_queue.len() != 0 {
            let (amount, node_id): (f64, usize) = node_queue.pop().unwrap();
            let node = &mut g.nodes[node_id];
            let node_id = node.id;
            let (variables_start, variables_end) = if node_id == 0 {
                (0, variable_end_index[0])
            } else {
                (variable_end_index[node_id - 1], variable_end_index[node_id])
            };
            let splits_for_node_except_0th = &x[variables_start..variables_end];
            let split_0th = 1.0 - splits_for_node_except_0th.iter().sum::<f64>();

            // Return total_out to be the most negative possible value to put in
            // place a "constraint" that the splits have to be in range (from 0 to 1)
            if check_out_of_range(&split_0th)
                || splits_for_node_except_0th.iter().any(check_out_of_range)
            {
                // println!("{:?} {:?}", split_0th, splits_for_node_except_0th);
                total_out = -1. * 10_e38; // The maximum negative floating point value
                break;
            }

            // println!("{:?}", splits_for_node_except_0th);
            assert_eq!(splits_for_node_except_0th.len(), node.edges_out.len() - 1);
            let mut pool_inputs: Vec<f64> = splits_for_node_except_0th
                .iter()
                .map(|portion| portion * amount)
                .collect();
            let pool_inputs_0 = split_0th * amount;

            pool_inputs.insert(0, pool_inputs_0);

            let next_vals: Vec<f64> = pool_inputs
                .iter()
                .enumerate()
                .map(|(i, amount)| get_output_amount(amount, &node.edges_out[i]))
                .collect();

            for i in 0..node.edges_out.len() {
                // Update the liquidity pool values
                unsafe {
                    (*((&mut node.edges_out[i]) as *mut Edge)).token_in_amount += pool_inputs[i];
                    (*((&mut node.edges_out[i]) as *mut Edge)).token_out_amount -= next_vals[i];
                };
                if node.edges_out[i].next_node_indx == 1 {
                    total_out += next_vals[i];
                } else {
                    node_queue.push((next_vals[i], node.edges_out[i].next_node_indx));
                }
            }
        }
        total_out * -1.0
    }
}

fn check_out_of_range(split: &f64) -> bool {
    return *split < 0.0 || 1.0 < *split;
}

fn get_initial_splits(g: &Graph) -> Vec<f64> {
    let splits: Vec<Vec<f64>> = g
        .nodes
        .iter()
        .map(|node| {
            let v = 1.0 / (node.edges_out.len() as f64);
            let len = if node.edges_out.len() > 0 {
                node.edges_out.len() - 1
            } else {
                0
            };
            (0..len).map(|_| v).collect::<Vec<f64>>()
        })
        .collect();
    splits.into_iter().flatten().collect()
}

/// Get a list of end index boundaries (exclusive) for each set of variables
///
/// So, the variables going into the optimizer have to be flat, thus there has to
/// be a list of indices which delineate the boundaries for the fraction splits of each node
/// So, the results first value, say n, dictates that the 0th to nth (exclusive) variable are the splits for the first node.
/// Then the second value, say m, dictates that the nth to mth variable are the splits for the second node
fn get_variable_end_indices(g: &Graph) -> Vec<usize> {
    // Subtract 1 because each set has 1 less variables than splits
    let node_edge_lens: Vec<usize> = g
        .nodes
        .iter()
        .map(|node| {
            if node.edges_out.len() == 0 {
                0
            } else {
                node.edges_out.len() - 1
            }
        })
        .collect();
    let mut iter = node_edge_lens.iter();
    let partial: Vec<_> = successors(Some(0), |n| iter.next().map(|i| n + i)).collect();
    // unwrap since with the added zero, the slice will always be non-empty
    let (total, partial) = partial.split_last().unwrap();

    let mut vec_owned = partial.to_owned();
    vec_owned.push(*total);
    vec_owned.remove(0);
    vec_owned
}

fn get_output_amount(amount: &f64, pool: &Edge) -> f64 {
    (amount * (1.0 - pool.fee) * pool.token_out_amount)
        / (amount * (1.0 - pool.fee) + pool.token_in_amount)
}

#[cfg(test)]
mod tests {
    use std::vec;

    use crate::{
        Edge, Graph, Node, _optimize, optimize, optimized_graph_to_pool_paths_and_amounts,
    };

    fn assert_within_range(val: f64, expected: f64, range: f64) {
        assert!(expected - range <= val && val <= expected + range);
    }

    // use wasm_bindgen_futures::JsFuture;

    #[test]
    fn test_optimization_works_with_2_levels() {
        let g = Graph {
            nodes: vec![
                Node {
                    id: 0,
                    edges_out: vec![
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.03,
                            pool_id: 100,
                            fraction: None,
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 100000.,
                            token_out_amount: 100000.,
                            fee: 0.03,
                            pool_id: 101,
                            fraction: None,
                        },
                        Edge {
                            next_node_indx: 2,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.001,
                            pool_id: 102,
                            fraction: None,
                        },
                    ],
                },
                Node {
                    id: 1,
                    edges_out: vec![],
                },
                Node {
                    id: 2,
                    edges_out: vec![
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.001,
                            pool_id: 103,
                            fraction: None,
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.0001,
                            pool_id: 104,
                            fraction: None,
                        },
                    ],
                },
            ],
        };
        let input = 100.;
        let (ret, out_opt) = _optimize(g, input);
        println!(
            "Got return graph for 2 level of {:?} with out of {:?}",
            ret, out_opt
        );
        assert_within_range(ret.nodes[0].edges_out[0].fraction.unwrap(), 0., 0.001);
        assert_within_range(ret.nodes[0].edges_out[1].fraction.unwrap(), 0.38, 0.001);
        assert_within_range(ret.nodes[0].edges_out[2].fraction.unwrap(), 0.62, 0.001);
        assert_within_range(ret.nodes[2].edges_out[0].fraction.unwrap(), 0.494, 0.001);
        assert_within_range(ret.nodes[2].edges_out[1].fraction.unwrap(), 0.5056, 0.001);
        assert_within_range(out_opt, 98.18, 0.01);

        let (amounts, pool_paths) =
            optimized_graph_to_pool_paths_and_amounts(&ret, 0, input, &vec![]);
        assert_eq!(amounts.len(), pool_paths.len());
        println!("Got amounts {:?} and pool paths {:?}", amounts, pool_paths);

        assert_eq!(
            amounts.iter().map(|v| *v as u64).collect::<Vec<u64>>(),
            vec![0, 38, 30, 31]
        );

        assert_eq!(
            pool_paths,
            vec![vec![100], vec![101], vec![102, 103], vec![102, 104]]
        );
    }

    #[test]
    fn test_it_works_with_1_level() {
        let g = Graph {
            nodes: vec![
                Node {
                    id: 0,
                    edges_out: vec![
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.003,
                            pool_id: 100,
                            fraction: None,
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 100000.,
                            token_out_amount: 100000.,
                            fee: 0.03,
                            fraction: None,
                            pool_id: 101,
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.001,
                            pool_id: 101,
                            fraction: None,
                        },
                    ],
                },
                Node {
                    id: 1,
                    edges_out: vec![],
                },
            ],
        };
        let ret = _optimize(g, 100.);
        println!("Got return graph for 1 level of {:?}", ret);
    }
}
