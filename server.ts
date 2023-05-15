import * as fs from "fs";
import Web3 from "web3";
import BigNumber from "bignumber.js";

const run = async () => {
  const wallets = fs.readFileSync("wallets.json", "utf8");
  const multicallABI = fs.readFileSync("multicall.json", "utf8");
  const erc20ABI = fs.readFileSync("erc20.json", "utf8");

  const multicallContractAddress = "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441";

  const web3 = new Web3(
    "https://mainnet.infura.io/v3/a374100574a041818a4d3e3afaa41fad"
  );

  const multicallContract = new web3.eth.Contract(
    JSON.parse(multicallABI),
    multicallContractAddress
  );
  let content = "";
  const encodesGetEthBalance = JSON.parse(wallets).wallets.map(
    (wallet: string) => {
      return web3.eth.abi.encodeFunctionCall(
        {
          constant: true,
          inputs: [{ name: "addr", type: "address" }],
          name: "getEthBalance",
          outputs: [{ name: "balance", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
        [wallet]
      );
    }
  );
  const balances = await multicallContract.methods
    .aggregate(
      encodesGetEthBalance.map((encode: string) => {
        return [multicallContractAddress, encode];
      })
    )
    .call();
  const balance = balances.returnData
    .map((encodedParam: string) =>
      web3.eth.abi.decodeParameter("uint256", encodedParam)
    )
    .reduce(
      (a: string, b: string) => new BigNumber(a).plus(new BigNumber(b)),
      new BigNumber(0)
    );
  content = content + `ETH,${balance.dividedBy(1e18).toString()}\n`;

  for (const token of JSON.parse(wallets).tokens) {
    const contractERC20 = new web3.eth.Contract(JSON.parse(erc20ABI), token);
    const decimals = await contractERC20.methods.decimals().call();
    const encodesGetErc20Balance = JSON.parse(wallets).wallets.map(
      (wallet: string) => {
        return web3.eth.abi.encodeFunctionCall(
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            payable: false,
            type: "function",
          },
          [wallet]
        );
      }
    );
    const balancesErc20 = await multicallContract.methods
      .aggregate(
        encodesGetErc20Balance.map((encode: string) => {
          return [token, encode];
        })
      )
      .call();
    const balanceErc20 = balancesErc20.returnData
      .map((encodedParam: string) =>
        web3.eth.abi.decodeParameter("uint256", encodedParam)
      )
      .reduce(
        (a: string, b: string) => new BigNumber(a).plus(new BigNumber(b)),
        new BigNumber(0)
      );
    content =
      content + `${token},${balanceErc20.div(10 ** decimals).toString()}\n`;
  }
  fs.writeFileSync("./result.csv", content);
};

run();
