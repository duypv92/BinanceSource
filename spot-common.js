const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR, ADX, MACD, BollingerBands } = require('technicalindicators');
var utils = require('./utils');
var common_func = require('./common.js');

const client = Binance({
    apiKey: 'gpGTdLODlhOpQDCDc7jPa0yddnXZYUsCuNajBluAtWW7foWMkIt0zPvQcLcMuyYt',
    apiSecret: 'O1eRHWjon81DuNuuqM4ladhGdS0oeIEpxl25kRMw8RaIDhr5AT6IQBDMcRFykXSe',
    futures: true
});

const getHistoricalDataCustom = async (symbol, interval, limit = 500) => {
    try {
        const candles = await client.futuresCandles({
            symbol: symbol,
            interval: interval,
            limit: limit
        });

        return candles.map(candle => ({
            open: parseFloat(candle.open),
            close: parseFloat(candle.close),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            volume: parseFloat(candle.volume),
            timestamp: candle.closeTime // Lấy timestamp của nến đóng
        }));
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return [];
    }
};

// Hàm lấy thông tin số dư trong ví Futures
const getSpotBalance = async (asset) => {
    try {
        // Lấy thông tin số dư Spot
        const accountInfo = await client.accountInfo();

        // Lấy số dư của các loại tài sản trong ví Spot
        const balances = accountInfo.balances;

        // Tìm số dư của USDT
        const usdtBalance = balances.find(balance => balance.asset === asset);
        if (usdtBalance) {
            // Số dư khả dụng của USDT
            // utils.customLog(`${asset} Free Balance: ${usdtBalance.free}`);
            return usdtBalance.free;
        } else {
            // utils.customLog(`${asset} balance not found.`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching spot balance:', error);
        return null;
    }
};

const spotOrder = async (symbol, side, quantity, stopLoss, takeProfit, currentPrice) => {
    try {
        const order = await client.order({
            symbol: symbol,
            side: side,
            type: 'MARKET',
            quantity: quantity
        });
        console.log(`${side} Order Placed:`, order);
    } catch (error) {
        console.error(`Error placing ${side} order:`, error);
    }
};

const closeAllSpotOrders = async (symbol, currentAction, currentPrice) => {
    try {
        let isStop = false;
        let lastestSpot = await getLatestSpotOrder(symbol);
        // console.log(lastestSpot);
        if (lastestSpot == null) {
            return false;
        } else if (lastestSpot.side == 'SELL' || lastestSpot.isBuyer == false) {
            utils.customLog(`The lastest spot order is ${utils.FgYellow}SELL${utils.Reset} => continue;`);
            return true;
        } else {
            utils.customLog(`The lastest spot order is ${utils.FgYellow}BUY${utils.Reset} => continue;`);
        }

        utils.customLog(`${utils.BgMagenta}Check profit/loss of current order ${utils.Reset}`);
        let profitLoss = await checkProfitLoss(lastestSpot, currentPrice);

        if (currentAction == 'SELL') {
            isStop = true;
            utils.customLog(`${utils.FgRed} New suggest action is SELL => Stop as soon as posible${utils.Reset}`);
        }

        if (profitLoss < 0) {
            utils.customLog(`${utils.BgMagenta}Checking market status for define stop loss...${utils.Reset}`);
            let newStopLoss = await monitorMarketAndAdjustStopLoss(symbol);
            if (newStopLoss != null) {
                // If market price have a large change => stop loss.
                await placeSellOrder(symbol, 'SUI');
                isStop = true;
            } else {
                utils.customLog('→ Are losing money → Keep hold');
            }
        } else {
            const closingFee = parseFloat(lastestSpot.commission);
            utils.customLog(`Closing Fee: ${closingFee} USD`);
            if (profitLoss >= (closingFee * 4)) {
                utils.customLog(`${utils.FgYellow}→ Take profit${utils.Reset}`);
                await placeSellOrder(symbol, 'SUI');
                isStop = true;
            } else {
                utils.customLog('→ Not enough profit!! → Keep hold');
            }
        }

        return isStop;
    } catch (error) {
        console.error('Error closing positions or cancelling orders:', error);
        return true;
    }
};

// Hàm lấy thông tin lệnh spot gần nhất
const getLatestSpotOrder = async (symbol) => {
    try {
        // Lấy danh sách các lệnh đã đặt cho cặp giao dịch (symbol)
        const orders = await client.allOrders({
            symbol: symbol,
            limit: 1  // Lấy lệnh gần nhất
        });
        let latestOrder = null;
        if (orders && orders.length > 0) {
            latestOrder = orders[0];  // Lấy lệnh gần nhất từ danh sách
        } else {
            console.log('No orders found.');
        }
        if (latestOrder != null && latestOrder.price != 0.00000000) {
            return latestOrder;
        } else {
            // Lấy lịch sử các giao dịch (trades) đã khớp cho cặp giao dịch (symbol)
            const buyTrades = await client.myTrades({
                symbol: symbol,
                limit: 1  // Lấy tối đa 10 giao dịch gần nhất
            });
            if (buyTrades && buyTrades.length > 0) {
                latestOrder = buyTrades[0];  // Lấy lệnh gần nhất từ danh sách
                return latestOrder;
            } else {
                console.log('No Buy trades found.');
            }
        }
        return latestOrder;
    } catch (error) {
        console.error('Error fetching latest spot order:', error);
        return null;
    }
};

//  kết hợp sử dụng RSI, ATR, MACD, và Volume nhằm xác định khả năng đảo chiều của thị trường
const determineTrendReversal = async (symbol) => {

    return action;
};

// Determine if a sudden move happens
const detectSuddenMove = async (symbol) => {

    const data = await getHistoricalDataCustom(symbol, '15m');
    const { atr, rsi, bb } = calculateIndicators(data);

    const latestATR = atr[atr.length - 1];
    const latestRSI = rsi[rsi.length - 1];
    const latestClose = bb[bb.length - 1].close;
    const lowerBand = bb[bb.length - 1].lower;
    const upperBand = bb[bb.length - 1].upper;

    // Check if ATR suddenly increases indicating a spike in volatility
    const volatilitySpike = latestATR > (1.5 * atr[atr.length - 2]);

    // Check if price moves outside Bollinger Bands
    const outsideUpperBand = latestClose > upperBand;
    const outsideLowerBand = latestClose < lowerBand;

    // Combine conditions
    const suddenMove = volatilitySpike || outsideUpperBand || outsideLowerBand;

    return suddenMove;
};

// Xác định xu hướng tăng hay giảm
const determineTrendAndSignal = async (symbol) => {
    const data = await common_func.getHistoricalDataCustom(symbol, '15m');

    if (data.length < 26) {
        console.error('Not enough data to make a decision.');
        return;
    }

    const closePrices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);

    // Tính RSI
    const rsi = RSI.calculate({ period: 14, values: closePrices });

    // Tính MACD
    const macdInput = {
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    };
    const macd = MACD.calculate(macdInput);

    // Tính SMA ngắn hạn và dài hạn (MA 9 và MA 21)
    const shortTermMA = SMA.calculate({ period: 9, values: closePrices });
    const longTermMA = SMA.calculate({ period: 21, values: closePrices });

    const latestClose = closePrices[closePrices.length - 1];
    const latestRSI = rsi[rsi.length - 1];
    const latestMACD = macd[macd.length - 1];
    const latestVolume = volumes[volumes.length - 1];
    const averageVolume = volumes.reduce((acc, val) => acc + val, 0) / volumes.length;

    let action = 'HOLD'; // Default hành động là không làm gì cả

    // Kiểm tra xu hướng tăng hoặc giảm dựa vào MACD, MA và Volume
    if (latestMACD.MACD > latestMACD.signal
        && shortTermMA[shortTermMA.length - 1] > longTermMA[longTermMA.length - 1]
        // && latestVolume > averageVolume
        && latestRSI < 45) {
        action = 'BUY'; // MACD cắt lên, MA ngắn hạn cắt lên trên MA dài hạn, và khối lượng giao dịch lớn hơn trung bình -> xu hướng tăng mạnh
    } else if (latestMACD.MACD < latestMACD.signal
        && shortTermMA[shortTermMA.length - 1] < longTermMA[longTermMA.length - 1]
        // && latestVolume > averageVolume
    ) {
        action = 'SELL'; // MACD cắt xuống, MA ngắn hạn cắt xuống dưới MA dài hạn, và khối lượng giao dịch lớn hơn trung bình -> xu hướng giảm mạnh
    }


    utils.customLog(`Latest RSI: ${latestRSI} (<45 => ${utils.FgYellow}${latestRSI < 45}${utils.Reset})`);
    utils.customLog(`Latest MACD: ${latestMACD.MACD}, signal: ${latestMACD.signal} (MACD > signal => ${utils.FgYellow}${latestMACD.MACD > latestMACD.signal}${utils.Reset})`);
    utils.customLog(`Volume: ${latestVolume}, Average Volume: ${averageVolume} (Lastest Volume > Average => ${utils.FgYellow}${latestVolume > averageVolume}${utils.Reset})`);
    utils.customLog(`→　Suggest Action: ${utils.FgYellow}${action}${utils.Reset}`);
    return action;
};

