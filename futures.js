const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR } = require('technicalindicators');
var common_func = require('./common.js');
var utils = require('./utils');

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';
const leverage = 10;



// Thiết lập mức đòn bẩy (Leverage)
const setLeverage = async (symbol, leverage) => {
    try {
        const response = await common_func.client.futuresLeverage({
            symbol: symbol,
            leverage: leverage
        });
        // console.log(`Leverage set to ${leverage}x for ${symbol}:`, response);
        utils.customLog(`Leverage set to ${utils.FgGreen} ${leverage}x ${utils.Reset} for ${utils.FgGreen} ${symbol} ${utils.Reset} done.`);
    } catch (error) {
        console.error('Error setting leverage:', error);
    }
};

const futuresTrade = async () => {
    var currentdate = new Date();
    var currentPrice = await common_func.getPrice(symbol);
    utils.customLog(`${utils.FgGreen}-----------${currentdate} **************START***************-----------${utils.Reset}`);
    utils.customLog(`The current price of ${symbol} is ${currentPrice}`);

    let marketStatus = await common_func.confirmMarketStatus(symbol, currentPrice);
    if (marketStatus == null) {
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // Close All Positions And Orders in futures
    let isStop = await common_func.closeAllPositionsAndOrders(marketStatus.action);
    if (!isStop) {
        utils.customLog("→ Stop renew futures requests => exit;");
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // If action is hold, doing nothing.
    if (marketStatus.action == "HOLD") {
        utils.customLog("→ Market's status is HOLD => exit;");
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // Check previous trade is lose or win
    let lastClosedTrade = await common_func.getLastClosedPosition(symbol);
    let realizedPnl = parseFloat(lastClosedTrade.realizedPnl);
    if (realizedPnl < 0) {
        // Check time of last trade
        let lastestTime = new Date(lastClosedTrade.time);
        let diffMs = currentdate - lastestTime;
        let diffMins = diffMs / 60000; // minutes
        if (diffMins >= 31) {
            utils.customLog("The Lastest trade is lose but time > 30 minutes => continue;");
        } else {
            utils.customLog("The Lastest trade is lose and not enough 30 minutes => exit;");
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        }
    }

    var quantity = 6;
    // get balance futures
    var balance = await common_func.getFuturesBalance(asset);
    if (balance) {
        utils.customLog(`Current ${utils.FgCyan} ${asset} ${utils.Reset} Balance in Futures Wallet: ${utils.FgCyan} ${balance} ${utils.Reset}`);
        // Nếu số dư đủ, thực hiện lệnh Long/Short
        if (balance >= 2) { // Đảm bảo rằng bạn có ít nhất 5 USDT (hoặc giá trị tương ứng) để giao dịch
            balance = ((parseFloat(balance) * 50) / 100) * 10;
            quantity = Number(Number(balance / currentPrice).toFixed(2));
            utils.customLog(`quantity to order: ${quantity}`);
        } else {
            utils.customLog('→ Not enough balance to place the order. => exit;');
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        }
    } else {
        utils.customLog(`→ Could not retrieve ${asset} balance. => use default quantity = 6.`);
    }

    // Thiết lập đòn bẩy Leverage
    await setLeverage(symbol, leverage);
    await common_func.determineTradeAction(symbol, quantity, currentPrice, marketStatus);

    utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
}

// Example usage
const main = async () => {
    var i = 1;
    var timmer = 1000 * 60 * 5; // 15 minutes
    futuresTrade();
    function futuresLoop() {
        console.log("■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●");
        setTimeout(function () {
            futuresTrade();
            i++;
            futuresLoop();
        }, timmer)
    }
    futuresLoop();
};

main();