#![no_std]

extern crate web_sys;
#[macro_use]
extern crate alloc;

use alloc::vec::Vec;
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
pub fn optimize() {
    // numeric version of the Rosenbrock function
    let function = NumericalDifferentiation::new(Func(|x: &[f64]| {
        (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0].powi(2)).powi(2)
    }));

    // we use a simple gradient descent scheme
    let minimizer = GradientDescent::new();

    // perform the actual minimization, depending on the task this may
    // take some time, it may be useful to install a log sink to see
    // what's going on
    let solution = minimizer.minimize(&function, vec![-3.0, -4.0]);

    // unsafe {
    //     log(format!(
    //         "Found solution for Rosenbrock function at f({:?}) = {:?}",
    //         solution.position, solution.value
    //     )
    //     .as_ref());
    // }
}

// TODO: add your constraint here by just tanking a function to neg inf if the value is less than 0 or greater than 1
fn run_forward() {
}

// #[cfg(test)]
// mod tests {
//     #[test]
//     fn it_works() {
//         assert_eq!(2 + 2, 4);
//     }
// }