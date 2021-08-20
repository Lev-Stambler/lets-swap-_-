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
use serde::{self, Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct Edge {
    next_node_indx: usize,
    token_in_amount: f64,
    token_out_amount: f64,
    fee: f64,
    pool_id: u64,
}

#[derive(Serialize, Deserialize)]
pub struct Node {
    /// The index in the Graph
    id: usize,
    edges_out: Vec<Edge>,
}

#[derive(Serialize, Deserialize)]
pub struct Graph {
    pub nodes: Vec<Node>,
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
pub fn optimize(graph_str: String, input: f64) {
    let g: Graph = serde_json::from_str(&graph_str).unwrap();
    let init_positions = get_initial_splits(&g);
    // numeric version of the Rosenbrock function
    let variable_end_indices = get_variable_end_indices(&g);
    let mut f = run_forward_fn(g, variable_end_indices, input);
    let function = NumericalDifferentiation::new(Func(|x: &[f64]| f(x)));

    // we use a simple gradient descent scheme
    let minimizer = GradientDescent::new();
    let minimizer = minimizer.max_iterations(Some(5_000));

    // perform the actual minimization, depending on the task this may
    // take some time, it may be useful to install a log sink to see
    // what's going on
    let solution = minimizer.minimize(&function, init_positions);

    let result_log = format!("Found solution for function: {:?}", solution);
    println!("{}", result_log);
    // unsafe {
    //     log(format!(
    //         "Found solution for Rosenbrock function at f({:?}) = {:?}",
    //         solution.position, solution.value
    //     )
    //     .as_ref());
    // }
}

// TODO: add your constraint here by just tanking a function to neg inf if the value is less than 0 or greater than 1
// TODO: part of that constraint also has to check that 0th is within bounds
fn run_forward_fn(
    mut g: Graph,
    variable_end_index: Vec<usize>,
    input: f64,
) -> impl Fn(&[f64]) -> f64 {
    assert_eq!(g.nodes.len(), variable_end_index.len());

    move |x: &[f64]| {
        let mut node_queue = Vec::<(f64, &Node)>::with_capacity((&g.nodes).len());
        node_queue.push((input, &g.nodes[0]));
        let mut total_out = 0.0;

        while node_queue.len() != 0 {
            let (amount, node): (f64, &Node) = node_queue.remove(0);
            let node_id = node.id;
            let (variables_start, variables_end) = if node_id == 0 {
                (0, variable_end_index[0])
            } else {
                (variable_end_index[node_id - 1], variable_end_index[node_id])
            };
            let splits_for_node_except_0th = &x[variables_start..variables_end];
            let split_0th = 1.0 - splits_for_node_except_0th.iter().sum::<f64>();

            if check_out_of_range(&split_0th)
                || splits_for_node_except_0th.iter().any(check_out_of_range)
            {
                // println!("{:?} {:?}", split_0th, splits_for_node_except_0th);
                total_out = -1. * 10_e38;
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
                // TODO: add back in with unsafe!!!
                // node.edges_out[i].token_in_amount += pool_inputs[i];
                // node.edges_out[i].token_out_amount -= next_vals[i];
                if node.edges_out[i].next_node_indx == 1 {
                    total_out += next_vals[i];
                } else {
                    node_queue.push((next_vals[i], &g.nodes[node.edges_out[i].next_node_indx]));
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

    use crate::{optimize, Edge, Graph, Node};

    // use wasm_bindgen_futures::JsFuture;

    #[test]
    fn test_it_works_with_2_levels() {
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
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 100000.,
                            token_out_amount: 100000.,
                            fee: 0.03,
                            pool_id: 101,
                        },
                        Edge {
                            next_node_indx: 2,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.001,
                            pool_id: 101,
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
                            pool_id: 102,
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.0001,
                            pool_id: 102,
                        },
                    ],
                },
            ],
        };
        optimize(serde_json::to_string(&g).unwrap(), 100.);
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
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 100000.,
                            token_out_amount: 100000.,
                            fee: 0.03,
                            pool_id: 101,
                        },
                        Edge {
                            next_node_indx: 1,
                            token_in_amount: 10000.,
                            token_out_amount: 10000.,
                            fee: 0.001,
                            pool_id: 101,
                        },
                    ],
                },
                Node {
                    id: 1,
                    edges_out: vec![],
                },
            ],
        };
        optimize(serde_json::to_string(&g).unwrap(), 100.);
    }
}
