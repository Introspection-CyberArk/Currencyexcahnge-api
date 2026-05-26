const { Telegraf } = require('telegraf');
const axios = require('axios');

let bot;

// Improved function with multiple API fallbacks
async function getExchangeRate(from, to, amount = 1) {
    try {
        // Clean the inputs
        from = from.toUpperCase().trim();
        to = to.toUpperCase().trim();
        amount = parseFloat(amount);
        
        if (isNaN(amount)) {
            throw new Error('Invalid amount');
        }
        
        // Using exchangerate.host API (no key needed for basic conversion)
        const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`;
        const response = await axios.get(url);
        
        if (response.data && response.data.success === true) {
            return {
                rate: response.data.info.rate,
                result: response.data.result,
                from: from,
                to: to,
                amount: amount
            };
        } else {
            throw new Error('API returned unsuccessful response');
        }
    } catch (error) {
        console.error('API Error:', error.message);
        throw new Error(`Cannot convert ${from} to ${to}. Please use valid currency codes like USD, EUR, INR, GBP`);
    }
}

// Get current rates for a currency
async function getRates(baseCurrency) {
    try {
        baseCurrency = baseCurrency.toUpperCase().trim();
        const response = await axios.get(`https://api.exchangerate.host/latest?base=${baseCurrency}`);
        
        if (response.data && response.data.rates) {
            return response.data.rates;
        } else {
            throw new Error('No rates found');
        }
    } catch (error) {
        throw new Error(`Cannot get rates for ${baseCurrency}`);
    }
}

// Parse natural language commands like "100 USD to EUR"
function parseNaturalQuery(text) {
    // Pattern: number + currency + to + currency
    const pattern = /(\d+(?:\.\d+)?)\s+([A-Za-z]{3})\s+to\s+([A-Za-z]{3})/i;
    const match = text.match(pattern);
    
    if (match) {
        return {
            amount: parseFloat(match[1]),
            from: match[2].toUpperCase(),
            to: match[3].toUpperCase()
        };
    }
    return null;
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
            `<b>Natural Language:</b>\n` +
            `Just type: <code>100 USD to EUR</code>\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Help command
    botInstance.help((ctx) => {
        ctx.replyWithHTML(
            `<b>📖 How to use:</b>\n\n` +
            `<b>Method 1 - Command:</b>\n` +
            `<code>/convert USD EUR 100</code>\n\n` +
            `<b>Method 2 - Natural Language:</b>\n` +
            `<code>100 USD to EUR</code>\n\n` +
            `<b>Get exchange rates:</b>\n` +
            `<code>/rates USD</code>\n\n` +
            `<b>Supported currencies:</b>\n` +
            `USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, and 160+ more!\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Convert command
    botInstance.command('convert', async (ctx) => {
        const args = ctx.message.text.split(' ');
        // Handle /convert USD EUR 100 or /convert USD EUR
        let from, to, amount = 1;
        
        if (args.length >= 3) {
            from = args[1];
            to = args[2];
            amount = args[3] ? parseFloat(args[3]) : 1;
        } else {
            return ctx.reply('❌ Usage: /convert USD EUR 100\nExample: /convert INR USD 500');
        }
        
        if (isNaN(amount)) {
            return ctx.reply('❌ Please enter a valid number for amount.\nExample: /convert USD EUR 100');
        }
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const result = await getExchangeRate(from, to, amount);
            ctx.replyWithHTML(
                `💱 <b>Currency Conversion</b>\n\n` +
                `💰 ${result.amount.toFixed(2)} ${result.from} = ${result.result.toFixed(2)} ${result.to}\n` +
                `📊 Rate: 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\n\n` +
                `<i>Powered By Introspection007</i>`
            );
        } catch (error) {
            ctx.reply(`❌ ${error.message}\n\nExample: /convert INR USD 500`);
        }
    });

    // Rates command
    botInstance.command('rates', async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('❌ Usage: /rates USD\nExample: /rates INR');
        }
        
        const baseCurrency = args[1];
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const rates = await getRates(baseCurrency);
            const commonCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
            
            let message = `📊 <b>Exchange Rates for ${baseCurrency.toUpperCase()}</b>\n\n`;
            
            for (const curr of commonCurrencies) {
                if (rates[curr]) {
                    message += `💵 ${curr}: ${rates[curr].toFixed(4)}\n`;
                }
            }
            
            message += `\n<i>Powered By Introspection007</i>`;
            ctx.replyWithHTML(message);
        } catch (error) {
            ctx.reply(`❌ ${error.message}\n\nExample: /rates USD`);
        }
    });

    // Handle natural language messages (like "100 USD to EUR")
    botInstance.on('text', async (ctx) => {
        const text = ctx.message.text;
        
        // Skip if it's a command
        if (text.startsWith('/')) return;
        
        // Try to parse natural language
        const parsed = parseNaturalQuery(text);
        
        if (parsed) {
            await ctx.replyWithChatAction('typing');
            try {
                const result = await getExchangeRate(parsed.from, parsed.to, parsed.amount);
                ctx.replyWithHTML(
                    `💱 <b>Currency Conversion</b>\n\n` +
                    `💰 ${result.amount.toFixed(2)} ${result.from} = ${result.result.toFixed(2)} ${result.to}\n` +
                    `📊 Rate: 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\n\n` +
                    `<i>Powered By Introspection007</i>`
                );
            } catch (error) {
                ctx.reply(`❌ ${error.message}\n\nTry: /convert ${parsed.from} ${parsed.to} ${parsed.amount}`);
            }
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
