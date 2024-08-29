const OpenAIApi = require("openai");
var common_func = require('./common.js');

const openai = new OpenAIApi({
    apiKey: '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', // Thay 'your-api-key' bằng API key thực của bạn từ OpenAI
});

//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
// const openai = new OpenAIApi(configuration);

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';

async function getPredictions(data) {
    const prompt = `
      Given the following historical data of a futures market:
      ${JSON.stringify(data)}
      What is the likely price movement in the next period? 
      Provide possible scenarios and the factors influencing them.
    `;

    try {
        const response = await openai.createCompletion({
            model: "gpt-3.5-turbo", // Hoặc "gpt-3.5-turbo" nếu bạn không có quyền truy cập vào GPT-4
            prompt: prompt,
            max_tokens: 200,
        });

        console.log(response.data.choices[0].text);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}


// Example usage
const main = async () => {

    const historicalData = [
        // Example data: timestamp, open, high, low, close, volume
        { timestamp: 1625155200, open: 34000, high: 34200, low: 33800, close: 34150, volume: 1200 },
        { timestamp: 1625241600, open: 34150, high: 34500, low: 33900, close: 34400, volume: 1500 },
        // Add more data here
    ];
    const priceData = await common_func.getHistoricalDataCustomForAI(symbol, '15m', 500);
    // console.log(JSON.stringify(priceData));
    // console.log(priceData);
    getPredictions(priceData);
};

main();
