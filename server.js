import fs from "fs";
import Web3 from "web3";
import BigNumber from "bignumber.js";
fs.readFile("./wallets.json", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  const jsonData = JSON.parse(data);
  fs.readFile("./erc20.json", "utf8", async (err, erc20Abi) => {
    fs.readFile("./multicall.json", "utf8", async (err, abi) => {
      if (err) {
        console.error(err);
        return;
      }
      const web3 = new Web3(
        "https://mainnet.infura.io/v3/a374100574a041818a4d3e3afaa41fad"
      );
      const multicallContract = new web3.eth.Contract(
        JSON.parse(abi),
        "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441"
      );

      let content = "";
      const encodesGetEthBalance = jsonData.wallets.map((wallet) => {
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
      });
      const balances = await multicallContract.methods
        .aggregate(
          encodesGetEthBalance.map((encode) => {
            return ["0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441", encode];
          })
        )
        .call();
      const balance = balances.returnData
        .map((encodedParam) =>
          web3.eth.abi.decodeParameter("uint256", encodedParam)
        )
        .reduce(
          (a, b) => new BigNumber(a).plus(new BigNumber(b)),
          new BigNumber(0)
        );
      content = content + `ETH,${balance.dividedBy(1e18).toString()}\n`;

      for (const token of jsonData.tokens) {
        const contractERC20 = new web3.eth.Contract(
          JSON.parse(erc20Abi),
          token
        );
        const decimals = await contractERC20.methods.decimals().call();
        const encodesGetErc20Balance = jsonData.wallets.map((wallet) => {
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
        });
        const balancesErc20 = await multicallContract.methods
          .aggregate(
            encodesGetErc20Balance.map((encode) => {
              return [token, encode];
            })
          )
          .call();
        const balanceErc20 = balancesErc20.returnData
          .map((encodedParam) =>
            web3.eth.abi.decodeParameter("uint256", encodedParam)
          )
          .reduce(
            (a, b) => new BigNumber(a).plus(new BigNumber(b)),
            new BigNumber(0)
          );
        content =
          content + `${token},${balanceErc20.div(10 ** decimals).toString()}\n`;
      }
      fs.writeFileSync("./result.csv", content);
    });
  });
});

// fs.readFile("./wallets.json", "utf8", (err, data) => {
//   if (err) {
//     console.error(err);
//     return;
//   }
//   const jsonData = JSON.parse(data);

//   fs.readFile("./erc20.json", "utf8", async (err, abi) => {
//     if (err) {
//       console.error(err);
//       return;
//     }
//     const web3 = new Web3(
//       "https://mainnet.infura.io/v3/a374100574a041818a4d3e3afaa41fad"
//     );
//     let content = "";

//     let balances = new BigNumber(0);
//     for (const wallet of jsonData.wallets) {
//       const balance = await web3.eth.getBalance(wallet, "pending");
//       balances = balances.plus(new BigNumber(balance));
//     }
//     content = content + `ETH,${balances.dividedBy(1e18).toString()}\n`;

//     for (const token of jsonData.tokens) {
//       balances = new BigNumber(0);
//       const contractERC20 = new web3.eth.Contract(JSON.parse(abi), token);
//       const decimals = await contractERC20.methods.decimals().call();
//       for (const wallet of jsonData.wallets) {
//         const result = await contractERC20.methods.balanceOf(wallet).call();
//         balances = balances.plus(new BigNumber(result));
//       }
//       content =
//         content + `${token},${balances.div(10 ** decimals).toString()}\n`;
//     }
//     fs.writeFileSync("./result.csv", content);
//   });
// });
