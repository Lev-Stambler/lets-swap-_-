// TODO: to .env and webpack
const CONTRACT_NAME = "dev-1629304735257-47782394333265";
const REF_SWAP_CONTRACT = "dev-1629664251608-31847817465912";

export const baseUrl = "http://localhost:3000";
export const env: Env = "development";
export type Env =
  | "production"
  | "development"
  | "test"
  | "mainnet"
  | "testnet"
  | "betanet"
  | "local"
  | "ci-betanet"
  | "ci";
export default function getConfig(_env=env) {
  switch (_env) {
    case "production":
    case "mainnet":
      return {
        networkId: "mainnet",
        nodeUrl: "https://rpc.mainnet.near.org",
        contractName: CONTRACT_NAME,
        walletUrl: "https://wallet.near.org",
        helperUrl: "https://helper.mainnet.near.org",
        explorerUrl: "https://explorer.mainnet.near.org",
        refSwapContract: REF_SWAP_CONTRACT,
      };
    case "development":
    case "testnet":
      return {
        networkId: "testnet",
        nodeUrl: "https://rpc.testnet.near.org",
        contractName: CONTRACT_NAME,
        walletUrl: "https://wallet.testnet.near.org",
        helperUrl: "https://helper.testnet.near.org",
        explorerUrl: "https://explorer.testnet.near.org",
        refSwapContract: REF_SWAP_CONTRACT,
      };
    case "betanet":
      return {
        networkId: "betanet",
        nodeUrl: "https://rpc.betanet.near.org",
        contractName: CONTRACT_NAME,
        walletUrl: "https://wallet.betanet.near.org",
        helperUrl: "https://helper.betanet.near.org",
        explorerUrl: "https://explorer.betanet.near.org",
        refSwapContract: REF_SWAP_CONTRACT,
      };
    case "test":
    case "ci":
      return {
        networkId: "shared-test",
        nodeUrl: "https://rpc.ci-testnet.near.org",
        contractName: CONTRACT_NAME,
        refSwapContract: REF_SWAP_CONTRACT,
        masterAccount: "test.near",
      };
    case "ci-betanet":
      return {
        networkId: "shared-test-staging",
        nodeUrl: "https://rpc.ci-betanet.near.org",
        contractName: CONTRACT_NAME,
        refSwapContract: REF_SWAP_CONTRACT,
        masterAccount: "test.near",
      };
    default:
      throw Error(
        `Unconfigured environment '${_env}'. Can be configured in src/config.js.`
      );
  }
}