// Hàm lấy thông tin kích thước lô (LOT_SIZE) của cặp giao dịch
const getLotSizeFilter = async (symbol) => {
    try {
        // Lấy thông tin về cặp giao dịch
        const exchangeInfo = await client.exchangeInfo();
        const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

        if (symbolInfo) {
            // Tìm thông tin về LOT_SIZE
            const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');

            if (lotSizeFilter) {
                //  utils.customLog('LOT_SIZE Filter:', lotSizeFilter);
                return lotSizeFilter;
            } else {
                utils.customLog('LOT_SIZE filter not found for the symbol.');
                return null;
            }
        } else {
            utils.customLog('Symbol not found.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching LOT_SIZE filter:', error);
        return null;
    }
};

// Hàm kiểm tra LOT_SIZE của cặp giao dịch
const getLotSize = async (symbol) => {
    try {
        const exchangeInfo = await client.exchangeInfo();
        const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        return {
            minQty: parseFloat(lotSizeFilter.minQty),
            stepSize: parseFloat(lotSizeFilter.stepSize)
        };
    } catch (error) {
        console.error('Error fetching LOT_SIZE:', error);
        return { minQty: 0, stepSize: 0 };
    }
};

const roundToPrecision = (quantity, precision) => {
    return Math.round(quantity * Math.pow(10, precision)) / Math.pow(10, precision);
};

// Đặt lệnh mua hoặc bán trên Binance
const placeSpotOrder = async (symbol, side, quantity) => {
    try {
        // Lấy thông tin kích thước lô của cặp giao dịch
        const lotSizeFilter = await getLotSizeFilter(symbol);
        if (lotSizeFilter) {
            const { stepSize, minQty } = lotSizeFilter;
            const precision = Math.log10(1 / parseFloat(stepSize));

            // Làm tròn số lượng để phù hợp với quy tắc
            const roundedQuantity = roundToPrecision(quantity, precision);

            if (roundedQuantity >= parseFloat(minQty)) {
                const order = await client.order({
                    symbol: symbol,
                    side: side,
                    type: 'MARKET',
                    quantity: roundedQuantity
                });
                // console.log(order);
                utils.customLog(`${side} Order Placed: id: ${order.orderId}, time: ${order.transactTime}`);
            } else {
                console.error('Quantity is below the minimum quantity allowed.');
            }
        }
    } catch (error) {
        console.error(`Error placing ${side} order:`, error);
    }
};

// Hàm đặt lệnh SELL với số lượng tài sản làm tròn và kiểm tra LOT_SIZE
const placeSellOrder = async (symbol, asset) => {
    const availableBalance = await getSpotBalance(asset);
    const { minQty, stepSize } = await getLotSize(symbol);

    console.log(`Min Quantity: ${minQty}, Step Size: ${stepSize}`);

    // Làm tròn số lượng tài sản theo stepSize
    const quantityToSell = Math.floor(availableBalance / stepSize) * stepSize;
    utils.customLog(`quantityToSell: ${quantityToSell}`);
    // Kiểm tra xem số lượng có lớn hơn minQty không
    if (quantityToSell >= minQty) {
        try {
            const sellOrder = await client.order({
                symbol: symbol,
                side: 'SELL',
                type: 'MARKET',
                quantity: quantityToSell
            });
            // console.log('Sell order placed:', sellOrder);
            utils.customLog(`SELL Order Placed: id: ${sellOrder.orderId}, time: ${sellOrder.transactTime}`);
        } catch (error) {
            console.error('Error placing sell order:', error);
        }
    } else {
        console.log('Insufficient balance to place sell order.');
    }
};

const calculateProfitLoss = (buyPrice, currentPrice, quantity) => {
    const profitLoss = (currentPrice - buyPrice) * quantity;
    return profitLoss;
};


// Main function to get the latest buy order and calculate profit/loss
const checkProfitLoss = async (lastestSpot, _currentPrice) => {
    try {
        const latestBuyOrder = lastestSpot;

        let currentPrice = _currentPrice;
        const buyPrice = parseFloat(latestBuyOrder.price);
        const quantity = parseFloat(latestBuyOrder.qty);

        const profitLoss = calculateProfitLoss(buyPrice, currentPrice, quantity);

        utils.customLog(`Bought Price/Current Price: ${buyPrice}/${currentPrice}`);
        utils.customLog(`Profit/Loss: ${profitLoss}`);

        if (profitLoss > 0) {
            utils.customLog('The position is in profit.');
        } else if (profitLoss < 0) {
            utils.customLog('The position is in loss.');
        } else {
            utils.customLog('The position is break-even.');
        }
        return profitLoss;
    } catch (error) {
        console.error('Error checking profit/loss:', error);
    }
};


// Giám Sát ADX và Volume để Điều Chỉnh Stop Loss
const monitorMarketAndAdjustStopLoss = async (symbol) => {
    try {
        const data = await getHistoricalDataCustom(symbol, '15m');

        if (data.length < 21) {
            console.error('Not enough data to calculate ADX or Volume.');
            return null;
        }

        const closePrices = data.map(d => d.close);
        const highPrices = data.map(d => d.high);
        const lowPrices = data.map(d => d.low);
        const volumes = data.map(d => d.volume);

        let stopLoss = null;

        // Apply ADX for check market
        const adx = ADX.calculate({
            period: 14,
            close: closePrices,
            high: highPrices,
            low: lowPrices
        });

        const latestClose = closePrices[closePrices.length - 1];
        const latestADX = adx[adx.length - 1];
        const averageVolume = SMA.calculate({ period: 20, values: volumes });
        const latestVolume = volumes[volumes.length - 1];

        // utils.customLog(`Latest ADX: ${latestADX.adx},Latest/Average Volume: ${latestVolume}/${averageVolume[averageVolume.length - 1]} (if ADX > 25)`);

        // Continue Apply RSI, MACD for check markets
        // Tính RSI
        const rsiValues = RSI.calculate({
            period: 14,
            values: closePrices
        });
        const latestRSI = rsiValues[rsiValues.length - 1];

        // Tính MACD
        const macdInput = {
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false, // EMA
            SimpleMASignal: false
        };
        const macd = MACD.calculate(macdInput);
        const latestMACD = macd[macd.length - 1];

        // Điều kiện để đặt stop loss nếu RSI cho thấy thị trường có xu hướng đảo chiều
        utils.customLog(`Current RSI: ${latestRSI} (>70: ${utils.FgYellow}${latestRSI > 70}${utils.Reset}), (MACD < signal: ${utils.FgYellow}${latestMACD.MACD < latestMACD.signal}${utils.Reset})`);
        if (latestRSI > 70 && latestMACD.MACD < latestMACD.signal) {
            utils.customLog('RSI indicates overbought, potential for price reversal.');
            stopLoss = latestClose - (latestClose * 0.005); // 0.5% thấp hơn giá hiện tại
            utils.customLog(`${utils.FgRed} Adjusted new stop Loss for ${position}: ${stopLoss}`);
        } else {
            utils.customLog('Market seems stable, no immediate action taken.');
        }
        return stopLoss;
        // Có thể thêm logic đặt lệnh stop loss ở đây
    } catch (error) {
        console.error('Monitor Market And Adjust Stop Loss:', error);
        return null;
    }
};

module.exports = {
    client, getHistoricalDataCustom,
    monitorMarketAndAdjustStopLoss, determineTrendReversal, detectSuddenMove, determineTrendAndSignal,
    closeAllSpotOrders, spotOrder, getSpotBalance, placeSpotOrder
};