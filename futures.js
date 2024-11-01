const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR } = require('technicalindicators');
var common_func = require('./common.js');
var utils = require('./utils');

const symbol_arr = ['PEPEUSDT', 'SUIUSDT']; // ['SUIUSDT']; // 
const future_symbol_arr = ['1000PEPEUSDT', 'SUIUSDT']; // ['SUIUSDT']; //

// const symbol = 'PEPEUSDT' //'BTCUSDT' SUIUSDT; PEPEUSDT // Replace with the symbol of the coin you want to check
// const future_symbol = '1000PEPEUSDT' //'BTCUSDT' SUIUSDT; 1000PEPEUSDT //

const asset = 'USDT';
const leverage = 10;

let marketHistory = {};

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

const futuresTrade = async (symbol, future_symbol) => {
    utils.customLog('\n');
    var currentdate = new Date();
    var currentPrice = await common_func.getPrice(symbol);
    utils.customLog(`${utils.FgGreen}-----------${currentdate} **************START***************-----------${utils.Reset}`);
    utils.customLog(`The current price of ${symbol} is ${currentPrice}`);

    utils.customLog(`${utils.BgMagenta}Confirm market status${utils.Reset}`);
    let marketStatus = await common_func.confirmMarketStatus(future_symbol);
    if (marketHistory[symbol] == null) {
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    } else {
        marketHistory[symbol].push(marketStatus);
        if (marketHistory[symbol].length > 4) {
            marketHistory[symbol].shift();
        }
    }

    // Close All Positions And Orders in futures
    utils.customLog(`${utils.BgMagenta}Close All Positions And Orders in futures${utils.Reset}`);
    let consistentTimesRes = await checkMarketContinue(marketHistory, symbol);
    let isStop = await common_func.closeAllPositionsAndOrders(marketStatus.action, future_symbol, consistentTimesRes);
    if (!isStop) {
        utils.customLog("→ Stop renew futures requests => exit;");
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // If action is hold, doing nothing.
    if (marketStatus.action == "HOLD") {
        utils.customLog(`→ Market's status is ${utils.FgYellow} HOLD ${utils.Reset} => exit;`);
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    }

    // Check previous trade is lose or win
    utils.customLog(`${utils.BgMagenta}Check previous trade is lose or win...${utils.Reset}`);
    let lastClosedTrade = await common_func.getLastClosedPosition(future_symbol);
    let realizedPnl = parseFloat(lastClosedTrade?.realizedPnl);
    if (realizedPnl != null && realizedPnl < 0) {
        // Check time of last trade
        let lastestTime = new Date(lastClosedTrade.time);
        let diffMs = currentdate - lastestTime;
        let diffMins = diffMs / 60000; // minutes
        if (diffMins > 15) {
        } else {
            utils.customLog("The Lastest trade is lose and not enough 15 minutes => exit;");
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        }
    }

    // Check market history
    utils.customLog(`${utils.BgMagenta}Check continuity of new futures action...${utils.Reset}`);
    let consistentTimes = 0;
    if (marketHistory[symbol].length < 4) {
        utils.customLog(`→ Not enough number of time of action => exit;`);
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    } else {
        let isOut = false;
        let holdTimes = 0;

        let _action = null;
        let _lastRSI = null;
        for (let index = 0; index < marketHistory[symbol].length; index++) {
            const element = marketHistory[symbol][index];
            let currentAction = element.action;
            const lastRSI = element.lastRSI;
            if (_action != null && _action != currentAction && currentAction != "HOLD" && _action != "HOLD") {
                isOut = true;
                utils.customLog(`Inconsistent action → Out`);
                break;
            } else {
                if (_lastRSI != null) {
                    if (currentAction == "SELL") {
                        utils.customLog(`lastRSI <= old_lastRSI(${lastRSI < _lastRSI || lastRSI == _lastRSI})`);
                        if (lastRSI > _lastRSI) {
                        } else {
                            consistentTimes += 1;
                        }
                    } else if (currentAction == "BUY") {
                        utils.customLog(`lastRSI >= old_lastRSI(${lastRSI > _lastRSI || lastRSI == _lastRSI})`);
                        if (lastRSI < _lastRSI) {
                        } else {
                            consistentTimes += 1;
                        }
                    }
                }
                if (currentAction == "HOLD") {
                    holdTimes += 1;
                    if (_lastRSI != null) {
                        if (_action == "SELL") {
                            utils.customLog(`HOLD lastRSI <= old_lastRSI(${lastRSI < _lastRSI || lastRSI == _lastRSI})`);
                            if (lastRSI > _lastRSI) {
                            } else {
                                consistentTimes += 1;
                            }
                        } else if (_action == "BUY") {
                            utils.customLog(`HOLD lastRSI >= old_lastRSI(${lastRSI > _lastRSI || lastRSI == _lastRSI})`);
                            if (lastRSI < _lastRSI) {
                            } else {
                                consistentTimes += 1;
                            }
                        }
                    }
                }
                _action = currentAction;
                _lastRSI = lastRSI;
            }
        }
        if (isOut || holdTimes > 2) {
            utils.customLog(`→ Action ${utils.FgYellow}has no continuity${utils.Reset} => exit;`);
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        } else if (consistentTimes < 2) {
            utils.customLog(`→ LastRSI is ${utils.FgYellow}Inconsistent${utils.Reset} => exit;`);
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        } else {
            // utils.customLog(`→ Action has the continuity => continue;`);
        }
        // Remove first action out of array
        marketHistory[symbol].shift();
    }

    utils.customLog(`${utils.BgMagenta}Start check suddenMove..${utils.Reset}`);
    const suddenMove = await common_func.detectSuddenMove(future_symbol);
    if (suddenMove) {
        utils.customLog(`${utils.FgYellow}Sudden price move detected! Consider taking action. => exit;${utils.Reset}`);
        utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
        return;
    } else {
        utils.customLog('No sudden moves detected. => Continue');
    }

    utils.customLog(`${utils.BgMagenta}Start determine Trend Reversal..${utils.Reset}`);
    let trendAction = await common_func.determineTrendReversal(future_symbol);
    utils.customLog(`New suggest action: ${utils.FgYellow}${marketStatus.action}${utils.Reset}`);
    utils.customLog(`Trend Reversalaction: ${utils.FgYellow}${trendAction}${utils.Reset}`);
    if (trendAction != marketStatus.action && trendAction != "HOLD") {
        utils.customLog(`${utils.FgYellow}→ The Trend action is not same with new suggest action => check consistentTimes;${utils.Reset}`);
        if (consistentTimes > 2) {
            utils.customLog(`${utils.FgYellow}→ The consistentTimes is ${consistentTimes} => continue; ${utils.Reset}`);
        } else {
            utils.customLog(`${utils.FgYellow}→ The consistentTimes is ${consistentTimes} => exits; ${utils.Reset}`);
            utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
            return;
        }
    }

    utils.customLog(`→${utils.BgMagenta}Start order new position${utils.Reset}`);
    var quantity = 6;
    // get balance futures
    var balance = await common_func.getFuturesBalance(asset);
    if (balance) {
        utils.customLog(`Current ${utils.FgCyan} ${asset} ${utils.Reset} Balance in Futures Wallet: ${utils.FgCyan} ${balance} ${utils.Reset}`);
        // Nếu số dư đủ, thực hiện lệnh Long/Short
        if (balance >= 1) { // Đảm bảo rằng bạn có ít nhất 5 USDT (hoặc giá trị tương ứng) để giao dịch
            balance = ((parseFloat(balance) * 40) / 100) * 10;
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
    await setLeverage(future_symbol, leverage);
    await common_func.determineTradeAction(future_symbol, quantity, currentPrice, marketStatus, future_symbol);

    utils.customLog(`${utils.FgGreen}-----------**************END***************-----------${utils.Reset}`);
}

const checkMarketContinue = async (marketHistory, symbol) => {
    // Check market history
    let consistentTimes = 0;
    if (marketHistory[symbol].length < 4) {
        return consistentTimes;
    } else {
        let _action = null;
        let _lastRSI = null;
        for (let index = 0; index < marketHistory[symbol].length; index++) {
            const element = marketHistory[symbol][index];
            let currentAction = element.action;
            const lastRSI = element.lastRSI;
            if (_action != null && _action != currentAction && currentAction != "HOLD" && _action != "HOLD") {
                break;
            } else {
                if (_lastRSI != null) {
                    if (currentAction == "SELL") {
                        if (lastRSI > _lastRSI) {
                        } else {
                            consistentTimes += 1;
                        }
                    } else if (currentAction == "BUY") {
                        if (lastRSI < _lastRSI) {
                        } else {
                            consistentTimes += 1;
                        }
                    }
                }
                if (currentAction == "HOLD") {
                    if (_lastRSI != null) {
                        if (_action == "SELL") {
                            if (lastRSI > _lastRSI) {
                            } else {
                                consistentTimes += 1;
                            }
                        } else if (_action == "BUY") {
                            if (lastRSI < _lastRSI) {
                            } else {
                                consistentTimes += 1;
                            }
                        }
                    }
                }
                _action = currentAction;
                _lastRSI = lastRSI;
            }
        }
        return consistentTimes;
    }
}

const sendReport = async () => {
    await utils.sendMail('test');
}

const futuresTradeAll = async () => {
    for (let index = 0; index < symbol_arr.length; index++) {
        const coinCode = symbol_arr[index];
        const coinFuturesCode = future_symbol_arr[index];
        if (marketHistory[coinCode] == undefined) {
            marketHistory[coinCode] = [];
        }
        await futuresTrade(coinCode, coinFuturesCode);
    }
}

// Example usage
const main = async () => {
    var i = 1;
    var timmer = 1000 * 61 * 10; // 15 minutes
    futuresTradeAll();
    function futuresLoop() {
        console.log(`${utils.FgMagenta} ■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●`);
        setTimeout(function () {
            futuresTradeAll();
            i++;
            futuresLoop();
        }, timmer)
    }
    futuresLoop();
    return;
    // Send report mail
    var sendReportMailTimmer = 1000 * 62 * 45; // 16 minutes
    function sendReportMail() {
        setTimeout(function () {
            sendReport();
            sendReportMail();
        }, sendReportMailTimmer)
    }
    sendReportMail();
};

main();