const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR } = require('technicalindicators');
var common_func = require('./common.js');
var spot_common_func = require('./spot-common.js');
var utils = require('./utils.js');

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';
const leverage = 10;

let marketHistory = [];


const spotTrade = async () => {
    var currentdate = new Date();
    var currentPrice = await common_func.getPrice(symbol);
    utils.customLog(`${utils.FgGreen}-----------${currentdate} **************START***************-----------${utils.Reset}`);
    utils.customLog(`The current price of ${symbol} is ${currentPrice}`);

    utils.customLog(`${utils.BgMagenta}Determine Trend And Signal${utils.Reset}`);
    let suggestAction = await spot_common_func.determineTrendAndSignal(symbol);

    utils.customLog(`${utils.BgMagenta}Close All Positions And Orders in spot${utils.Reset}`);
    // Close All Positions And Orders in spot
    let isStop = await spot_common_func.closeAllSpotOrders(symbol, suggestAction, currentPrice);
    if (!isStop) {
        utils.customLog("→ Stop renew spot order requests => exit;");
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // If action is hold, doing nothing.
    if (suggestAction == "HOLD" || suggestAction == "SELL") {
        utils.customLog(`→ Market's status is ${utils.FgYellow} HOLD/SELL ${utils.Reset} => exit;`);
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    utils.customLog(`→${utils.BgMagenta}Start new order${utils.Reset}`);
     // get balance spot
     var balance = await spot_common_func.getSpotBalance(asset);
     let quantity = 0;
     if (balance) {
        utils.customLog(`Current ${utils.FgCyan} ${asset} ${utils.Reset} Balance in spot Wallet: ${utils.FgCyan} ${balance} ${utils.Reset}`);
        // Nếu số dư đủ, thực hiện lệnh Long/Short
        if (balance >= 2) { // Đảm bảo rằng bạn có ít nhất 5 USDT (hoặc giá trị tương ứng) để giao dịch
            balance = ((parseFloat(balance) * 5) / 100);
            quantity = Number(Number(balance / currentPrice).toFixed(2));
            utils.customLog(`Quantity to order: ${quantity}`);
        } else {
            utils.customLog('→ Not enough balance to place the order. => exit;');
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        }
    } else {
        utils.customLog(`→ Could not retrieve ${asset} balance. => exit;`);
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // Place new spot
    await spot_common_func.placeSpotOrder(symbol, "BUY", quantity);
    utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
}

// Example usage
const main = async () => {
    var i = 1;
    var timmer = 1000 * 61 * 15; // 15 minutes
    // var timmer = 1000 * 5; // 15 minutes
    spotTrade();
    function spotLoop() {
        console.log(`${utils.FgMagenta} ■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●`);
        setTimeout(function () {
            spotTrade();
            i++;
            spotLoop();
        }, timmer)
    }
    spotLoop();
};

main();