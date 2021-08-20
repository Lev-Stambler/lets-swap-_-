import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { config } from "../config";
import { near } from "../service/near";
import { getPoolsTouchingInOrOut } from "../service/get-pools";
import { buildDirectedGraph } from "../service/graph";
import cors from 'cors'
import { findOptV2 } from "../service/get-optimized";

const app = express();
const port = 3000; // default port to listen

// TODO: whitelist
app.use(cors())
app.use(bodyParser.json());

// define a route handler for the default home page
app.get("/get-swap/:tokenin/:tokenout/:amount", (req, res) => {
  (async () => {
    const tokenIn = req.params.tokenin;
    const tokenOut = req.params.tokenout;
    const amount = parseFloat(req.params.amount);

    console.log(`Finding optimizations for ${tokenIn} ${tokenOut} ${amount}`);

    // TODO: this can be global/ lazy loaded
    const account = await near.account(config.near.PROXY_ACCOUNT);
    const pools = await getPoolsTouchingInOrOut(account, tokenIn, tokenOut);
    const G = buildDirectedGraph(pools, tokenIn, tokenOut);
    console.log("The directed graph", JSON.stringify(G));
    const ret = await findOptV2(G, 1000.222);
    res.json(ret);
  })();
});

// start the express server
app.listen(port, () => {
  // tslint:disable-next-line:no-console
  console.log(`server started at http://localhost:${port}`);
});
