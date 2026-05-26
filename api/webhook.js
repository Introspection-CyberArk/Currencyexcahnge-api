const { Telegraf } = require('telegraf');
const axios = require('axios');

const API_KEY = 'a979724f3443652272529c861e925dfa';
let bot;

// Fixed: Better API endpoint with error handling
async function getExchangeRate(from, to, amount = 1) {
    try {
        // Using free endpoint without API key first (more reliable)
        const response = await axios.get(`https://api.exchangerate.host/convert`, {
            params: {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                amount: amount
            }
        });
        
        if (response.data && response.data.result) {
            return {
                rate: response.data.info.rate,
                result: response.data.result,
                from: from,
                to: to
            };
        } else {
            throw new Error('Invalid response from API');
        }
    } catch (error) {
        console.error('API Error:', error.message);
        // Fallback to another free endpoint
        try {
            const fallbackResponse = await axios.get(`https://api.exchangerate.host/latest`, {
                params: {
                    base: from.toUpperCase(),
                    symbols: to.toUpperCase()
                }
            });
            
            if (fallbackResponse.data && fallbackResponse.data.rates) {
                const rate = fallbackResponse.data.rates[to.toUpperCase()];
                if (rate) {
                    return {
                        rate: rate,
                        result: amount * rate,
                        from: from,
                        to: to
                    };
                }
            }
            throw new Error('Conversion failed');
        } catch (fallbackError) {
            throw new Error('Unable to fetch exchange rate. Please try again.');
        }
    }
}

function setupBot(botInstance) {
    // Start command
    botInstance.start((ctx) => {
        ctx.replyWithHTML(
            `🪙 <b>Currency Exchange Bot</b>\n\n` +
            `I can help you convert currencies!\n\n` +
            `<b>Commands:</b>\n` +
            `/convert USD EUR 100 - Convert 100 USD to EUR\n` +
            `/rates USD - Get exchange rates for USD\n` +
            `/help - Show this message\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Help command
    botInstance.help((ctx) => {
        ctx.replyWithHTML(
            `<b>📖 How to use:</b>\n\n` +
            `<b>Convert currency:</b>\n` +
            `<code>/convert USD EUR 100</code>\n` +
            `<b>Get exchange rates:</b>\n` +
            `<code>/rates USD</code>\n\n` +
            `<b>Supported currencies:</b>\n` +
            `USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, and many more!\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Convert command - FIXED with better error handling
    botInstance.command('convert', async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('❌ Usage: /convert <from> <to> [amount]\nExample: /convert USD EUR 100');
        }
        
        const from = args[1].toUpperCase();
        const to = args[2].toUpperCase();
        const amount = args[3] ? parseFloat(args[3]) : 1;
        
        if (isNaN(amount)) {
            return ctx.reply('❌ Invalid amount. Please enter a number.');
        }
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const result = await getExchangeRate(from, to, amount);
            
            // Check if result exists before using toFixed
            if (result && result.result !== undefined) {
                ctx.replyWithHTML(
                    `💱 <b>Currency Conversion</b>\n\n` +
                    `${amount.toFixed(2)} ${from} = ${result.result.toFixed(2)} ${to}\n` +
                    `<i>Rate: 1 ${from} = ${result.rate.toFixed(4)} ${to}</i>\n\n` +
                    `<i>Powered By Introspection007</i>`
                );
            } else {
                ctx.reply('❌ Failed to get conversion rate. Please try again later.');
            }
        } catch (error) {
            console.error('Conversion error:', error);
            ctx.reply(`❌ Error: ${error.message}\n\nMake sure currency codes are valid (e.g., USD, EUR, GBP)`);
        }
    });

    // Rates command - FIXED
    botInstance.command('rates', async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('❌ Usage: /rates <currency>\nExample: /rates USD');
        }
        
        const baseCurrency = args[1].toUpperCase();
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const response = await axios.get(`https://api.exchangerate.host/latest`, {
                params: {
                    base: baseCurrency
                }
            });
            
            if (response.data && response.data.rates) {
                const rates = response.data.rates;
                const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];
                
                let message = `📊 <b>Exchange Rates for ${baseCurrency}</b>\n\n`;
                let hasRates = false;
                
                commonCurrencies.forEach(curr => {
                    if (rates[curr]) {
                        message += `${curr}: ${rates[curr].toFixed(4)}\n`;
                        hasRates = true;
                    }
                });
                
                if (hasRates) {
                    message += `\n<i>Powered By Introspection007</i>`;
                    ctx.replyWithHTML(message);
                } else {
                    ctx.reply('❌ No rates found for this currency. Please check the currency code.');
                }
            } else {
                throw new Error('Failed to fetch rates');
            }
        } catch (error) {
            console.error('Rates error:', error);
            ctx.reply('❌ Failed to fetch exchange rates. Please check the currency code.');
        }
    });
}

// Webhook handler
module.exports = async (req, res) => {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        console.error('BOT_TOKEN not set');
        return res.status(500).send('BOT_TOKEN not configured');
    }
    
    if (!bot) {
        bot = new Telegraf(BOT_TOKEN);
        setupBot(bot);
    }
    
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).send('OK');
    }
};
